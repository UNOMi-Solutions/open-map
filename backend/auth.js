import express from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import User from "./models/User.js";
import { sendVerificationEmail } from "./emailService.js";

const router = express.Router();

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
  try {
    const user = await User.findOne({ verificationToken: token });
    if (!user)
      return res.status(400).json({ message: "Invalid or expired token." });

    user.verified = true;
    user.verificationToken = undefined;
    await user.save();

    res.status(200).json({ message: `Email ${user.email} successfully verified!` });
  } catch (err) {
    console.error("Verification error:", err);
    res.status(500).json({ message: "Verification failed. Please try again." });
  }
});

export default router;
