// middleware/errorHandler.js
export default function errorHandler(err, req, res, next) {
  console.error(`[ERROR] ${req.method} ${req.originalUrl} -> ${err.message}`);

  res.status(err.status || 500).json({
    success: false,
    message: "An unexpected error occurred. Please try again later.",
    error: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
}
