/**
 * AdSense ad-unit slot IDs.
 *
 * 1. Sign in to AdSense → Ads → "By ad unit" → create your units:
 *      - "Display ad" (Responsive)        → Banner
 *      - "In-feed ad" or "Multiplex ad"   → Video / In-feed
 * 2. After creating each unit AdSense gives you a slot ID (a 10-digit number).
 * 3. Paste those IDs as Vercel environment variables:
 *      VITE_ADSENSE_CLIENT=ca-pub-4397282403486242
 *      VITE_ADSENSE_SLOT_BANNER=1234567890
 *      VITE_ADSENSE_SLOT_VIDEO=0987654321
 *      VITE_ADSENSE_SLOT_SIDEBAR=...
 *      VITE_ADSENSE_SLOT_INFEED=...
 *
 * The defaults below are empty strings, which makes the components render
 * nothing until you provide real slot IDs (so unapproved/dev builds don't
 * show broken ad slots).
 */

const env = (import.meta as any).env ?? {};

export const AD_SLOTS = {
  banner: env.VITE_ADSENSE_SLOT_BANNER ?? "",
  video: env.VITE_ADSENSE_SLOT_VIDEO ?? "",
  sidebar: env.VITE_ADSENSE_SLOT_SIDEBAR ?? "",
  infeed: env.VITE_ADSENSE_SLOT_INFEED ?? "",
};

/**
 * Local/demo preview: with VITE_AD_PREVIEW=true, slots without an ID render a dashed placeholder
 * at the real size (and name the variable to set) instead of nothing. Never enable in production.
 */
export const AD_PREVIEW: boolean = env.VITE_AD_PREVIEW === "true";

/** True when a slot will draw something (a real unit, or a preview placeholder). */
export const adSlotActive = (slot: string) => Boolean(slot) || AD_PREVIEW;

export const ADSENSE_CLIENT: string =
  env.VITE_ADSENSE_CLIENT ?? "ca-pub-4397282403486242";
