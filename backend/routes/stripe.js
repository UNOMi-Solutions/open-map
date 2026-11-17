import { Router } from "express";
import Stripe from "stripe";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { PRICE_MAP } from "../stripePriceMap.js";
import User from "../models/User.js";
import requireAuth from "../middleware/requireAuth.js";

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

    // Only verified accounts may purchase a paid plan. We enforce this here
    // (not just in the UI) because the frontend gate can be bypassed. Skipped
    // when no database is connected (local dev without MONGODB_URI).
    if (dbReady()) {
      const purchasingUser = customer_email ? await User.findOne({ email: customer_email }) : null;
      if (!purchasingUser || !purchasingUser.verified) {
        return res.status(403).json({
          error: "Please verify your email before subscribing to a plan.",
          code: "EMAIL_NOT_VERIFIED",
        });
      }
    }

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

/**
 * Describes the logged-in user's plan for the account settings page.
 *
 * `isPaid` is what the UI keys off to decide between "View Plans" and
 * "Unsubscribe": a user is only on a paid plan when they have a live Stripe
 * subscription, so an account with `plan: null` (or a cancelled one) is
 * treated as a free trial.
 */
router.get("/subscription", requireAuth, (req, res) => {
  const user = req.authUser;
  const planKey = user.plan && PRICE_MAP[user.plan] ? user.plan : null;
  const isPaid =
    !!planKey &&
    planKey !== "freeTrial" &&
    !!user.stripeSubscriptionId &&
    user.subscriptionStatus !== "canceled";

  return res.json({
    plan: planKey,
    displayName: isPaid ? PRICE_MAP[planKey].displayName : "Free Trial",
    isPaid,
    interval: user.subscriptionInterval || null,
    status: user.subscriptionStatus || null,
    currentPeriodEnd: user.currentPeriodEnd || null,
    cancelAtPeriodEnd: !!user.cancelAtPeriodEnd,
  });
});

/**
 * Unsubscribes at the end of the paid period rather than immediately, so the
 * user keeps the access they've already paid for. Stripe emits
 * `customer.subscription.deleted` when the period ends, which clears the plan.
 */
router.post("/cancel-subscription", requireAuth, async (req, res) => {
  if (!stripe) return res.status(503).json({ error: "Stripe not configured." });

  const user = req.authUser;
  if (!user.stripeSubscriptionId) {
    return res.status(400).json({ error: "You don't have an active subscription to cancel." });
  }

  try {
    const subscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    user.cancelAtPeriodEnd = true;
    user.subscriptionStatus = subscription.status;
    const periodEnd = subscription.current_period_end || subscription.items?.data?.[0]?.current_period_end;
    if (periodEnd) user.currentPeriodEnd = new Date(periodEnd * 1000);
    await user.save();

    return res.json({
      success: true,
      cancelAtPeriodEnd: true,
      currentPeriodEnd: user.currentPeriodEnd || null,
    });
  } catch (err) {
    console.error("cancel-subscription error:", err);
    return res.status(500).json({ error: "Could not cancel your subscription. Please try again." });
  }
});

// Undoes a pending cancellation while the subscription is still in its paid period.
router.post("/resume-subscription", requireAuth, async (req, res) => {
  if (!stripe) return res.status(503).json({ error: "Stripe not configured." });

  const user = req.authUser;
  if (!user.stripeSubscriptionId) {
    return res.status(400).json({ error: "You don't have a subscription to resume." });
  }

  try {
    const subscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });

    user.cancelAtPeriodEnd = false;
    user.subscriptionStatus = subscription.status;
    await user.save();

    return res.json({ success: true, cancelAtPeriodEnd: false });
  } catch (err) {
    console.error("resume-subscription error:", err);
    return res.status(500).json({ error: "Could not resume your subscription. Please try again." });
  }
});

/**
 * Upgrades or downgrades an existing subscription in place.
 *
 * This swaps the price on the live Stripe subscription rather than sending the
 * user back through checkout — a second checkout would create a second
 * subscription and bill them twice. Stripe prorates the difference onto the
 * next invoice, so an upgrade takes effect immediately and a downgrade credits
 * the unused time.
 */
router.post("/change-plan", requireAuth, async (req, res) => {
  if (!stripe) return res.status(503).json({ error: "Stripe not configured." });

  const { plan, interval } = req.body || {};
  const planEntry = PRICE_MAP[plan];

  if (!planEntry) return res.status(400).json({ error: "Invalid plan." });
  if (plan === "freeTrial") {
    return res.status(400).json({
      error: "To move to the free trial, cancel your subscription instead.",
      code: "USE_CANCEL",
    });
  }

  const priceId = planEntry[interval];
  if (!priceId) return res.status(400).json({ error: "Invalid billing interval for this plan." });

  const user = req.authUser;
  if (!user.stripeSubscriptionId || user.subscriptionStatus === "canceled") {
    return res.status(400).json({
      error: "You don't have an active subscription to change.",
      code: "NO_SUBSCRIPTION",
    });
  }

  try {
    const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
    const item = subscription.items?.data?.[0];
    if (!item) return res.status(400).json({ error: "Your subscription has no billable item." });

    if (item.price?.id === priceId) {
      return res.status(400).json({ error: "You're already on that plan." });
    }

    const updated = await stripe.subscriptions.update(user.stripeSubscriptionId, {
      items: [{ id: item.id, price: priceId }],
      proration_behavior: "create_prorations",
      // Switching plans is an active choice to stay, so drop any pending cancel.
      cancel_at_period_end: false,
    });

    user.plan = plan;
    user.subscriptionInterval = interval;
    user.subscriptionStatus = updated.status;
    user.cancelAtPeriodEnd = false;
    const periodEnd = updated.current_period_end || updated.items?.data?.[0]?.current_period_end;
    if (periodEnd) user.currentPeriodEnd = new Date(periodEnd * 1000);
    await user.save();

    return res.json({
      success: true,
      plan,
      interval,
      displayName: planEntry.displayName,
      currentPeriodEnd: user.currentPeriodEnd || null,
    });
  } catch (err) {
    console.error("change-plan error:", err);
    return res.status(500).json({ error: "Could not change your plan. Please try again." });
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
