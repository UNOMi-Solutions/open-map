/**
 * Stripe price IDs + display prices.
 *
 * Each plan maps to the live Stripe price IDs created in the Stripe Dashboard.
 * Keep the amounts here in sync with the "Manage Your Plan" pricing UI.
 */
export const PRICE_MAP = {
  freeTrial: {
    monthly: null,
    yearly: null,
    displayName: "Free Trial",
    displayPriceMonthly: "Free Trial",
    displayPriceYearly: "Trial",
    features: ["1 Profile", "New Update Notifications", "With Ads"],
  },
  premium: {
    monthly: "price_1SzMiDDIOIsLjmCZVUBPcuRP",
    yearly: "price_1SzMjCDIOIsLjmCZvYOodG2p",
    displayName: "Premium",
    displayPriceMonthly: "$5",
    displayPriceYearly: "$48",
    features: ["1 Profile", "New Update Notifications", "Advanced Search", "24/7 Support", "No Ads"],
  },
  enterprise: {
    monthly: "price_1SzMjSDIOIsLjmCZUh7aUr3G",
    yearly: "price_1SzMjtDIOIsLjmCZ3pD6vcd9",
    displayName: "Enterprise",
    displayPriceMonthly: "$29",
    displayPriceYearly: "$278",
    features: ["10 Profiles", "New Update Notifications", "Advanced Search", "24/7 Support", "No Ads"],
  },
  agency: {
    monthly: "price_1SzMk5DIOIsLjmCZlvG5ryZ0",
    yearly: "price_1SzMkQDIOIsLjmCZvUOCilC6",
    displayName: "Agency",
    displayPriceMonthly: "$139",
    displayPriceYearly: "$1330",
    features: ["100 Profiles", "New Update Notifications", "Advanced Search", "24/7 VIP Support", "No Ads"],
  },
};

/**
 * Reverse lookup: Stripe price ID -> { plan, interval }.
 * Used by the webhook to resolve a paid subscription back to a plan key.
 */
export const PRICE_TO_PLAN = Object.entries(PRICE_MAP).reduce((acc, [plan, val]) => {
  if (val.monthly) acc[val.monthly] = { plan, interval: "monthly" };
  if (val.yearly) acc[val.yearly] = { plan, interval: "yearly" };
  return acc;
}, {});

/**
 * Maximum number of saved profiles (map configurations) each plan allows.
 * Keep these in sync with the "N Profiles" copy in each plan's `features`.
 */
export const PROFILE_LIMITS = {
  freeTrial: 1,
  premium: 1,
  enterprise: 10,
  agency: 100,
};

/**
 * Resolves the profile limit for a user's plan key. A missing/unknown plan
 * (e.g. a brand-new account with `plan: null`) is treated as the free trial,
 * which allows a single profile.
 */
export function getProfileLimit(plan) {
  return PROFILE_LIMITS[plan] ?? PROFILE_LIMITS.freeTrial;
}
