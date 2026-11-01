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
    unassignedBlocks: data?.unassignedBlocks ?? 0,
    orphanedBlocks: data?.orphanedBlocks ?? 0,
    wrongPageBlocks: data?.wrongPageBlocks ?? 0,
    // Unknown until the first check lands — assume on rather than flash a warning.
    storefrontEnabled: data?.storefrontEnabled ?? true,
    feedStatus: (feed) =>
      data?.feeds?.[feed?.label] ?? { added: false, wrongBlocks: [] },
  };
}
