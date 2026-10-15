import { readItem } from "@directus/sdk";
import AppBridgeForm from "app/components/app-bridge-form";
import { FeedPreview } from "app/components/feed-preview";
import FeedSettingsForm from "app/components/forms/feed-settings-form";
import { ResizablePreview } from "app/components/resizable-preview";
import directus from "app/directus.server";
import { useGalleries } from "app/hooks/useGalleries";
import { useMutation } from "app/hooks/useMutation";
import { apiFetch } from "app/lib/api-client";
import { requestAppWindowClose } from "app/lib/app-window";
import { FEEDS } from "app/lib/constants";
import { feedSettings } from "app/lib/feeds";
import { toFeed } from "app/lib/shops.server";
import { useForm } from "react-hook-form";
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

  const formMethods = useForm({
    defaultValues: {
      gallery: feedDetails?.gallery || {},
      settings: feedSettings(feedDetails),
    },
  });

  const {
    watch,
    reset,
    getValues,
    handleSubmit,
    formState: { isDirty },
  } = formMethods;

  const formValues = watch();
  const galleryId = formValues.gallery?.id;

  // The loader already shipped the feed's own gallery; the list is only needed
  // to preview a different one the merchant picks.
  const { galleries } = useGalleries();
  const media =
    galleries?.find((g) => g.id === galleryId)?.media ??
    feedDetails?.gallery?.media ??
    [];

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
          <FeedPreview
            type={feedDetails?.type}
            media={media}
            settings={formValues.settings}
          />
        </ResizablePreview>

        <AppBridgeForm
          {...formMethods}
          onSubmit={handleFormSubmit}
          showSaveBar={false}
        >
          <FeedSettingsForm type={feedDetails?.type} />
        </AppBridgeForm>
      </div>
    </s-page>
  );
}
