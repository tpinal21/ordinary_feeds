// Server-side plan limits. The shop's plan is read from its Directus row
// (`shops.plan`, uppercase), which the billing code and the
// app_subscriptions/update webhook keep in step with Shopify — no Admin API
// call per check.
import { readItem } from "@directus/sdk";
import directus from "app/directus.server";
import { SHOPS } from "app/lib/constants";
import { FREE_PLAN, entitlementsFor, planUnlocking } from "app/lib/plans";

// `{ planId, limits }` for the shop; Free if the row has no plan yet.
export async function getShopEntitlements(shopDomain) {
  const shop = await directus.request(
    readItem(SHOPS, shopDomain, { fields: ["plan"] }),
  );
  const planId = shop?.plan ? String(shop.plan).toLowerCase() : FREE_PLAN;
  return { planId, limits: entitlementsFor(planId) };
}

// The 403 every limit check returns. `limit` names what was hit (a key of
// ENTITLEMENTS), `upgradeTo` the plan that lifts it — null when no plan does,
// i.e. the fair-use cap.
export function planLimitResponse(limit, { planId, limits }) {
  const max = limits[limit];
  // Feeds have no plan without a cap (paid plans share the fair-use one), so
  // a Free shop is pointed at Pro, the first plan raising it.
  const unlocking =
    planUnlocking(limit) ??
    (limit === "maxFeeds" && planId === FREE_PLAN ? { id: "pro" } : null);
  const upgradeTo = unlocking && unlocking.id !== planId ? unlocking.id : null;

  return Response.json(
    {
      success: false,
      error: "plan_limit",
      limit,
      max: typeof max === "number" && Number.isFinite(max) ? max : null,
      plan: planId,
      upgradeTo,
    },
    { status: 403 },
  );
}
