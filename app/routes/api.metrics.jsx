// GET /api/metrics?days=30 -> this shop's feed metrics over the last N days.
import {
  countMetrics,
  METRIC_RANGES,
  sumRevenue,
} from "app/lib/metrics.server";
import { getShopEntitlements } from "app/lib/entitlements.server";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const days = parseInt(new URL(request.url).searchParams.get("days"), 10);
  const range = METRIC_RANGES.includes(days) ? days : 30;

  try {
    // Events are recorded on every plan, so upgrading shows the history
    // straight away; the plan only decides what's returned. `access` tells
    // the dashboard which tiles to lock.
    const { limits } = await getShopEntitlements(shop);
    const access = { metrics: limits.metrics, revenue: limits.revenue };
    if (!access.metrics) {
      return {
        success: true,
        data: { days: range, counts: null, revenue: null, access },
      };
    }

    const [counts, revenue] = await Promise.all([
      countMetrics(shop, range),
      access.revenue ? sumRevenue(shop, range) : null,
    ]);
    return { success: true, data: { days: range, counts, revenue, access } };
  } catch (err) {
    console.error("[metrics] read failed", err);
    return Response.json(
      { success: false, error: String(err?.message ?? err) },
      { status: 500 },
    );
  }
}
