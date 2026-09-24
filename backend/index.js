// Import dotenv for hidden variables
import dotenv from "dotenv";
dotenv.config();

// Core dependencies
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

// Database
import { connectDB } from "./db/connect.js";

// Security & middleware imports
import secureApp from "./middleware/security.js";
import enforceHTTPS from "./middleware/httpsRedirect.js";
import requestLogger from "./middleware/requestLogger.js";
import errorHandler from "./middleware/errorHandler.js";
import auth from "./middleware/auth.js";
import requireAuth from "./middleware/requireAuth.js";
import loginLimiter from "./middleware/loginLimiter.js";
import authRoutes, { buildAuthResponse } from "./auth.js";

// Auth helpers
import User from "./models/User.js";
import bcrypt from "bcryptjs";

// Route imports
import censusRoutes from "./routes/census.js";
import crimeRoutes, { warmCrimeCache } from "./routes/crime.js";
import economicsRoutes from "./routes/economics.js";
import environmentRoutes from "./routes/environment.js";
import healthRoutes from "./routes/health.js";
import lawEnforcementRoutes, { warmLawEnforcementCache } from "./routes/lawEnforcement.js";
import politicsRoutes from "./routes/politics.js";
import socialRoutes from "./routes/social.js";
import stripeRoutes from "./routes/stripe.js";
import stripeWebhook from "./routes/stripeWebhook.js";
import profileRoutes from "./routes/profiles.js";

// Connect to MongoDB
connectDB();

// signUserToken() throws without this, which would surface as an opaque 500 on
// every login. Warn loudly at boot instead of at the first sign-in attempt.
if (!process.env.JWT_SECRET) {
  console.error(
    "[startup] JWT_SECRET is not set — all logins will fail with a 500. Set it in backend/.env."
  );
}
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.warn(
    "[startup] GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set — Sign in with Google will fail until they are added to backend/.env."
  );
}

// Express setup
const app = express();
// Cloud Run terminates TLS and proxies the request, so without this every
// visitor looks like the same client IP and they share one rate-limit bucket.
app.set("trust proxy", 1);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CORS configuration
const productionOrigins = [
  "https://getopenmap.com",
  "https://www.getopenmap.com",
];

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (productionOrigins.includes(origin)) return true;
  // Vite may use 5173, 5174, 5175, … when ports are in use
  if (/^http:\/\/localhost:\d+$/.test(origin)) return true;
  if (/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) return true;
  return false;
}

const corsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked for origin: ${origin}`));
    }
  },
  // PATCH is required by the account settings page; omitting a method here
  // makes the browser reject the preflight before Express ever sees the call.
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  // x-api-key MUST be listed here or the browser rejects the preflight
  allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
  credentials: true,
};

app.use(cors(corsOptions));

// Respond 200 to all preflight OPTIONS requests so CORS checks pass
// Express 5 + path-to-regexp v8 rejects string wildcards ("*", "(.*)").
// Passing a RegExp bypasses path-to-regexp entirely and works correctly.
app.options(/.*/, cors(corsOptions));

// Force HTTPS in production
app.use(enforceHTTPS);

// Global security configuration (helmet, sanitization, rate limiting)
secureApp(app);

// Stripe webhook MUST receive the raw, unparsed body for signature verification,
// so it is mounted before express.json() and is intentionally not API-key protected
// (Stripe authenticates via the stripe-signature header instead).
app.use("/api/v1/stripe/webhook", express.raw({ type: "application/json" }), stripeWebhook);

// JSON parsing
app.use(express.json());

// Request logging
app.use(requestLogger);

// Public liveness check (Cloud Run / local dev — no API key)
app.get("/api/v1/health/ping", (req, res) => {
  res.status(200).json({ ok: true, service: "openmap-backend" });
});

// Auth routes (register + email verification)
app.use("/api/v1/auth", authRoutes);

// Login route
app.post("/api/auth/login", loginLimiter, async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }
    if (!user.password) {
      return res.status(401).json({
        success: false,
        message: "This account uses Google sign-in. Please continue with Google.",
      });
    }
    if (!(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }
    // Issue a JWT so per-user features (e.g. saved profiles) can identify the
    // caller on subsequent requests.
    res.status(200).json(buildAuthResponse(user));
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Enforce API Key on all data routes
app.use("/api/v1/census", auth, censusRoutes);
app.use("/api/v1/crime", auth, crimeRoutes);
app.use("/api/v1/economics", auth, economicsRoutes);
app.use("/api/v1/environment", auth, environmentRoutes);
app.use("/api/v1/health", auth, healthRoutes);
app.use("/api/v1/lawEnforcement", auth, lawEnforcementRoutes);
app.use("/api/v1/politics", auth, politicsRoutes);
app.use("/api/v1/social", auth, socialRoutes);

// Stripe checkout routes (API-key protected, like the data routes).
// The webhook is mounted separately above (before JSON parsing).
app.use("/api/v1/stripe", auth, stripeRoutes);

// Saved map profiles (per-user). Requires the shared API key AND a logged-in
// user (JWT), since profiles and their per-tier limits are user-specific.
app.use("/api/v1/profiles", auth, requireAuth, profileRoutes);

// Documentation route
app.get("/", (req, res) => {
  res.status(200).sendFile(path.join(__dirname + "/index.html"));
});

// Global error handler (after all routes)
app.use(errorHandler);

// Server start
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Secure OpenMap backend running on port ${PORT}`);

  // Build the slowest datasets in the background. Failures are non-fatal: the
  // routes rebuild on demand, and a crash here would take down the container.
  Promise.allSettled([warmCrimeCache(), warmLawEnforcementCache()]).then((results) => {
    for (const result of results) {
      if (result.status === "rejected") {
        console.warn("[startup] cache warm-up failed:", result.reason?.message);
      }
    }
  });
});
