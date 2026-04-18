/**
 * Google Ads Sync Job - runs every 1.5 minutes when enabled via .env
 */
const SYNC_INTERVAL_MS = 90 * 1000;

let syncIntervalId = null;

async function runGoogleAdsSync() {
  if (process.env.GOOGLE_ADS_SYNC_ENABLED !== "true") return;
  if (!process.env.GOOGLE_ADS_CUSTOMER_ID || !process.env.GOOGLE_ADS_DEVELOPER_TOKEN) {
    console.warn("[GoogleAds] Sync skipped: missing credentials. Set GOOGLE_ADS_* in .env");
    return;
  }

  try {
    console.log(`[GoogleAds] Sync ran at ${new Date().toISOString()}`);
  } catch (err) {
    console.error("[GoogleAds] Sync error:", err.message);
  }
}

export function startGoogleAdsSync() {
  if (syncIntervalId) return;
  runGoogleAdsSync();
  syncIntervalId = setInterval(runGoogleAdsSync, SYNC_INTERVAL_MS);
  console.log(`[GoogleAds] Sync job started (every ${SYNC_INTERVAL_MS / 1000}s)`);
}

export function stopGoogleAdsSync() {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
    console.log("[GoogleAds] Sync job stopped");
  }
}
