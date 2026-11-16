import { Router } from "express";
import { getDrugOverdoseDeaths, isOverdosePeriod } from "../services/drugOverdose.js";

const router = Router();
router.get("/", async (req, res) => {
  const period = req.query.period ?? "latest";
  if (period !== "latest" && !isOverdosePeriod(period)) return res.status(400).json({ error: "Use period=latest or a reporting month in YYYY-MM format." });
  try {
    res.json(await getDrugOverdoseDeaths(period));
  } catch (error) {
    console.error("[DrugOverdose] Data request failed:", error.message);
    res.status(error.status === 404 ? 404 : error.response?.status === 429 ? 503 : 502).json({
      error: error.status === 404 ? error.message : "CDC overdose data or Census population estimates are currently unavailable. Please try again later.",
    });
  }
});
export default router;
