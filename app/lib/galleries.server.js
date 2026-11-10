// Shared helpers for the `api.galleries*` resource routes.
import { readItems } from "@directus/sdk";
import directus from "app/directus.server";
import { GALLERIES } from "app/lib/constants";

export const GALLERY_FIELDS = [
  "id",
  "title",
  "type",

  "ig_media.id",
  "ig_media.instagram_media_id.id",
  "ig_media.instagram_media_id.media_type",
  "ig_media.instagram_media_id.media_url",
  "ig_media.instagram_media_id.thumbnail_url",
  "ig_media.instagram_media_id.timestamp",
  "ig_media.order",
];

// The junction rows carry the ordering; the media itself is upserted by its
// `media_id` so a post shared by two galleries is stored once.
export const toIgMedia = (media) =>
  media?.map(({ media_id, order, id, ...media }, index) => ({
    ...(id && { id }),
    instagram_media_id: { id: media_id, ...media },
    order: index + 1,
  }));

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
export const ownsGallery = async (shopDomain, galleryId) => {
  const [existing] = await directus.request(
    readItems(GALLERIES, {
      fields: ["id"],
      filter: {
        _and: [{ id: { _eq: galleryId } }, { shop: { _eq: shopDomain } }],
      },
      limit: 1,
    }),
  );

  return !!existing;
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
