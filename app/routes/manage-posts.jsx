import PostCard from "app/components/post-card";
import { useFetch } from "app/hooks/useFetch";
import { useMutation } from "app/hooks/useMutation";
import { useFieldArray, useForm } from "react-hook-form";
import AppBridgeForm from "app/components/app-bridge-form";
import { useRouteLoaderData } from "react-router";
import { apiFetch } from "app/lib/api-client";
import { delay, enter } from "app/lib/animations";

export default function ManagePosts() {
  const { shopDetails } = useRouteLoaderData("root");

  const formMethods = useForm({
    defaultValues: {
      media: [],
    },
  });

  const { reset, control, watch } = formMethods;

  const { isLoading, mutate: refetchPosts } = useFetch(
    "instagram-reels",
    () => apiFetch("/api/instagram/posts"),
    {
      keepPreviousData: true,
      onSuccess: (data) => {
        reset({ media: data?.account?.reels }, { keepDirty: false });
      },
    },
  );

  const { trigger: triggerSync, isMutating: syncing } = useMutation(
    "instagram-sync",
    () => apiFetch("/api/instagram/sync", { method: "POST" }),
    {
      onSuccess: refetchPosts,
      onError: () => {},
    },
  );

  const { trigger: triggerSave } = useMutation(
    "instagram-save",
    ({ arg }) =>
      apiFetch("/api/instagram/posts", { method: "POST", body: arg }),
    {
      onSuccess: ({ success }) => {
        success && refetchPosts();
      },
    },
  );

  const { fields: media, update: updateMedia } = useFieldArray({
    control,
    name: "media",
    keyName: "field_id",
  });

  return (
    <div className="max-w-249.5 mx-auto p-4 flex flex-col">
      <div className={`flex justify-between items-start ${enter}`}>
        <h1 className="text-xl font-semibold mb-2">Manage posts</h1>
        <s-button
          variant="primary"
          onClick={triggerSync}
          {...(syncing ? { loading: true } : {})}
        >
          Sync now
        </s-button>
      </div>

      <p className={`text-sm text-neutral-500 mb-4 ${enter}`} style={delay(75)}>
        Set up your Instagram feeds in minutes
      </p>

      {isLoading ? (
        <p className="text-sm text-neutral-500">Loading posts…</p>
      ) : media.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No posts yet. Click “Sync now” to pull in your latest Instagram posts.
        </p>
      ) : (
        <AppBridgeForm
          {...formMethods}
          onSubmit={(values) => triggerSave(values)}
        >
          <div
            className={`grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 ${enter}`}
            style={delay(150)}
          >
            {media.map((post, index) => (
              <PostCard
                key={post.field_id}
                post={post}
                showTagProducts
                onTagProduct={(product) => {
                  updateMedia(index, {
                    ...post,
                    products: product
                      ? [
                          {
                            product_id: {
                              id: product.id,
                              title: product.title,
                              images: product.images.map((img) => ({
                                id: img.id,
                                alt_text: img.altText,
                                original_src: img.originalSrc,
                              })),
                            },
                          },
                        ]
                      : null,
                  });
                }}
              />
            ))}
          </div>
        </AppBridgeForm>
      )}
    </div>
  );
}
