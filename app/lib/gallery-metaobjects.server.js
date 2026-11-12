// Mirrors a Directus gallery into the app-owned `$app:gallery` metaobject the
// theme blocks read (title and its posts, in order). Directus stays the
// source of truth; this runs after every create and update.
import { readItems } from "@directus/sdk";
import directus from "app/directus.server";
import { GALLERIES } from "app/lib/constants";
import {
  postHandle,
  syncPostMetaobjects,
} from "app/lib/post-metaobjects.server";

const UPSERT_GALLERY = `#graphql
  mutation UpsertGallery($handle: MetaobjectHandleInput!, $metaobject: MetaobjectUpsertInput!) {
    gallery: metaobjectUpsert(handle: $handle, metaobject: $metaobject) {
      metaobject { id handle }
      userErrors { field message code }
    }
  }`;

// Everything the post metaobjects need, in gallery order.
const readGallery = async (galleryId, shopDomain) => {
  const [gallery] = await directus.request(
    readItems(GALLERIES, {
      fields: [
        "id",
        "title",
        "ig_media.order",
        "ig_media.instagram_media_id.id",
        "ig_media.instagram_media_id.media_type",
        "ig_media.instagram_media_id.media_url",
        "ig_media.instagram_media_id.thumbnail_url",
        "ig_media.instagram_media_id.permalink",
        "ig_media.instagram_media_id.caption",
        "ig_media.instagram_media_id.products.product_id.id",
      ],
      // Scoped to the shop, so a gallery id from the client can never mirror
      // another shop's gallery into this store.
      filter: {
        _and: [{ id: { _eq: galleryId } }, { shop: { _eq: shopDomain } }],
      },
      limit: 1,
    }),
  );
  return gallery;
};

// Upserts the gallery's posts first (a gallery can only reference posts that
// exist in Shopify), then the gallery itself. Throws if Shopify rejects any
// of it; every step is idempotent, so retrying is safe.
export async function syncGalleryMetaobject(admin, galleryId, shopDomain) {
  const gallery = await readGallery(galleryId, shopDomain);
  if (!gallery) throw new Error(`Gallery ${galleryId} not found`);

  const media = [...(gallery.ig_media ?? [])]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((row) => row.instagram_media_id)
    .filter(Boolean);

  const gids = await syncPostMetaobjects(admin, media);
  // Posts Shopify can't store (no media URL) are skipped, not referenced.
  const posts = media.map((m) => gids[m.id]).filter(Boolean);

  const res = await admin.graphql(UPSERT_GALLERY, {
    variables: {
      handle: { type: "$app:gallery", handle: postHandle(gallery.id) },
      metaobject: {
        fields: [
          { key: "title", value: gallery.title },
          { key: "posts", value: JSON.stringify(posts) },
        ],
      },
    },
  });
  const { data, errors } = await res.json();

  const problems = [
    ...(errors ?? []).map((e) => e.message),
    ...(data?.gallery?.userErrors ?? []).map((e) =>
      `${e.field?.join(".") ?? ""} ${e.message}`.trim(),
    ),
  ];
  if (problems.length) {
    throw new Error(`Gallery metaobject sync failed: ${problems.join("; ")}`);
  }

  return data.gallery.metaobject;
}
