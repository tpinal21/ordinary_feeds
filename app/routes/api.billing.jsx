// GET  /api/billing -> the shop's plan and trial.
// POST /api/billing { plan, interval } -> `{ confirmationUrl }` to approve a
//      paid plan on Shopify, or, for `plan: "free"`, cancels the paid one.
import {
  cancelPlan,
  getBillingState,
  requestPlan,
} from "app/lib/billing.server";
import { badRequest, readJsonBody } from "app/lib/http.server";
import { BILLING_INTERVALS, FREE_PLAN, isPaidPlan } from "app/lib/plans";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  const { admin, session } = await authenticate.admin(request);
  try {
    return { success: true, data: await getBillingState(admin, session.shop) };
  } catch (err) {
    console.error("[billing] read failed", err);
    return Response.json(
      { success: false, error: String(err?.message ?? err) },
      { status: 500 },
    );
  }
}

export async function action({ request }) {
  const { admin, session } = await authenticate.admin(request);
  const { plan, interval } = await readJsonBody(request);

  try {
    if (plan === FREE_PLAN) {
      await cancelPlan(admin, session.shop);
      return {
        success: true,
        data: await getBillingState(admin, session.shop),
      };
    }

    if (!isPaidPlan(plan)) return badRequest("invalid_plan");
    if (!BILLING_INTERVALS.includes(interval)) {
      return badRequest("invalid_interval");
    }

    // Back to the Plans page inside the admin once the merchant approves
    // (or declines) on Shopify's screen.
    const returnUrl = `https://${session.shop}/admin/apps/${process.env.SHOPIFY_API_KEY}/plans`;
    const confirmationUrl = await requestPlan(admin, session.shop, {
      planId: plan,
      interval,
      returnUrl,
    });
    return { success: true, confirmationUrl };
  } catch (err) {
    console.error("[billing] change failed", err);
    return Response.json(
      { success: false, error: String(err?.message ?? err) },
      { status: 500 },
    );
  }
}
