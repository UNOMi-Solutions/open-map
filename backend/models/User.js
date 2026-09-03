import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  // Display name shown in the account menu. Optional — accounts created before
  // the settings page existed (and signups, which only collect credentials)
  // have no name until the user sets one.
  name: {
    type: String,
    trim: true,
    maxlength: 80,
  },
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
  // A requested new email address. It only replaces `email` once the user
  // clicks the confirmation link sent to that address, so a typo or a hijacked
  // session can never lock someone out of their own account.
  pendingEmail: {
    type: String,
    lowercase: true,
    trim: true,
  },
  emailChangeToken: {
    type: String,
  },
  emailChangeTokenExpires: {
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
  // True after the user unsubscribes: the plan stays active until
  // `currentPeriodEnd`, then Stripe deletes the subscription.
  cancelAtPeriodEnd: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const User = mongoose.model("User", userSchema);
export default User;
