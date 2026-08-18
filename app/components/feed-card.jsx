import { Card, CardContent, CardHeader } from "app/components/ui/card";
import { APP_WINDOW_CHANNEL } from "app/lib/app-window";
import { FEEDS_KEY } from "app/lib/feeds";
import { useEffect } from "react";
import { mutate } from "swr";
import { FeedCarousel } from "./feed-carousel";

export const CAROUSEL_FEED_DEFAULTS = {
  loop: true,
  slides_per_view: 4,
  speed: 1,
  auto_scroll: false,
  media_auto_play: false,
  // Both in px.
  border_radius: 8,
  item_gap: 8,
};

export const CarouselFeedCard = ({ feed, onRemove }) => {
  const appWindowId = `/feeds/${feed.id}`;

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
    <Card className="gap-1">
      <CardHeader className="gap-0">
        <div className="flex items-start justify-between">
          <div className="inline-flex gap-2">
            <s-heading>{feed.label}</s-heading>
            <button className="hover:bg-neutral-100 rounded-md cursor-copy">
              <s-icon type="clipboard" tone="neutral"></s-icon>
            </button>
          </div>

          <div className="inline-flex gap-2 items-center">
            <s-button
              icon="edit"
              variant="secondary"
              accessibilityLabel={`Edit ${feed.label} feed`}
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
              accessibilityLabel={`Remove ${feed.label} feed`}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2">
          <div className="inline-flex gap-2 items-center">
            <div className="inline-flex gap-2 items-center">
              <s-text>Theme block:</s-text>
              <s-badge tone="warning">Not added</s-badge>
              <s-button type="button" variant="tertiary" icon="app-extension">
                Add theme block
              </s-button>
            </div>
          </div>
          <div className="mt-1">
            <s-heading>Preview</s-heading>
          </div>
          <FeedCarousel
            media={feed?.gallery?.media}
            settings={feed?.settings}
          />
        </div>
      </CardContent>
      <s-app-window id={appWindowId} src={appWindowId}></s-app-window>
    </Card>
  );
};
