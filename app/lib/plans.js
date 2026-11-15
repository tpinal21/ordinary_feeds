// The app's plans. Shared by the Plans page and the billing code, so what the
// merchant sees is what Shopify is asked to charge.
//
// Priced against the Instagram feed apps on the App Store (Instafeed Pro ~$8,
// Socialwidget $9.90, Foursixty $50+): Free limits by quantity so merchants
// see tagging work, Pro sits at the market price with more included, Plus
// sells revenue attribution.

// One trial per shop, shared by every paid plan: switching plans or
// reinstalling only gets the days that are left.
export const TRIAL_DAYS = 14;

export const BILLING_INTERVALS = ["monthly", "yearly"];

export const PLANS = [
  {
    id: "free",
    name: "Free",
    monthly: 0,
    yearly: 0,
    description: "Try shoppable video feeds on your store.",
    features: [
      "1 feed",
      "Carousel and grid layouts",
      "Post popup",
      "Tag products on up to 5 posts",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    monthly: 9.99,
    yearly: 99,
    recommended: true,
    description: "Everything you need to sell from your feeds.",
    features: [
      "Unlimited feeds",
      "Unlimited product tags",
      "Product page galleries",
      "Feed performance metrics",
    ],
  },
  {
    id: "plus",
    name: "Plus",
    monthly: 24.99,
    yearly: 249,
    description: "See exactly how much your feeds sell.",
    features: [
      "Everything in Pro",
      "Revenue attribution",
      "Priority support",
      "Early access to new features",
    ],
  },
];

export const FREE_PLAN = "free";

// What each plan allows. Every limit check (server, app UI and, through the
// shop metafield, the storefront) reads this, so a limit only ever changes
// here. Keep it in step with the `features` lists above.
//
// "Unlimited" feeds are a fair-use cap far beyond any real store — feeds are
// per page type, and stores use a handful — stated on the Plans page.
// Tagged posts have no cap on paid plans: the shop's Instagram posts already
// bound them.
export const FAIR_USE_MAX_FEEDS = 50;

export const ENTITLEMENTS = {
  free: {
    maxFeeds: 1,
    maxTaggedPosts: 5,
    productGalleries: false,
    metrics: false,
    revenue: false,
  },
  pro: {
    maxFeeds: FAIR_USE_MAX_FEEDS,
    maxTaggedPosts: Infinity,
    productGalleries: true,
    metrics: true,
    revenue: false,
  },
  plus: {
    maxFeeds: FAIR_USE_MAX_FEEDS,
    maxTaggedPosts: Infinity,
    productGalleries: true,
    metrics: true,
    revenue: true,
  },
};

// Unknown or missing plans get Free's limits.
export const entitlementsFor = (planId) =>
  ENTITLEMENTS[planId] ?? ENTITLEMENTS[FREE_PLAN];

// The plan a feature first appears in, for "Upgrade to …" prompts.
export const planUnlocking = (feature) =>
  PLANS.find((p) => {
    const value = ENTITLEMENTS[p.id]?.[feature];
    return value === true || value === Infinity;
  }) ?? null;

export const findPlan = (id) => PLANS.find((p) => p.id === id) ?? null;

export const isPaidPlan = (id) => !!findPlan(id) && id !== FREE_PLAN;

// What the subscription is called on the merchant's Shopify bill, e.g.
// "Ordinary Feeds Pro (Yearly)". The billing code reads the plan back from
// this name, so keep `planFromSubscriptionName` in step with it.
export const subscriptionName = (plan, interval) =>
  `Ordinary Feeds ${plan.name} (${interval === "yearly" ? "Yearly" : "Monthly"})`;

export const planFromSubscriptionName = (name = "") => {
  const match = /^Ordinary Feeds (\w+) \((Monthly|Yearly)\)$/.exec(name);
  const plan = match && PLANS.find((p) => p.name === match[1]);
  return plan ? { planId: plan.id, interval: match[2].toLowerCase() } : null;
};
