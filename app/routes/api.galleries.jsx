import { createItem, readItems } from "@directus/sdk";
import directus from "app/directus.server";
import { GALLERIES } from "app/lib/constants";
import {
  GALLERY_FIELDS,
  serverError,
  toGallery,
  toIgMedia,
} from "app/lib/galleries.server";
import { badRequest, readJsonBody } from "app/lib/http.server";
import { authenticate } from "../shopify.server";

// GET /api/galleries -> list this shop's galleries
export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  try {
    const galleryList = await directus.request(
      readItems(GALLERIES, {
        fields: GALLERY_FIELDS,
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
    return serverError("[gallery] list failed", err);
  }
}

// POST /api/galleries -> create a gallery.
// Editing and deleting live at /api/galleries/:id.
export async function action({ request }) {
  if (request.method !== "POST") {
    return Response.json(
      { success: false, error: "method_not_allowed" },
      { status: 405, headers: { Allow: "POST" } },
    );
  }

  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const { title, type, media } = await readJsonBody(request);

  if (!title?.trim()) return badRequest("title_required");

  try {
    const gallery = await directus.request(
      createItem(
        GALLERIES,
        { shop: shopDomain, title, type, ig_media: toIgMedia(media) },
        { fields: GALLERY_FIELDS },
      ),
    );

    return { success: true, data: toGallery(gallery) };
  } catch (err) {
    return serverError("[gallery] create failed", err);
  }
}
