import PostCard from "app/components/post-card";
import { useState } from "react";

// Columns, gap, radius and tile shape are all resolved in grid.css from these
// custom properties — that file holds the sizing rules, including the mobile
// override. Handing the settings over as variables instead of computed styles
// keeps this layout identical to the theme extension, which sets the very same
// properties from Liquid.
const gridVars = (settings) => ({
  "--insta-columns": settings?.columns || 1,
  "--insta-gap": `${settings?.item_gap ?? 0}px`,
  "--insta-radius": `${settings?.border_radius ?? 0}px`,
  "--insta-aspect": settings?.aspect_ratio || "1 / 1",
});

export function FeedGrid({ media = [], settings }) {
  const columns = settings?.columns || 1;
  const rows = settings?.rows || 1;
  const overflow = settings?.overflow ?? "cap";

  // Tiles per row are settled by grid.css from the container width, so
  // `columns` is only the count at 1080px — what these two really fix is the
  // batch size, and "Load more" reveals another one. Changing either setting
  // re-frames the grid, so the reveal starts over with it.
  const [shownRows, setShownRows] = useState(rows);
  const [framedBy, setFramedBy] = useState({ rows, columns });

  if (framedBy.rows !== rows || framedBy.columns !== columns) {
    setFramedBy({ rows, columns });
    setShownRows(rows);
  }

  const visible =
    overflow === "expand" ? media : media.slice(0, columns * shownRows);
  const hasMore = overflow === "load_more" && visible.length < media.length;

  return (
    <div className="insta-grid" style={gridVars(settings)}>
      <div className="insta-grid__items">
        {visible.map((m, ind) =>
          // The create route previews placeholder tiles until a gallery loads.
          typeof m === "number" ? (
            <div
              key={m}
              className="insta-grid__media w-full bg-gray-300 animate-pulse"
              style={{ aspectRatio: "var(--insta-aspect)" }}
            />
          ) : (
            <PostCard
              key={m.id || ind}
              post={m}
              hideCheckbox
              className="insta-grid__media"
              autoPlay={settings?.media_auto_play}
            />
          ),
        )}
      </div>

      {hasMore && (
        <div className="insta-grid__more">
          {/*
            Plain button, styled by grid.css at zero specificity. The theme
            extension renders the same markup plus the theme's own button
            class, which then takes over — see the note in grid.css. The class
            isn't added here because the admin has no theme to inherit from.
          */}
          <button
            type="button"
            className="insta-grid__more-btn"
            onClick={() => setShownRows((shown) => shown + rows)}
          >
            Load more
          </button>
        </div>
      )}
    </div>
  );
}
