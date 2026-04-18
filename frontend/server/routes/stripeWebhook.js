import express from "express";
import Stripe from "stripe";
import { sendPaymentConfirmation } from "../emailService.js";
import dotenv from "dotenv";
dotenv.config();

const router = express.Router();
const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey ? new Stripe(stripeKey) : null;

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
        let subscription = null;
        let customer = null;
        try {
          if (session.subscription) {
            subscription = await stripe.subscriptions.retrieve(session.subscription);
          }
          if (session.customer) {
            customer = await stripe.customers.retrieve(session.customer);
          }
        } catch (err) {
          console.warn("Could not retrieve subscription/customer:", err.message);
        }

        const customerEmail = session.customer_details?.email || session.customer_email;
        let planName = "Subscription";
        let unitAmount = session.amount_total || null;
        let currency = session.currency || "usd";
        let interval = "one-time";

        if (session.mode === "subscription" && subscription) {
          unitAmount = subscription?.items?.data?.[0]?.price?.unit_amount || null;
          currency = subscription?.items?.data?.[0]?.price?.currency || "usd";
          interval = subscription?.items?.data?.[0]?.price?.recurring?.interval || "month";
          const productId = subscription?.items?.data?.[0]?.price?.product;
          if (productId) {
            try {
              const product = await stripe.products.retrieve(productId);
              planName = product.name || planName;
            } catch (e) {
              planName = String(productId);
            }
          }
        } else if (session.mode === "payment") {
          planName = "One-time payment";
        }

        if (customerEmail) {
          await sendPaymentConfirmation(customerEmail, {
            planName,
            amount: unitAmount ? (unitAmount / 100).toFixed(2) : "0.00",
            currency,
            interval,
            subscriptionId: subscription?.id || "",
            customerId: customer?.id || session.customer || "",
          });
          console.log(`Payment confirmation email sent to ${customerEmail}`);
        } else {
          console.warn("No customer email on session; skipping confirmation email.");
        }
        break;
      }

      case "invoice.payment_succeeded":
        console.log("invoice.payment_succeeded:", event.data.object.id);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error("Error handling webhook event:", err);
    return res.status(200).json({ received: true });
  }

  res.json({ received: true });
});

export default router;
