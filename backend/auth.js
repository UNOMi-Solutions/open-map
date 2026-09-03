import express from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import User from "./models/User.js";
import Profile from "./models/Profile.js";
import requireAuth from "./middleware/requireAuth.js";
import stripe from "./utils/stripeClient.js";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendEmailChangeVerification,
} from "./emailService.js";

const router = express.Router();

/** Password reset links are single-use and short-lived. */
const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000;

/** How long a pending email-change confirmation link stays valid. */
const EMAIL_CHANGE_TTL_MS = 24 * 60 * 60 * 1000;

/** The account shape returned to the client. Never includes the password hash. */
function serializeUser(user) {
  return {
    name: user.name || "",
    email: user.email,
    verified: !!user.verified,
    plan: user.plan || null,
    subscriptionStatus: user.subscriptionStatus || null,
    subscriptionInterval: user.subscriptionInterval || null,
    currentPeriodEnd: user.currentPeriodEnd || null,
    cancelAtPeriodEnd: !!user.cancelAtPeriodEnd,
    // Set while an email change is awaiting confirmation, so the settings page
    // can show "pending confirmation" next to the old address.
    pendingEmail: user.pendingEmail || null,
  };
}

/** Mirrors the password rules enforced by the signup/reset UI. */
function validatePassword(password) {
  if (typeof password !== "string" || password.length < 8) {
    return "Password must be at least 8 characters long.";
  }
  if (password.length > 64) return "Password must be less than 64 characters long.";
  if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter.";
  if (!/[0-9]/.test(password)) return "Password must contain at least one number.";
  if (!/[^a-zA-Z0-9 ]/.test(password)) return "Password must contain at least one special character.";
  return "";
}

function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

// Returns the currently authenticated user (resolved from the JWT). Used by the
// frontend to restore the session — including the plan — after a page refresh.
router.get("/me", requireAuth, (req, res) => {
  res.status(200).json({ user: serializeUser(req.authUser) });
});

// Updates the display name. The only account field simple enough to change
// without a confirmation step.
router.patch("/me", requireAuth, async (req, res) => {
  const { name } = req.body || {};
  if (typeof name !== "string") {
    return res.status(400).json({ message: "A name is required." });
  }

  const trimmed = name.trim();
  if (trimmed.length > 80) {
    return res.status(400).json({ message: "Name must be 80 characters or fewer." });
  }

  try {
    const user = req.authUser;
    user.name = trimmed;
    await user.save();
    return res.status(200).json({ user: serializeUser(user) });
  } catch (err) {
    console.error("Update name error:", err);
    return res.status(500).json({ message: "Could not update your name. Please try again." });
  }
});

// Step 1 of an email change: verify the password, then mail a confirmation link
// to the new address. The account keeps its current email until that link is
// opened, so a typo can't lock the user out.
router.post("/me/email", requireAuth, async (req, res) => {
  const { email, password } = req.body || {};

  if (!isValidEmail(email)) {
    return res.status(400).json({ message: "Please enter a valid email address." });
  }
  if (!password) {
    return res.status(400).json({ message: "Please enter your current password." });
  }

  const newEmail = email.trim().toLowerCase();
  const user = req.authUser;

  if (newEmail === user.email) {
    return res.status(400).json({ message: "That's already your email address." });
  }

  try {
    if (!(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "That password is incorrect." });
    }

    const taken = await User.findOne({ email: newEmail });
    if (taken) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }

    const token = crypto.randomBytes(32).toString("hex");
    user.pendingEmail = newEmail;
    user.emailChangeToken = token;
    user.emailChangeTokenExpires = new Date(Date.now() + EMAIL_CHANGE_TTL_MS);
    await user.save();

    await sendEmailChangeVerification(newEmail, token);

    return res.status(200).json({
      message: `Confirmation sent to ${newEmail}. Your email changes once you open that link.`,
      user: serializeUser(user),
    });
  } catch (err) {
    console.error("Email change request error:", err);
    return res.status(500).json({ message: "Could not start the email change. Please try again." });
  }
});

