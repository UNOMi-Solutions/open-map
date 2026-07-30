import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

dotenv.config();

/**
 * Requires a valid logged-in user. Verifies the Bearer JWT issued at login,
 * then loads the matching user document and attaches it as `req.authUser`.
 *
 * This is stricter than the shared API-key middleware (`middleware/auth.js`):
 * it identifies *which* user is making the request, which is what per-user
 * features like saved profiles and tier limits need. The freshly-loaded user
 * document is the source of truth for the plan (the token's plan claim may be
 * stale after an upgrade/downgrade).
 */
const requireAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ success: false, message: "Invalid or expired token" });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ success: false, message: "User no longer exists" });
    }

    req.authUser = user;
    next();
  } catch (error) {
    console.error("[REQUIRE_AUTH] Unexpected error:", error);
    res.status(500).json({ success: false, message: "Authentication failure" });
  }
};

export default requireAuth;
