import dotenv from "dotenv";
import Stripe from "stripe";

dotenv.config();

/**
 * Shared Stripe client, or `null` when STRIPE_SECRET_KEY isn't configured
 * (local dev without billing). Callers must handle the null case rather than
 * assuming Stripe is available.
 */
const stripeKey = process.env.STRIPE_SECRET_KEY;
export const stripe = stripeKey ? new Stripe(stripeKey) : null;

export default stripe;
