import { readItem, updateItem } from "@directus/sdk";
import directus from "app/directus.server";
import { FEEDS, SHOPS } from "app/lib/constants";
import { syncFeedMetaobject } from "app/lib/feed-metaobjects.server";
import { galleryNotFound, ownsGallery } from "app/lib/galleries.server";
import { readJsonBody } from "app/lib/http.server";
import { authenticate } from "../shopify.server";

export async function action({ request, params }) {
  const { admin, session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const payload = await readJsonBody(request);

  const { gallery, settings } = payload;

  try {
    // The feed id comes from the URL and the write runs with an admin token, so
    // check the feed actually belongs to this shop before touching it.
    const shop = await directus.request(
      readItem(SHOPS, shopDomain, { fields: ["feeds.id"] }),
    );
    const ownsFeed = shop?.feeds?.some(
      (feed) => String(feed.id) === String(params.id),
    );

    if (!ownsFeed) {
      return Response.json(
        { success: false, error: "feed_not_found" },
        { status: 404 },
      );
    }

    // The gallery id comes from the client; it has to be this shop's.
    if (gallery?.id && !(await ownsGallery(shopDomain, gallery.id))) {
      return galleryNotFound();
    }

    const feed = await directus.request(
      updateItem(
        FEEDS,
        params.id,
        {
          gallery: gallery?.id ?? null,
          // Stored as a JSON string — the read side parses it back out.
          settings: JSON.stringify(settings ?? {}),
        },
        { fields: ["id", "label", "type", "page", "settings", "gallery"] },
      ),
    );

    // Saving again re-runs this, so a failure here is safe to surface.
    try {
      await syncFeedMetaobject(admin, feed, shopDomain);
    } catch (err) {
      console.error("[feed] metaobject sync failed", err);
      return Response.json(
        { success: false, error: "metaobject_sync_failed" },
        { status: 502 },
      );
    }

    return { success: true };
  } catch (err) {
    console.error("[feed] save failed", err);
    return Response.json(
      { success: false, error: String(err?.message ?? err) },
      { status: 500 },
    );
  }
}
