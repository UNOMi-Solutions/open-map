import express from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import User from "./models/User.js";
import requireAuth from "./middleware/requireAuth.js";
import { sendVerificationEmail, sendPasswordResetEmail } from "./emailService.js";

const router = express.Router();

/** Password reset links are single-use and short-lived. */
const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000;

// Returns the currently authenticated user (resolved from the JWT). Used by the
// frontend to restore the session — including the plan — after a page refresh.
router.get("/me", requireAuth, (req, res) => {
  const user = req.authUser;
  res.status(200).json({
    user: {
      email: user.email,
      verified: !!user.verified,
      plan: user.plan || null,
      subscriptionStatus: user.subscriptionStatus || null,
      subscriptionInterval: user.subscriptionInterval || null,
    },
  });
});

// Step 1: Register user
router.post("/register", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: "Email and password are required." });

  try {
    const existing = await User.findOne({ email });
    if (existing)
      return res.status(409).json({ message: "An account with this email already exists." });

    const hashedPassword = await bcrypt.hash(password, 12);
    const token = crypto.randomBytes(32).toString("hex");

    await User.create({
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
