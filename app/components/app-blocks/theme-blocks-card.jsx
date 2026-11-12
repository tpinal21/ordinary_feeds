import {
  templateLabel,
  themeCustomizeUrl,
  useThemeBlocks,
} from "app/hooks/useThemeBlocks";
import { useOutletContext } from "react-router";

const BLOCK_NAMES = { carousel: "Carousel", grid: "Grid", popup: "Popup" };

// What each placement status means for the merchant, from the check's
// `placements[template][].status`.
const STATUSES = {
  ok: { tone: "success", label: "Live" },
  disabled: { tone: "neutral", label: "Hidden" },
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

// `awaiting_feed` (a block left on its page's default, whose feed doesn't
// exist yet) gets no badge: it fills in once that feed is created.
const BlockRow = ({ placement }) => {
  const status = STATUSES[placement.status];
  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <div className="flex flex-col min-w-0">
        <s-text type="strong">
          {BLOCK_NAMES[placement.block] ?? placement.block} block
        </s-text>
        <span className="text-xs text-neutral-500 truncate">
          {placement.feedLabel
            ? `${placement.feedLabel}${placement.typed ? "" : " (default)"}`
            : "No feed label"}
        </span>
      </div>
      {status && <s-badge tone={status.tone}>{status.label}</s-badge>}
    </div>
  );
};

// The published theme and, page by page, every feed block placed in it with
// what it shows. Pages without a feed block are left out.
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
          <div className="flex flex-col gap-3">
            {templates.map((template) => (
              <div
                key={template}
                className="rounded-md border border-[#e3e3e3] px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2 pb-1 border-b border-[#ebebeb]">
                  <s-text type="strong">{templateLabel(template)}</s-text>
                  <s-link
                    href={themeCustomizeUrl({ shop, template })}
                    target="_blank"
                  >
                    Edit
                  </s-link>
                </div>
                {placements[template].map((placement, i) => (
                  <BlockRow key={i} placement={placement} />
                ))}
              </div>
            ))}
          </div>
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
