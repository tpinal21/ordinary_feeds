import { FeedCarousel } from "app/components/feed-carousel";
import { FeedGrid } from "app/components/feed-grid";

const PREVIEWS = {
  CAROUSEL: FeedCarousel,
  GRID: FeedGrid,
};

// The storefront rendering of a feed, as far as the app can show it. Same
// component backs the feed card on the dashboard and the live preview while
// its settings are being edited.
export function FeedPreview({ type, media = [], settings }) {
  const Preview = PREVIEWS[type];

  if (!Preview) return null;

  return <Preview media={media} settings={settings} />;
}
