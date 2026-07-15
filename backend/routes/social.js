import { Router } from "express";
import { STATE_CENTERS } from "../lib/usStateCenters.js";

const router = Router();

router.get("/test", (req, res) => {
  res.json({ response: "Success: Viewing Social Data" });
});

/** Age of consent by state (static reference data — no external API key). */
router.get("/ageOfConsentByState", (req, res) => {
  const states = AGE_OF_CONSENT.map(({ state, ageOfConsent }) => {
    const coords = STATE_CENTERS[state] ?? [39.8283, -98.5795];
    return {
      state,
      ageOfConsent,
      latitude: coords[0],
      longitude: coords[1],
    };
  });

  res.json({
    source: "OpenMap reference data (verify locally before production use)",
    count: states.length,
    states,
  });
});

const AGE_OF_CONSENT = [
  { state: "AL", ageOfConsent: 16 }, { state: "AK", ageOfConsent: 16 },
  { state: "AZ", ageOfConsent: 18 }, { state: "AR", ageOfConsent: 16 },
  { state: "CA", ageOfConsent: 18 }, { state: "CO", ageOfConsent: 17 },
  { state: "CT", ageOfConsent: 16 }, { state: "DE", ageOfConsent: 18 },
  { state: "FL", ageOfConsent: 18 }, { state: "GA", ageOfConsent: 16 },
  { state: "HI", ageOfConsent: 16 }, { state: "ID", ageOfConsent: 18 },
  { state: "IL", ageOfConsent: 17 }, { state: "IN", ageOfConsent: 16 },
  { state: "IA", ageOfConsent: 16 }, { state: "KS", ageOfConsent: 16 },
  { state: "KY", ageOfConsent: 16 }, { state: "LA", ageOfConsent: 17 },
  { state: "ME", ageOfConsent: 16 }, { state: "MD", ageOfConsent: 16 },
  { state: "MA", ageOfConsent: 16 }, { state: "MI", ageOfConsent: 16 },
  { state: "MN", ageOfConsent: 16 }, { state: "MS", ageOfConsent: 16 },
  { state: "MO", ageOfConsent: 17 }, { state: "MT", ageOfConsent: 16 },
  { state: "NE", ageOfConsent: 17 }, { state: "NV", ageOfConsent: 16 },
  { state: "NH", ageOfConsent: 16 }, { state: "NJ", ageOfConsent: 16 },
  { state: "NM", ageOfConsent: 17 }, { state: "NY", ageOfConsent: 17 },
  { state: "NC", ageOfConsent: 16 }, { state: "ND", ageOfConsent: 18 },
  { state: "OH", ageOfConsent: 16 }, { state: "OK", ageOfConsent: 16 },
  { state: "OR", ageOfConsent: 18 }, { state: "PA", ageOfConsent: 16 },
  { state: "RI", ageOfConsent: 16 }, { state: "SC", ageOfConsent: 16 },
  { state: "SD", ageOfConsent: 16 }, { state: "TN", ageOfConsent: 18 },
  { state: "TX", ageOfConsent: 17 }, { state: "UT", ageOfConsent: 18 },
  { state: "VT", ageOfConsent: 16 }, { state: "VA", ageOfConsent: 18 },
  { state: "WA", ageOfConsent: 16 }, { state: "WV", ageOfConsent: 16 },
  { state: "WI", ageOfConsent: 18 }, { state: "WY", ageOfConsent: 18 },
];

export default router;
