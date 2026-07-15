const PLACEHOLDER_PREFIXES = ["your-", "replace-me", "changeme"];

/**
 * Returns an env var value or sends 503 if missing / still a placeholder.
 */
export function requireEnv(res, key, label = key) {
  const value = process.env[key]?.trim();
  if (!value) {
    res.status(503).json({
      error: `${label} is not configured. Set ${key} in backend/.env (see .env.example).`,
    });
    return null;
  }

  const lower = value.toLowerCase();
  if (PLACEHOLDER_PREFIXES.some((p) => lower.startsWith(p))) {
    res.status(503).json({
      error: `${label} is still a placeholder. Replace ${key} in backend/.env with your real API key.`,
    });
    return null;
  }

  return value;
}
