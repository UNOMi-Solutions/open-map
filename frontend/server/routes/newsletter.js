import { Router } from "express";
import dotenv from "dotenv";

dotenv.config();
const router = Router();

router.post("/subscribe", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Valid email is required" });
    }

    const apiKey = process.env.MAILCHIMP_API_KEY;
    const serverPrefix = process.env.MAILCHIMP_SERVER_PREFIX;
    const audienceId = process.env.MAILCHIMP_AUDIENCE_ID;

    if (!apiKey || !serverPrefix || !audienceId) {
      console.warn("Mailchimp not configured: MAILCHIMP_API_KEY, MAILCHIMP_SERVER_PREFIX, MAILCHIMP_AUDIENCE_ID");
      return res.status(503).json({
        error: "Newsletter signup is not configured",
        message: "Please try again later or contact support.",
      });
    }

    const dc = serverPrefix;
    const url = `https://${dc}.api.mailchimp.com/3.0/lists/${audienceId}/members`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        email_address: email.trim(),
        status: "subscribed",
        merge_fields: {},
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      if (data.title === "Member Exists") {
        return res.json({ message: "You're already subscribed. Thank you!" });
      }
      if (data.detail) {
        return res.status(400).json({ error: data.detail, message: data.detail });
      }
      return res.status(response.status).json({
        error: data.title || "Subscription failed",
        message: data.detail || "Could not subscribe. Please try again.",
      });
    }

    return res.json({ message: "Thank you for subscribing!" });
  } catch (err) {
    console.error("Newsletter subscribe error:", err);
    return res.status(500).json({
      error: "Server error",
      message: "Something went wrong. Please try again later.",
    });
  }
});

export default router;
