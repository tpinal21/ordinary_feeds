// Plan billing through Shopify's Billing API (appSubscriptionCreate). Shopify
// shows the merchant its own approval screen and adds the charge to their
// Shopify bill; the app never sees payment details.
//
// The free trial is the app's to track: Shopify starts a fresh trial on every
// subscription it's asked to create, so a merchant could otherwise switch
// plans or reinstall for another 14 days. When the trial first starts, its
// start date is kept on the shop's Directus row (`shops.trial_started_at`,
// kept through uninstalls), and later subscriptions only get the days that
// are left.
import { readItem, updateItem } from "@directus/sdk";
import directus from "app/directus.server";
import { SHOPS } from "app/lib/constants";
import {
  BILLING_INTERVALS,
  FREE_PLAN,
  TRIAL_DAYS,
  findPlan,
  isPaidPlan,
  planFromSubscriptionName,
  subscriptionName,
} from "app/lib/plans";

const DAY_MS = 24 * 60 * 60 * 1000;

const STATE_QUERY = `#graphql
  query BillingState {
    shop {
      plan { partnerDevelopment }
    }
    currentAppInstallation {
      activeSubscriptions {
        id
        name
        status
        test
        trialDays
        createdAt
        currentPeriodEnd
      }
    }
  }`;

const CREATE_MUTATION = `#graphql
  mutation CreateSubscription(
    $name: String!
    $lineItems: [AppSubscriptionLineItemInput!]!
    $returnUrl: URL!
    $trialDays: Int
    $test: Boolean
  ) {
    appSubscriptionCreate(
      name: $name
      lineItems: $lineItems
      returnUrl: $returnUrl
      trialDays: $trialDays
      test: $test
    ) {
      confirmationUrl
      userErrors { field message }
    }
  }`;

const CANCEL_MUTATION = `#graphql
  mutation CancelSubscription($id: ID!) {
    appSubscriptionCancel(id: $id) {
      userErrors { field message }
    }
  }`;

const throwOnUserErrors = (label, userErrors) => {
  if (userErrors?.length) {
    throw new Error(`${label}: ${userErrors.map((e) => e.message).join(", ")}`);
  }
};

// The plan as last saved on the shop's Directus row. Shopify stays the source
// of truth; this copy is what the rest of the app (and reporting) reads
// without an Admin API call. Kept current by getBillingState and the
// app_subscriptions/update webhook.
const PLAN_FIELDS = [
  "plan",
  "plan_interval",
  "subscription_id",
  "subscription_status",
  "trial_ends_at",
];

async function readShopBilling(shopDomain) {
  return directus.request(
    readItem(SHOPS, shopDomain, {
      fields: ["trial_started_at", ...PLAN_FIELDS],
    }),
  );
}

// Directus keeps the values uppercase, matching its dropdowns: plan FREE /
// PRO / PLUS, plan_interval MONTHLY / YEARLY, subscription_status as Shopify
// sends it (ACTIVE, ...). The app itself uses the lowercase plan ids.
const toStored = (value) => (value ? String(value).toUpperCase() : null);

// Writes the plan fields only when something changed, so a page visit
// doesn't touch the row every time.
async function savePlan(shopDomain, stored, current) {
  const plan = {
    ...current,
    plan: toStored(current.plan),
    plan_interval: toStored(current.plan_interval),
    subscription_status: toStored(current.subscription_status),
  };
  const same = PLAN_FIELDS.every((f) =>
    f === "trial_ends_at"
      ? Date.parse(stored?.[f] ?? 0) === Date.parse(plan[f] ?? 0)
      : (stored?.[f] ?? null) === (plan[f] ?? null),
  );
  if (same) return;

  await directus.request(
    updateItem(SHOPS, shopDomain, {
      ...plan,
      plan_updated_at: new Date().toISOString(),
    }),
  );
}

// Back to Free on the shop's row, e.g. after uninstalling, when the app can
// no longer ask Shopify (which cancels the subscription itself).
export const saveFreePlan = (shopDomain) =>
  directus.request(
    updateItem(SHOPS, shopDomain, {
      plan: toStored(FREE_PLAN),
      plan_interval: null,
      subscription_id: null,
      subscription_status: null,
      trial_ends_at: null,
      plan_updated_at: new Date().toISOString(),
    }),
  );

async function readState(admin) {
  const res = await admin.graphql(STATE_QUERY);
  const { data, errors } = await res.json();
  if (errors?.length) throw new Error(errors.map((e) => e.message).join(", "));
  return data;
}

