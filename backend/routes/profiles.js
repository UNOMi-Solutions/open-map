import { Router } from "express";
import mongoose from "mongoose";
import Profile from "../models/Profile.js";
import { getProfileLimit } from "../stripePriceMap.js";

const router = Router();

// Every route below is mounted behind the API-key middleware AND requireAuth,
// so `req.authUser` is always a valid, freshly-loaded user document.

/** Serializes a profile document for the client. */
function toClient(profile) {
  return {
    id: profile._id.toString(),
    name: profile.name,
    config: profile.config ?? {},
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

/** Shared usage summary so the UI can show "count / limit" and gate creation. */
async function usage(user) {
  const limit = getProfileLimit(user.plan);
  const count = await Profile.countDocuments({ userId: user._id });
  return { plan: user.plan || "freeTrial", limit, count, remaining: Math.max(0, limit - count) };
}

// List the current user's profiles plus their tier's limit/usage.
router.get("/", async (req, res) => {
  try {
    const profiles = await Profile.find({ userId: req.authUser._id }).sort({ updatedAt: -1 });
    return res.json({
      profiles: profiles.map(toClient),
      ...(await usage(req.authUser)),
    });
  } catch (err) {
    console.error("GET /profiles error:", err);
    return res.status(500).json({ error: "Failed to load profiles" });
  }
});

// Create a new saved profile, enforcing the plan's profile-count limit.
router.post("/", async (req, res) => {
  try {
    const { name, config } = req.body || {};
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "A profile name is required." });
    }

    const limit = getProfileLimit(req.authUser.plan);
    const count = await Profile.countDocuments({ userId: req.authUser._id });
    if (count >= limit) {
      return res.status(403).json({
        error: `Your plan allows ${limit} saved profile${limit === 1 ? "" : "s"}. Upgrade to save more.`,
        code: "PROFILE_LIMIT_REACHED",
        limit,
        count,
      });
    }

    const profile = await Profile.create({
      userId: req.authUser._id,
      name: name.trim(),
      config: config ?? {},
    });

    return res.status(201).json({ profile: toClient(profile), ...(await usage(req.authUser)) });
  } catch (err) {
    console.error("POST /profiles error:", err);
    return res.status(500).json({ error: "Failed to create profile" });
  }
});

// Update a profile's name and/or config (ownership enforced).
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid profile id" });
    }

    const { name, config } = req.body || {};
    const update = {};
    if (typeof name === "string") {
      if (!name.trim()) return res.status(400).json({ error: "A profile name is required." });
      update.name = name.trim();
    }
    if (config !== undefined) update.config = config;

    const profile = await Profile.findOneAndUpdate(
      { _id: id, userId: req.authUser._id },
      update,
      { new: true }
    );
    if (!profile) return res.status(404).json({ error: "Profile not found" });

    return res.json({ profile: toClient(profile), ...(await usage(req.authUser)) });
  } catch (err) {
    console.error("PUT /profiles/:id error:", err);
    return res.status(500).json({ error: "Failed to update profile" });
  }
});

// Delete a profile (ownership enforced).
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid profile id" });
    }

    const deleted = await Profile.findOneAndDelete({ _id: id, userId: req.authUser._id });
    if (!deleted) return res.status(404).json({ error: "Profile not found" });

    return res.json({ success: true, id, ...(await usage(req.authUser)) });
  } catch (err) {
    console.error("DELETE /profiles/:id error:", err);
    return res.status(500).json({ error: "Failed to delete profile" });
  }
});

export default router;
