// middleware/httpsRedirect.js

/**
 * Forces HTTPS in production environments.
 * Prevents man-in-the-middle attacks and session hijacking.
 */
export default function enforceHTTPS(req, res, next) {
  if (
    process.env.NODE_ENV === "production" &&
    req.headers["x-forwarded-proto"] !== "https"
  ) {
    return res.redirect(`https://${req.headers.host}${req.url}`);
  }
  next();
}
