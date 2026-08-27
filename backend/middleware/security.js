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
 * Express 5 makes req.query a read-only getter. Legacy sanitizers mutate it,
 * which throws: "Cannot set property query of #<IncomingMessage>".
 */
function makeMutableQuery(req, _res, next) {
  Object.defineProperty(req, "query", {
    ...Object.getOwnPropertyDescriptor(req, "query"),
    value: req.query,
    writable: true,
    configurable: true,
    enumerable: true,
  });
  next();
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

  // Required before express-mongo-sanitize / xss-clean on Express 5
  app.use(makeMutableQuery);

  app.use(sanitizeBodyAndParams(mongoSanitize.sanitize));
  app.use(sanitizeBodyAndParams(xssClean.clean));

  // Prevent HTTP parameter pollution on POST bodies only
  app.use(hpp({ checkQuery: false }));

  // Compress responses
  app.use(compression());

  // Global rate limiter on all API routes
  app.use("/api", generalLimiter);
}
