import { authenticate } from "app/shopify.server";
import { SHOPS } from "app/lib/constants";
import directus from "app/directus.server";
import { updateItem } from "@directus/sdk";

const handle = process.env.SHOPIFY_APP_HANDLE;

async function checkThemeExtension({ admin, shop }) {
  const res = await admin.graphql(
    `#graphql
      query MainThemeFiles {
        themes(first: 1, roles: [MAIN]) {
          nodes {
            id
            files(filenames: ["templates/index.json"], first: 1) {
              nodes {
                body { ... on OnlineStoreThemeFileBodyText { content } }
              }
            }
          }
        }
      }`,
  );
  const data = (await res.json()).data;
  const content =
    data?.themes?.nodes?.[0]?.files?.nodes?.[0]?.body?.content ?? "{}";

  const blockAdded = new RegExp(
    `"type"\\s*:\\s*"shopify://apps/${handle}/blocks/carousel/`,
  ).test(content);

  await directus.request(
    updateItem(SHOPS, shop, {
      theme_extension_enabled: blockAdded,
      theme_extension_checked_at: new Date().toISOString(),
    }),
  );

  return { success: blockAdded };
}

export async function action({ request }) {
  const { admin, session } = await authenticate.admin(request);
  return checkThemeExtension({ admin, shop: session.shop });
}
