import { deleteItems, readItems, updateItem } from "@directus/sdk";
import directus from "app/directus.server";
import { redirect } from "react-router";
import {
  exchangeCodeForLongLivedToken,
  fetchProfileFromInstagram,
  verifyState,
} from "../lib/instagram.server";
import {
  FEEDS,
  GALLERIES,
  IG_ACCOUNTS,
  IG_MEDIA,
  SHOPS,
} from "app/lib/constants";
import { purgeAppMetaobjects } from "app/lib/post-metaobjects.server";
import {
  readAccountTaggedProductIds,
  syncProductPostMetafields,
} from "app/lib/product-post-metafields.server";
import { unauthenticated } from "../shopify.server";

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Every Instagram account this shop has ever connected, most recent first.
// Accounts keep their row after a disconnect but lose the `shop` link, so
// they're also matched by their `<instagram id>-<shop handle>` id.
async function shopAccountIds(shopDomain, shopHandle) {
  const ownId = new RegExp(`^\\d+-${escapeRegExp(shopHandle)}$`);
  const accounts = await directus.request(
    readItems(IG_ACCOUNTS, {
      filter: {
        _or: [
          { shop: { _eq: shopDomain } },
          { id: { _ends_with: `-${shopHandle}` } },
        ],
      },
      fields: ["id", "shop", "connected_at"],
      limit: -1,
    }),
  );

  // Sorted here, not in the query: Postgres puts NULLs first on a
  // descending sort, which would rank never-connected rows on top.
  const time = (a) => (a.connected_at ? Date.parse(a.connected_at) : 0);
  return accounts
    .filter((a) => a.shop === shopDomain || ownId.test(a.id))
    .sort((a, b) => time(b) - time(a))
    .map((a) => a.id);
}

// Switching to another Instagram account: the store's feeds, galleries and
// posts belong to the old one, so clear them in Shopify and in Directus.
// Shopify goes first so a failure there leaves Directus untouched; every
// step is safe to repeat on the next attempt.
async function clearPreviousAccountData(shopDomain, oldAccountIds) {
  const { admin } = await unauthenticated.admin(shopDomain);
  // Read before the posts (and their tags) are deleted below.
  const taggedProductIds = await readAccountTaggedProductIds(oldAccountIds);
  await purgeAppMetaobjects(admin);

  // Feeds point at galleries (SET NULL), and deleting a gallery takes its
  // post links with it, so feeds first, then galleries, then the posts.
  await directus.request(
    deleteItems(FEEDS, { filter: { shop: { _eq: shopDomain } } }),
  );
  await directus.request(
    deleteItems(GALLERIES, { filter: { shop: { _eq: shopDomain } } }),
  );
  // Scoped to this shop's own old accounts, so no other shop's posts match.
  // Their product tags (junction rows) cascade with them.
  await directus.request(
    deleteItems(IG_MEDIA, {
      filter: { instagram_account: { _in: oldAccountIds } },
    }),
  );

  // With the tags gone this clears each product's post list, so product
  // pages don't keep pointing at the purged post metaobjects.
  await syncProductPostMetafields(admin, shopDomain, taggedProductIds);
}

function buildEmbeddedRedirect(shop, params) {
  const handle = process.env.SHOPIFY_APP_HANDLE;
  const qs = new URLSearchParams(params);
  return `https://admin.shopify.com/store/${shop}/apps/${handle}/setup?${qs.toString()}`;
}

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return new Response(`Instagram authorization failed: ${error}`, {
      status: 400,
    });
  }

  const verified = verifyState(state);
  if (!verified?.shop) {
    return new Response("Invalid or expired state", { status: 400 });
  }
  if (!code) {
    return new Response("Missing authorization code", { status: 400 });
  }

  const shopDomain = verified.shop;
  const shopHandle = shopDomain.replace(".myshopify.com", "");

  try {
    const { accessToken, expiresInSeconds } =
      await exchangeCodeForLongLivedToken(code);

    const account = await fetchProfileFromInstagram(accessToken);

    const now = new Date();
    const accountId = `${account.id}-${shopHandle}`;

    // A different account than last time: clear the old one's data. Done
    // before saving the new account so that if it fails, the next connect
    // attempt still sees the old account as the last one and tries again.
    const accountIds = await shopAccountIds(shopDomain, shopHandle);
    if (accountIds.length && accountIds[0] !== accountId) {
      try {
        await clearPreviousAccountData(
          shopDomain,
          accountIds.filter((id) => id !== accountId),
        );
      } catch (err) {
        console.error("[instagram] clearing previous account failed", err);
        throw redirect(
          buildEmbeddedRedirect(shopHandle, {
            ig_connected: "0",
            error: "account_switch_failed",
          }),
        );
      }
    }

    await directus.request(
      updateItem(SHOPS, shopDomain, {
        instagram_account: [
          {
            ...account,
            id: accountId,
            is_syncing: true, // sync media from instagram instantly after connection
            status: "CONNECTED",
            connected_at: now.toISOString(),
            access_token: accessToken,
            token_expires_at: new Date(
              now.getTime() + expiresInSeconds * 1000,
            ).toISOString(),
          },
        ],
      }),
    );

    throw redirect(buildEmbeddedRedirect(shopHandle, { ig_connected: "1" }));
  } catch (err) {
    if (err instanceof Response) throw err;
    console.error("[instagram] callback failed", err);
    throw redirect(
      buildEmbeddedRedirect(shopHandle, {
        ig_connected: "0",
        error: "exchange_failed",
      }),
    );
  }
};
