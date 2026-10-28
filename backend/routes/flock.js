import { Router } from "express";
import { camerasForView } from "../lib/alprCameras.js";

const router = Router();

// Test Command
router.get("/test", (req, res) => {
  const testResponse = { response: "Success: Viewing Flock Data" };
  res.json(testResponse);
});

function parseBounds(query) {
  let south = Number(query.south);
  let north = Number(query.north);
  let west = Number(query.west);
  let east = Number(query.east);
  if (![south, north, west, east].every(Number.isFinite)) {
    return { error: "south, west, north, and east are required" };
  }
  if (south > north) [south, north] = [north, south];
  if (west > east) [west, east] = [east, west];
  const zoom = Number(query.zoom);
  return {
    south: Math.max(-90, south),
    north: Math.min(90, north),
    west: Math.max(-180, west),
    east: Math.min(180, east),
    zoom: Number.isFinite(zoom) ? Math.min(20, Math.max(0, zoom)) : 4,
    flockOnly: query.flockOnly === "1",
  };
}

// OpenStreetMap ALPR / ANPR cameras inside the current map view.
router.get("/cameras", async (req, res) => {
  res.set("Cache-Control", "no-store");
  try {
    const bounds = parseBounds(req.query);
    if (bounds.error) return res.status(400).json({ error: bounds.error });
    res.json(await camerasForView(bounds));
  } catch (error) {
    console.error("Error fetching ALPR cameras:", error.message);
    res.status(500).json({ error: "Unable to fetch ALPR cameras from OpenStreetMap" });
  }
});

export default router;
