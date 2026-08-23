import AppBridgeForm from "app/components/app-bridge-form";
import { CAROUSEL_FEED_DEFAULTS } from "app/components/feed-card";
import { FeedCarousel } from "app/components/feed-carousel";
import CarouselSettingsForm from "app/components/forms/carousel-settings-form";
import { ResizablePreview } from "app/components/resizable-preview";
import { useFetch } from "app/hooks/useFetch";
import { useMutation } from "app/hooks/useMutation";
import { apiFetch } from "app/lib/api-client";
import { requestAppWindowClose } from "app/lib/app-window";
import {
  FEEDS_KEY,
  FEED_PAGE_CODES,
  FEED_TYPES,
  SUPPORTED_FEED_TYPES,
  feedCreateWindowId,
} from "app/lib/feeds";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

// Placeholder tiles so the preview isn't empty before a gallery resolves.
const PREVIEW_PLACEHOLDERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export default function CreateFeed() {
  // Both come off the URL (the "Add feed" menu builds it), so anything not in
  // the known set falls back to the default rather than reaching the API.
  const [type] = useQueryState(
    "type",
    parseAsStringLiteral(FEED_TYPES).withDefault("CAROUSEL"),
  );
  const [page] = useQueryState(
    "page",
    parseAsStringLiteral(FEED_PAGE_CODES).withDefault("HP"),
  );

  const [media, setMedia] = useState(PREVIEW_PLACEHOLDERS);

  const formMethods = useForm({
    defaultValues: {
      gallery: { id: "" },
      settings: {
        ...CAROUSEL_FEED_DEFAULTS,
      },
    },
  });

  const { data: galleriesData, isLoading: fetchingGalleries } = useFetch(
    "/api/galleries",
    ({ key }) => apiFetch(key),
    {
      revalidateIfStale: false,
    },
  );

  const { watch, reset, getValues, setValue, handleSubmit } = formMethods;

  const formValues = watch();

  const { trigger: createFeed, isMutating: isCreating } = useMutation(
    "create-feed",
    ({ arg }) => apiFetch(FEEDS_KEY, { method: "POST", body: arg }),
    {
      throwOnError: false,
      onSuccess: (res) => {
        shopify.toast.show(
          res.success ? "Feed created" : "Failed to create feed",
          { isError: !res.success },
        );

        if (!res.success) return;

        // Reset first — a dirty save bar would prompt before the window closes.
        reset(getValues(), { keepDirty: false });

        // The frame that owns the window hides it and refreshes the feed list.
        requestAppWindowClose(feedCreateWindowId(type, page));
      },
      onError: () =>
        shopify.toast.show("Failed to create feed", { isError: true }),
    },
  );

  // `label` is generated server-side so it stays unique per shop.
  const handleFormSubmit = handleSubmit((data) =>
    createFeed({
      type,
      page,
      gallery: { id: data.gallery?.id ?? null },
      settings: data.settings,
    }),
  );

  useEffect(() => {
    let autoGallery;

    if (formValues?.gallery?.id) {
      autoGallery = galleriesData?.data?.find(
        (g) => g.id === formValues?.gallery?.id,
      );
    } else {
      autoGallery = galleriesData?.data?.find((g) => g.type === "AUTO");
    }
    if (autoGallery) {
      setValue("gallery.id", autoGallery.id, { shouldDirty: true });
      setMedia(autoGallery.media, { shouldDirty: true });
    }
  }, [JSON.stringify(galleriesData), formValues?.gallery?.id]);

  if (!SUPPORTED_FEED_TYPES.includes(type)) {
    return (
      <s-page heading="Heading" inlineSize="large">
        <s-banner tone="info" heading={`${type} feeds aren't available yet`}>
          <s-paragraph>
            Pick the carousel style for now — this one is on the way.
          </s-paragraph>
        </s-banner>
      </s-page>
    );
  }

  return (
    <s-page heading="Heading" inlineSize="large">
      <s-button
        slot="primary-action"
        loading={fetchingGalleries || isCreating}
        disabled={isCreating}
        onClick={handleFormSubmit}
      >
        Create
      </s-button>
      <div className="flex flex-col gap-2">
        <ResizablePreview>
          <FeedCarousel media={media} settings={formValues.settings} />
        </ResizablePreview>

        <AppBridgeForm
          {...formMethods}
          onSubmit={handleFormSubmit}
          showSaveBar={false}
        >
          <CarouselSettingsForm />
        </AppBridgeForm>
      </div>
    </s-page>
  );
}
