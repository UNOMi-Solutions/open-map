import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";
import xssClean from "xss-clean/lib/xss.js";
import hpp from "hpp";
import compression from "compression";
import { generalLimiter } from "./rateLimiter.js";

function sanitizeBodyAndParams(sanitizeFn) {
  return (req, res, next) => {
    if (req.body) {
      req.body = sanitizeFn(req.body);
    }
    if (req.params) {
      req.params = sanitizeFn(req.params);
    }
    next();
  };
}

/**
 * Combines multiple middleware to enforce a secure Express environment.
 * Note: CORS is handled separately in index.js so it is not duplicated here.
 * Express 5 makes req.query read-only — sanitize body/params only.
 */
export default function secureApp(app) {
  // Secure HTTP headers
  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );

  app.use(sanitizeBodyAndParams(mongoSanitize.sanitize));
  app.use(sanitizeBodyAndParams(xssClean.clean));

  // Prevent HTTP parameter pollution on POST bodies only
  app.use(hpp({ checkQuery: false }));

  // Compress responses
  app.use(compression());

  // Global rate limiter on all API routes
  app.use("/api", generalLimiter);
}
