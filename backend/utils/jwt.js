import dotenv from "dotenv";
import jwt from "jsonwebtoken";

dotenv.config();

const JWT_EXPIRES_IN = "30d";

/**
 * Signs a JWT identifying a logged-in OpenMap user. The token carries the
 * user id (used to load the fresh user document on protected routes) plus a
 * couple of convenience claims. Never trust the plan claim for enforcement —
 * always re-read it from the database.
 */
export function signUserToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }
  return jwt.sign(
    { id: user._id.toString(), email: user.email, plan: user.plan || null },
    secret,
    { expiresIn: JWT_EXPIRES_IN }
  );
}
