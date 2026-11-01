import { FeedPreview } from "app/components/feed-preview";
import { APP_WINDOW_CHANNEL } from "app/lib/app-window";
import { useThemeBlocks, themeEditorUrl } from "app/hooks/useThemeBlocks";
import { FEEDS_KEY } from "app/lib/feeds";
import { useEffect } from "react";
import { useOutletContext } from "react-router";
import { mutate } from "swr";

export const FeedCard = ({ feed, onRemove }) => {
  const appWindowId = `/feeds/${feed.id}`;
  const { shopDetails, apiKey } = useOutletContext();
  const { feedStatus, isLoading, checkFailed, storefrontEnabled } =
    useThemeBlocks();
  const { added, wrongBlocks } = feedStatus(feed);

  useEffect(() => {
    const channel = new BroadcastChannel(APP_WINDOW_CHANNEL);
    channel.onmessage = ({ data }) => {
      if (data?.type === "close" && data.id === appWindowId) {
        document.getElementById(appWindowId)?.hide();
        // The edit happened in the window's own frame, so this frame's cache
        // still holds the pre-edit feed.
        mutate(FEEDS_KEY);
      }
    };
    return () => channel.close();
  }, [appWindowId]);

  return (
    <s-box
      padding="none"
      border="base"
      borderRadius="large"
      paddingInline="base"
      paddingBlock="base"
      background="subdued"
    >
      <div className="flex items-start justify-between">
        <div className="inline-flex gap-2">
          <s-heading>{feed.label}</s-heading>
          {/* The label is what the merchant types into the theme block. */}
          <button
            type="button"
            className="hover:bg-neutral-100 rounded-md cursor-copy"
            aria-label={`Copy ${feed.label}`}
            title="Copy label for the theme block"
            onClick={() =>
              navigator.clipboard
                .writeText(feed.label)
                .then(() => shopify.toast.show(`Copied ${feed.label}`))
                .catch(() =>
                  shopify.toast.show("Couldn't copy", { isError: true }),
                )
            }
          >
            <s-icon type="clipboard" tone="neutral"></s-icon>
          </button>
        </div>

        <div className="inline-flex gap-2 items-center">
          <s-button
            icon="edit"
            variant="secondary"
            accessibilitylabel={`Edit ${feed.label} feed`}
            commandfor={appWindowId}
            command="--show"
          >
            Edit
          </s-button>
          <s-button
            icon="delete"
            variant="secondary"
            tone="critical"
            onClick={onRemove}
            accessibilitylabel={`Remove ${feed.label} feed`}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="inline-flex gap-2 items-center">
          <div className="inline-flex gap-2 items-center">
            <s-text>Theme block:</s-text>
            {isLoading ? (
              <s-spinner size="base" accessibilitylabel="Checking theme" />
            ) : checkFailed ? (
              <s-badge tone="neutral">Couldn&apos;t check theme</s-badge>
            ) : added ? (
              <>
                <s-badge tone="success" icon="check">
                  Added
                </s-badge>
                {!!wrongBlocks.length && (
                  <s-badge tone="warning" icon="alert-triangle">
                    Picked in a {wrongBlocks.join("/")} block
                  </s-badge>
                )}
                {!storefrontEnabled && (
                  <s-badge tone="critical" icon="hide">
                    Hidden on storefront
                  </s-badge>
                )}
              </>
            ) : (
              <>
                <s-badge tone="warning">Not added</s-badge>
                <s-button
                  variant="tertiary"
                  icon="app-extension"
                  href={themeEditorUrl({
                    shop: shopDetails?.shop_domain,
                    apiKey,
                    page: feed.page,
                    type: feed.type,
                  })}
                  target="_blank"
                  accessibilitylabel={`Add ${feed.label} to theme`}
                >
                  Add theme block
                </s-button>
              </>
            )}
          </div>
        </div>
        <div className="mt-1">
          <s-heading>Preview</s-heading>
        </div>
        <FeedPreview
          type={feed?.type}
          media={feed?.gallery?.media}
          settings={feed?.settings}
        />
      </div>
      <s-app-window id={appWindowId} src={appWindowId}></s-app-window>
    </s-box>
  );
};