// Step 2 of an email change: the link in the new inbox lands here. Public by
// design — the token is the proof, and the user may open it on another device.
router.get("/verify-email-change", async (req, res) => {
  const { token } = req.query;
  // Same guard as /verify and /reset: a non-string token (absent, or repeated
  // in the query string) must never reach the findOne filter.
  if (typeof token !== "string" || !token)
    return res.status(400).json({ message: "Missing confirmation token." });

  try {
    const user = await User.findOne({ emailChangeToken: token });
    if (!user || !user.pendingEmail) {
      return res.status(400).json({ message: "Invalid or expired confirmation link." });
    }
    if (user.emailChangeTokenExpires && user.emailChangeTokenExpires < new Date()) {
      return res.status(400).json({ message: "This confirmation link has expired." });
    }

    // Someone else may have claimed the address while this link sat unopened.
    const taken = await User.findOne({ email: user.pendingEmail });
    if (taken && !taken._id.equals(user._id)) {
      user.pendingEmail = undefined;
      user.emailChangeToken = undefined;
      user.emailChangeTokenExpires = undefined;
      await user.save();
      return res.status(409).json({ message: "An account with this email already exists." });
    }

    user.email = user.pendingEmail;
    // The address is proven reachable by the fact this link was opened.
    user.verified = true;
    user.pendingEmail = undefined;
    user.emailChangeToken = undefined;
    user.emailChangeTokenExpires = undefined;
    await user.save();

    return res.status(200).json({ message: "Email updated.", email: user.email });
  } catch (err) {
    console.error("Email change confirm error:", err);
    return res.status(500).json({ message: "Could not confirm your new email. Please try again." });
  }
});

// Changing a password from the settings page reuses the login flow's reset
// email, so there is exactly one "set a new password" screen in the product.
router.post("/me/password-reset", requireAuth, async (req, res) => {
  try {
    const user = req.authUser;
    const token = crypto.randomBytes(32).toString("hex");
    user.passwordResetToken = token;
    // POST /auth/reset only accepts unexpired tokens, so this must be stamped
    // here too or the link mailed from the settings page is dead on arrival.
    user.passwordResetExpires = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
    await user.save();

    await sendPasswordResetEmail(user.email, token);

    return res.status(200).json({ message: `Password reset link sent to ${user.email}.` });
  } catch (err) {
    console.error("Account password reset error:", err);
    return res.status(500).json({ message: "Could not send the reset email. Please try again." });
  }
});

// Permanently deletes the account: cancels any Stripe subscription immediately,
// removes the user's saved map profiles, then the user document itself.
router.delete("/me", requireAuth, async (req, res) => {
  const { password } = req.body || {};
  if (!password) {
    return res.status(400).json({ message: "Please enter your password to delete your account." });
  }

  const user = req.authUser;

  try {
    if (!(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "That password is incorrect." });
    }

    // Billing must be verifiably stopped *before* the user document goes away,
    // because that document holds the only link back to the Stripe records. If
    // we delete it while the subscription is still live, the card keeps getting
    // charged and nothing can trace the charge back to an account.
    if (user.stripeSubscriptionId) {
      if (!stripe) {
        return res.status(503).json({
          message:
            "We can't reach our payment provider to stop your subscription, so your account wasn't deleted. Please try again shortly.",
        });
      }

      try {
        await stripe.subscriptions.cancel(user.stripeSubscriptionId);
      } catch (err) {
        // A subscription Stripe no longer knows about is already stopped, so
        // that specific failure is safe to ignore. Anything else (outage,
        // network, bad key) leaves it billing and must abort the deletion.
        const alreadyStopped =
          err?.code === "resource_missing" ||
          err?.raw?.code === "resource_missing" ||
          /no such subscription|already been canceled|already canceled/i.test(err?.message || "");

        if (!alreadyStopped) {
          console.error("Stripe cancel during account deletion failed:", err.message);
          return res.status(502).json({
            message:
              "We couldn't stop your subscription with our payment provider, so your account wasn't deleted and you haven't been charged anything new. Please try again in a moment.",
          });
        }

        console.warn("Subscription already gone at Stripe during deletion:", err.message);
      }
    }

    await Profile.deleteMany({ userId: user._id });
    await User.deleteOne({ _id: user._id });

    return res.status(200).json({ success: true, message: "Your account has been deleted." });
  } catch (err) {
    console.error("Delete account error:", err);
    return res.status(500).json({ message: "Could not delete your account. Please try again." });
  }
});

