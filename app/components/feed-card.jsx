import { FeedPreview } from "app/components/feed-preview";
import { APP_WINDOW_CHANNEL } from "app/lib/app-window";
import {
  THEME_BLOCKS_KEY,
  templateLabel,
  useThemeBlocks,
} from "app/hooks/useThemeBlocks";
import { apiFetch } from "app/lib/api-client";
import { FEEDS_KEY } from "app/lib/feeds";
import { useEffect, useState } from "react";
import { useOutletContext } from "react-router";
import { mutate } from "swr";

export const FeedCard = ({ feed }) => {
  const appWindowId = `/feeds/${feed.id}`;
  const deleteModalId = `delete-feed-${feed.id}`;
  const { shopDetails, apiKey } = useOutletContext();
  const {
    feedStatus,
    addToThemeUrl,
    isLoading,
    checkFailed,
    storefrontEnabled,
  } = useThemeBlocks();
  const { added, wrongBlocks, templates = [] } = feedStatus(feed);

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
            commandfor={deleteModalId}
            command="--show"
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
                  href={addToThemeUrl({
                    shop: shopDetails?.shop_domain,
                    apiKey,
                    feed,
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
        <div className="mt-1 flex items-center justify-between gap-2">
          <div className="inline-flex items-center gap-1">
            <s-heading>Preview</s-heading>
            <button
              type="button"
              interestfor={`preview-help-${feed.id}`}
              aria-label="About this preview"
              className="cursor-help"
            >
              <s-icon type="info" tone="auto" color="subdued" />
            </button>
            <s-tooltip id={`preview-help-${feed.id}`}>
              Posts are shown at laptop size. Open Full preview to check tablet
              and mobile.
            </s-tooltip>
          </div>
          <s-button
            variant="tertiary"
            icon="maximize"
            commandfor={appWindowId}
            command="--show"
            accessibilitylabel={`Full preview of ${feed.label}`}
          >
            Full preview
          </s-button>
        </div>
        <FeedPreview
          type={feed?.type}
          media={feed?.gallery?.media}
          settings={feed?.settings}
        />
      </div>
      <s-app-window id={appWindowId} src={appWindowId}></s-app-window>
      <DeleteFeedModal
        id={deleteModalId}
        feed={feed}
        added={!isLoading && !checkFailed && added}
        unknown={isLoading || checkFailed}
        templates={templates}
      />
    </s-box>
  );
};

// "Delete <label>?" — the message depends on whether the feed is placed in
// the live theme, since deleting a placed feed blanks that block.
const DeleteFeedModal = ({ id, feed, added, unknown, templates }) => {
  const [deleting, setDeleting] = useState(false);

  const pages = templates.map(templateLabel).join(", ");

  const onDelete = async () => {
    setDeleting(true);
    try {
      const res = await apiFetch(`/api/feeds/${feed.id}`, { method: "DELETE" });
      if (!res?.success) throw new Error(res?.error ?? "delete_failed");

      document.getElementById(id)?.hideOverlay?.();
      shopify.toast.show(`${feed.label} deleted`);
      mutate(FEEDS_KEY);
      mutate(THEME_BLOCKS_KEY);
    } catch {
      shopify.toast.show("Couldn't delete the feed", { isError: true });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <s-modal id={id} heading={`Delete ${feed.label}?`}>
      <s-stack direction="block" gap="base">
        {added ? (
          <s-banner tone="warning">
            This feed is live in your theme
            {pages ? ` on the ${pages}` : ""}. Once it&apos;s deleted, that
            theme block shows nothing until you remove it or give it another
            feed.
          </s-banner>
        ) : unknown ? (
          <s-paragraph>
            We couldn&apos;t check your theme. If this feed is in it, its block
            will show nothing once the feed is deleted.
          </s-paragraph>
        ) : (
          <s-paragraph>
            This feed isn&apos;t in your theme, so nothing on your store
            changes.
          </s-paragraph>
        )}
        <s-paragraph>
          The feed&apos;s gallery and posts are kept. This can&apos;t be undone.
        </s-paragraph>
      </s-stack>
      <s-button
        slot="primary-action"
        variant="primary"
        tone="critical"
        loading={deleting}
        onClick={onDelete}
      >
        Delete feed
      </s-button>
      <s-button slot="secondary-actions" commandfor={id} command="--hide">
        Cancel
      </s-button>
    </s-modal>
  );
};
