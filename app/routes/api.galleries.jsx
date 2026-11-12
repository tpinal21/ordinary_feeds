import { createItem, readItems } from "@directus/sdk";
import directus from "app/directus.server";
import { GALLERIES } from "app/lib/constants";
import {
  GALLERY_FIELDS,
  missingAccount,
  ownMedia,
  readShopAccount,
  serverError,
  toGallery,
  toIgMedia,
} from "app/lib/galleries.server";
import { syncGalleryMetaobject } from "app/lib/gallery-metaobjects.server";
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

  const { admin, session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const { title, type, media } = await readJsonBody(request);

  if (!title?.trim()) return badRequest("title_required");

  try {
    const account = await readShopAccount(shopDomain);
    if (!account) return missingAccount();

    const gallery = await directus.request(
      createItem(
        GALLERIES,
        {
          shop: shopDomain,
          title,
          type,
          ig_media: toIgMedia(ownMedia(media, account), account.id),
        },
        { fields: GALLERY_FIELDS },
      ),
    );

    // The gallery exists in Directus now, so a failed mirror mustn't read as a
    // failed create (a retry would make a second gallery). The next save of
    // the gallery re-syncs it.
    let metaobjectSynced = true;
    try {
      await syncGalleryMetaobject(admin, gallery.id, shopDomain);
    } catch (err) {
      metaobjectSynced = false;
      console.error("[gallery] metaobject sync failed", err);
    }

    return { success: true, data: toGallery(gallery), metaobjectSynced };
  } catch (err) {
    return serverError("[gallery] create failed", err);
  }
}
