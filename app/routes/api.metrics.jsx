// GET /api/metrics?days=30 -> this shop's feed metrics over the last N days.
import {
  countMetrics,
  METRIC_RANGES,
  sumRevenue,
} from "app/lib/metrics.server";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);

  const days = parseInt(new URL(request.url).searchParams.get("days"), 10);
  const range = METRIC_RANGES.includes(days) ? days : 30;

  try {
    const [counts, revenue] = await Promise.all([
      countMetrics(session.shop, range),
      sumRevenue(session.shop, range),
    ]);
    return { success: true, data: { days: range, counts, revenue } };
  } catch (err) {
    console.error("[metrics] read failed", err);
    return Response.json(
      { success: false, error: String(err?.message ?? err) },
      { status: 500 },
    );
  }
}
