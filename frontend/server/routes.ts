import type { Express } from "express";
import { createServer, type Server } from "http";
import path from "path";
import { fileURLToPath } from "url";
import stripeRouter from "./routes/stripe.js";
import newsletterRouter from "./routes/newsletter.js";
import { startGoogleAdsSync } from "./jobs/googleAdsSync.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolvePublicHtml(filename: string): string {
  if (process.env.NODE_ENV === "production") {
    return path.join(__dirname, "public", filename);
  }
  return path.join(__dirname, "..", "client", "public", filename);
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.use("/api/v1/stripe", stripeRouter);
  app.use("/api/v1/newsletter", newsletterRouter);

  app.get("/privacy", (_req, res) => {
    res.sendFile(resolvePublicHtml("privacy.html"));
  });
  app.get("/payment-success", (_req, res) => {
    res.sendFile(resolvePublicHtml("payment-success.html"));
  });
  app.get("/payment-cancelled", (_req, res) => {
    res.sendFile(resolvePublicHtml("payment-cancelled.html"));
  });

  const httpServer = createServer(app);
  startGoogleAdsSync();
  return httpServer;
}
