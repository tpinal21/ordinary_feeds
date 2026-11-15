import { createItem, readItems } from "@directus/sdk";
import directus from "app/directus.server";
import { GALLERIES } from "app/lib/constants";
import {
  GALLERY_FIELDS,
  GALLERY_TYPES,
  missingAccount,
  ownMedia,
  readShopAccount,
  serverError,
  storesMedia,
  toGallery,
  toIgMedia,
  toPostLimit,
} from "app/lib/galleries.server";
import {
  getShopEntitlements,
  planLimitResponse,
} from "app/lib/entitlements.server";
import { syncGalleryMetaobject } from "app/lib/gallery-metaobjects.server";
import {
  readAccountTaggedProductIds,
  syncProductPostMetafields,
} from "app/lib/product-post-metafields.server";
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

  const { title, type, post_limit, media } = await readJsonBody(request);

  if (!title?.trim()) return badRequest("title_required");
  if (!GALLERY_TYPES.includes(type)) return badRequest("invalid_type");

  try {
    if (type === "PRODUCT") {
      const entitlements = await getShopEntitlements(shopDomain);
      if (!entitlements.limits.productGalleries) {
        return planLimitResponse("productGalleries", entitlements);
      }
    }

    const account = await readShopAccount(shopDomain);
    if (!account) return missingAccount();

    const gallery = await directus.request(
      createItem(
        GALLERIES,
        {
          shop: shopDomain,
          title,
          type,
          post_limit: toPostLimit(post_limit),
          ig_media: storesMedia(type)
            ? toIgMedia(ownMedia(media, account), account.id)
            : [],
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
      // Backfill: products tagged before product post lists existed have
      // none yet. Idempotent, so re-running it per PRODUCT gallery is safe.
      if (type === "PRODUCT") {
        await syncProductPostMetafields(
          admin,
          shopDomain,
          await readAccountTaggedProductIds([account.id]),
        );
      }
    } catch (err) {
      metaobjectSynced = false;
      console.error("[gallery] metaobject sync failed", err);
    }

    return { success: true, data: toGallery(gallery), metaobjectSynced };
  } catch (err) {
    return serverError("[gallery] create failed", err);
  }
}
