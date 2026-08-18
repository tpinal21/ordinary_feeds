import { readItem, updateItem } from "@directus/sdk";
import directus from "app/directus.server";
import { FEEDS, SHOPS } from "app/lib/constants";
import { authenticate } from "../shopify.server";

export async function action({ request, params }) {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  let payload;
  try {
    payload = await request.json();
  } catch {
    return Response.json(
      { success: false, error: "invalid_json" },
      { status: 400 },
    );
  }

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

    await directus.request(
      updateItem(FEEDS, params.id, {
        gallery: gallery?.id ?? null,
        // Stored as a JSON string — the read side parses it back out.
        settings: JSON.stringify(settings ?? {}),
      }),
    );

    return { success: true };
  } catch (err) {
    console.error("[feed] save failed", err);
    return Response.json(
      { success: false, error: String(err?.message ?? err) },
      { status: 500 },
    );
  }
}
