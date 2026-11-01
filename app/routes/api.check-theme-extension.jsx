import { authenticate } from "app/shopify.server";
import { SHOPS } from "app/lib/constants";
import directus from "app/directus.server";
import { updateItem } from "@directus/sdk";
import { appSettings } from "app/lib/app-settings";
import { FEED_BLOCKS, FEED_PAGES } from "app/lib/feeds";

const isDev = process.env.NODE_ENV !== "production";

// block handle -> feed type it renders (`grid` -> `GRID`)
const BLOCK_FEED_TYPES = Object.fromEntries(
  Object.entries(FEED_BLOCKS).map(([type, block]) => [block, type]),
);

// App blocks are saved as `shopify://apps/<app handle>/blocks/<block>/<uuid>`.
// The handle in the theme doesn't always equal SHOPIFY_APP_HANDLE (dev vs
// deployed app, renamed handles), so match on the block name instead — any of
// the feed blocks (carousel, grid, popup, …).
const BLOCK_TYPE = new RegExp(
  `^shopify://apps/[^/]+/blocks/(${Object.values(FEED_BLOCKS).join("|")})/`,
);
const APP_BLOCK = /^shopify:\/\/apps\//;

// Every template a feed can be placed on — alternate templates included
// (`product.alt.json`), since a merchant may only add the block to one of them.
const TEMPLATE_FILES = [
  "templates/index.json",
  "templates/product*.json",
  "templates/collection*.json",
];

const THEME_QUERY = `#graphql
  query MainThemeTemplates($filenames: [String!]!) {
    themes(first: 1, roles: [MAIN]) {
      nodes {
        name
        files(filenames: $filenames, first: 100) {
          nodes {
            filename
            body { ... on OnlineStoreThemeFileBodyText { content } }
          }
        }
      }
    }
    shop {
      settings: metafield(namespace: "$app", key: "settings") { jsonValue }
    }
  }`;

const FEEDS_QUERY = `#graphql
  query FeedMetaobjects($after: String) {
    metaobjects(type: "$app:feed", first: 250, after: $after) {
      nodes {
        id
        handle
        type
        label: field(key: "label") { value }
        feedType: field(key: "type") { value }
        page: field(key: "page") { value }
      }
      pageInfo { hasNextPage endCursor }
    }
  }`;

// All `$app:feed` entries, however many pages that takes.
async function readFeedMetaobjects(admin) {
  const all = [];
  let after = null;

  do {
    const res = await admin.graphql(FEEDS_QUERY, { variables: { after } });
    const { data, errors } = await res.json();
    if (errors) throw new Error(JSON.stringify(errors));

    const page = data?.metaobjects;
    all.push(...(page?.nodes ?? []));
    after = page?.pageInfo?.hasNextPage ? page.pageInfo.endCursor : null;
  } while (after);

  return all;
}

