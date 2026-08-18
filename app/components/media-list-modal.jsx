import PostCard from "app/components/post-card";
import { useFetch } from "app/hooks/useFetch";
import { apiFetch } from "app/lib/api-client";
import { useState } from "react";

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
          commandfor="modal"
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
                  key={index}
                  post={media}
                  selected={
                    !!selected.find((_) => _.media_id == media.media_id)
                  }
                  onSelect={(_selected) => {
                    if (_selected) {
                      setSelected((prev) => [...prev, media]);
                    } else {
                      setSelected((prev) =>
                        prev.filter((item) => item.media_id != media.media_id),
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
