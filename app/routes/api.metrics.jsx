// GET /api/metrics?days=30 -> this shop's feed metrics over the last N days.
import { countMetrics, METRIC_RANGES } from "app/lib/metrics.server";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);

  const days = parseInt(new URL(request.url).searchParams.get("days"), 10);
  const range = METRIC_RANGES.includes(days) ? days : 30;

  try {
    const counts = await countMetrics(session.shop, range);
    return { success: true, data: { days: range, counts } };
  } catch (err) {
    console.error("[metrics] read failed", err);
    return Response.json(
      { success: false, error: String(err?.message ?? err) },
      { status: 500 },
    );
  }
}
