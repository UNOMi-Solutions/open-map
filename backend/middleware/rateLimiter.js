// utils/rateLimiter.js
import rateLimit from "express-rate-limit";

/**
 * Rate limiter for global requests — limits total calls per 15 minutes.
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // each IP gets 100 requests
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
