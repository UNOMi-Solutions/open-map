import { Router } from "express";
import { getEnergyPlants } from "../services/energyPlants.js";

const router = Router();
// Existing environment authentication protects the cached EIA plant snapshot.
router.get("/", async (_req, res) => {
  try {
    res.json(await getEnergyPlants());
  } catch (error) {
    const limited = error.response?.status === 429;
    console.error("[EnergyPlants] EIA request failed:", error.message);
    res.status(limited ? 503 : 502).json({ error: limited ? "EIA is temporarily rate-limited. Please try again later." : "Energy plant data is currently unavailable." });
  }
});
export default router;
