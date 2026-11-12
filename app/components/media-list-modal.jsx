import PostCard from "app/components/post-card";
import { useFetch } from "app/hooks/useFetch";
import { apiFetch } from "app/lib/api-client";
import { useState } from "react";

// Posts picked from the Instagram list carry only `id` (the post); posts read
// back from a gallery carry `media_id` (the post) and `id` (the gallery row).
const mediaKey = (m) => m?.media_id ?? m?.id;

export const MediaListModal = ({
  selected: defaultSelected = [],
  variant = "primary",
  children,
  modalId = "modal",
  onSubmit,
}) => {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(defaultSelected);

  const { data: instagramPostsData, isLoading } = useFetch(
    () => (open ? "posts-from-instagram" : false),
    () => apiFetch("/api/instagram/posts"),
    {
      revalidateIfStale: false,
      onSuccess: (data) => {},
    },
  );

  return (
    <>
      <s-button
        icon="attachment"
        variant={variant}
        commandfor={modalId}
        command="--show"
      >
        {children}
      </s-button>

      <s-modal
        id={modalId}
        onShow={() => setOpen(true)}
        onHide={() => setOpen(false)}
        heading="Select media from instagram"
        size="large"
      >
        <s-button
          slot="secondary-actions"
          commandfor={modalId}
          command="--hide"
        >
          Close
        </s-button>
        <s-button
          slot="primary-action"
          variant="primary"
          commandfor={modalId}
          command="--hide"
          onClick={() => onSubmit(selected)}
        >
          Save
        </s-button>

        {isLoading ? (
          <s-stack justifyContent="center" direction="inline">
            <s-spinner />
          </s-stack>
        ) : (
          <>
            {
              <s-stack direction="inline" gap="small">
                <s-heading>Selected posts: </s-heading>
                <s-badge>{selected.length}/20</s-badge>
              </s-stack>
            }
            <div className="grid grid-cols-3 mt-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 gap-2">
              {instagramPostsData?.data?.map((media, index) => (
                <PostCard
                  key={mediaKey(media) ?? index}
                  post={media}
                  selected={selected.some(
                    (item) => mediaKey(item) === mediaKey(media),
                  )}
                  onSelect={(_selected) => {
                    // Copyrighted posts come without a media_url and can't be shown.
                    if (!media.media_url) return;
                    if (_selected) {
                      setSelected((prev) => [...prev, media]);
                    } else {
                      setSelected((prev) =>
                        prev.filter(
                          (item) => mediaKey(item) !== mediaKey(media),
                        ),
                      );
                    }
                  }}
                />
              ))}
            </div>
          </>
        )}
      </s-modal>
    </>
  );
};
