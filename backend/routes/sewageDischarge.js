import { Router } from "express";
import { getSewageOutfalls } from "../services/sewageDischarge.js";

const router = Router();
// API-key protection is inherited from the environment router in index.js.
router.get("/", async (_req, res) => {
  try {
    res.json(await getSewageOutfalls());
  } catch (error) {
    console.error("[SewageDischarge] EPA request failed:", error.message);
    res.status(error.response?.status === 429 ? 503 : 502).json({ error: "EPA sewage outfall data is currently unavailable. Please try again later." });
  }
});
export default router;
