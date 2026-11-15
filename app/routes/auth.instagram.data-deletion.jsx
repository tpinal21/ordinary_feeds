import { deleteItems, readItems } from "@directus/sdk";
import directus from "app/directus.server";
import { IG_ACCOUNTS, IG_MEDIA, SHOPS } from "app/lib/constants";
import crypto from "node:crypto";
import {
  readAccountTaggedProductIds,
  syncProductPostMetafields,
} from "app/lib/product-post-metafields.server";
import { unauthenticated } from "app/shopify.server";
import {
  getAppUrl,
  instagramUserFilter,
  parseSignedRequest,
} from "app/lib/instagram.server";

// The shops these accounts belong to. Accounts lose their `shop` link on
// disconnect, so those are matched by the shop handle their id ends with
// (`<instagram id>-<shop handle>`).
async function accountShops(accounts) {
  const shops = new Set(accounts.map((a) => a.shop).filter(Boolean));
  const handles = accounts
    .filter((a) => !a.shop)
    .map((a) => String(a.id).split("-").slice(1).join("-"))
    .filter(Boolean);

  if (handles.length) {
    const rows = await directus.request(
      readItems(SHOPS, {
        filter: { shop_handle: { _in: handles } },
        fields: ["shop_domain"],
        limit: -1,
      }),
    );
    rows.forEach((r) => shops.add(r.shop_domain));
  }
  return [...shops];
}

// Removes the deleted posts from each shop's product pages: with their tags
// gone, re-syncing the tagged products clears (or shrinks) their
// `$app.instagram_posts` metafield. Runs without a request, on the shop's
// offline session. Best effort: the Directus data is already deleted, which
// is what Meta requires, so failures are only logged.
async function clearProductPosts(shops, productIds) {
  for (const shop of shops) {
    try {
      const { admin } = await unauthenticated.admin(shop);
      await syncProductPostMetafields(admin, shop, productIds);
    } catch (err) {
      console.error(
        `[instagram] product metafield cleanup failed for ${shop}`,
        err,
      );
    }
  }
}

// Meta "Data deletion request URL": deletes everything stored for the
// Instagram user, then answers with a confirmation code and a status URL that
// Meta shows the user.
export async function action({ request }) {
  const form = await request.formData();
  const data = parseSignedRequest(form.get("signed_request"));

  if (!data?.user_id) {
    return Response.json({ error: "invalid_signed_request" }, { status: 400 });
  }

  try {
    const accounts = await directus.request(
      readItems(IG_ACCOUNTS, {
        filter: instagramUserFilter(data.user_id),
        fields: ["id", "media", "shop"],
        limit: -1,
      }),
    );

    // Read before the posts (and their product tags) are deleted below.
    const accountIds = accounts.map((a) => a.id);
    const [taggedProductIds, shops] = await Promise.all([
      readAccountTaggedProductIds(accountIds),
      accountShops(accounts),
    ]);

    const mediaIds = accounts.flatMap((a) => a.media ?? []);
    if (mediaIds.length) {
      await directus.request(deleteItems(IG_MEDIA, mediaIds));
    }
    if (accounts.length) {
      await directus.request(deleteItems(IG_ACCOUNTS, accountIds));
    }

    if (taggedProductIds.length) {
      await clearProductPosts(shops, taggedProductIds);
    }
  } catch (err) {
    console.error("[instagram] data deletion failed", err);
    return Response.json({ error: "deletion_failed" }, { status: 500 });
  }

  const confirmationCode = crypto.randomUUID();
  console.log(
    `[instagram] deleted data for user ${data.user_id}, code ${confirmationCode}`,
  );

  return Response.json({
    url: `${getAppUrl()}/auth/instagram/data-deletion?code=${confirmationCode}`,
    confirmation_code: confirmationCode,
  });
}

// The status page Meta links the user to. Deletion runs synchronously in the
// action, so any request that got a code is already complete.
export async function loader({ request }) {
  const code = new URL(request.url).searchParams.get("code");

  if (!code) {
    return new Response("Missing confirmation code", { status: 400 });
  }

  return new Response(
    `Data deletion request ${code}: your Instagram data has been deleted from this app.`,
    { headers: { "Content-Type": "text/plain; charset=utf-8" } },
  );
}
