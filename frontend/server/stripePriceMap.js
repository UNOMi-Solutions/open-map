/**
 * Stripe price IDs + display prices (match Figma "Manage Your Plan" design)
 * Create/update products in Stripe Dashboard to match these amounts.
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
