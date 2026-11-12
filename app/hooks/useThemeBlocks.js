import { useFetch } from "app/hooks/useFetch";
import { apiFetch } from "app/lib/api-client";
import { feedBlockHandle } from "app/lib/feeds";

export const THEME_BLOCKS_KEY = "check-theme-extension";

// Theme editor template each feed page maps to.
const PAGE_TEMPLATES = {
  HOME_PAGE: "index",
  PRODUCT_PAGE: "product",
  COLLECTION_PAGE: "collection",
};

// `product.alt` -> "Product page (alt)", `index` -> "Home page"
const TEMPLATE_NAMES = {
  index: "Home page",
  product: "Product page",
  collection: "Collection page",
};
export const templateLabel = (template) => {
  const [base, ...rest] = template.split(".");
  const name = TEMPLATE_NAMES[base] ?? base;
  return rest.length ? `${name} (${rest.join(".")})` : name;
};

// Opens the live theme's editor, optionally on a specific template
// (`product.alt` included) so the merchant lands where the fix is.
export const themeCustomizeUrl = ({ shop, template }) =>
  `https://${shop}/admin/themes/current/editor${
    template ? `?template=${encodeURIComponent(template)}` : ""
  }`;

// Opens the theme editor on the feed's page with its type's block ready to add.
export const themeEditorUrl = ({
  shop,
  apiKey,
  page = "HOME_PAGE",
  type = "CAROUSEL",
}) =>
  `https://${shop}/admin/themes/current/editor?template=${
    PAGE_TEMPLATES[page] ?? "index"
  }&addAppBlockId=${apiKey}/${feedBlockHandle(type)}&target=newAppsSection`;

// Placed blocks that render nothing and can take a new feed instead of a
// second block being added.
const REUSABLE_STATUSES = new Set(["awaiting_feed", "orphaned", "unassigned"]);

const reusableTemplate = (placements, feed) => {
  const base = PAGE_TEMPLATES[feed?.page];
  const block = feedBlockHandle(feed?.type);
  if (!base || !placements) return null;

  return (
    Object.keys(placements)
      .filter((t) => t.split(".")[0] === base)
      // The page's main template before alternates like `product.alt`.
      .sort((a, b) => (a === base ? -1 : b === base ? 1 : a.localeCompare(b)))
      .find((t) =>
        placements[t].some(
          (p) => p.block === block && REUSABLE_STATUSES.has(p.status),
        ),
      ) ?? null
  );
};

// Which feeds are placed in the live theme. Every caller shares one SWR key,
// so a page full of feed cards still makes a single request. Focus
// revalidation re-checks when the merchant comes back from the theme editor;
// both intervals keep tab-switching from hammering the Admin API.
export function useThemeBlocks({ enabled = true, ...config } = {}) {
  const swr = useFetch(
    enabled ? THEME_BLOCKS_KEY : null,
    () => apiFetch("/api/check-theme-extension", { method: "POST" }),
    {
      revalidateOnFocus: true,
      dedupingInterval: 10_000,
      focusThrottleInterval: 10_000,
      ...config,
    },
  );
  const { data } = swr;

  return {
    ...swr,
    isChecking: swr.isLoading || swr.isValidating,
    // The check itself failed — "Not added" would be a guess.
    checkFailed: !!data?.error,
    themeName: data?.themeName ?? null,
    themeId: data?.themeId ?? null,
    themeUpdatedAt: data?.themeUpdatedAt ?? null,
    placements: data?.placements ?? {},
    problemTemplates: {
      unassigned: data?.problemTemplates?.unassigned ?? [],
      orphaned: data?.problemTemplates?.orphaned ?? [],
      wrongPage: data?.problemTemplates?.wrongPage ?? [],
    },
    unassignedBlocks: data?.unassignedBlocks ?? 0,
    orphanedBlocks: data?.orphanedBlocks ?? 0,
    wrongPageBlocks: data?.wrongPageBlocks ?? 0,
    // Unknown until the first check lands — assume on rather than flash a warning.
    storefrontEnabled: data?.storefrontEnabled ?? true,
    feedStatus: (feed) =>
      data?.feeds?.[feed?.label] ?? { added: false, wrongBlocks: [] },
    // Where "Add to theme" should send the merchant for a feed that isn't
    // placed yet: a block of the feed's type already on its page that shows
    // nothing (left on a default with no feed, or a label matching no feed)
    // is reused — the editor opens on that page instead of adding a second
    // block. Otherwise a new block is added.
    addToThemeUrl: ({ shop, apiKey, feed }) => {
      const template = reusableTemplate(data?.placements, feed);
      return template
        ? themeCustomizeUrl({ shop, template })
        : themeEditorUrl({ shop, apiKey, page: feed?.page, type: feed?.type });
    },
  };
}
