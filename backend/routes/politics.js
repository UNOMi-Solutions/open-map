import axios from "axios";
import { Router } from "express";
import { offsetCoords, photoUrlFromGovTrackLink } from "../lib/usStateCenters.js";

const router = Router();

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
    const representatives = objects
      .filter((role) => role.state && role.district != null)
      .map((role) => {
        const person = role.person ?? {};
        const link = person.link ?? "";
        const state = role.state;
        const [lat, lng] = offsetCoords(state, (role.district ?? 0) % 2);
        return {
          id: `rep-${person.id ?? role.id}`,
          name: person.name ?? `${person.firstname ?? ""} ${person.lastname ?? ""}`.trim(),
          state,
          district: role.district,
          party: role.party ?? "",
          description: role.description ?? "",
          website: role.website ?? link,
          photoUrl: photoUrlFromGovTrackLink(link),
          lat,
          lng,
        };
      })
      .sort((a, b) => a.state.localeCompare(b.state) || a.district - b.district);

    res.json({
      source: "https://www.govtrack.us/api/v2/role (current representatives)",
      fetchedAt: new Date().toISOString(),
      count: representatives.length,
      representatives,
    });
  } catch (error) {
    console.error("Politics representatives error:", error.message);
    res.status(error.response?.status || 500).json({
      error: error.message || "Failed to fetch representative data",
    });
  }
});

export default router;
