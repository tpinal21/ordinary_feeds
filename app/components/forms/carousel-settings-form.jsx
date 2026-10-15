import {
  AppearanceFields,
  MediaSettingsSection,
  SelectField,
  SettingRow,
} from "app/components/forms/fields";
import { Slider } from "app/components/ui/slider";
import { Controller, useFormContext } from "react-hook-form";

const PER_VIEW_TOOLTIP = (
  <>
    <button type="button" interestfor="per-view-tooltip">
      <s-icon type="info" tone="auto" />
    </button>
    <s-tooltip id="per-view-tooltip">
      Sets the slide width at 1080px wide. Wider screens keep that width and
      show more slides; phones always show 2.
    </s-tooltip>
  </>
);

export default function CarouselSettingsForm() {
  const { setValue, control, watch, resetField } = useFormContext();

  const autoScroll = watch("settings.auto_scroll");

  return (
    <>
      <MediaSettingsSection />

      <div className="flex flex-col gap-2">
        <s-heading>Carousel settings</s-heading>

        <SettingRow label="Auto scroll">
          <Controller
            name="settings.auto_scroll"
            control={control}
            render={({ field }) => (
              <s-switch
                {...field}
                checked={field.value}
                accessibilitylabel="Auto scroll switch"
                onChange={(checked) => {
                  const checkedValue = checked.target.checked;
                  field.onChange(checkedValue);
                  // Auto scroll only reads well as an endless strip.
                  if (checkedValue) {
                    setValue("settings.loop", true, { shouldDirty: true });
                  } else {
                    resetField("settings.loop", { keepDirty: false });
                  }
                }}
              />
            )}
          />
        </SettingRow>

        {autoScroll && (
          <SettingRow label="Speed">
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
          </SettingRow>
        )}

        <SettingRow label="Loop slides">
          <Controller
            name="settings.loop"
            control={control}
            disabled={!!autoScroll}
            render={({ field }) => (
              <s-switch
                {...field}
                checked={field.value}
                accessibilitylabel="Loop switch"
                disabled={field.disabled}
                onChange={(checked) => field.onChange(checked.target.checked)}
              />
            )}
          />
        </SettingRow>

        <SelectField
          name="settings.slides_per_view"
          label="Slides per view"
          tooltip={PER_VIEW_TOOLTIP}
          options={[3, 4, 5, 6, 7, 8]}
        />

        <AppearanceFields />
      </div>
    </>
  );
}
