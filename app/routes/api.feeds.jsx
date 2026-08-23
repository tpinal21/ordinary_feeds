import { createItem, readItems } from "@directus/sdk";
import directus from "app/directus.server";
import { FEEDS } from "app/lib/constants";
import { FEED_PAGE_CODES, FEED_PAGES, FEED_TYPES } from "app/lib/feeds";
import { getShopFeeds } from "app/lib/shops.server";
import { authenticate } from "../shopify.server";

// Labels read as `CAROUSEL_HP_01` and have to be unique per shop, so they're
// generated here rather than taken from the client: highest one in use, plus one.
const LABEL_PAD = 2;

async function nextFeedLabel(shopDomain, type, pageCode) {
  const prefix = `${type}_${pageCode}_`;

  const [highest] = await directus.request(
    readItems(FEEDS, {
      fields: ["label"],
      filter: {
        _and: [
          { shop: { _eq: shopDomain } },
          { label: { _starts_with: prefix } },
        ],
      },
      // Fixed-width sequences sort the same lexically as numerically.
      sort: ["-label"],
      limit: 1,
    }),
  );

  const seq = Number.parseInt(highest?.label.slice(prefix.length), 10) || 0;

  return `${prefix}${String(seq + 1).padStart(LABEL_PAD, "0")}`;
}

const badRequest = (error) =>
  Response.json({ success: false, error }, { status: 400 });

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  try {
    return { success: true, data: await getShopFeeds(shopDomain) };
  } catch (err) {
    console.error("[feeds] get failed", err);
    return Response.json(
      { success: false, error: String(err?.message ?? err) },
      { status: 500 },
    );
  }
}

export async function action({ request }) {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  let payload;
  try {
    payload = await request.json();
  } catch {
    return badRequest("invalid_json");
  }

  const { type, page, gallery, settings } = payload;

  // `type` and `page` come straight off the create URL, so neither can be
  // trusted to be one of the values the storefront knows how to render.
  if (!FEED_TYPES.includes(type)) return badRequest("invalid_type");
  if (!FEED_PAGE_CODES.includes(page)) return badRequest("invalid_page");

  try {
    const feed = await directus.request(
      createItem(
        FEEDS,
        {
          shop: shopDomain,
          type,
          page: FEED_PAGES[page],
          label: await nextFeedLabel(shopDomain, type, page),
          gallery: gallery?.id ?? null,
          // Stored as a JSON string — the read side parses it back out.
          settings: JSON.stringify(
            typeof settings === "object" && settings !== null ? settings : {},
          ),
        },
        { fields: ["id", "label"] },
      ),
    );

    return { success: true, data: feed };
  } catch (err) {
    console.error("[feeds] create failed", err);
    return Response.json(
      { success: false, error: String(err?.message ?? err) },
      { status: 500 },
    );
  }
}
