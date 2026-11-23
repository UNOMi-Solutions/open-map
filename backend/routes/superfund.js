import { Router } from "express";
import { getSuperfundBoundary, getSuperfundSites, isSuperfundSiteId } from "../services/superfund.js";

const router = Router();

function respondWithUpstreamError(res, error) {
  console.error("[Superfund] EPA request failed:", error.message);
  const status = error.response?.status === 429 ? 503 : 502;
  return res.status(status).json({ error: "EPA Superfund data is currently unavailable. Please try again later." });
}

// Uses the existing environment router's API-key protection for both EPA endpoints.
router.get("/", async (_req, res) => {
  try {
    res.json(await getSuperfundSites());
  } catch (error) {
    respondWithUpstreamError(res, error);
  }
});

router.get("/:siteId/boundary", async (req, res) => {
  if (!isSuperfundSiteId(req.params.siteId)) {
    return res.status(400).json({ error: "Use a valid 12-character EPA site ID." });
  }
  try {
    res.json(await getSuperfundBoundary(req.params.siteId));
  } catch (error) {
    respondWithUpstreamError(res, error);
  }
});

export default router;
