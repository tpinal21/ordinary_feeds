import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "app/components/ui/select";
import { Slider } from "app/components/ui/slider";
import { useGalleries } from "app/hooks/useGalleries";
import { Controller, useFormContext } from "react-hook-form";

// One labelled row of the settings panel. `alignStart` is for controls taller
// than their label, so the label sits against the first line.
export const SettingRow = ({ label, tooltip, alignStart, children }) => (
  <div className={`flex gap-4 ${alignStart ? "items-start" : "items-center"}`}>
    <span
      className={`w-40 shrink-0 inline-flex items-center gap-1 ${alignStart ? "mt-1.5" : ""}`}
    >
      <s-text>{label}</s-text>
      {tooltip}
    </span>
    {children}
  </div>
);

// Slider plus a live readout, for the settings measured in pixels.
export const PixelSlider = ({ value, onChange, max, ...field }) => (
  <div className="flex items-center gap-3 max-w-56 w-full">
    <Slider
      {...field}
      value={value}
      min={0}
      max={max}
      step={1}
      onValueChange={(v) => onChange(v)}
    />
    <span className="w-10 shrink-0 text-right">
      <s-text>{value}px</s-text>
    </span>
  </div>
);

// `options` is either a list of values or of `{ label, value }`.
export const OptionSelect = ({ options, value, onChange, ...field }) => {
  const items = options.map((o) =>
    typeof o === "object" ? o : { label: String(o), value: o },
  );

  return (
    <Select items={items} {...field} value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full max-w-56">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="w-(--anchor-width)">
        <SelectGroup>
          {items.map((item) => (
            <SelectItem
              key={item.value}
              value={item.value}
              className="flex-wrap"
            >
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
};

export const SwitchField = ({ name, label }) => {
  const { control } = useFormContext();

  return (
    <SettingRow label={label}>
      <Controller
        name={name}
        control={control}
        render={({ field: { value, onChange, ...field } }) => (
          <s-switch
            {...field}
            checked={value}
            accessibilitylabel={`${label} switch`}
            onChange={(checked) => onChange(checked.target.checked)}
          />
        )}
      />
    </SettingRow>
  );
};

export const SelectField = ({ name, label, tooltip, options }) => {
  const { control } = useFormContext();

  return (
    <SettingRow label={label} tooltip={tooltip} alignStart={!!tooltip}>
      <div className="max-w-56 w-full">
        <Controller
          name={name}
          control={control}
          render={({ field: { ref, ...field } }) => (
            <OptionSelect options={options} {...field} />
          )}
        />
      </div>
    </SettingRow>
  );
};

export const PixelSliderField = ({ name, label, max }) => {
  const { control } = useFormContext();

  return (
    <SettingRow label={label}>
      <Controller
        name={name}
        control={control}
        render={({ field: { ref, ...field } }) => (
          <PixelSlider {...field} max={max} />
        )}
      />
    </SettingRow>
  );
};

export const GallerySelect = ({ name }) => {
  const { getValues, control } = useFormContext();
  const { galleries, isLoading } = useGalleries();

  const galleryList = isLoading
    ? [{ label: "Loading galleries...", value: getValues(name) }]
    : (galleries || []).map((g) => ({ label: g.title, value: g.id }));

  return (
    <div className="inline-flex gap-4">
      <span className="w-40 inline-flex items-center">
        <label htmlFor="gallery-select">
          <s-text interestFor="gallery-select">Media gallery</s-text>
        </label>
      </span>
      <Controller
        name={name}
        control={control}
        render={({ field: { value, onChange } }) => (
          <OptionSelect
            options={galleryList}
            value={value}
            onChange={onChange}
            disabled={isLoading}
          />
        )}
      />
    </div>
  );
};

// The gallery and playback settings every feed type has, whatever it renders.
export const MediaSettingsSection = () => (
  <div className="flex flex-col gap-2">
    <s-heading>Media settings</s-heading>
    <GallerySelect name="gallery.id" />
    <SwitchField name="settings.media_auto_play" label="Video auto play" />
  </div>
);

// Both feed types size and space their tiles the same way.
export const AppearanceFields = () => (
  <>
    <PixelSliderField
      name="settings.border_radius"
      label="Corner radius"
      max={32}
    />
    <PixelSliderField
      name="settings.item_gap"
      label="Space between items"
      max={40}
    />
  </>
);
