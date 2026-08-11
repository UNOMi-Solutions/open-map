import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
  },
  verified: {
    type: Boolean,
    default: false,
  },
  verificationToken: {
    type: String,
  },
  passwordResetToken: {
    type: String,
  },
  // Reset links are only valid until this instant; checked in POST /auth/reset.
  passwordResetExpires: {
    type: Date,
  },
  stripeCustomerId: {
    type: String,
  },
  stripeSubscriptionId: {
    type: String,
  },
  // Plan key matching backend/stripePriceMap.js (e.g. "premium", "enterprise", "agency").
  plan: {
    type: String,
    enum: ["freeTrial", "premium", "enterprise", "agency", null],
    default: null,
  },
  // Billing interval for the active subscription ("monthly" | "yearly").
  subscriptionInterval: {
    type: String,
  },
  // Mirrors Stripe subscription.status (active, trialing, past_due, canceled, etc.).
  subscriptionStatus: {
    type: String,
  },
  // End of the current paid period; used to gate premium access.
  currentPeriodEnd: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const User = mongoose.model("User", userSchema);
export default User;
