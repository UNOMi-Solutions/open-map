import mongoose from "mongoose";

/**
 * A "profile" is a saved map configuration: the layers, filters, choropleth,
 * dropped pins, etc. a user set up and named so they can reload it later.
 * How many profiles a user may keep is capped per subscription tier
 * (see PROFILE_LIMITS in backend/stripePriceMap.js) and enforced in
 * backend/routes/profiles.js.
 */
const profileSchema = new mongoose.Schema(
  {
    // Owner of this profile. Indexed because every query filters by user.
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    // Opaque snapshot of the map state (selected layers, filters, pins, etc.).
    // Stored as-is so the frontend owns the shape and can evolve it freely.
    config: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

const Profile = mongoose.model("Profile", profileSchema);
export default Profile;
