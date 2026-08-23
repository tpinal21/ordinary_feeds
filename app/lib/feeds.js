// SWR key for the feed list. Shared so anything that changes a feed can
// refresh the list with `mutate(FEEDS_KEY)`.
export const FEEDS_KEY = "/api/feeds";

export const FEED_TYPES = ["CAROUSEL", "GRID", "POPUP"];

// Only carousels are implemented so far — the other types are offered in the
// "Add feed" menu but can't be created yet.
export const SUPPORTED_FEED_TYPES = ["CAROUSEL"];

// The UI passes pages around by short code (it's what the create URL carries
// and what the generated label reads as); Directus stores the long form.
export const FEED_PAGES = {
  HP: "HOME_PAGE",
  PP: "PRODUCT_PAGE",
  CP: "COLLECTION_PAGE",
};

export const FEED_PAGE_CODES = Object.keys(FEED_PAGES);

// `s-app-window` id for the create flow. Shared so the frame that owns the
// element can match the close request the route inside it broadcasts.
export const feedCreateWindowId = (type, page) => `${type}_${page}`;
