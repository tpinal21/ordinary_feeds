import {
  AppearanceFields,
  MediaSettingsSection,
  SelectField,
} from "app/components/forms/fields";
import { GRID_COLUMNS, GRID_ROWS } from "app/lib/feeds";

const ASPECT_RATIOS = [
  { label: "Square (1:1)", value: "1 / 1" },
  { label: "Portrait (4:5)", value: "4 / 5" },
  { label: "Reel (9:16)", value: "9 / 16" },
];

// What happens to the posts past the first `rows` rows.
const OVERFLOW_OPTIONS = [
  { label: "Hide them", value: "cap" },
  { label: "Show a “Load more” button", value: "load_more" },
  { label: "Show every post", value: "expand" },
];

const ROWS_TOOLTIP = (
  <>
    <button type="button" interestfor="rows-tooltip">
      <s-icon type="info" tone="auto" />
    </button>
    <s-tooltip id="rows-tooltip">
      Also counted at 1080px wide. Since wider screens fit more tiles per row,
      what this really sets is how many posts show before “Load more”.
    </s-tooltip>
  </>
);

const COLUMNS_TOOLTIP = (
  <>
    <button type="button" interestfor="columns-tooltip">
      <s-icon type="info" tone="auto" />
    </button>
    <s-tooltip id="columns-tooltip">
      Sets the tile width at 1080px wide. Wider screens keep that width and fit
      more tiles per row; narrow screens show three.
    </s-tooltip>
  </>
);

export default function GridSettingsForm() {
  return (
    <>
      <MediaSettingsSection />

      <div className="flex flex-col gap-2">
        <s-heading>Grid settings</s-heading>

        <SelectField
          name="settings.columns"
          label="Columns"
          tooltip={COLUMNS_TOOLTIP}
          options={GRID_COLUMNS}
        />
        <SelectField
          name="settings.rows"
          label="Rows"
          tooltip={ROWS_TOOLTIP}
          options={GRID_ROWS}
        />
        <SelectField
          name="settings.aspect_ratio"
          label="Tile shape"
          options={ASPECT_RATIOS}
        />
        <SelectField
          name="settings.overflow"
          label="Extra posts"
          options={OVERFLOW_OPTIONS}
        />

        <AppearanceFields />
      </div>
    </>
  );
}
