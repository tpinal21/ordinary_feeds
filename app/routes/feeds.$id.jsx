import { readItem } from "@directus/sdk";
import AppBridgeForm from "app/components/app-bridge-form";
import { FeedPreview, PREVIEW_PLACEHOLDERS } from "app/components/feed-preview";
import FeedSettingsForm from "app/components/forms/feed-settings-form";
import {
  ProductPreviewBar,
  usePreviewProduct,
  useTaggedPosts,
} from "app/components/product-preview";
import { ResizablePreview } from "app/components/resizable-preview";
import { Spinner } from "app/components/ui/spinner";
import directus from "app/directus.server";
import { useGalleries } from "app/hooks/useGalleries";
import { useMutation } from "app/hooks/useMutation";
import { apiFetch } from "app/lib/api-client";
import { requestAppWindowClose } from "app/lib/app-window";
import { FEEDS } from "app/lib/constants";
import { feedSettings } from "app/lib/feeds";
import { MEDIA_PRODUCT_FIELDS, toFeed } from "app/lib/shops.server";
import { Suspense } from "react";
import { useForm } from "react-hook-form";
import { Await, useLoaderData, useParams, useRevalidator } from "react-router";

export async function loader({ params }) {
  // Not awaited: the page shell streams immediately and suspends until the feed arrives.
  const feed = directus
    .request(
      readItem(FEEDS, params.id, {
        fields: [
          "*",
          "gallery.*",
          "gallery.ig_media.instagram_media_id.*",
          ...MEDIA_PRODUCT_FIELDS.map(
            (f) => `gallery.ig_media.instagram_media_id.${f}`,
          ),
        ],
      }),
    )
    .then(toFeed)
    .catch((error) => {
      console.log(error, "error");
      return {};
    });

  return { feed };
}

export default function FeedsEdit() {
  const { feed } = useLoaderData();

  return (
    <Suspense fallback={<Spinner />}>
      <Await resolve={feed}>
        {(feedDetails) => <FeedsEditForm feedDetails={feedDetails} />}
      </Await>
    </Suspense>
  );
}

// Split out so `useForm` mounts with the resolved feed as its `defaultValues`.
function FeedsEditForm({ feedDetails }) {
  const { id } = useParams();

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
  const gallery =
    galleries?.find((g) => g.id === galleryId) ??
    (feedDetails?.gallery?.id === galleryId ? feedDetails.gallery : null);

  // A PRODUCT gallery's posts depend on the product page it's shown on, so
  // the preview needs a product to show anything real.
  const isProductGallery = gallery?.type === "PRODUCT";
  const previewProduct = usePreviewProduct();
  const tagged = useTaggedPosts(
    isProductGallery ? previewProduct.product : null,
    gallery?.post_limit ?? 20,
  );
  const media = isProductGallery
    ? tagged.posts.length
      ? tagged.posts
      : PREVIEW_PLACEHOLDERS
    : (gallery?.media ?? []);

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
        {isProductGallery && (
          <ProductPreviewBar
            product={previewProduct.product}
            onChoose={previewProduct.choose}
            tagged={tagged}
          />
        )}
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
          <FeedSettingsForm type={feedDetails?.type} page={feedDetails?.page} />
        </AppBridgeForm>
      </div>
    </s-page>
  );
}
