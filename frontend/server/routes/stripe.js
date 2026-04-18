import { Router } from "express";
import Stripe from "stripe";
import dotenv from "dotenv";
import { PRICE_MAP } from "../stripePriceMap.js";

dotenv.config();
const router = Router();
const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey ? new Stripe(stripeKey) : null;

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

router.post("/create-checkout-session", async (req, res) => {
  if (!stripe) return res.status(503).json({ error: "Stripe not configured. Set STRIPE_SECRET_KEY in .env" });
  try {
    const { plan, interval, customer_email, successUrl, cancelUrl, metadata } = req.body;

    if (!plan || !interval) {
      return res.status(400).json({ error: "Missing plan or interval" });
    }

    const planEntry = PRICE_MAP[plan];
    if (!planEntry) return res.status(400).json({ error: "Invalid plan" });

    const priceId = planEntry[interval];
    if (!priceId) {
      if (plan === "freeTrial") {
        const hostBase = process.env.DOMAIN || process.env.FRONTEND_URL || `${req.protocol}://${req.get("host")}`;
        return res.json({ url: `${hostBase}/signup?plan=freeTrial`, isFreeTrial: true });
      }
      return res.status(400).json({ error: "Invalid interval for plan" });
    }

    const hostBase = process.env.DOMAIN || `${req.protocol}://${req.get("host")}`;
    const success = successUrl || `${hostBase}/payment-success?session_id={CHECKOUT_SESSION_ID}`;
    const cancel = cancelUrl || `${hostBase}/payment-cancelled`;

    let sessionParams = {
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: success,
      cancel_url: cancel,
      metadata: metadata || {},
    };

    const email = customer_email || "guest@example.com";
    const customer = await stripe.customers.create({ email });
    sessionParams.customer = customer.id;

    const session = await stripe.checkout.sessions.create(sessionParams);

    return res.json({ url: session.url, id: session.id });
  } catch (err) {
    console.error("create-checkout-session error:", err);
    return res.status(500).json({ error: err.message });
  }
});

router.post("/create-one-time-session", async (req, res) => {
  if (!stripe) return res.status(503).json({ error: "Stripe not configured. Set STRIPE_SECRET_KEY in .env" });
  try {
    const { amount, email, successUrl, cancelUrl } = req.body;
    if (!amount || amount < 50) {
      return res.status(400).json({ error: "Amount required (min 50 cents)" });
    }
    const hostBase = process.env.DOMAIN || process.env.FRONTEND_URL || "http://localhost:3000";
    const success = successUrl || `${hostBase}/payment-success?session_id={CHECKOUT_SESSION_ID}`;
    const cancel = cancelUrl || `${hostBase}/payment-cancelled`;

    const customer = await stripe.customers.create({ email: email || "guest@example.com" });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: { name: "OpenMap Product" },
          unit_amount: Math.round(amount),
        },
        quantity: 1,
      }],
      mode: "payment",
      customer: customer.id,
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
