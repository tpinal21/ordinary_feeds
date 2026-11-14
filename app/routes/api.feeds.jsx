import { createItem, readItems } from "@directus/sdk";
import directus from "app/directus.server";
import { FEEDS } from "app/lib/constants";
import {
  FEED_PAGE_CODES,
  FEED_PAGES,
  FEED_TYPES,
  galleryAllowedOnPage,
} from "app/lib/feeds";
import { syncFeedMetaobject } from "app/lib/feed-metaobjects.server";
import { galleryNotFound, ownsGallery } from "app/lib/galleries.server";
import { getShopFeeds } from "app/lib/shops.server";
import { badRequest, readJsonBody } from "app/lib/http.server";
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
  const { admin, session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const payload = await readJsonBody(request);

  const { type, page, gallery, settings } = payload;

  // `type` and `page` come straight off the create URL, so neither can be
  // trusted to be one of the values the storefront knows how to render.
  if (!FEED_TYPES.includes(type)) return badRequest("invalid_type");
  if (!FEED_PAGE_CODES.includes(page)) return badRequest("invalid_page");

  try {
    // The gallery id comes from the client; it has to be this shop's.
    if (gallery?.id) {
      const owned = await ownsGallery(shopDomain, gallery.id);
      if (!owned) return galleryNotFound();
      if (!galleryAllowedOnPage(owned.type, FEED_PAGES[page])) {
        return badRequest("gallery_not_allowed_on_page");
      }
    }

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
        { fields: ["id", "label", "type", "page", "settings", "gallery"] },
      ),
    );

    // The feed exists in Directus now, so a failed mirror mustn't read as a
    // failed create (a retry would make a second feed). The next save of the
    // feed re-syncs it.
    let metaobjectSynced = true;
    try {
      await syncFeedMetaobject(admin, feed, shopDomain);
    } catch (err) {
      metaobjectSynced = false;
      console.error("[feeds] metaobject sync failed", err);
    }

    return {
      success: true,
      data: { id: feed.id, label: feed.label },
      metaobjectSynced,
    };
  } catch (err) {
    console.error("[feeds] create failed", err);
    return Response.json(
      { success: false, error: String(err?.message ?? err) },
      { status: 500 },
    );
  }
}
