import AppBridgeForm from "app/components/app-bridge-form";
import { CAROUSEL_FEED_DEFAULTS } from "app/components/feed-card";
import { FeedCarousel } from "app/components/feed-carousel";
import CarouselSettingsForm from "app/components/forms/carousel-settings-form";
import { ResizablePreview } from "app/components/resizable-preview";
import { useFetch } from "app/hooks/useFetch";
import { apiFetch } from "app/lib/api-client";
import { useQueryState } from "nuqs";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

export default function CreateFeed() {
  const [type, setType] = useQueryState("type", {
    defaultValue: "CAROUSEL_HP",
  });

  const [media, setMedia] = useState([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

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

  const {
    watch,
    setValue,
    handleSubmit,
    formState: { isDirty },
  } = formMethods;

  const formValues = watch();

  const handleFormSubmit = handleSubmit((data) => {});

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

  return (
    <s-page heading="Heading" inlineSize="large">
      <s-button
        slot="primary-action"
        loading={fetchingGalleries}
        disabled={!isDirty}
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
