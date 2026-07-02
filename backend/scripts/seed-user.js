import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import User from "../models/User.js";

dotenv.config();

const SAMPLE_USER = {
  email: "sample@openmap.com",
  password: "Sample123!",
};

async function seedUser() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set in backend/.env");
    process.exit(1);
  }

  await mongoose.connect(uri);

  const existing = await User.findOne({ email: SAMPLE_USER.email });
  if (existing) {
    console.log(`Sample user already exists: ${SAMPLE_USER.email}`);
    await mongoose.disconnect();
    return;
  }

  const hashedPassword = await bcrypt.hash(SAMPLE_USER.password, 12);
  await User.create({
    email: SAMPLE_USER.email,
    password: hashedPassword,
    verified: true,
  });

  console.log("Sample user created:");
  console.log(`  Email:    ${SAMPLE_USER.email}`);
  console.log(`  Password: ${SAMPLE_USER.password}`);

  await mongoose.disconnect();
}

seedUser().catch((err) => {
  console.error("Failed to seed sample user:", err);
  process.exit(1);
});
