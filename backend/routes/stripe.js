import { Router } from "express";
import Stripe from "stripe";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { PRICE_MAP } from "../stripePriceMap.js";
import User from "../models/User.js";

dotenv.config();

const router = Router();
const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey ? new Stripe(stripeKey) : null;

// True only when Mongoose has a live connection. Lets Stripe checkout work
// without a database (e.g. local testing without MONGODB_URI) instead of
// hanging on buffered queries.
const dbReady = () => mongoose.connection?.readyState === 1;

/**
 * Finds (or creates) a Stripe customer for the given email and caches the
 * Stripe customer ID on the matching OpenMap user so we never create
 * duplicate customers across checkouts. Falls back to a plain Stripe customer
 * when no database is connected.
 */
async function resolveCustomer(email) {
  const user = email && dbReady() ? await User.findOne({ email }) : null;

  if (user?.stripeCustomerId) {
    return { customerId: user.stripeCustomerId, user };
  }

  const customer = await stripe.customers.create({ email: email || undefined });

  if (user) {
    user.stripeCustomerId = customer.id;
    await user.save();
  }

  return { customerId: customer.id, user };
}

// Public catalog of plans for rendering pricing UIs.
router.get("/plans", (req, res) => {
  const plans = {};
  for (const [key, val] of Object.entries(PRICE_MAP)) {
    plans[key] = {
      displayName: val.displayName,
      monthly: val.displayPriceMonthly,
      yearly: val.displayPriceYearly,
      features: val.features || [],
      hasCheckout: !!val.monthly || !!val.yearly,
    };
  }
  return res.json(plans);
});

// Creates a Stripe Checkout session for a recurring subscription plan.
router.post("/create-checkout-session", async (req, res) => {
  if (!stripe)
    return res.status(503).json({ error: "Stripe not configured. Set STRIPE_SECRET_KEY in .env" });

  try {
    const { plan, interval, customer_email, successUrl, cancelUrl, metadata } = req.body;

    if (!plan || !interval) {
      return res.status(400).json({ error: "Missing plan or interval" });
    }

    const planEntry = PRICE_MAP[plan];
    if (!planEntry) return res.status(400).json({ error: "Invalid plan" });

    const hostBase =
      process.env.DOMAIN || process.env.FRONTEND_URL || `${req.protocol}://${req.get("host")}`;

    const priceId = planEntry[interval];
    if (!priceId) {
      // The free trial has no Stripe price; route the user to signup instead.
      if (plan === "freeTrial") {
        return res.json({ url: `${hostBase}/signup?plan=freeTrial`, isFreeTrial: true });
      }
      return res.status(400).json({ error: "Invalid interval for plan" });
    }

    const success = successUrl || `${hostBase}/payment-success?session_id={CHECKOUT_SESSION_ID}`;
    const cancel = cancelUrl || `${hostBase}/payment-cancelled`;

    const { customerId } = await resolveCustomer(customer_email);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: success,
      cancel_url: cancel,
      customer: customerId,
      // Stored on the session so the webhook can persist the correct plan.
      metadata: { ...(metadata || {}), plan, interval },
    });

    return res.json({ url: session.url, id: session.id });
  } catch (err) {
    console.error("create-checkout-session error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Creates a Stripe Checkout session for a single one-time payment (in cents).
router.post("/create-one-time-session", async (req, res) => {
  if (!stripe)
    return res.status(503).json({ error: "Stripe not configured. Set STRIPE_SECRET_KEY in .env" });

  try {
    const { amount, email, successUrl, cancelUrl } = req.body;
    if (!amount || amount < 50) {
      return res.status(400).json({ error: "Amount required (min 50 cents)" });
    }

    const hostBase =
      process.env.DOMAIN || process.env.FRONTEND_URL || `${req.protocol}://${req.get("host")}`;
    const success = successUrl || `${hostBase}/payment-success?session_id={CHECKOUT_SESSION_ID}`;
    const cancel = cancelUrl || `${hostBase}/payment-cancelled`;

    const { customerId } = await resolveCustomer(email);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: "OpenMap Product" },
            unit_amount: Math.round(amount),
          },
          quantity: 1,
        },
      ],
      customer: customerId,
      success_url: success,
      cancel_url: cancel,
    });

    return res.json({ url: session.url, id: session.id });
  } catch (err) {
    console.error("create-one-time-session error:", err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
