// Import dotenv for hidden variables
import dotenv from "dotenv";
dotenv.config();
import jwt from "jsonwebtoken";

/**
 * API key + optional JWT-based authentication
 * Ensures only authorized users or services can access protected routes.
 */
const apiKeyAuth = (req, res, next) => {
  try {
    const clientKey = req.headers["x-api-key"];
    const validKey = process.env.API_DEV_KEY;

    if (!clientKey) {
      console.warn(`[AUTH] Missing API key from ${req.ip}`);
      return res.status(401).json({ success: false, message: "Missing API Key" });
    }

    if (clientKey !== validKey) {
      console.warn(`[AUTH] Invalid API key attempt from ${req.ip}`);
      return res.status(403).json({ success: false, message: "Invalid API Key" });
    }

    // Optional JWT check (for future user accounts)
    const token = req.headers.authorization?.split(" ")[1];
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
      } catch {
        return res.status(401).json({ success: false, message: "Invalid or expired token" });
      }
    }

    req.client = { ip: req.ip, key: clientKey };
    next();
  } catch (error) {
    console.error("[AUTH] Unexpected error:", error);
    res.status(500).json({ success: false, message: "Auth middleware failure" });
  }
};

export default apiKeyAuth;
