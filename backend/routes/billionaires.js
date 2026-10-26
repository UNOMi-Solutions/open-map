import { Router } from "express";
import { getUsBillionaireProfiles } from "../lib/rtbBillionaires.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const profiles = await getUsBillionaireProfiles();
    return res.json({ count: profiles.length, profiles });
  } catch (error) {
    console.error("GET /billionares error:", error.message);
    return res.status(502).json({ error: "Failed to retrieve U.S. billionaire profiles" });
  }
});

export default router;
