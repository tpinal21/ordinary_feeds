import {
  templateLabel,
  themeCustomizeUrl,
  useThemeBlocks,
} from "app/hooks/useThemeBlocks";
import { useOutletContext } from "react-router";

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// One "Open <template>" button per template holding the broken block, so the
// merchant lands in the theme editor right where the fix is. Falls back to a
// plain theme editor link when the check didn't say where.
const EditorLinks = ({ shop, templates }) => {
  if (!templates.length) {
    return (
      <s-button
        slot="secondary-actions"
        href={themeCustomizeUrl({ shop })}
        target="_blank"
      >
        Open theme editor
      </s-button>
    );
  }
  return templates.map((template) => (
    <s-button
      key={template}
      slot="secondary-actions"
      href={themeCustomizeUrl({ shop, template })}
      target="_blank"
    >
      {templates.length === 1
        ? "Fix in theme editor"
        : `Open ${templateLabel(template)}`}
    </s-button>
  ));
};

// Theme-wide problems that don't belong to any single feed card: blocks with
// an empty feed label, blocks naming a feed that doesn't exist, and blocks
// naming a feed made for another page.
export function ThemeBlockNotices() {
  const { shopDetails } = useOutletContext();
  const shop = shopDetails?.shop_domain;
  const {
    unassignedBlocks,
    orphanedBlocks,
    wrongPageBlocks,
    problemTemplates,
    isLoading,
    isChecking,
    checkFailed,
    mutate,
  } = useThemeBlocks();

  if (isLoading) return null;

  if (checkFailed) {
    return (
      <div className="flex flex-col gap-2 mb-3">
        <s-banner tone="critical" heading="Couldn't check your theme">
          Feed statuses may be out of date.
          <s-button
            slot="secondary-actions"
            onClick={() => mutate()}
            loading={isChecking}
          >
            Try again
          </s-button>
        </s-banner>
      </div>
    );
  }

  if (!unassignedBlocks && !orphanedBlocks && !wrongPageBlocks) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 mb-3">
      {!!unassignedBlocks && (
        <s-banner tone="warning" heading="A feed block has no feed label">
          {plural(unassignedBlocks, "block has", "blocks have")} no feed label
          on a page without a default feed, so nothing shows there. Copy the
          label from the feed card and paste it into the block settings.
          <EditorLinks shop={shop} templates={problemTemplates.unassigned} />
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
          <EditorLinks shop={shop} templates={problemTemplates.orphaned} />
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
          <EditorLinks shop={shop} templates={problemTemplates.wrongPage} />
        </s-banner>
      )}
    </div>
  );
}
