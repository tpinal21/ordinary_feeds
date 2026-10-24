import {
  BORDER_RADIUS_MAX,
  FEED_DEFAULTS,
  GRID_COLUMNS,
  GRID_FEED_DEFAULTS,
  GRID_ROWS,
  ITEM_GAP_MAX,
} from "app/lib/feeds";

// App-wide settings live as JSON in the shop's `$app.settings` metafield, so the
// storefront block reads them straight from Liquid. Per-feed settings stay on
// the feed itself; these only seed new feeds.

export const POST_TYPES = [
  { value: "IMAGE", label: "Photos" },
  { value: "VIDEO", label: "Videos and reels" },
  { value: "CAROUSEL_ALBUM", label: "Carousel posts" },
];

export const CLICK_ACTIONS = [
  { value: "popup", label: "Open the post in a popup" },
  { value: "instagram", label: "Open the post on Instagram" },
  { value: "product", label: "Go to the tagged product" },
  { value: "none", label: "Do nothing" },
];

export const APP_SETTINGS_DEFAULTS = {
  storefront_enabled: true,
  feed_defaults: {
    media_auto_play: GRID_FEED_DEFAULTS.media_auto_play,
    border_radius: GRID_FEED_DEFAULTS.border_radius,
    item_gap: GRID_FEED_DEFAULTS.item_gap,
    columns: GRID_FEED_DEFAULTS.columns,
    rows: GRID_FEED_DEFAULTS.rows,
  },
  content: {
    post_types: POST_TYPES.map((t) => t.value),
    show_captions: false,
  },
  click: {
    action: "popup",
  },
};

const toInt = (value, min, max, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

const toBool = (value, fallback) =>
  typeof value === "boolean" ? value : fallback;

// Reads stored or submitted settings through the defaults, dropping anything
// out of range — the metafield may predate a setting, and the client can't be
// trusted to send only valid values.
export function appSettings(raw) {
  const d = APP_SETTINGS_DEFAULTS;
  const feed = raw?.feed_defaults ?? {};
  const content = raw?.content ?? {};
  const click = raw?.click ?? {};

  const postTypes = Array.isArray(content.post_types)
    ? POST_TYPES.map((t) => t.value).filter((v) =>
        content.post_types.includes(v),
      )
    : d.content.post_types;

  return {
    storefront_enabled: toBool(raw?.storefront_enabled, d.storefront_enabled),
    feed_defaults: {
      media_auto_play: toBool(
        feed.media_auto_play,
        d.feed_defaults.media_auto_play,
      ),
      border_radius: toInt(
        feed.border_radius,
        0,
        BORDER_RADIUS_MAX,
        d.feed_defaults.border_radius,
      ),
      item_gap: toInt(feed.item_gap, 0, ITEM_GAP_MAX, d.feed_defaults.item_gap),
      columns: toInt(
        feed.columns,
        GRID_COLUMNS[0],
        GRID_COLUMNS.at(-1),
        d.feed_defaults.columns,
      ),
      rows: toInt(
        feed.rows,
        GRID_ROWS[0],
        GRID_ROWS.at(-1),
        d.feed_defaults.rows,
      ),
    },
    content: {
      post_types: postTypes,
      show_captions: toBool(content.show_captions, d.content.show_captions),
    },
    click: {
      action: CLICK_ACTIONS.some((a) => a.value === click.action)
        ? click.action
        : d.click.action,
    },
  };
}

// Settings a new feed of `type` starts with: the type's own defaults, with the
// shop's chosen defaults layered over the fields that type has.
export function newFeedSettings(type, feedDefaults) {
  const base = { ...FEED_DEFAULTS[type] };
  if (!feedDefaults) return base;

  for (const key of Object.keys(base)) {
    if (key in feedDefaults) base[key] = feedDefaults[key];
  }
  return base;
}
