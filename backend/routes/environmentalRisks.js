import { Router } from "express";
import { getEnvironmentalRisk, validState, validYear } from "../services/environmentalRisks.js";

const router = Router();
for (const [path, kind, start] of [["frackingLocations", "fracking", 2011], ["industrialRunoff", "runoff", 2000], ["drinkingWater", "drinkingWater", null]]) {
  router.get(`/${path}`, async (req, res) => {
    const state = req.query.state ? String(req.query.state).toUpperCase() : null;
    const year = req.query.year;
    if ((state && !validState(state)) || (start && !validYear(year, start))) return res.status(400).json({ error: `Provide a valid reporting year${start ? ` (${start}–present)` : ""} and, if supplied, a valid U.S. state.` });
    try { res.json(await getEnvironmentalRisk(kind, state, start ? Number(year) : null)); }
    catch (error) {
      console.error(`[${kind}] upstream request failed:`, error.message);
      res.status(error.response?.status === 429 ? 503 : 502).json({ error: "Source data is currently unavailable for this selection. Please try again or select another reporting year." });
    }
  });
}
export default router;
