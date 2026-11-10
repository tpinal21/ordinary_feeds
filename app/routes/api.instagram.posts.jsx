import { createItems, readItems, updateItemsBatch } from "@directus/sdk";
import directus from "app/directus.server";
import { IG_ACCOUNTS, IG_MEDIA } from "app/lib/constants";
import { readJsonBody } from "app/lib/http.server";
import { syncPostMetaobjects } from "app/lib/post-metaobjects.server";
import { authenticate } from "../shopify.server";

const MAX_PER_PAGE = 50;

// instagram_media.products is M2M: junction row -> products item.
const PRODUCT_FIELDS = [
  "id",
  "products.id",
  "products.product_id.id",
  "products.product_id.title",
  "products.product_id.images.id",
  "products.product_id.images.alt_text",
  "products.product_id.images.original_src",
];
// Safety cap on Graph API round-trips per request (100 posts each).
const MAX_IG_REQUESTS = 20;

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  try {
    const instagramAccount = await directus.request(
      readItems(IG_ACCOUNTS, {
        filter: {
          _and: [
            { shop: { _eq: shopDomain } },
            { status: { _eq: "CONNECTED" } },
          ],
        },
        fields: ["access_token,shop.shop_handle"],
      }),
    );

    const instagramAccountDetails = instagramAccount.at(0);

    const token = instagramAccountDetails?.access_token;

    const fields = [
      "id",
      "media_type",
      "media_product_type",
      "media_url",
      "thumbnail_url",
      "permalink",
      "caption",
      "timestamp",
    ].join(",");

    // Optional pagination: `?page=1&per_page=12`. Without them every fetched
    // post is returned (the media picker relies on that).
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page"), 10) || 1);
    const perPageParam = parseInt(url.searchParams.get("per_page"), 10);
    const perPage =
      perPageParam > 0 ? Math.min(perPageParam, MAX_PER_PAGE) : null;

    // Instagram paginates with cursors, so walk `paging.next` until we have
    // enough videos to fill the requested page plus one (to know whether a
    // next page exists), or run out of posts.
    const needed = perPage ? page * perPage + 1 : Infinity;
    const videos = [];
    let nextUrl = `https://graph.instagram.com/v21.0/me/media?fields=${fields}&limit=100&access_token=${token}`;
    let requests = 0;

    while (nextUrl && videos.length < needed && requests < MAX_IG_REQUESTS) {
      const res = await fetch(nextUrl).then((_) => _.json());
      if (res.error) throw new Error(res.error.message);
      videos.push(...(res.data ?? []).filter((m) => m.media_type == "VIDEO"));
      nextUrl = res.paging?.next ?? null;
      requests++;
      // Unpaginated callers keep the old behaviour of a single request.
      if (!perPage) break;
    }

    const start = perPage ? (page - 1) * perPage : 0;
    const pageItems = perPage ? videos.slice(start, start + perPage) : videos;

    // Tagged products live in Directus, not Instagram — merge them in.
    const shopHandle = instagramAccountDetails.shop.shop_handle;
    const ids = pageItems.map((m) => `${m.id}-${shopHandle}`);
    const saved = ids.length
      ? await directus.request(
          readItems(IG_MEDIA, {
            filter: { id: { _in: ids } },
            fields: PRODUCT_FIELDS,
            limit: -1,
          }),
        )
      : [];
    const productsById = new Map(saved.map((m) => [m.id, m.products ?? []]));

    const timeNow = new Date().toISOString();

    return {
      success: true,
      data: pageItems.map((m) => ({
        id: `${m.id}-${instagramAccountDetails.shop.shop_handle}`,
        // instagram_account: instagramAccountDetails.id,
        media_type: m.media_type,
        media_url: m.media_url ?? null,
        thumbnail_url: m.thumbnail_url ?? null,
        // permalink: m.permalink ?? null,
        caption: m.caption ?? null,
        timestamp: m.timestamp ? new Date(m.timestamp).toISOString() : null,
        last_synced_at: timeNow,
        products: productsById.get(`${m.id}-${shopHandle}`) ?? [],
      })),
      ...(perPage && {
        pagination: {
          page,
          per_page: perPage,
          has_previous_page: page > 1,
          has_next_page: videos.length > start + perPage || !!nextUrl,
        },
      }),
    };
  } catch (err) {
    console.error("[instagram] posts fetch failed", err);
    return Response.json(
      { success: false, error: String(err?.message ?? err) },
      { status: 500 },
    );
  }
}

