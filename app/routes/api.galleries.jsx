import {
  createItem,
  deleteItem,
  readItems,
  updateItem,
} from "@directus/sdk";
import directus from "app/directus.server";
import { GALLERIES } from "app/lib/constants";
import { authenticate } from "../shopify.server";

const fields = [
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
const toIgMedia = (media) =>
  media?.map(({ media_id, order, id, ...media }, index) => ({
    ...(id && { id }),
    instagram_media_id: { id: media_id, ...media },
    order: index + 1,
  }));

const toGallery = ({ ig_media, ...gallery }) => ({
  ...gallery,
  media: ig_media?.map(({ instagram_media_id, ...m }) => ({
    ...instagram_media_id,
    media_id: instagram_media_id.id,
    ...m,
  })),
});

// The ids come from the client and the writes run with an admin token, so
// every mutation has to prove the gallery belongs to the calling shop first.
const ownsGallery = async (shopDomain, gallery_id) => {
  const [existing] = await directus.request(
    readItems(GALLERIES, {
      fields: ["id"],
      filter: {
        _and: [{ id: { _eq: gallery_id } }, { shop: { _eq: shopDomain } }],
      },
      limit: 1,
    }),
  );

  return !!existing;
};

const notFound = () =>
  Response.json(
    { success: false, error: "gallery_not_found" },
    { status: 404 },
  );

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  try {
    const galleryList = await directus.request(
      readItems(GALLERIES, {
        fields: fields,
        filter: { shop: { _eq: shopDomain } },
        sort: ["date_created"],
      }),
    );

    return {
      success: true,
      galleryList,
      data: galleryList?.map(toGallery),
    };
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
    return Response.json(
      { success: false, error: "invalid_json" },
      { status: 400 },
    );
  }

  const { id: gallery_id, title, type, media } = payload;

  if (request.method === "DELETE") {
    if (!gallery_id) {
      return Response.json(
        { success: false, error: "id_required" },
        { status: 400 },
      );
    }

    try {
      if (!(await ownsGallery(shopDomain, gallery_id))) return notFound();

      // The junction rows go with it; the `instagram_media` items are shared
      // across galleries, so they stay.
      await directus.request(deleteItem(GALLERIES, gallery_id));

      return { success: true, id: gallery_id };
    } catch (err) {
      console.error("[gallery] delete failed", err);
      return Response.json(
        { success: false, error: String(err?.message ?? err) },
        { status: 500 },
      );
    }
  }

  if (!title?.trim()) {
    return Response.json(
      { success: false, error: "title_required" },
      { status: 400 },
    );
  }

  try {
    // No id means this is a brand new gallery.
    if (!gallery_id) {
      const gallery = await directus.request(
        createItem(
          GALLERIES,
          {
            shop: shopDomain,
            title,
            type,
            ig_media: toIgMedia(media),
          },
          { fields: fields },
        ),
      );

      return { success: true, data: toGallery(gallery) };
    }

    if (!(await ownsGallery(shopDomain, gallery_id))) return notFound();

    const gallery = await directus.request(
      updateItem(
        GALLERIES,
        gallery_id,
        { title, ig_media: toIgMedia(media) },
        { fields: fields },
      ),
    );

    return { success: true, data: toGallery(gallery) };
  } catch (err) {
    console.error("[gallery] save failed", err);
    return Response.json(
      { success: false, error: String(err?.message ?? err) },
      { status: 500 },
    );
  }
}
