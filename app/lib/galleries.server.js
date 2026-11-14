// Shared helpers for the `api.galleries*` resource routes.
import { readItems } from "@directus/sdk";
import directus from "app/directus.server";
import { GALLERIES, IG_ACCOUNTS } from "app/lib/constants";
import { MEDIA_PRODUCT_FIELDS } from "app/lib/shops.server";

export const GALLERY_FIELDS = [
  "id",
  "title",
  "type",
  "post_limit",

  "ig_media.id",
  "ig_media.instagram_media_id.id",
  "ig_media.instagram_media_id.media_type",
  "ig_media.instagram_media_id.media_url",
  "ig_media.instagram_media_id.thumbnail_url",
  "ig_media.instagram_media_id.timestamp",
  // Shown in the feed preview's post dialog. Never written back: toIgMedia
  // only sends MEDIA_FIELDS.
  "ig_media.instagram_media_id.caption",
  "ig_media.instagram_media_id.permalink",
  "ig_media.instagram_media_id.like_count",
  ...MEDIA_PRODUCT_FIELDS.map((f) => `ig_media.instagram_media_id.${f}`),
  "ig_media.order",
];

// Post fields a gallery save may write. `products` is left out on purpose:
// sending it would replace (and usually wipe) the post's product tags.
const MEDIA_FIELDS = [
  "media_type",
  "media_url",
  "thumbnail_url",
  "permalink",
  "caption",
  "like_count",
  "timestamp",
  "last_synced_at",
];

// The junction rows carry the ordering; the media itself is upserted by its
// id so a post shared by two galleries is stored once.
//
// Items come in two shapes: rows read back from a gallery (`toGallery`) carry
// `media_id` (the post) and `id` (the junction row); posts picked from the
// media list carry only `id`, which is the post's.
export const toIgMedia = (media, accountId) =>
  media?.map((item, index) => {
    const isRow = item.media_id != null;
    const fields = Object.fromEntries(
      MEDIA_FIELDS.filter((k) => item[k] !== undefined).map((k) => [
        k,
        item[k],
      ]),
    );

    return {
      ...(isRow && item.id && { id: item.id }),
      instagram_media_id: {
        id: isRow ? item.media_id : item.id,
        // Required when the post isn't in Directus yet.
        ...(accountId && { instagram_account: accountId }),
        ...fields,
      },
      order: index + 1,
    };
  });

// The shop's connected Instagram account, which new posts are stored under.
export const readShopAccount = async (shopDomain) => {
  const [account] = await directus.request(
    readItems(IG_ACCOUNTS, {
      filter: {
        _and: [{ shop: { _eq: shopDomain } }, { status: { _eq: "CONNECTED" } }],
      },
      fields: ["id", "username", "profile_picture_url", "shop.shop_handle"],
      limit: 1,
    }),
  );
  return account ?? null;
};

// Media ids are `<instagram id>-<shop handle>`; anything else wasn't produced
// for this shop, and saving it would re-home another shop's post.
export const ownMedia = (media, account) => {
  const suffix = `-${account.shop.shop_handle}`;
  return (Array.isArray(media) ? media : []).filter((m) => {
    const id = m?.media_id ?? m?.id;
    return typeof id === "string" && id.endsWith(suffix);
  });
};

export const GALLERY_TYPES = ["AUTO", "MANUAL", "PRODUCT"];
export const POST_LIMITS = [10, 15, 20];
export const DEFAULT_POST_LIMIT = 10;

// Only the limits the UI offers; anything else falls back to the default.
export const toPostLimit = (value) => {
  const limit = parseInt(value, 10);
  return POST_LIMITS.includes(limit) ? limit : DEFAULT_POST_LIMIT;
};

// PRODUCT galleries pick their posts per product page from the product's
// tags, so they never store a post list of their own.
export const storesMedia = (type) => type !== "PRODUCT";

export const missingAccount = () =>
  Response.json(
    { success: false, error: "missing_instagram_account" },
    { status: 400 },
  );

export const toGallery = ({ ig_media, ...gallery }) => ({
  ...gallery,
  media: ig_media?.map(({ instagram_media_id, ...m }) => ({
    ...instagram_media_id,
    media_id: instagram_media_id.id,
    ...m,
  })),
});

// The ids come from the client and the writes run with an admin token, so
// every mutation has to prove the gallery belongs to the calling shop first.
// Resolves to the gallery's `{ id, type }` when it's this shop's, else null.
export const ownsGallery = async (shopDomain, galleryId) => {
  const [existing] = await directus.request(
    readItems(GALLERIES, {
      fields: ["id", "type"],
      filter: {
        _and: [{ id: { _eq: galleryId } }, { shop: { _eq: shopDomain } }],
      },
      limit: 1,
    }),
  );

  return existing ?? null;
};

export const galleryNotFound = () =>
  Response.json(
    { success: false, error: "gallery_not_found" },
    { status: 404 },
  );

export const serverError = (label, err) => {
  console.error(label, err);
  return Response.json(
    { success: false, error: String(err?.message ?? err) },
    { status: 500 },
  );
};
