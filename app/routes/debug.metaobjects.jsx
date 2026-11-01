import { authenticate } from "app/shopify.server";
import { useLoaderData } from "react-router";

// Debug view of everything the app keeps in Shopify for the current shop: the
// three app-owned metaobject types (as declared in shopify.app.toml) and the
// two shop metafields. Not linked from the nav — open /debug/metaobjects.

const TYPES = ["post", "gallery", "feed"];

const TYPE_QUERY = `#graphql
  query DebugMetaobjectType($type: String!) {
    definition: metaobjectDefinitionByType(type: $type) {
      id
      type
      name
      metaobjectsCount
      fieldDefinitions {
        key
        required
        type { name }
      }
    }
    entries: metaobjects(type: $type, first: 100) {
      nodes {
        id
        handle
        updatedAt
        fields { key value }
      }
      pageInfo { hasNextPage }
    }
  }`;

const SHOP_QUERY = `#graphql
  query DebugShopMetafields {
    shop {
      myshopifyDomain
      settings: metafield(namespace: "$app", key: "settings") {
        jsonValue
        updatedAt
      }
      feedCache: metafield(namespace: "$app", key: "insta_feed_posts") {
        jsonValue
        updatedAt
      }
    }
  }`;

// { key, value }[] -> { key: value }, parsing JSON values (settings, lists).
const flattenFields = (fields) =>
  Object.fromEntries(
    fields.map(({ key, value }) => {
      try {
        return [key, JSON.parse(value)];
      } catch {
        return [key, value];
      }
    }),
  );

async function readType(admin, name) {
  const res = await admin.graphql(TYPE_QUERY, {
    variables: { type: `$app:${name}` },
  });
  const { data, errors } = await res.json();

  return {
    name,
    errors: errors ?? null,
    definition: data?.definition ?? null,
    hasMore: data?.entries?.pageInfo?.hasNextPage ?? false,
    entries: (data?.entries?.nodes ?? []).map(({ fields, ...entry }) => ({
      ...entry,
      fields: flattenFields(fields),
    })),
  };
}

export async function loader({ request }) {
  // Dumps raw store data — dev builds only.
  if (process.env.NODE_ENV === "production") {
    throw new Response("Not found", { status: 404 });
  }

  const { admin } = await authenticate.admin(request);

  const [types, shopRes] = await Promise.all([
    Promise.all(TYPES.map((name) => readType(admin, name))),
    admin.graphql(SHOP_QUERY).then((res) => res.json()),
  ]);

  return { types, shop: shopRes.data?.shop ?? null };
}

const Json = ({ value }) => (
  <pre className="overflow-auto max-h-120 rounded-md bg-neutral-100 p-3 text-xs leading-relaxed">
    {JSON.stringify(value, null, 2)}
  </pre>
);

export default function DebugMetaobjects() {
  const { types, shop } = useLoaderData();

  return (
    <s-page heading="Metaobjects (debug)" inlineSize="large">
      <s-paragraph color="subdued">
        Raw app data stored in Shopify for {shop?.myshopifyDomain}.
      </s-paragraph>

      {types.map(({ name, definition, entries, hasMore, errors }) => (
        <s-section key={name} heading={`$app:${name}`}>
          {errors && (
            <s-banner tone="critical" heading="Query failed">
              <Json value={errors} />
            </s-banner>
          )}
          {!definition ? (
            <s-banner tone="warning" heading="No definition on this shop">
              Deploy the app config (shopify app deploy) or approve the updated
              scopes on this store.
            </s-banner>
          ) : (
            <s-stack gap="base">
              <s-text>
                {definition.type} · {definition.metaobjectsCount} entries
                {hasMore && " (showing first 100)"}
              </s-text>
              <s-heading>Definition</s-heading>
              <Json value={definition} />
              <s-heading>Entries</s-heading>
              <Json value={entries} />
            </s-stack>
          )}
        </s-section>
      ))}

      <s-section heading="Shop metafields">
        <s-stack gap="base">
          <s-heading>$app.settings</s-heading>
          <Json value={shop?.settings ?? null} />
          <s-heading>$app.insta_feed_posts</s-heading>
          <Json value={shop?.feedCache ?? null} />
        </s-stack>
      </s-section>
    </s-page>
  );
}
