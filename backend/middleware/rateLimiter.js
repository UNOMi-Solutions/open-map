// utils/rateLimiter.js
import rateLimit from "express-rate-limit";

/**
 * Rate limiter for global requests — limits total calls per 15 minutes.
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  // A single map session fires dozens of layer requests, so 100 locked out
  // ordinary visitors. Requires app.set("trust proxy") to count real clients.
  max: 600,
  message: {
    success: false,
    message: "Too many requests from this IP, please try again later.",
  },
  standardHeaders: true, 
  legacyHeaders: false,
});

/**
 * Optional stricter limiter for auth or OpenAI endpoints.
 */
export const strictLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    message: "Too many sensitive requests. Try again later.",
  },
});
