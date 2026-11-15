import {
  templateLabel,
  themeCustomizeUrl,
  useThemeBlocks,
} from "app/hooks/useThemeBlocks";
import { useOutletContext } from "react-router";

// What each placement status means for the merchant, from the check's
// `placements[template][].status`.
const STATUSES = {
  ok: { tone: "success", label: "Live" },
  disabled: { tone: "neutral", label: "Hidden" },
  // Left on the page's default label, and no feed has it — typically the
  // feed was deleted in the app while its block stayed in the theme.
  awaiting_feed: { tone: "warning", label: "No feed" },
  unassigned: { tone: "warning", label: "No feed label" },
  orphaned: { tone: "warning", label: "Feed not found" },
  wrong_page: { tone: "warning", label: "Other page's feed" },
  wrong_type: { tone: "warning", label: "Type mismatch" },
};

// Home page first, then product and collection templates (alternates after
// their base template).
const PAGE_ORDER = ["index", "product", "collection"];
const sortTemplates = (a, b) => {
  const rank = (t) => {
    const i = PAGE_ORDER.indexOf(t.split(".")[0]);
    return i === -1 ? PAGE_ORDER.length : i;
  };
  return rank(a) - rank(b) || a.localeCompare(b);
};

// Blocks that render nothing on the storefront. They still take up a spot
// in the theme, so tell the merchant how to clear them.
const EMPTY_STATUSES = new Set(["awaiting_feed", "orphaned", "unassigned"]);

const BlockNode = ({ id, placement }) => {
  const status = STATUSES[placement.status];
  const empty = EMPTY_STATUSES.has(placement.status);
  const tipId = `theme-block-help-${id}`;
  return (
    <li className="flex items-center gap-2 min-h-7 pl-3">
      <div className="flex items-center gap-1.5 min-w-0">
        <s-text type="strong">
          {placement.feedLabel ? `${placement.feedLabel}` : "No feed label"}
        </s-text>
      </div>
      {status && <s-badge tone={status.tone}>{status.label}</s-badge>}
      {empty && (
        <>
          <button
            type="button"
            interestfor={tipId}
            aria-label="Why this block shows nothing"
            className="inline-flex cursor-help"
          >
            <s-icon type="info" tone="auto" color="subdued" />
          </button>
          <s-tooltip id={tipId}>
            Shows nothing on your store. Remove this block in the theme editor.
          </s-tooltip>
        </>
      )}
    </li>
  );
};

const PageNode = ({ shop, template, placements }) => (
  <li>
    <div className="flex items-center justify-between gap-2 mb-2">
      <s-heading variant="headingMd">{templateLabel(template)}</s-heading>
      <s-link href={themeCustomizeUrl({ shop, template })} target="_blank">
        Edit
      </s-link>
    </div>
    <ul>
      {placements.map((placement, i) => (
        <BlockNode key={i} id={`${template}-${i}`} placement={placement} />
      ))}
    </ul>
  </li>
);

export const ThemeBlocksCard = () => {
  const { shopDetails } = useOutletContext();
  const shop = shopDetails?.shop_domain;
  const { themeName, placements, isLoading, isChecking, checkFailed, mutate } =
    useThemeBlocks();

  const templates = Object.keys(placements)
    .filter((t) => placements[t].length)
    .sort(sortTemplates);

  return (
    <s-section>
      <s-stack direction="block" gap="base">
        <s-stack direction="block" gap="small-300">
          <s-heading>Theme blocks</s-heading>
          {themeName && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-neutral-500 truncate">
                Active theme:{" "}
                <strong className="text-neutral-600">{themeName}</strong>
              </span>
              <s-badge tone="success">Live</s-badge>
            </div>
          )}
        </s-stack>

        {isLoading ? (
          <s-stack direction="inline" gap="small" alignItems="center">
            <s-spinner size="base" accessibilityLabel="Checking your theme" />
            <s-text color="subdued">Checking your theme…</s-text>
          </s-stack>
        ) : checkFailed ? (
          <s-stack direction="block" gap="small">
            <s-text tone="critical">Couldn&apos;t check your theme.</s-text>
            <div>
              <s-button onClick={() => mutate()} loading={isChecking}>
                Try again
              </s-button>
            </div>
          </s-stack>
        ) : !templates.length ? (
          <s-text color="subdued">
            No feed blocks in your theme yet. Add one from the theme editor.
          </s-text>
        ) : (
          <ul className="flex flex-col gap-2">
            {templates.map((template) => (
              <PageNode
                key={template}
                shop={shop}
                template={template}
                placements={placements[template]}
              />
            ))}
          </ul>
        )}

        <s-stack direction="inline" gap="small">
          <s-button
            variant="primary"
            href={themeCustomizeUrl({ shop })}
            target="_blank"
          >
            Customize theme
          </s-button>
          <s-button href={`https://${shop}`} target="_blank">
            View store
          </s-button>
        </s-stack>
      </s-stack>
    </s-section>
  );
};
