import AppBridgeForm from "app/components/app-bridge-form";
import { FeedPreview } from "app/components/feed-preview";
import FeedSettingsForm from "app/components/forms/feed-settings-form";
import { ResizablePreview } from "app/components/resizable-preview";
import { useGalleries } from "app/hooks/useGalleries";
import { useMutation } from "app/hooks/useMutation";
import { apiFetch } from "app/lib/api-client";
import { requestAppWindowClose } from "app/lib/app-window";
import {
  FEEDS_KEY,
  FEED_DEFAULTS,
  FEED_PAGE_CODES,
  FEED_TYPES,
  SUPPORTED_FEED_TYPES,
  feedCreateWindowId,
} from "app/lib/feeds";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useEffect } from "react";
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

  const formMethods = useForm({
    defaultValues: {
      gallery: { id: "" },
      settings: { ...FEED_DEFAULTS[type] },
    },
  });

  const { watch, reset, getValues, setValue, handleSubmit } = formMethods;

  const formValues = watch();
  const galleryId = formValues.gallery?.id;

  const { galleries, isLoading: fetchingGalleries } = useGalleries();

  // A new feed starts on the shop's automatic gallery; picking another one in
  // the form takes over from there.
  const gallery =
    galleries?.find((g) => g.id === galleryId) ??
    galleries?.find((g) => g.type === "AUTO");

  useEffect(() => {
    if (gallery && gallery.id !== galleryId) {
      setValue("gallery.id", gallery.id, { shouldDirty: true });
    }
  }, [gallery, galleryId, setValue]);

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

  if (!SUPPORTED_FEED_TYPES.includes(type)) {
    return (
      <s-page heading="Heading" inlineSize="large">
        <s-banner tone="info" heading={`${type} feeds aren't available yet`}>
          <s-paragraph>
            Pick another style for now — this one is on the way.
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
          <FeedPreview
            type={type}
            media={gallery?.media ?? PREVIEW_PLACEHOLDERS}
            settings={formValues.settings}
          />
        </ResizablePreview>

        <AppBridgeForm
          {...formMethods}
          onSubmit={handleFormSubmit}
          showSaveBar={false}
        >
          <FeedSettingsForm type={type} />
        </AppBridgeForm>
      </div>
    </s-page>
  );
}
