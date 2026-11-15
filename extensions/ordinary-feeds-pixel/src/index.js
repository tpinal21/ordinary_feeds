import { register } from "@shopify/web-pixels-extension";

// Must match the names carousel.js publishes (EVENT_PREFIX + type).
const PREFIX = "ordinary_feeds:";
const TYPES = [
  "impression",
  "video_view",
  "post_click",
  "product_click",
  "add_to_cart",
];

// Variants added from a feed, remembered as a fallback for attributing the
// order in case checkout doesn't hand the line item properties back.
const ATTRIBUTION_KEY = "ordinary_feeds_attribution";
const ATTRIBUTION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// "gid://shopify/ProductVariant/123" or "123" -> "123".
const numericId = (id) => {
  const match = String(id ?? "").match(/(\d+)$/);
  return match ? match[1] : null;
};

const productGid = (id) => {
  const numeric = numericId(id);
  return numeric ? `gid://shopify/Product/${numeric}` : null;
};

register(({ analytics, browser, settings }) => {
  const { shop, collectUrl } = settings;
  if (!shop || !collectUrl) return;

  const post = (events) =>
    fetch(collectUrl, {
      method: "POST",
      // text/plain keeps this a "simple" request: no CORS preflight.
      headers: { "Content-Type": "text/plain" },
      keepalive: true,
      body: JSON.stringify({ shop, events }),
    }).catch(() => {});

  const loadAttribution = async () => {
    try {
      const map = JSON.parse(
        (await browser.localStorage.getItem(ATTRIBUTION_KEY)) || "{}",
      );
      const cutoff = Date.now() - ATTRIBUTION_TTL_MS;
      return Object.fromEntries(
        Object.entries(map).filter(([, entry]) => entry?.at > cutoff),
      );
    } catch {
      return {};
    }
  };

  const saveAttribution = async (map) => {
    try {
      await browser.localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(map));
    } catch {
      // Storage unavailable: line item properties still attribute the order.
    }
  };

  TYPES.forEach((type) => {
    analytics.subscribe(PREFIX + type, async (event) => {
      const data = event.customData ?? {};
      post([
        {
          id: event.id,
          type,
          timestamp: event.timestamp,
          feed_id: data.feed_id ?? null,
          post_id: data.post_id ?? null,
          product_id: data.product_id ?? null,
        },
      ]);

      const variantId = numericId(data.variant_id);
      if (type === "add_to_cart" && variantId && data.feed_id) {
        const map = await loadAttribution();
        map[variantId] = {
          feed_id: data.feed_id,
          post_id: data.post_id ?? null,
          at: Date.now(),
        };
        await saveAttribution(map);
      }
    });
  });

  // Revenue: one `purchase` event per order line added from a feed. The line
  // is attributed by its `_ordinary_feeds_feed` / `_ordinary_feeds_post` properties, falling
  // back to the remembered variant. Ids are built from the order and line, so
  // a re-fired event (e.g. a thank-you page reload) is stored once.
  analytics.subscribe("checkout_completed", async (event) => {
    const checkout = event.data?.checkout;
    const orderKey = checkout?.order?.id || checkout?.token;
    if (!orderKey) return;

    const remembered = await loadAttribution();
    const purchases = [];

    (checkout.lineItems ?? []).forEach((line, index) => {
      const props = Object.fromEntries(
        (line.properties ?? []).map((p) => [p.key, p.value]),
      );
      const variantId = numericId(line.variant?.id);
      const fallback = variantId ? remembered[variantId] : null;
      const feedId = props._ordinary_feeds_feed || fallback?.feed_id;
      if (!feedId) return;

      purchases.push({
        id: `${orderKey}:${line.id ?? index}`,
        type: "purchase",
        timestamp: event.timestamp,
        feed_id: feedId,
        post_id: props._ordinary_feeds_post || fallback?.post_id || null,
        product_id: productGid(line.variant?.product?.id),
        order_id: String(orderKey),
        quantity: line.quantity ?? null,
        value: Number(line.finalLinePrice?.amount) || 0,
        currency:
          line.finalLinePrice?.currencyCode ?? checkout.currencyCode ?? null,
      });

      if (variantId) delete remembered[variantId];
    });

    if (!purchases.length) return;
    post(purchases);
    await saveAttribution(remembered);
  });
});
