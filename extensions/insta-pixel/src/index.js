import { register } from "@shopify/web-pixels-extension";

// Must match the names carousel.js publishes (EVENT_PREFIX + type).
const PREFIX = "insta_feed:";
const TYPES = [
  "impression",
  "video_view",
  "post_click",
  "product_click",
  "add_to_cart",
];

register(({ analytics, settings }) => {
  const { shop, collectUrl } = settings;
  if (!shop || !collectUrl) return;

  const send = (event, type) => {
    const data = event.customData ?? {};
    fetch(collectUrl, {
      method: "POST",
      // text/plain keeps this a "simple" request: no CORS preflight.
      headers: { "Content-Type": "text/plain" },
      keepalive: true,
      body: JSON.stringify({
        shop,
        events: [
          {
            id: event.id,
            type,
            timestamp: event.timestamp,
            feed_id: data.feed_id ?? null,
            post_id: data.post_id ?? null,
            product_id: data.product_id ?? null,
          },
        ],
      }),
    }).catch(() => {});
  };

  TYPES.forEach((type) => {
    analytics.subscribe(PREFIX + type, (event) => send(event, type));
  });
});
