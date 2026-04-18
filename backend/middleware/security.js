import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";
import xss from "xss-clean";
import hpp from "hpp";
import compression from "compression";
import { generalLimiter } from "./rateLimiter.js";

/**
 * Combines multiple middleware to enforce a secure Express environment.
 * Note: CORS is handled separately in index.js so it is not duplicated here.
 */
export default function secureApp(app) {
  // Secure HTTP headers
  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );

  // Sanitize MongoDB queries against injection
  app.use(mongoSanitize());

  // Sanitize user input against XSS
  app.use(xss());

  // Prevent HTTP parameter pollution
  app.use(hpp());

  // Compress responses
  app.use(compression());

  // Global rate limiter on all API routes
  app.use("/api", generalLimiter);
}
