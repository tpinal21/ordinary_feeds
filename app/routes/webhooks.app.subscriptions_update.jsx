import { getBillingState, saveFreePlan } from "app/lib/billing.server";
import { authenticate } from "../shopify.server";

// app_subscriptions/update: a subscription was approved, cancelled, declined,
// frozen or expired — including when the merchant approves a plan and never
// comes back to the app. The payload isn't trusted for the plan itself:
// switching plans sends one notice for the new subscription and one for the
// cancelled old one, in no fixed order, so the shop's active subscriptions
// are re-read from Shopify instead.
export const action = async ({ request }) => {
  const { shop, admin } = await authenticate.webhook(request);

  try {
    if (admin) {
      await getBillingState(admin, shop);
    } else {
      // No session: the app was uninstalled, and Shopify cancels the
      // subscription with it.
      await saveFreePlan(shop);
    }
  } catch (err) {
    // Shopify retries on a non-2xx; a transient Directus or Admin API
    // failure is worth another go.
    console.error("[billing] subscription webhook failed", err);
    return new Response(null, { status: 500 });
  }

  return new Response();
};
