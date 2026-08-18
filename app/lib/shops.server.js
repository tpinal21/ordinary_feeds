import { readItem } from "@directus/sdk";
import { FEEDS, SHOPS } from "app/lib/constants";
import directus from "../directus.server";

const FEED_FIELDS = [
  "feeds.*",
  "feeds.gallery.*",
  "feeds.gallery.ig_media.instagram_media_id.*",
];

// Flattens Directus' nested media rows into the shape the client renders.
export function toFeed({ id, type, label, settings, gallery }) {
  return {
    id,
    type,
    label,
    settings,
    // A feed can be saved without a gallery, so this is nullable.
    gallery: gallery
      ? {
          id: gallery.id,
          type: gallery.type,
          media: (gallery.ig_media ?? [])
            .map((m) => m.instagram_media_id)
            .map((m) => ({
              id: m.id,
              last_synced_at: m.last_synced_at,
              media_url: m.media_url,
              products: m.products,
              thumbnail_url: m.thumbnail_url,
              timestamp: m.timestamp,
            })),
        }
      : null,
  };
}

export async function getShopDetails(shopDomain) {
  return await directus.request(
    readItem(SHOPS, shopDomain, {
      fields: [
        "shop_domain",
        "installed_at",
        "last_seen_at",
        "uninstalled_at",
        "theme_extension_enabled",
        "theme_extension_checked_at",
        "instagram_account.*",
        ...FEED_FIELDS,
      ],
    }),
  );
}

// Feeds only — the root loader seeds the list, this backs refreshes of it.
export async function getShopFeeds(shopDomain) {
  const shop = await directus.request(
    readItem(SHOPS, shopDomain, { fields: FEED_FIELDS }),
  );

  return shop?.feeds?.map(toFeed);
}
