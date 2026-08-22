import { Card } from "app/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "app/components/ui/select";
import { Slider } from "app/components/ui/slider";
import { useFetch } from "app/hooks/useFetch";
import { apiFetch } from "app/lib/api-client";
import { Controller, useFormContext } from "react-hook-form";

export default function CarouselSettingsForm() {
  const { setValue, control, watch } = useFormContext();

  const formValues = watch();

  return (
    <Card className="flex flex-col gap-4 mt-2 px-3 max-w-4xl mx-auto w-full">
      <div className="flex flex-col gap-2">
        <s-heading>Media settings</s-heading>
        <GallerySelect name="gallery.id" />
        <div className="flex items-center gap-4">
          <span className="w-40">
            <s-text>Video auto play</s-text>
          </span>
          <Controller
            name="settings.media_auto_play"
            control={control}
            render={({ field: { value, onChange, ...field } }) => (
              <s-switch
                {...field}
                checked={value}
                accessibilityLabel="Video auto play switch"
                onChange={(checked) => onChange(checked.target.checked)}
              />
            )}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <s-heading>Carousel settings</s-heading>
        <div className="flex items-center gap-4">
          <span className="w-40">
            <s-text>Auto scroll</s-text>
          </span>
          <Controller
            name="settings.auto_scroll"
            control={control}
            render={({ field }) => (
              <s-switch
                {...field}
                checked={field.value}
                accessibilityLabel="Auto scroll switch"
                onChange={(checked) => {
                  const checkedValue = checked.target.checked;
                  field.onChange(checkedValue);
                  if (checkedValue) {
                    setValue("settings.loop", true, {
                      shouldDirty: true,
                    });
                  } else {
                    resetField("settings.loop", { keepDirty: false });
                  }
                }}
              />
            )}
          />
        </div>
        {formValues.settings.auto_scroll && (
          <div className="flex items-center gap-4">
            <span className="w-40">
              <s-text>Speed</s-text>
            </span>
            <Controller
              name="settings.speed"
              control={control}
              render={({ field: { ref, onChange, ...field } }) => (
                <Slider
                  className="max-w-56"
                  min={0.1}
                  max={1}
                  step={0.1}
                  {...field}
                  onValueChange={onChange}
                />
              )}
            />
          </div>
        )}
        <div className="flex items-center gap-4">
          <span className="w-40">
            <s-text>Loop slides</s-text>
          </span>
          <Controller
            name="settings.loop"
            control={control}
            disabled={!!formValues.settings.auto_scroll}
            render={({ field }) => (
              <s-switch
                {...field}
                checked={field.value}
                accessibilityLabel="Loop switch"
                disabled={field.disabled}
                onChange={(checked) => field.onChange(checked.target.checked)}
              />
            )}
          />
        </div>
        <div className="flex items-start gap-4">
          <span className="w-40 mt-1.5 gap-1 inline-flex items-center">
            <s-text>Sliders per view</s-text>
            <button type="button" interestfor="info-tooltip">
              <s-icon type="info" tone="auto" />
            </button>
            <s-tooltip id="info-tooltip">
              Sets the slide width at 1080px wide. Wider screens keep that width
              and show more slides; phones always show 2.
            </s-tooltip>
          </span>
          <div className="max-w-56 w-full">
            <Controller
              name="settings.slides_per_view"
              control={control}
              render={({ field: { ref, value, onChange, ...field } }) => (
                <Select
                  items={[3, 4, 5, 6, 7, 8]}
                  {...field}
                  value={value}
                  onValueChange={onChange}
                >
                  <SelectTrigger className="w-full max-w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="w-(--anchor-width)">
                    <SelectGroup>
                      {[3, 4, 5, 6, 7, 8].map((num) => (
                        <SelectItem key={num} value={num} className="flex-wrap">
                          {num}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="w-40">
            <s-text>Corner radius</s-text>
          </span>
          <Controller
            name="settings.border_radius"
            control={control}
            render={({ field: { ref, ...field } }) => (
              <PixelSlider {...field} max={32} />
            )}
          />
        </div>
        <div className="flex items-center gap-4">
          <span className="w-40">
            <s-text>Space between items</s-text>
          </span>
          <Controller
            name="settings.item_gap"
            control={control}
            render={({ field: { ref, ...field } }) => (
              <PixelSlider {...field} max={40} />
            )}
          />
        </div>
      </div>
    </Card>
  );
}

const PixelSlider = ({ value, onChange, max, ...field }) => (
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

const GallerySelect = ({ name }) => {
  const { getValues, control } = useFormContext();

  const { data: galleriesData, isLoading: fetchingGalleries } = useFetch(
    "/api/galleries",
    ({ key }) => apiFetch(key),
    {
      revalidateIfStale: false,
    },
  );

  const galleryList = fetchingGalleries
    ? [{ label: "Loading galleries...", value: getValues(name) }]
    : (galleriesData?.data || []).map((g) => ({ label: g.title, value: g.id }));

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
          <Select
            items={galleryList}
            value={value}
            onValueChange={onChange}
            disabled={fetchingGalleries}
          >
            <SelectTrigger id="gallery-select" className="w-full max-w-56">
              <SelectValue placeholder="Select gallery" />
            </SelectTrigger>
            <SelectContent className="w-(--anchor-width)">
              <SelectGroup>
                {galleryList.map((gallery) => (
                  <SelectItem
                    key={gallery.value}
                    value={gallery.value}
                    className="flex-wrap"
                  >
                    {gallery.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        )}
      />
    </div>
  );
};