// Days of the shop's one trial still unused, given when it started.
const trialDaysLeft = (trialStartedAt, now = Date.now()) => {
  if (!trialStartedAt) return TRIAL_DAYS;
  const used = Math.floor((now - Date.parse(trialStartedAt)) / DAY_MS);
  return Math.max(0, TRIAL_DAYS - used);
};

// Charges on development stores must be test charges, and so must every
// charge outside production.
const isTestCharge = (shop) =>
  process.env.NODE_ENV !== "production" ||
  process.env.SHOPIFY_BILLING_TEST === "true" ||
  !!shop?.plan?.partnerDevelopment;

// The shop's current plan and trial, as the Plans page shows them:
// `{ planId, interval, subscriptionId, trialEndsAt, trialDaysLeft }`.
// Read from Shopify, then saved to the shop's Directus row along with when
// the trial started (the first time it's seen).
export async function getBillingState(admin, shopDomain) {
  const [data, stored] = await Promise.all([
    readState(admin),
    readShopBilling(shopDomain),
  ]);
  let trialStartedAt = stored?.trial_started_at ?? null;

  // Only our own subscriptions, in case the name ever stops matching.
  const subscription = (data?.currentAppInstallation?.activeSubscriptions ?? [])
    .map((s) => ({ ...s, plan: planFromSubscriptionName(s.name) }))
    .find((s) => s.plan);

  const trialEndsAt =
    subscription?.trialDays > 0
      ? new Date(
          Date.parse(subscription.createdAt) + subscription.trialDays * DAY_MS,
        ).toISOString()
      : null;
  const inTrial = !!trialEndsAt && Date.parse(trialEndsAt) > Date.now();

  if (subscription?.trialDays > 0 && !trialStartedAt) {
    // The subscription's own trial is the first one: back-date the record so
    // the days it already used count.
    await directus.request(
      updateItem(SHOPS, shopDomain, {
        trial_started_at: subscription.createdAt,
      }),
    );
    trialStartedAt = subscription.createdAt;
  }

  await savePlan(shopDomain, stored, {
    plan: subscription?.plan.planId ?? FREE_PLAN,
    plan_interval: subscription?.plan.interval ?? null,
    subscription_id: subscription?.id ?? null,
    subscription_status: subscription?.status ?? null,
    trial_ends_at: inTrial ? trialEndsAt : null,
  });

  return {
    planId: subscription?.plan.planId ?? FREE_PLAN,
    interval: subscription?.plan.interval ?? "monthly",
    subscriptionId: subscription?.id ?? null,
    test: !!subscription?.test,
    trialEndsAt: inTrial ? trialEndsAt : null,
    // What a new subscription would get now.
    trialDaysLeft: trialDaysLeft(trialStartedAt),
  };
}

// Starts a subscription to `planId` billed `interval`ly and returns the
// Shopify URL where the merchant approves it. Approving replaces any plan
// they're on. `returnUrl` is where Shopify sends them afterwards.
export async function requestPlan(
  admin,
  shopDomain,
  { planId, interval, returnUrl },
) {
  const plan = findPlan(planId);
  if (!isPaidPlan(planId)) throw new Error(`Not a paid plan: ${planId}`);
  if (!BILLING_INTERVALS.includes(interval)) {
    throw new Error(`Unknown billing interval: ${interval}`);
  }

  const [data, stored] = await Promise.all([
    readState(admin),
    readShopBilling(shopDomain),
  ]);
  const trialDays = trialDaysLeft(stored?.trial_started_at);

  const res = await admin.graphql(CREATE_MUTATION, {
    variables: {
      name: subscriptionName(plan, interval),
      returnUrl,
      trialDays,
      test: isTestCharge(data?.shop),
      lineItems: [
        {
          plan: {
            appRecurringPricingDetails: {
              price: {
                amount: interval === "yearly" ? plan.yearly : plan.monthly,
                currencyCode: "USD",
              },
              interval: interval === "yearly" ? "ANNUAL" : "EVERY_30_DAYS",
            },
          },
        },
      ],
    },
  });
  const { data: created, errors } = await res.json();
  if (errors?.length) throw new Error(errors.map((e) => e.message).join(", "));
  throwOnUserErrors("Subscription", created?.appSubscriptionCreate?.userErrors);

  return created.appSubscriptionCreate.confirmationUrl;
}

// Back to Free: cancels the shop's paid subscription, if it has one.
export async function cancelPlan(admin, shopDomain) {
  const { subscriptionId } = await getBillingState(admin, shopDomain);
  if (!subscriptionId) return;

  const res = await admin.graphql(CANCEL_MUTATION, {
    variables: { id: subscriptionId },
  });
  const { data } = await res.json();
  throwOnUserErrors("Cancel", data?.appSubscriptionCancel?.userErrors);
}
