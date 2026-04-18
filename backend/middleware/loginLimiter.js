// middleware/loginLimiter.js

/**
 * In-memory login attempt tracker with lockout
 * Locks user/IP for 15 minutes after 5 failed login attempts.
 */
const loginAttempts = {}; // { ip: { count, lockUntil } }

const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes

export default function loginLimiter(req, res, next) {
  const identifier = req.ip;
  const now = Date.now();

  if (!loginAttempts[identifier]) {
    loginAttempts[identifier] = { count: 0, lockUntil: null };
  }

  const user = loginAttempts[identifier];

  // If locked
  if (user.lockUntil && now < user.lockUntil) {
    const remaining = Math.ceil((user.lockUntil - now) / 60000);
    return res.status(429).json({
      success: false,
      message: `Too many failed login attempts. Try again in ${remaining} minutes.`,
    });
  }

  // Hook response to update attempt counts
  res.on("finish", () => {
    if (res.statusCode === 401 || res.statusCode === 403) {
      user.count += 1;
      if (user.count >= MAX_ATTEMPTS) {
        user.lockUntil = now + LOCKOUT_TIME;
        console.warn(`[LOCKOUT] ${identifier} locked for 15 minutes`);
      }
    } else if (res.statusCode === 200) {
      user.count = 0;
      user.lockUntil = null;
    }
  });

  next();
}