// Theme JSON templates start with a generated `/* ... */` header, which
// JSON.parse rejects.
const parseTemplate = (content) => {
  try {
    return JSON.parse(content.replace(/^\s*\/\*[\s\S]*?\*\//, ""));
  } catch {
    return null;
  }
};

// App blocks sit in `sections.*.blocks`, and theme blocks can nest further, so
// walk the whole tree for our feed blocks.
function collectFeedBlocks(node, found = [], appBlockTypes = new Set()) {
  if (!node || typeof node !== "object") return found;

  if (typeof node.type === "string" && APP_BLOCK.test(node.type)) {
    appBlockTypes.add(node.type);
    const block = node.type.match(BLOCK_TYPE)?.[1];
    if (block) {
      found.push({
        block,
        feed: node.settings?.feed ?? null,
        disabled: !!node.disabled,
      });
    }
  }
  for (const value of Object.values(node)) {
    collectFeedBlocks(value, found, appBlockTypes);
  }

  return found;
}

// `templates/product.alt.json` -> `product.alt`
const templateName = (filename) =>
  filename.replace(/^templates\//, "").replace(/\.json$/, "");

// Left empty, a block shows its page's first feed of the block's type —
// `CAROUSEL_PP_01` on a product page. Mirrors the block's Liquid.
const PAGE_CODES = { index: "HP", product: "PP", collection: "CP" };
const pageCode = (templateName) => PAGE_CODES[templateName.split(".")[0]];
const defaultLabel = (templateName, block) => {
  const page = pageCode(templateName);
  return page ? `${BLOCK_FEED_TYPES[block]}_${page}_01` : "";
};

// The typed label, normalized the way the block's Liquid does (`strip | upcase`).
const normalizeLabel = (value) => value.trim().toUpperCase();

async function checkThemeExtension({ admin, shop }) {
  const [themeRes, metaobjects] = await Promise.all([
    admin
      .graphql(THEME_QUERY, { variables: { filenames: TEMPLATE_FILES } })
      .then((res) => res.json()),
    readFeedMetaobjects(admin),
  ]);
  const { data, errors } = themeRes;
  if (errors) console.error("[theme-check] query errors", errors);

  const theme = data?.themes?.nodes?.[0];
  const files = theme?.files?.nodes ?? [];

  // feed label -> where it's placed
  const feeds = {};
  // Every feed block found, with what it resolved to (dev builds only).
  const blocks = [];
  const appBlockTypes = new Set();
  let blockAdded = false;
  // Placed blocks with no label, on a template without a default.
  let unassignedBlocks = 0;
  // Placed blocks whose label matches no feed.
  let orphanedBlocks = 0;
  // Placed blocks naming a feed made for another page (e.g. a home page feed
  // on a product page). The block refuses to render those.
  let wrongPageBlocks = 0;

  for (const { filename, body } of files) {
    const template = parseTemplate(body?.content ?? "");
    const name = templateName(filename);
    if (!template) {
      blocks.push({ template: name, error: "unparseable_template" });
      continue;
    }

    for (const block of collectFeedBlocks(template, [], appBlockTypes)) {
      const feedLabel =
        normalizeLabel(typeof block.feed === "string" ? block.feed : "") ||
        defaultLabel(name, block.block);
      const metaobject = feedLabel
        ? metaobjects.find(
            (m) =>
              m.label?.value === feedLabel ||
              // Blocks saved while the setting was a metaobject picker hold
              // the feed's handle, which the Liquid matches too.
              m.handle?.toUpperCase() === feedLabel,
          )
        : null;
      const label = metaobject?.label?.value ?? null;

      blocks.push({ template: name, ...block, label });

      if (block.disabled) continue;
      blockAdded = true;

      // No label and no default for this template, or a label matching no feed.
      if (!feedLabel) unassignedBlocks += 1;
      else if (!label) orphanedBlocks += 1;
      if (!label) continue;

      if (metaobject.page?.value !== FEED_PAGES[pageCode(name)]) {
        wrongPageBlocks += 1;
        continue;
      }

      const entry = (feeds[label] ??= {
        added: true,
        templates: [],
        wrongBlocks: [],
      });
      if (!entry.templates.includes(name)) entry.templates.push(name);

      // e.g. a GRID feed picked in a carousel block renders as a carousel.
      const feedType = metaobject.feedType?.value;
      if (
        feedType &&
        BLOCK_FEED_TYPES[block.block] !== feedType &&
        !entry.wrongBlocks.includes(block.block)
      ) {
        entry.wrongBlocks.push(block.block);
      }
    }
  }

  // Bookkeeping only — a Directus hiccup mustn't hide the theme status.
  directus
    .request(
      updateItem(SHOPS, shop, {
        theme_extension_enabled: blockAdded,
        theme_extension_checked_at: new Date().toISOString(),
      }),
    )
    .catch((err) => console.error("[theme-check] directus update failed", err));

  // The Settings page's master switch: when off, the block renders nothing
  // even where it's placed, so "Added" alone would mislead the merchant.
  const { storefront_enabled: storefrontEnabled } = appSettings(
    data?.shop?.settings?.jsonValue ?? {},
  );

  return {
    success: blockAdded,
    themeName: theme?.name ?? null,
    storefrontEnabled,
    feeds,
    unassignedBlocks,
    orphanedBlocks,
    wrongPageBlocks,
    // Traces a "Not added" that looks wrong; never shipped to merchants.
    ...(isDev && {
      debug: {
        templates: files.map((f) => f.filename),
        appBlockTypes: [...appBlockTypes],
        blocks,
        metaobjects: metaobjects.map((m) => ({
          id: m.id,
          handle: m.handle,
          label: m.label?.value ?? null,
          type: m.feedType?.value ?? null,
        })),
        errors: errors ?? null,
      },
    }),
  };
}

export async function action({ request }) {
  const { admin, session } = await authenticate.admin(request);

  try {
    return await checkThemeExtension({ admin, shop: session.shop });
  } catch (err) {
    console.error("[theme-check] failed", err);
    return Response.json(
      { success: false, error: String(err?.message ?? err) },
      { status: 500 },
    );
  }
}
