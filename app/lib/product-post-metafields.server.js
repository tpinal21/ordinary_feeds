// Keeps each product's `$app.instagram_posts` metafield (the posts that
// product is tagged in, newest first) in step with Directus. PRODUCT
// galleries read it on the product page, since Liquid can't search posts by
// tagged product itself.
import { readItems } from "@directus/sdk";
import directus from "app/directus.server";
import { IG_MEDIA_PRODUCTS } from "app/lib/constants";
import { lookupMetaobjectIds } from "app/lib/post-metaobjects.server";

const NAMESPACE = "$app";
const KEY = "instagram_posts";

// Gallery post limits top out at 20; keep some headroom without letting a
// heavily tagged product grow the list without bound.
const MAX_POSTS_PER_PRODUCT = 50;

// metafieldsSet / metafieldsDelete accept at most 25 metafields per call.
const CHUNK_SIZE = 25;

const SET_MUTATION = `#graphql
  mutation SetProductPosts($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      userErrors { field message code }
    }
  }`;

const DELETE_MUTATION = `#graphql
  mutation ClearProductPosts($metafields: [MetafieldIdentifierInput!]!) {
    metafieldsDelete(metafields: $metafields) {
      userErrors { field message }
    }
  }`;

// Shopify product GIDs tagged on these posts, read from Directus. Call it
// before a save that may untag them, and pass the result to the sync along
// with the new tags so untagged products get cleared too.
export async function readTaggedProductIds(mediaIds) {
  if (!mediaIds?.length) return [];
  const rows = await directus.request(
    readItems(IG_MEDIA_PRODUCTS, {
      filter: { instagram_media_id: { _in: mediaIds } },
      fields: ["product_id"],
      limit: -1,
    }),
  );
  return [...new Set(rows.map((r) => r.product_id).filter(Boolean))];
}

// Every product tagged on any post of these Instagram accounts.
export async function readAccountTaggedProductIds(accountIds) {
  if (!accountIds?.length) return [];
  const rows = await directus.request(
    readItems(IG_MEDIA_PRODUCTS, {
      filter: {
        instagram_media_id: { instagram_account: { _in: accountIds } },
      },
      fields: ["product_id"],
      limit: -1,
    }),
  );
  return [...new Set(rows.map((r) => r.product_id).filter(Boolean))];
}

// `{ [product GID]: [media id, ...] }`, newest post first, for this shop.
async function readPostsByProduct(shopDomain, productIds) {
  const rows = await directus.request(
    readItems(IG_MEDIA_PRODUCTS, {
      filter: {
        _and: [
          { product_id: { _in: productIds } },
          {
            instagram_media_id: {
              instagram_account: { shop: { _eq: shopDomain } },
            },
          },
        ],
      },
      fields: [
        "product_id",
        "instagram_media_id.id",
        "instagram_media_id.timestamp",
      ],
      limit: -1,
    }),
  );

  const byProduct = Object.fromEntries(productIds.map((id) => [id, []]));
  for (const row of rows) {
    if (row.instagram_media_id?.id)
      byProduct[row.product_id]?.push(row.instagram_media_id);
  }
  const time = (m) => (m.timestamp ? Date.parse(m.timestamp) : 0);
  for (const id of productIds) {
    byProduct[id] = byProduct[id]
      .sort((a, b) => time(b) - time(a))
      .map((m) => m.id);
  }
  return byProduct;
}

const userErrorsOf = (json, field) => [
  ...(json.errors ?? []).map((e) => e.message),
  ...(json.data?.[field]?.userErrors ?? []).map((e) => e.message),
];

// Rewrites the metafield of every given product from Directus. Products with
// no tagged posts left get the metafield removed. Posts without a `$app:post`
// metaobject (e.g. no media URL) are skipped. Idempotent; throws if Shopify
// rejects any write.
export async function syncProductPostMetafields(admin, shopDomain, productIds) {
  const ids = [...new Set(productIds)].filter(Boolean);
  if (!ids.length) return;

  const postsByProduct = await readPostsByProduct(shopDomain, ids);
  const mediaIds = [...new Set(Object.values(postsByProduct).flat())];
  const gids = await lookupMetaobjectIds(admin, "post", mediaIds);

  const toSet = [];
  const toClear = [];
  for (const productId of ids) {
    const posts = postsByProduct[productId]
      .map((mediaId) => gids[mediaId])
      .filter(Boolean)
      .slice(0, MAX_POSTS_PER_PRODUCT);
    if (posts.length) {
      toSet.push({
        ownerId: productId,
        namespace: NAMESPACE,
        key: KEY,
        type: "list.metaobject_reference",
        value: JSON.stringify(posts),
      });
    } else {
      toClear.push({ ownerId: productId, namespace: NAMESPACE, key: KEY });
    }
  }

  const errors = [];
  for (let i = 0; i < toSet.length; i += CHUNK_SIZE) {
    const res = await admin.graphql(SET_MUTATION, {
      variables: { metafields: toSet.slice(i, i + CHUNK_SIZE) },
    });
    errors.push(...userErrorsOf(await res.json(), "metafieldsSet"));
  }
  for (let i = 0; i < toClear.length; i += CHUNK_SIZE) {
    const res = await admin.graphql(DELETE_MUTATION, {
      variables: { metafields: toClear.slice(i, i + CHUNK_SIZE) },
    });
    errors.push(...userErrorsOf(await res.json(), "metafieldsDelete"));
  }

  if (errors.length) {
    throw new Error(
      `Product posts metafield sync failed: ${errors.join("; ")}`,
    );
  }
}
