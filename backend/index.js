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
import loginLimiter from "./middleware/loginLimiter.js";
import authRoutes from "./auth.js";

// Auth helpers
import User from "./models/User.js";
import bcrypt from "bcryptjs";

// Route imports
import censusRoutes from "./routes/census.js";
import crimeRoutes from "./routes/crime.js";
import economicsRoutes from "./routes/economics.js";
import environmentRoutes from "./routes/environment.js";
import healthRoutes from "./routes/health.js";
import lawEnforcementRoutes from "./routes/lawEnforcement.js";
import politicsRoutes from "./routes/politics.js";
import socialRoutes from "./routes/social.js";

// Connect to MongoDB
connectDB();

// Express setup
const app = express();
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
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
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
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }
    res.status(200).json({ success: true, message: "Login successful" });
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

// Documentation route
app.get("/", (req, res) => {
  res.status(200).sendFile(path.join(__dirname + "/index.html"));
});

// Global error handler (after all routes)
app.use(errorHandler);

// Server start
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Secure OpenMap backend running on port ${PORT}`));
