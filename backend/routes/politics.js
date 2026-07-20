// Import dotenv for hidden variables
import dotenv from "dotenv";
import axios from "axios";
import { offsetCoords } from "../lib/usStateCenters.js";
import { photoUrlFromGovTrackLink } from "../lib/usStateCenters.js";
dotenv.config();

// Import Router so paths can be passed to index
import { response, Router } from "express";
const router = Router();
function govTrackIdFromLink(link) {
  if (!link || typeof link !== "string") return null;
  return link.trim().match(/\/(\d+)\/?$/)?.[1] ?? null;
}

/**
 * Only the 50 states get voting seats in the U.S. House (435 total apportioned).
 * GovTrack also returns non-voting delegates (DC, PR, GU, AS, MP, VI) under
 * role_type=representative — those must be excluded to match the 435-member House.
 */
const FIFTY_STATE_CODES = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL",
  "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT",
  "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI",
  "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
]);

router.get("/test", (req, res) => {
  res.json({ response: "Success: Viewing Political Data" });
});

/** Current U.S. senators from GovTrack (no API key required). */
router.get("/senators", async (req, res) => {
  try {
    const response = await axios.get(
      "https://www.govtrack.us/api/v2/role",
      { params: { current: true, role_type: "senator", limit: 100 } }
    );

    const objects = response.data?.objects ?? [];
    const byState = new Map();

    for (const role of objects) {
      const st = role.state;
      if (!st) continue;
      if (!byState.has(st)) byState.set(st, []);
      byState.get(st).push(role);
    }

    const senators = [];
    for (const [state, roles] of byState) {
      roles.sort((a, b) => {
        const ra = a.senator_rank === "senior" ? 0 : 1;
        const rb = b.senator_rank === "senior" ? 0 : 1;
        if (ra !== rb) return ra - rb;
        return (a.person?.lastname ?? "").localeCompare(b.person?.lastname ?? "");
      });

      roles.forEach((role, i) => {
        const [lat, lng] = offsetCoords(state, i);
        const person = role.person ?? {};
        const link = person.link ?? "";
        senators.push({
          id: `sen-${person.id ?? role.id ?? `${state}-${i}`}`,
          name: person.name ?? `${person.firstname ?? ""} ${person.lastname ?? ""}`.trim(),
          state,
          party: role.party ?? "",
          description: role.description ?? "",
          rank: role.senator_rank_label ?? role.senator_rank ?? "",
          website: role.website ?? link,
          photoUrl: photoUrlFromGovTrackLink(link),
          lat,
          lng,
        });
      });
    }

    senators.sort((a, b) => a.state.localeCompare(b.state) || a.name.localeCompare(b.name));

    res.json({
      source: "https://www.govtrack.us/api/v2/role (current senators)",
      fetchedAt: new Date().toISOString(),
      count: senators.length,
      senators,
    });
  } catch (error) {
    console.error("Politics senators error:", error.message);
    res.status(error.response?.status || 500).json({
      error: error.message || "Failed to fetch senator data",
    });
  }
});

/** Current U.S. House representatives from GovTrack (no API key required). */
router.get("/representatives", async (req, res) => {
  try {
    const response = await axios.get(
      "https://www.govtrack.us/api/v2/role",
      { params: { current: true, role_type: "representative", limit: 500 } }
    );

    const objects = response.data?.objects ?? [];
    const districts = {};
    for (const role of objects) {
      const st = role.state;
      if (!st || !FIFTY_STATE_CODES.has(st)) continue;
      const dist = typeof role.district === "number" ? role.district : 0;
      const key = `${st}-${dist}`;
      const person = role.person ?? {};
      const link = person.link ?? "";
      districts[key] = {
        party: role.party ?? "",
        name: person.name ?? "",
        description: role.description ?? "",
        website: role.website || link,
        photoUrl: photoUrlFromGovTrackLink(link),
      }
    }

    res.json({
      source: "https://www.govtrack.us/api/v2/role (current representatives)",
      fetchedAt: new Date().toISOString(),
      count: Object.keys(districts).length,
      districts,
    });
  } catch (error) {
    console.error("Politics representatives error:", error.message);
    res.status(error.response?.status || 500).json({
      error: error.message || "Failed to fetch representative data",
    });
  }
});

export default router;