// Step 1: Register user
router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: "Email and password are required." });

  const trimmedName = typeof name === "string" ? name.trim() : "";
  if (!trimmedName) return res.status(400).json({ message: "Please enter your name." });
  if (trimmedName.length > 80)
    return res.status(400).json({ message: "Name must be 80 characters or fewer." });

  try {
    const existing = await User.findOne({ email });
    if (existing)
      return res.status(409).json({ message: "An account with this email already exists." });

    const hashedPassword = await bcrypt.hash(password, 12);
    const token = crypto.randomBytes(32).toString("hex");

    await User.create({
      name: trimmedName,
      email,
      password: hashedPassword,
      verified: false,
      verificationToken: token,
    });

    await sendVerificationEmail(email, token);
    res.status(200).json({ message: "Verification email sent. Please check your inbox." });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ message: "Registration failed. Please try again." });
  }
});

// Step 2: Verify email
router.get("/verify", async (req, res) => {
  const { token } = req.query;
  // Mongoose strips undefined values out of query filters, so an absent token
  // would turn this into findOne({}) and verify an arbitrary account.
  if (typeof token !== "string" || !token)
    return res.status(400).json({ message: "Invalid or expired token." });
  try {
    const user = await User.findOne({ verificationToken: token });
    if (!user)
      return res.status(400).json({ message: "Invalid or expired token." });

    user.verified = true;
    user.verificationToken = undefined;
    await user.save();

    res.status(200).json({ message: "Verification success.", email: user.email});
  } catch (err) {
    console.error("Verification error:", err);
    res.status(500).json({ message: "Verification failed. Please try again." });
  }
});

// THOUGHT PROCESS FOR THIS SECTION

router.post("/reset_request", async (req, res) => {
  const { email }= req.body;
  try {
    const user = await User.findOne({ email: email });
    if (!user) {
      return res.status(200).json({ message: "Email to reset user password sent"});
    }
    const token = crypto.randomBytes(32).toString("hex");
    user.passwordResetToken = token;
    // Matches the "expires in 15 minutes" wording in sendPasswordResetEmail.
    user.passwordResetExpires = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
    await user.save();

    await sendPasswordResetEmail(email, token);

    res.status(200).json({ message: "Email to reset user password sent"});
  } catch (err) {
    console.error("Reset request error:", err);
    res.status(500).json({ message: "Something went wrong on server side. Please try again" });
  }
});

router.post("/reset", async (req, res) => {
  const { token } = req.query;
  const { password } = req.body;
  // Without this guard Mongoose drops the undefined token from the filter and
  // findOne({}) matches an arbitrary user, letting anyone reset their password.
  if (typeof token !== "string" || !token) {
    return res.status(400).json({ message: "Invalid or expired token" });
  }
  if (typeof password !== "string" || !password) {
    return res.status(400).json({ message: "A new password is required" });
  }
  try {
    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: new Date() },
    });
    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    const invalid = validatePassword(password);
    if (invalid) {
      return res.status(400).json({ message: invalid });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    // Unset rather than blank out — an empty string would still be matchable.
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.password = hashedPassword;
    await user.save();

    res.status(200).json({ message: "Password reset initiated" });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ message: "Something went wrong on the server side while resetting password. Please try again." });
  }
});

export default router;
