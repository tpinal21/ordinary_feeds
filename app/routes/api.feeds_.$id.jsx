import { deleteItem, readItem, updateItem } from "@directus/sdk";
import directus from "app/directus.server";
import { FEEDS, SHOPS } from "app/lib/constants";
import { syncFeedMetaobject } from "app/lib/feed-metaobjects.server";
import { galleryAllowedOnPage } from "app/lib/feeds";
import { galleryNotFound, ownsGallery } from "app/lib/galleries.server";
import { badRequest, readJsonBody } from "app/lib/http.server";
import { deleteMetaobjects } from "app/lib/post-metaobjects.server";
import { authenticate } from "../shopify.server";

// The feed id comes from the URL and the writes run with an admin token, so
// check the feed actually belongs to this shop before touching it.
// Resolves to the shop's feed `{ id, page }` with this id, or null.
async function ownsFeed(shopDomain, feedId) {
  const shop = await directus.request(
    readItem(SHOPS, shopDomain, { fields: ["feeds.id", "feeds.page"] }),
  );
  return (
    shop?.feeds?.find((feed) => String(feed.id) === String(feedId)) ?? null
  );
}

const feedNotFound = () =>
  Response.json({ success: false, error: "feed_not_found" }, { status: 404 });

// POST   /api/feeds/:id -> save the feed
// DELETE /api/feeds/:id -> delete the feed
export async function action({ request, params }) {
  const { admin, session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  if (request.method === "DELETE") {
    return deleteFeed(admin, shopDomain, params.id);
  }

  const payload = await readJsonBody(request);

  const { gallery, settings } = payload;

  try {
    const existing = await ownsFeed(shopDomain, params.id);
    if (!existing) return feedNotFound();

    // The gallery id comes from the client; it has to be this shop's, and
    // able to render on the feed's page.
    if (gallery?.id) {
      const owned = await ownsGallery(shopDomain, gallery.id);
      if (!owned) return galleryNotFound();
      if (!galleryAllowedOnPage(owned.type, existing.page)) {
        return badRequest("gallery_not_allowed_on_page");
      }
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

// Removes the feed from Shopify, then from Directus. Its gallery and posts are
// left alone — other feeds may use them, and they're managed on their own.
async function deleteFeed(admin, shopDomain, feedId) {
  try {
    if (!(await ownsFeed(shopDomain, feedId))) return feedNotFound();

    // Shopify first: a leftover feed metaobject would keep rendering in the
    // theme. If this fails nothing has changed, so the delete can be retried.
    try {
      await deleteMetaobjects(admin, "feed", [feedId]);
    } catch (err) {
      console.error("[feed] metaobject delete failed", err);
      return Response.json(
        {
          success: false,
          error: "metaobject_delete_failed",
          detail: String(err?.message ?? err),
        },
        { status: 502 },
      );
    }

    await directus.request(deleteItem(FEEDS, feedId));

    return { success: true, id: feedId };
  } catch (err) {
    console.error("[feed] delete failed", err);
    return Response.json(
      { success: false, error: String(err?.message ?? err) },
      { status: 500 },
    );
  }
}
