import AppBridgeForm from "app/components/app-bridge-form";
import { MediaListModal } from "app/components/media-list-modal";
import PostCard from "app/components/post-card";
import { useMutation } from "app/hooks/useMutation";
import { delay, enter, enterFade } from "app/lib/animations";
import { apiFetch } from "app/lib/api-client";
import { cn } from "app/lib/utils";
import { useRef } from "react";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { useNavigate } from "react-router";

export const GALLERY_TYPES = [
  {
    type: "AUTO",
    description:
      "Automatically shows your most recent Instagram posts. The gallery keeps itself up to date as you publish new content, no manual work needed.",
  },
  {
    type: "MANUAL",
    description:
      "Pick exactly which posts to show and drag them into the order you want.",
  },
  {
    type: "PRODUCT",
    description:
      "Matches posts to each product automatically. On a product page, it shows only the posts where that product is tagged, perfect for adding social proof next to the buy button.",
  },
];

export default function MediaGallery() {
  const navigate = useNavigate();

  const formMethods = useForm({
    defaultValues: {
      title: "Handpicked ",
      type: "MANUAL",
      post_limit: "10",
      media: [],
    },
  });

  const {
    watch,
    control,
    reset,
    getValues,
    formState: { errors },
  } = formMethods;

  const formValues = watch();

  const { fields, remove, move, replace } = useFieldArray({
    control,
    name: "media",
    keyName: "field_id",
  });

  const { trigger: createGallery } = useMutation(
    "create-gallery",
    ({ arg }) => apiFetch("/api/galleries", { method: "POST", body: arg }),
    {
      onSuccess: (res) => {
        shopify.toast.show(
          res.success ? "Gallery created" : "Failed to create gallery",
          { isError: !res.success },
        );

        if (!res.success) return;

        reset(getValues(), { keepDirty: false });
        navigate("/media-gallery");
      },
    },
  );

  const handleSave = ({ title, type, media }) =>
    createGallery({
      title: title.trim(),
      type,
      media: media?.map(({ field_id, ...m }) => m),
    });

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="max-w-249.5 mx-auto p-4 flex flex-col">
        <div className={`flex gap-2 items-start ${enter}`}>
          <s-button
            icon="arrow-left"
            variant="tertiary"
            href="/media-gallery"
          ></s-button>
          <h1 className="text-xl font-semibold mb-2">Gallery details</h1>
        </div>

        <p
          className={`text-sm text-neutral-500 mb-4 ${enter}`}
          style={delay(75)}
        >
          Organize your synced Instagram posts into galleries, then display them
          anywhere in your store.
        </p>

        <AppBridgeForm {...formMethods} onSubmit={handleSave}>
          <div className="flex gap-4 items-stretch">
            <div
              className={`sticky top-3 flex flex-col gap-4 w-full max-w-80 ${enterFade}`}
              style={delay(150)}
            >
              <s-section>
                <Controller
                  control={control}
                  name="title"
                  rules={{
                    validate: (value) =>
                      value?.trim() ? true : "Title is required",
                  }}
                  render={({ field }) => (
                    <s-text-field
                      label="Title"
                      value={field.value}
                      onInput={(e) => field.onChange(e.target.value)}
                      onBlur={field.onBlur}
                      error={errors.title?.message}
                      placeholder="Become a merchant"
                    />
                  )}
                />

                <div className="flex flex-col gap-1">
                  <s-text>Type</s-text>
                  <Controller
                    control={control}
                    name="type"
                    render={({ field }) => (
                      <div className="flex flex-col gap-1.5">
                        {GALLERY_TYPES.map((g) => (
                          <s-stack key={g.type}>
                            <label
                              className={cn(
                                "choice inline-flex cursor-pointer items-center gap-2 font-semibold",
                                {
                                  "disabled opacity-40 cursor-not-allowed":
                                    g.type === "AUTO",
                                },
                              )}
                              aria-disabled={g.type === "AUTO"}
                            >
                              <input
                                type="radio"
                                className="radio"
                                disabled={g.type === "AUTO"}
                                name={field.name}
                                value={g.type}
                                checked={field.value == g.type}
                                onChange={(e) => field.onChange(g.type)}
                              />
                              {g.type}
                            </label>
                            <p
                              className={cn("pl-6 text-sm text-neutral-500", {
                                "opacity-50": g.type == "AUTO",
                              })}
                            >
                              {g.description}
                            </p>
                          </s-stack>
                        ))}
                      </div>
                    )}
                  />
                </div>

                <div className="mt-4 flex flex-col gap-2">
                  <s-heading>Settings</s-heading>
                  <Controller
                    control={control}
                    name="post_limit"
                    render={({ field }) => (
                      <s-select
                        label="Max. posts limit"
                        value={field.value}
                        onChange={(e) => field.onChange(e.target.value)}
                      >
                        {[10, 15, 20].map((num) => (
                          <s-option value={num}>{num}</s-option>
                        ))}
                      </s-select>
                    )}
                  />
                </div>
              </s-section>
            </div>
            <div className={`w-full ${enterFade}`} style={delay(200)}>
              <s-box
                background="subdued"
                border="base"
                borderColor="subdued"
                borderRadius="large"
              >
                <div className="px-4 py-3 inline-flex gap-2">
                  <s-heading>Included posts:</s-heading>
                  <s-badge>
                    {fields?.length}/{formValues.post_limit}
                  </s-badge>
                </div>

                <s-section>
                  {fields?.length ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                      {fields?.map((media, index) => (
                        <DraggableMedia
                          key={media.field_id}
                          id={media.field_id}
                          index={index}
                          move={move}
                        >
                          <PostCard
                            post={media}
                            showDeleteButton
                            onDelete={() => remove(index)}
                          />
                        </DraggableMedia>
                      ))}
                      {fields.length < formValues.post_limit && (
                        <div className="flex flex-col col-span-full justify-center items-center gap-3 p-4">
                          <s-heading>Add more media</s-heading>
                          <s-text>Select media to add to this gallery.</s-text>
                          <div className="mt-2">
                            <MediaListModal
                              selected={fields}
                              onSubmit={(selectedMedia) =>
                                replace(selectedMedia)
                              }
                            >
                              Select media
                            </MediaListModal>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col justify-center items-center gap-3 p-4">
                      <s-heading>No media added</s-heading>
                      <s-text>Select media to add to this gallery.</s-text>
                      <div className="mt-2">
                        <MediaListModal
                          selected={fields}
                          onSubmit={(selectedMedia) => replace(selectedMedia)}
                        >
                          Select media
                        </MediaListModal>
                      </div>
                    </div>
                  )}
                </s-section>
              </s-box>
            </div>
          </div>
        </AppBridgeForm>
      </div>
    </DndProvider>
  );
}

const DND_TYPE = "gallery-media";

const DraggableMedia = ({ id, index, move, children }) => {
  const ref = useRef(null);
  const handleRef = useRef(null);

  const [{ isDragging }, drag, preview] = useDrag({
    type: DND_TYPE,
    item: { id, index },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  const [, drop] = useDrop({
    accept: DND_TYPE,
    hover: (item) => {
      if (item.index === index) return;
      move(item.index, index);
      item.index = index;
    },
  });

  // Only the handle button starts a drag; the whole card is the preview + drop target.
  drag(handleRef);
  preview(drop(ref));

  return (
    <div
      ref={ref}
      className="relative rounded-md"
      style={{ opacity: isDragging ? 0.4 : 1 }}
    >
      {children}

      <button
        ref={handleRef}
        type="button"
        className="absolute z-10 left-1 top-1 py-0.5 cursor-move bg-neutral-100 shadow-card rounded"
      >
        <s-icon type="drag-handle" tone="neutral" />
      </button>
    </div>
  );
};