export async function action({ request }) {
  const { admin, session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const values = await readJsonBody(request);

  try {
    const [account] = await directus.request(
      readItems(IG_ACCOUNTS, {
        filter: {
          _and: [
            { shop: { _eq: shopDomain } },
            { status: { _eq: "CONNECTED" } },
          ],
        },
        fields: ["id", "shop.shop_handle"],
        limit: 1,
      }),
    );

    if (!account) {
      return Response.json(
        { success: false, error: "missing_instagram_account" },
        { status: 400 },
      );
    }

    // Media ids are `<instagram id>-<shop handle>`; anything else was not
    // produced for this shop by the loader, so drop it.
    const suffix = `-${account.shop.shop_handle}`;
    const media = (Array.isArray(values?.media) ? values.media : [])
      .filter((m) => typeof m?.id === "string" && m.id.endsWith(suffix))
      .map((m) => toMediaItem(m, account.id));

    if (!media.length) return { success: true, created: 0, updated: 0 };

    // Split into rows Directus already has (update) and new ones (create).
    const existing = await directus.request(
      readItems(IG_MEDIA, {
        filter: { id: { _in: media.map((m) => m.id) } },
        fields: ["id", "instagram_account"],
        limit: -1,
      }),
    );

    if (existing.some((m) => m.instagram_account !== account.id)) {
      return Response.json(
        { success: false, error: "media_not_owned" },
        { status: 403 },
      );
    }

    const existingIds = new Set(existing.map((m) => m.id));
    const toUpdate = media.filter((m) => existingIds.has(m.id));
    const toCreate = media.filter((m) => !existingIds.has(m.id));

    // Run one after the other: both requests may upsert the same product
    // (one product tagged on several posts), and doing them in parallel
    // races two creates of the same products row.
    if (toUpdate.length) {
      await directus.request(updateItemsBatch(IG_MEDIA, toUpdate));
    }
    if (toCreate.length) {
      await directus.request(createItems(IG_MEDIA, toCreate));
    }

    // Then mirror them into the `$app:post` metaobjects the storefront reads,
    // so a product tag shows up there straight away.
    try {
      await syncPostMetaobjects(admin, media);
    } catch (err) {
      console.error("[instagram] post metaobject sync failed", err);
      return Response.json(
        {
          success: false,
          error: "metaobject_sync_failed",
          detail: String(err?.message ?? err),
        },
        { status: 502 },
      );
    }

    return {
      success: true,
      created: toCreate.length,
      updated: toUpdate.length,
    };
  } catch (err) {
    console.error("[instagram] posts save failed", err);
    return Response.json(
      { success: false, error: String(err?.message ?? err) },
      { status: 500 },
    );
  }
}

// Whitelists what the client may write. `products` is the M2M array:
// keeping the junction `id` reuses the row, a missing one creates it, and
// rows left out are removed. The nested `product_id` object is upserted into
// the products collection by its Shopify GID.
function toMediaItem(m, accountId) {
  return {
    id: m.id,
    instagram_account: accountId,
    media_type: m.media_type ?? null,
    media_url: m.media_url ?? null,
    thumbnail_url: m.thumbnail_url ?? null,
    caption: m.caption ?? null,
    timestamp: m.timestamp ?? null,
    last_synced_at: m.last_synced_at ?? null,
    products: (Array.isArray(m.products) ? m.products : [])
      .filter((p) => p?.product_id?.id)
      .map((p) => ({
        ...(p.id && { id: p.id }),
        product_id: {
          id: String(p.product_id.id),
          title: p.product_id.title ?? null,
          images: (Array.isArray(p.product_id.images)
            ? p.product_id.images
            : []
          )
            .filter((img) => img?.id)
            .map((img) => ({
              id: String(img.id),
              alt_text: img.alt_text ?? null,
              original_src: img.original_src ?? null,
            })),
        },
      })),
  };
}
