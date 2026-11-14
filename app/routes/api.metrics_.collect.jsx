// POST /api/metrics/collect: storefront events from the app's web pixel
// (extensions/insta-pixel). Public and cross-origin: the pixel runs in
// Shopify's sandbox and can't authenticate, so the body is validated
// instead (see recordMetricEvents).
import { isKnownShop, recordMetricEvents } from "app/lib/metrics.server";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

// Far above one event's size; anything bigger isn't from the pixel.
const MAX_BODY_BYTES = 16 * 1024;

const reply = (status) => new Response(null, { status, headers: CORS_HEADERS });

// CORS preflight (the pixel sends text/plain, so normally there is none).
export async function loader({ request }) {
  return reply(request.method === "OPTIONS" ? 204 : 405);
}

export async function action({ request }) {
  if (request.method === "OPTIONS") return reply(204);
  if (request.method !== "POST") return reply(405);

  // Sent as text/plain to avoid a preflight, so parse it by hand.
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return reply(413);

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return reply(400);
  }

  if (!(await isKnownShop(body?.shop))) return reply(400);

  try {
    await recordMetricEvents(body.shop, body.events);
  } catch (err) {
    console.error("[metrics] collect failed", err);
    return reply(500);
  }

  return reply(204);
}
