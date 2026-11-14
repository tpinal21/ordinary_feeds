// Mirrors a Directus feed into the app-owned `$app:feed` metaobject the theme
// blocks read (label, type, page, settings and its gallery). Directus stays
// the source of truth; this runs after every create and update.
import { feedSettings } from "app/lib/feeds";
import { readShopAccount } from "app/lib/galleries.server";
import { syncGalleryMetaobject } from "app/lib/gallery-metaobjects.server";
import { postHandle } from "app/lib/post-metaobjects.server";

const UPSERT_FEED = `#graphql
  mutation UpsertFeed($handle: MetaobjectHandleInput!, $metaobject: MetaobjectUpsertInput!) {
    feed: metaobjectUpsert(handle: $handle, metaobject: $metaobject) {
      metaobject { id handle }
      userErrors { field message code }
    }
  }`;

// `feed` is the Directus item: `id`, `label`, `type`, `page`, `settings` (a
// JSON string) and `gallery` (its id, or an expanded `{ id }`).
//
// The feed's gallery and its posts are mirrored first — a feed can only
// reference a gallery that exists in Shopify, and the gallery only posts that
// do. Throws if Shopify rejects any of it; every step is idempotent, so
// retrying is safe.
export async function syncFeedMetaobject(admin, feed, shopDomain) {
  const galleryId =
    typeof feed.gallery === "object" ? feed.gallery?.id : feed.gallery;
  const gallery = galleryId
    ? (await syncGalleryMetaobject(admin, galleryId, shopDomain)).id
    : null;

  // Shown in the storefront's post dialog; Liquid has no other way to reach
  // the connected account.
  const account = await readShopAccount(shopDomain);

  const fields = [
    { key: "label", value: feed.label },
    { key: "type", value: feed.type },
    { key: "page", value: feed.page ?? "" },
    // Stored with the type's defaults filled in, so the block renders the
    // same settings the editor shows.
    {
      key: "settings",
      value: JSON.stringify({
        ...feedSettings(feed),
        instagram_username: account?.username ?? null,
        // Instagram's CDN URL: it expires after a few days, and the dialog
        // falls back to the Instagram logo once it does.
        instagram_profile_picture: account?.profile_picture_url ?? null,
      }),
    },
    // Empty clears a gallery that was removed.
    { key: "gallery", value: gallery ?? "" },
  ];

  const res = await admin.graphql(UPSERT_FEED, {
    variables: {
      handle: { type: "$app:feed", handle: postHandle(feed.id) },
      metaobject: { fields },
    },
  });
  const { data, errors } = await res.json();

  const problems = [
    ...(errors ?? []).map((e) => e.message),
    ...(data?.feed?.userErrors ?? []).map((e) =>
      `${e.field?.join(".") ?? ""} ${e.message}`.trim(),
    ),
  ];
  if (problems.length) {
    throw new Error(`Feed metaobject sync failed: ${problems.join("; ")}`);
  }

  return data.feed.metaobject;
}
