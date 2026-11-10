// Mirrors saved Instagram posts into the app-owned `$app:post` metaobjects the
// storefront reads. Directus stays the source of truth; Shopify only gets
// what Liquid needs, with tagged products stored as product references so
// their title, price and image are always live.

// Upserts per GraphQL request, sent as aliased mutations in one document.
const CHUNK_SIZE = 25;

const buildMutation = (count) => {
  const vars = [];
  const calls = [];
  for (let i = 0; i < count; i++) {
    vars.push(
      `$handle${i}: MetaobjectHandleInput!, $metaobject${i}: MetaobjectUpsertInput!`,
    );
    calls.push(`
    post${i}: metaobjectUpsert(handle: $handle${i}, metaobject: $metaobject${i}) {
      metaobject { id }
      userErrors { field message code }
    }`);
  }
  return `#graphql
  mutation UpsertPosts(${vars.join(", ")}) {${calls.join("")}
  }`;
};

// Metaobject handle for a Directus id (posts and galleries alike). Handles
// only allow lowercase letters, digits, `-` and `_`.
export const postHandle = (mediaId) =>
  String(mediaId)
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-");

// One Directus `instagram_media` item (as written by the posts action) ->
// the metaobject fields. Optional fields with no value are left out rather
// than sent empty; `products` is always sent so untagging clears it.
const toFields = (media) => {
  const fields = {
    media_type: media.media_type,
    media_url: media.media_url,
    thumbnail_url: media.thumbnail_url,
    caption: media.caption,
    products: JSON.stringify(
      (media.products ?? []).map((p) => p.product_id.id),
    ),
  };

  return Object.entries(fields)
    .filter(([, value]) => value != null && value !== "")
    .map(([key, value]) => ({ key, value: String(value) }));
};

// Upserts one `$app:post` metaobject per media item, keyed by its Directus
// id. Throws if Shopify rejects any of them; every upsert is idempotent, so
// retrying the whole save is safe.
export async function syncPostMetaobjects(admin, mediaItems) {
  // `media_url` is required on the definition; posts without one (e.g.
  // copyright-blocked videos) can't be rendered on the storefront anyway.
  const items = mediaItems.filter((m) => m.media_url && m.media_type);
  const errors = [];

  for (let start = 0; start < items.length; start += CHUNK_SIZE) {
    const chunk = items.slice(start, start + CHUNK_SIZE);
    const variables = {};
    chunk.forEach((media, i) => {
      variables[`handle${i}`] = {
        type: "$app:post",
        handle: postHandle(media.id),
      };
      variables[`metaobject${i}`] = { fields: toFields(media) };
    });

    const res = await admin.graphql(buildMutation(chunk.length), { variables });
    const { data, errors: gqlErrors } = await res.json();

    if (gqlErrors?.length) {
      errors.push(...gqlErrors.map((e) => e.message));
      continue;
    }

    chunk.forEach((media, i) => {
      for (const e of data?.[`post${i}`]?.userErrors ?? []) {
        errors.push(`${media.id}: ${e.message}`);
      }
    });
  }

  if (errors.length) {
    throw new Error(`Post metaobject sync failed: ${errors.join("; ")}`);
  }
}

const buildLookup = (count) => {
  const vars = [];
  const calls = [];
  for (let i = 0; i < count; i++) {
    vars.push(`$handle${i}: MetaobjectHandleInput!`);
    calls.push(`
    entry${i}: metaobjectByHandle(handle: $handle${i}) { id }`);
  }
  return `#graphql
  query FindMetaobjects(${vars.join(", ")}) {${calls.join("")}
  }`;
};

const buildDelete = (count) => {
  const vars = [];
  const calls = [];
  for (let i = 0; i < count; i++) {
    vars.push(`$id${i}: ID!`);
    calls.push(`
    entry${i}: metaobjectDelete(id: $id${i}) {
      deletedId
      userErrors { field message code }
    }`);
  }
  return `#graphql
  mutation DeleteMetaobjects(${vars.join(", ")}) {${calls.join("")}
  }`;
};

// Deletes the app-owned metaobjects of `type` (e.g. "post", "gallery") whose
// handles are derived from these Directus ids. Ids that never got a
// metaobject are skipped. Throws if Shopify rejects any delete.
export async function deleteMetaobjects(admin, type, directusIds) {
  const errors = [];

  for (let start = 0; start < directusIds.length; start += CHUNK_SIZE) {
    const chunk = directusIds.slice(start, start + CHUNK_SIZE);

    const lookupVars = Object.fromEntries(
      chunk.map((id, i) => [
        `handle${i}`,
        { type: `$app:${type}`, handle: postHandle(id) },
      ]),
    );
    const lookup = await (
      await admin.graphql(buildLookup(chunk.length), {
        variables: lookupVars,
      })
    ).json();
    if (lookup.errors?.length) {
      errors.push(...lookup.errors.map((e) => e.message));
      continue;
    }

    const ids = chunk
      .map((_, i) => lookup.data?.[`entry${i}`]?.id)
      .filter(Boolean);
    if (!ids.length) continue;

    const res = await (
      await admin.graphql(buildDelete(ids.length), {
        variables: Object.fromEntries(ids.map((id, i) => [`id${i}`, id])),
      })
    ).json();
    if (res.errors?.length) {
      errors.push(...res.errors.map((e) => e.message));
      continue;
    }
    ids.forEach((id, i) => {
      for (const e of res.data?.[`entry${i}`]?.userErrors ?? []) {
        errors.push(`${id}: ${e.message}`);
      }
    });
  }

  if (errors.length) {
    throw new Error(`${type} metaobject delete failed: ${errors.join("; ")}`);
  }
}

export const deletePostMetaobjects = (admin, mediaIds) =>
  deleteMetaobjects(admin, "post", mediaIds);

export const deleteGalleryMetaobject = (admin, galleryId) =>
  deleteMetaobjects(admin, "gallery", [galleryId]);

const PURGE_TYPES = ["post", "gallery", "feed"];

const PURGE_MUTATION = `#graphql
  mutation PurgeMetaobjects {
    ${PURGE_TYPES.map(
      (
        type,
      ) => `${type}: metaobjectBulkDelete(where: { type: "$app:${type}" }) {
      job { id }
      userErrors { field message code }
    }`,
    ).join("\n    ")}
  }`;

// Deletes every app-owned post, gallery and feed metaobject in the store.
// Shopify runs each bulk delete as a background job, so entries can take a
// few seconds to disappear. Throws if Shopify rejects any of them.
export async function purgeAppMetaobjects(admin) {
  const res = await admin.graphql(PURGE_MUTATION);
  const { data, errors } = await res.json();

  const problems = [
    ...(errors ?? []).map((e) => e.message),
    ...PURGE_TYPES.flatMap((type) =>
      (data?.[type]?.userErrors ?? []).map((e) => `${type}: ${e.message}`),
    ),
  ];

  if (problems.length) {
    throw new Error(`Metaobject purge failed: ${problems.join("; ")}`);
  }
}
