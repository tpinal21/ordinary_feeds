import { useThemeBlocks } from "app/hooks/useThemeBlocks";

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// Theme-wide problems that don't belong to any single feed card: blocks with
// an empty feed label, blocks naming a feed that doesn't exist, and blocks
// naming a feed made for another page.
// Also names the theme that was checked, since unpublished themes aren't.
export function ThemeBlockNotices() {
  const {
    unassignedBlocks,
    orphanedBlocks,
    wrongPageBlocks,
    themeName,
    isLoading,
    checkFailed,
  } = useThemeBlocks();

  if (isLoading) return null;

  if (checkFailed) {
    return (
      <s-banner tone="critical" heading="Couldn't check your theme">
        Feed statuses may be out of date. Reopen this page to try again.
      </s-banner>
    );
  }

  return (
    <>
      {!!unassignedBlocks && (
        <s-banner tone="warning" heading="A feed block has no feed label">
          {plural(unassignedBlocks, "block has", "blocks have")} no feed label
          on a page without a default feed, so nothing shows there. Copy the
          label from the feed card and paste it into the block settings.
        </s-banner>
      )}
      {!!orphanedBlocks && (
        <s-banner
          tone="warning"
          heading="A feed block names a feed that doesn't exist"
        >
          {plural(orphanedBlocks, "block has", "blocks have")} a feed label that
          doesn&apos;t match any feed (mistyped, or the feed was deleted). Copy
          the label from the feed card and paste it into the block settings.
        </s-banner>
      )}
      {!!wrongPageBlocks && (
        <s-banner
          tone="warning"
          heading="A feed block uses another page's feed"
        >
          {plural(wrongPageBlocks, "block uses", "blocks use")} a feed created
          for a different page (e.g. a home page feed on a product page), so
          nothing shows there. Use a feed created for that page.
        </s-banner>
      )}
      {themeName && (
        <s-text color="subdued">
          Statuses are checked against your published theme ({themeName}).
        </s-text>
      )}
    </>
  );
}
