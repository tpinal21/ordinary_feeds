// SWR key for the feed list. Shared so anything that changes a feed can
// refresh the list with `mutate(FEEDS_KEY)`.
export const FEEDS_KEY = "/api/feeds";

export const GALLERIES_KEY = "/api/galleries";

export const FEED_TYPES = ["CAROUSEL", "GRID", "POPUP"];

// Theme app extension block that renders each feed type — the file name under
// `extensions/feed-section/blocks/`. Adding a type here is all the theme check
// and the "Add to theme" links need; the block itself still has to exist.
export const FEED_BLOCKS = {
  CAROUSEL: "carousel",
  GRID: "grid",
  POPUP: "popup",
};

export const feedBlockHandle = (type) =>
  FEED_BLOCKS[type] ?? FEED_BLOCKS.CAROUSEL;

// Ranges the feed editor and the app-wide feed defaults both offer.
export const GRID_COLUMNS = [2, 3, 4, 5, 6];
export const GRID_ROWS = [1, 2, 3, 4, 5, 6];
export const BORDER_RADIUS_MAX = 32;
export const ITEM_GAP_MAX = 40;

// Popups aren't implemented yet — the "Add feed" menu offers the type but the
// create route turns it away.
export const SUPPORTED_FEED_TYPES = ["CAROUSEL", "GRID"];

// The UI passes pages around by short code (it's what the create URL carries
// and what the generated label reads as); Directus stores the long form.
export const FEED_PAGES = {
  HP: "HOME_PAGE",
  PP: "PRODUCT_PAGE",
  CP: "COLLECTION_PAGE",
};

export const FEED_PAGE_CODES = Object.keys(FEED_PAGES);

// PRODUCT galleries show the posts tagged with the product being viewed, so
// they only work on product pages: on the home and collection pages the
// theme block has no product and would render nothing. `page` is the long
// form (FEED_PAGES value).
export const galleryAllowedOnPage = (galleryType, page) =>
  galleryType !== "PRODUCT" || page === FEED_PAGES.PP;

// `s-app-window` id for the create flow. Shared so the frame that owns the
// element can match the close request the route inside it broadcasts.
export const feedCreateWindowId = (type, page) => `${type}_${page}`;

// Settings a feed is created with, and the floor every stored feed is read
// through — a feed saved before a setting existed still renders with it.
const MEDIA_DEFAULTS = {
  media_auto_play: false,
  // Tagged products on each post card and in the post popup's
  // "Shop this post". Off shows the posts alone.
  show_tagged_products: true,
  // Both in px.
  border_radius: 8,
  item_gap: 8,
};

export const CAROUSEL_FEED_DEFAULTS = {
  ...MEDIA_DEFAULTS,
  loop: true,
  slides_per_view: 7,
  speed: 1,
  auto_scroll: false,
  // Prev / next arrows: "inside" overlays them on the slides, "outside" moves
  // them into a gutter on either side of the strip, "outside_full" pushes them
  // past the strip's edges without narrowing it.
  arrow_position: "inside",
};

export const GRID_FEED_DEFAULTS = {
  ...MEDIA_DEFAULTS,
  columns: 4,
  rows: 2,
  // Tiles are square by default; the carousel's tall 9/16 is the other end.
  aspect_ratio: "1 / 1",
  overflow: "load_more",
};

export const FEED_DEFAULTS = {
  CAROUSEL: CAROUSEL_FEED_DEFAULTS,
  GRID: GRID_FEED_DEFAULTS,
};

// Stored settings are a JSON string, and only ever a subset of what the
// current UI knows about.
export const feedSettings = (feed) => ({
  ...FEED_DEFAULTS[feed?.type],
  ...JSON.parse(feed?.settings || "{}"),
});
