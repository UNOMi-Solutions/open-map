import express from "express";
import Stripe from "stripe";
import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/User.js";
import { PRICE_TO_PLAN } from "../stripePriceMap.js";
import { sendPaymentConfirmation } from "../emailService.js";

dotenv.config();

const router = express.Router();
const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey ? new Stripe(stripeKey) : null;

// True only when Mongoose has a live connection, so webhook DB writes are
// skipped (rather than hanging) when no database is configured.
const dbReady = () => mongoose.connection?.readyState === 1;

/**
 * Resolves the OpenMap user tied to a Stripe event, preferring the
 * Stripe customer ID and falling back to the customer email.
 */
async function findUser({ customerId, email }) {
  if (!dbReady()) return null;
  if (customerId) {
    const byCustomer = await User.findOne({ stripeCustomerId: customerId });
    if (byCustomer) return byCustomer;
  }
  if (email) {
    return User.findOne({ email });
  }
  return null;
}

/**
 * Maps a Stripe subscription object onto the OpenMap user document and saves it.
 */
async function applySubscriptionToUser(user, subscription) {
  if (!user || !subscription) return;

  const item = subscription.items?.data?.[0];
  const priceId = item?.price?.id;
  const mapped = priceId ? PRICE_TO_PLAN[priceId] : null;
  const periodEnd = subscription.current_period_end || item?.current_period_end;

  user.stripeCustomerId = subscription.customer || user.stripeCustomerId;
  user.stripeSubscriptionId = subscription.id;
  user.subscriptionStatus = subscription.status;
  user.cancelAtPeriodEnd = !!subscription.cancel_at_period_end;
  if (mapped?.plan) user.plan = mapped.plan;
  if (mapped?.interval) user.subscriptionInterval = mapped.interval;
  if (periodEnd) user.currentPeriodEnd = new Date(periodEnd * 1000);

  await user.save();
}

router.post("/", async (req, res) => {
  if (!stripe) return res.status(503).send("Stripe not configured");

  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const customerEmail = session.customer_details?.email || session.customer_email;
        const customerId = session.customer || null;

        let subscription = null;
        if (session.subscription) {
          subscription = await stripe.subscriptions.retrieve(session.subscription);
        }

        const user = await findUser({ customerId, email: customerEmail });

        if (user) {
          if (subscription) {
            await applySubscriptionToUser(user, subscription);
          } else {
            // One-time payment: just make sure the customer ID is linked.
            if (customerId && !user.stripeCustomerId) {
              user.stripeCustomerId = customerId;
              await user.save();
            }
          }
        } else {
          console.warn(`No OpenMap user found for ${customerEmail || customerId}; skipping DB update.`);
        }

        // Build confirmation details from the metadata/subscription.
        const item = subscription?.items?.data?.[0];
        const planName =
          PRICE_TO_PLAN[item?.price?.id]?.plan ||
          session.metadata?.plan ||
          (session.mode === "payment" ? "One-time payment" : "Subscription");
        const unitAmount = item?.price?.unit_amount ?? session.amount_total ?? 0;
        const currency = item?.price?.currency || session.currency || "usd";
        const interval = item?.price?.recurring?.interval || session.metadata?.interval || "month";

        if (customerEmail) {
          await sendPaymentConfirmation(customerEmail, {
            planName,
            amount: (unitAmount / 100).toFixed(2),
            currency,
            interval,
          });
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const user = await findUser({ customerId: subscription.customer });
        await applySubscriptionToUser(user, subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const user = await findUser({ customerId: subscription.customer });
        if (user) {
          user.subscriptionStatus = "canceled";
          user.plan = null;
          user.stripeSubscriptionId = undefined;
          user.cancelAtPeriodEnd = false;
          await user.save();
        }
        break;
      }

      case "invoice.payment_succeeded":
        console.log("invoice.payment_succeeded:", event.data.object.id);
        break;

      default:
        console.log(`Unhandled Stripe event type: ${event.type}`);
    }
  } catch (err) {
    // Acknowledge receipt so Stripe doesn't retry indefinitely on our internal errors.
    console.error("Error handling webhook event:", err);
    return res.status(200).json({ received: true });
  }

  res.json({ received: true });
});

export default router;
