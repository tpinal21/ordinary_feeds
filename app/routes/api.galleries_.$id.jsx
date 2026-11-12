import { deleteItem, deleteItems, readItems, updateItem } from "@directus/sdk";
import directus from "app/directus.server";
import { GALLERIES, IG_MEDIA } from "app/lib/constants";
import {
  GALLERY_FIELDS,
  galleryNotFound,
  missingAccount,
  ownMedia,
  ownsGallery,
  readShopAccount,
  serverError,
  toGallery,
  toIgMedia,
} from "app/lib/galleries.server";
import { syncGalleryMetaobject } from "app/lib/gallery-metaobjects.server";
import { badRequest, readJsonBody } from "app/lib/http.server";
import {
  deleteGalleryMetaobject,
  deletePostMetaobjects,
} from "app/lib/post-metaobjects.server";
import { authenticate } from "../shopify.server";

// PATCH /api/galleries/:id  -> update the gallery
// DELETE /api/galleries/:id -> delete the gallery
export async function action({ request, params }) {
  const { admin, session } = await authenticate.admin(request);
  const shopDomain = session.shop;
  const galleryId = params.id;

  switch (request.method) {
    case "PATCH":
      return updateGallery(admin, request, shopDomain, galleryId);
    case "DELETE":
      return deleteGallery(admin, shopDomain, galleryId);
    default:
      return Response.json(
        { success: false, error: "method_not_allowed" },
        { status: 405, headers: { Allow: "PATCH, DELETE" } },
      );
  }
}

async function updateGallery(admin, request, shopDomain, galleryId) {
  const { title, media } = await readJsonBody(request);

  if (!title?.trim()) return badRequest("title_required");

  try {
    if (!(await ownsGallery(shopDomain, galleryId))) return galleryNotFound();

    const account = await readShopAccount(shopDomain);
    if (!account) return missingAccount();

    const gallery = await directus.request(
      updateItem(
        GALLERIES,
        galleryId,
        {
          title,
          ig_media: toIgMedia(ownMedia(media, account), account.id),
        },
        { fields: GALLERY_FIELDS },
      ),
    );

    // Saving again re-runs this, so a failure here is safe to surface.
    try {
      await syncGalleryMetaobject(admin, galleryId, shopDomain);
    } catch (err) {
      console.error("[gallery] metaobject sync failed", err);
      return Response.json(
        {
          success: false,
          error: "metaobject_sync_failed",
          detail: String(err?.message ?? err),
        },
        { status: 502 },
      );
    }

    return { success: true, data: toGallery(gallery) };
  } catch (err) {
    return serverError("[gallery] update failed", err);
  }
}

// A post is "orphaned" once it's in no gallery and has no product tagged:
// nothing on the storefront can show it any more.
const isOrphan = (media) => !media.galleries?.length && !media.products?.length;

const readMedia = (filter) =>
  directus.request(
    readItems(IG_MEDIA, {
      filter,
      fields: ["id", "galleries.id", "products.id"],
      limit: -1,
    }),
  );

async function deleteGallery(admin, shopDomain, galleryId) {
  try {
    if (!(await ownsGallery(shopDomain, galleryId))) return galleryNotFound();

    // Collect this gallery's posts before deleting it: the junction rows go
    // with the gallery, after which they can't be traced back to it.
    const linked = await readMedia({
      galleries: { galleries_id: { _eq: galleryId } },
    });

    // Remove the storefront's copy first: feeds reference the gallery
    // metaobject, so a leftover one would keep rendering. Doing it before
    // Directus means a Shopify failure leaves everything as it was and the
    // delete can simply be retried.
    try {
      await deleteGalleryMetaobject(admin, galleryId);
    } catch (err) {
      console.error("[gallery] gallery metaobject delete failed", err);
      return Response.json(
        {
          success: false,
          error: "metaobject_delete_failed",
          detail: String(err?.message ?? err),
        },
        { status: 502 },
      );
    }

    // The junction rows go with it; the `instagram_media` items are shared
    // across galleries, so only the ones left orphaned are removed below.
    await directus.request(deleteItem(GALLERIES, galleryId));

    // Re-read after the delete so a post added to another gallery or tagged
    // in the meantime is kept.
    const orphanIds = linked.length
      ? (await readMedia({ id: { _in: linked.map((m) => m.id) } }))
          .filter(isOrphan)
          .map((m) => m.id)
      : [];

    if (orphanIds.length) {
      await directus.request(deleteItems(IG_MEDIA, orphanIds));
      try {
        await deletePostMetaobjects(admin, orphanIds);
      } catch (err) {
        // The gallery and posts are already gone from Directus; a leftover
        // metaobject is unreferenced, so log it rather than fail the delete.
        console.error("[gallery] post metaobject cleanup failed", err);
      }
    }

    return { success: true, id: galleryId, deletedPosts: orphanIds.length };
  } catch (err) {
    return serverError("[gallery] delete failed", err);
  }
}
