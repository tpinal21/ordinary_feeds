import { readItem } from "@directus/sdk";
import AppBridgeForm from "app/components/app-bridge-form";
import { CAROUSEL_FEED_DEFAULTS } from "app/components/feed-card";
import { FeedCarousel } from "app/components/feed-carousel";
import { ResizablePreview } from "app/components/resizable-preview";
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
import directus from "app/directus.server";
import { useFetch } from "app/hooks/useFetch";
import { useMutation } from "app/hooks/useMutation";
import { apiFetch } from "app/lib/api-client";
import { requestAppWindowClose } from "app/lib/app-window";
import { FEEDS } from "app/lib/constants";
import { toFeed } from "app/lib/shops.server";
import { useState } from "react";
import { Controller, useForm, useFormContext } from "react-hook-form";
import { useLoaderData, useParams, useRevalidator } from "react-router";

export async function loader({ params }) {
  let feed;

  try {
    feed = await directus.request(
      readItem(FEEDS, params.id, {
        fields: ["*", "gallery.*", "gallery.ig_media.instagram_media_id.*"],
      }),
    );

    return { feed: toFeed(feed) };
  } catch (error) {
    console.log(error, "error");
  }
  return { feed: {} };
}

export default function FeedsEdit() {
  const { id } = useParams();

  const { feed: feedDetails } = useLoaderData();

  const [media, setMedia] = useState(feedDetails?.gallery?.media || []);

  const formMethods = useForm({
    defaultValues: {
      gallery: feedDetails?.gallery || {},
      settings: {
        ...CAROUSEL_FEED_DEFAULTS,
        ...JSON.parse(feedDetails?.settings || "{}"),
      },
    },
  });

  const {
    watch,
    control,
    reset,
    getValues,
    setValue,
    resetField,
    handleSubmit,
    formState: { isDirty },
  } = formMethods;
  const formValues = watch();

  const revalidator = useRevalidator();

  const { trigger: saveFeed, isMutating: isSaving } = useMutation(
    `save-feed-for-${id}`,
    ({ arg }) => apiFetch(`/api/feeds/${id}`, { method: "POST", body: arg }),
    {
      onSuccess: (res) => {
        shopify.toast.show(res.success ? "Feed saved" : "Failed to save feed", {
          isError: !res.success,
        });

        if (!res.success) return;

        // `defaultValues` only seeds the form once, so re-baseline it against
        // what was just saved — otherwise the form stays dirty after a save.
        reset(getValues(), { keepDirty: false });
        revalidator.revalidate();

        // Reset first — a dirty save bar would prompt before the window closes.
        requestAppWindowClose(`/feeds/${id}`);
      },
    },
  );

  const handleFormSubmit = handleSubmit((data) =>
    saveFeed({
      gallery: { id: data.gallery?.id ?? null },
      settings: data.settings,
    }),
  );

  return (
    <s-page heading="Heading" inlineSize="large">
      <s-button
        slot="primary-action"
        loading={isSaving}
        disabled={!isDirty}
        onClick={handleFormSubmit}
      >
        Save
      </s-button>
      <div className="flex flex-col gap-2">
        <ResizablePreview>
          <FeedCarousel media={media || []} settings={formValues.settings} />
        </ResizablePreview>

        <AppBridgeForm
          {...formMethods}
          onSubmit={handleFormSubmit}
          showSaveBar={false}
        >
          <Card className="flex flex-col gap-4 mt-2 px-3 max-w-4xl mx-auto w-full">
            <div className="flex flex-col gap-2">
              <s-heading>Media settings</s-heading>
              <GallerySelect name="gallery.id" onChange={(m) => setMedia(m)} />
              <div className="flex items-center gap-4">
                <span className="w-40">
                  <s-text>Video auto play</s-text>
                </span>
                <Controller
                  name="settings.media_auto_play"
                  control={control}
                  render={({ field }) => (
                    <s-switch
                      {...field}
                      checked={field.value}
                      accessibilityLabel="Video auto play switch"
                      onChange={(checked) =>
                        field.onChange(checked.target.checked)
                      }
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
                    render={({ field }) => (
                      <Slider
                        className="max-w-56"
                        min={0.1}
                        max={1}
                        step={0.1}
                        {...field}
                        onValueChange={(v) => field.onChange(v)}
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
                      onChange={(checked) =>
                        field.onChange(checked.target.checked)
                      }
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
                    Sets the slide width at 1080px wide. Wider screens keep that
                    width and show more slides; phones always show 2.
                  </s-tooltip>
                </span>
                <div className="max-w-56 w-full">
                  <Controller
                    name="settings.slides_per_view"
                    control={control}
                    render={({ field: { value, onChange, ...field } }) => (
                      <Select
                        items={[3, 4, 5, 6, 7, 8]}
                        {...field}
                        value={value}
                        onValueChange={(val) => {
                          onChange(val);
                          setMedia(
                            galleryList.find((g) => g.value === val)?.media ||
                              [],
                          );
                        }}
                      >
                        <SelectTrigger className="w-full max-w-56">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="w-(--anchor-width)">
                          <SelectGroup>
                            {[3, 4, 5, 6, 7, 8].map((num) => (
                              <SelectItem
                                key={num}
                                value={num}
                                className="flex-wrap"
                              >
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
                  render={({ field }) => <PixelSlider {...field} max={32} />}
                />
              </div>
              <div className="flex items-center gap-4">
                <span className="w-40">
                  <s-text>Space between items</s-text>
                </span>
                <Controller
                  name="settings.item_gap"
                  control={control}
                  render={({ field }) => <PixelSlider {...field} max={40} />}
                />
              </div>
            </div>
          </Card>
        </AppBridgeForm>
      </div>
    </s-page>
  );
}

// Slider plus a live readout, for the settings measured in pixels.
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

const GallerySelect = ({ name, onChange: setMedia }) => {
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
            onValueChange={(val) => {
              onChange(val);
              setMedia(galleryList.find((g) => g.value === val)?.media || []);
            }}
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
