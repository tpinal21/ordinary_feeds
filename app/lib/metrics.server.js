// Feed metrics: storefront events sent by the app's web pixel
// (extensions/insta-pixel), stored raw in Directus `metric_events` and
// counted per type for the dashboard.
import { createItem, createItems, readItem, readItems } from "@directus/sdk";
import directus from "app/directus.server";
import { METRIC_EVENTS, SHOPS } from "app/lib/constants";

export const METRIC_TYPES = [
  "impression",
  "video_view",
  "post_click",
  "product_click",
  "add_to_cart",
];

export const METRIC_RANGES = [7, 30, 90];

// One request carries one event today; the cap only guards the endpoint.
const MAX_EVENTS_PER_REQUEST = 20;

const SHOP_DOMAIN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
const HANDLE = /^[a-z0-9_-]{1,128}$/;
const PRODUCT_GID = /^gid:\/\/shopify\/Product\/\d{1,20}$/;

// The endpoint is public (the pixel can't authenticate), so a shop is only
// accepted if the app knows it. Cached briefly to keep events cheap.
const SHOP_TTL_MS = 10 * 60 * 1000;
const knownShops = new Map();

export async function isKnownShop(shop) {
  if (typeof shop !== "string" || !SHOP_DOMAIN.test(shop)) return false;
  const cached = knownShops.get(shop);
  if (cached && cached.expires > Date.now()) return cached.known;

  let known = false;
  try {
    known = !!(await directus.request(
      readItem(SHOPS, shop, { fields: ["shop_domain"] }),
    ));
  } catch {
    known = false;
  }
  knownShops.set(shop, { known, expires: Date.now() + SHOP_TTL_MS });
  return known;
}

const orNull = (value, pattern) =>
  typeof value === "string" && pattern.test(value) ? value : null;

// Whitelists one event from the pixel into a `metric_events` row, or null.
// Anyone can publish these events from a browser console, so nothing is
// trusted beyond its shape.
const toRow = (shop, event) => {
  if (!event || !METRIC_TYPES.includes(event.type)) return null;
  if (typeof event.id !== "string" || !event.id || event.id.length > 128) {
    return null;
  }
  const time = Date.parse(event.timestamp);
  return {
    shop,
    event_id: event.id,
    type: event.type,
    feed_id: orNull(event.feed_id, HANDLE),
    post_id: orNull(event.post_id, HANDLE),
    product_id: orNull(event.product_id, PRODUCT_GID),
    occurred_at: new Date(Number.isNaN(time) ? Date.now() : time).toISOString(),
  };
};

// Stores the events. `event_id` is unique in Directus, so a retried event
// fails on insert; the batch then falls back to one insert per event and
// skips the duplicates. Returns how many were stored.
export async function recordMetricEvents(shop, events) {
  const rows = (Array.isArray(events) ? events : [])
    .slice(0, MAX_EVENTS_PER_REQUEST)
    .map((e) => toRow(shop, e))
    .filter(Boolean);
  if (!rows.length) return 0;

  try {
    await directus.request(createItems(METRIC_EVENTS, rows));
    return rows.length;
  } catch {
    let stored = 0;
    for (const row of rows) {
      try {
        await directus.request(createItem(METRIC_EVENTS, row));
        stored++;
      } catch {
        // Duplicate (or invalid) event: skip it.
      }
    }
    return stored;
  }
}

// Directus returns `count` as a number or a numeric string depending on the
// database driver.
const toCount = (value) => Number(value?.["*"] ?? value) || 0;

// `{ [type]: count }` for the shop over the last `days` days, every type
// present (0 when there were none).
export async function countMetrics(shop, days) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await directus.request(
    readItems(METRIC_EVENTS, {
      aggregate: { count: "*" },
      groupBy: ["type"],
      filter: {
        _and: [
          { shop: { _eq: shop } },
          { occurred_at: { _gte: since.toISOString() } },
        ],
      },
      limit: -1,
    }),
  );

  const counts = Object.fromEntries(METRIC_TYPES.map((t) => [t, 0]));
  for (const row of rows) {
    if (row.type in counts) counts[row.type] = toCount(row.count);
  }
  return counts;
}
