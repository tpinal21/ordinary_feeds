import PostCard from "app/components/post-card";
import useSWRInfinite from "swr/infinite";
import { useMutation } from "app/hooks/useMutation";
import { useFieldArray, useForm } from "react-hook-form";
import AppBridgeForm from "app/components/app-bridge-form";
import { apiFetch } from "app/lib/api-client";
import { delay, enter } from "app/lib/animations";
import { isTagged, pickProductTag } from "app/lib/product-tag";
import { useEffect, useState } from "react";

const PER_PAGE = 18;

export default function ManagePosts() {
  const formMethods = useForm({
    defaultValues: {
      media: [],
    },
  });

  const {
    reset,
    control,
    formState: { isDirty, dirtyFields },
  } = formMethods;

  // Each "Load more" fetches the next page; SWR keeps the earlier ones.
  const {
    data: pages,
    isLoading,
    size,
    setSize,
    mutate: refetchPosts,
  } = useSWRInfinite(
    (index, previous) =>
      index > 0 && !previous?.pagination?.has_next_page
        ? null
        : ["instagram-reels", index + 1, PER_PAGE],
    ([, page, perPage]) =>
      apiFetch(
        `/api/instagram/posts?${new URLSearchParams({ page, per_page: perPage })}`,
      ),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateFirstPage: false,
    },
  );

  // Put every loaded page into the form.
  useEffect(() => {
    reset(
      { media: pages?.flatMap((p) => p?.data ?? []) ?? [] },
      { keepDirty: false },
    );
  }, [pages, reset]);

  const loadingMore =
    size > 0 && pages && typeof pages[size - 1] === "undefined";
  const hasMore = !!pages?.at(-1)?.pagination?.has_next_page;

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
    async ({ arg }) => {
      const res = await apiFetch("/api/instagram/posts", {
        method: "POST",
        body: arg,
      });
      if (!res?.success) throw new Error(res?.error);
      // Refetch here rather than in onSuccess: SWR doesn't await onSuccess,
      // and the save bar should stay loading until the form has been reset.
      await refetchPosts();
      return res;
    },
    {
      throwOnError: false,
      onSuccess: () => shopify.toast.show("Posts saved"),
      onError: () =>
        shopify.toast.show("Couldn't save posts", { isError: true }),
    },
  );

  const { fields: media, update: updateMedia } = useFieldArray({
    control,
    name: "media",
    keyName: "field_id",
  });

  // Ids of the posts ticked for bulk tagging. Tagged or unplayable posts
  // can't be ticked, and drop out if they become tagged meanwhile.
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const selectable = media.filter((p) => p.media_url && !isTagged(p));
  const selectedCount = selectable.filter((p) => selectedIds.has(p.id)).length;

  const toggleSelected = (id, checked) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      checked ? next.add(id) : next.delete(id);
      return next;
    });

  const clearSelection = () => setSelectedIds(new Set());

  const tagSelected = async () => {
    const tag = await pickProductTag();
    if (!tag) return;
    media.forEach((post, index) => {
      if (selectedIds.has(post.id) && post.media_url && !isTagged(post)) {
        updateMedia(index, { ...post, products: [tag] });
      }
    });
    clearSelection();
  };

  return (
    <s-page heading="Manage posts" inlineSize="base">
      {/* While posts are ticked, bulk tagging takes over the primary action
          and syncing moves to the secondary actions. */}
      {selectedCount > 0 && (
        <>
          <s-button
            slot="primary-action"
            icon="product-add"
            onClick={tagSelected}
          >
            Tag product to {selectedCount} post{selectedCount === 1 ? "" : "s"}
          </s-button>
          <s-button slot="secondary-actions" onClick={clearSelection}>
            Clear selection
          </s-button>
        </>
      )}
      <s-button
        slot="primary-action"
        onClick={triggerSync}
        {...(syncing ? { loading: true } : {})}
      >
        Sync now
      </s-button>
      <div className={`mb-4 ${enter}`} style={delay(75)}>
        <s-paragraph color="subdued">
          Sync your latest Instagram posts and tag products to make them
          shoppable
        </s-paragraph>
      </div>

      {isLoading ? (
        <div
          className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2"
          aria-busy="true"
          aria-label="Loading posts"
        >
          {Array.from({ length: PER_PAGE }, (_, i) => (
            <div
              key={i}
              className="w-full aspect-9/16 rounded-md border border-neutral-300 bg-neutral-200 animate-pulse"
            />
          ))}
        </div>
      ) : media.length === 0 && !hasMore ? (
        <p className="text-sm text-neutral-500">
          No posts yet. Click “Sync now” to pull in your latest Instagram posts.
        </p>
      ) : (
        <AppBridgeForm
          {...formMethods}
          onSubmit={async (values) => {
            const changed = values.media.filter(
              (_, i) => dirtyFields.media?.[i],
            );
            if (!changed.length) return;
            await triggerSave({ media: changed });
          }}
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
            {media.map((post, index) => (
              <PostCard
                key={post.field_id}
                post={post}
                showTagProducts
                selected={selectedIds.has(post.id) && !isTagged(post)}
                checkBoxDisabled={isTagged(post)}
                onSelect={(checked) => toggleSelected(post.id, checked)}
                onTagProduct={(tag) => {
                  updateMedia(index, {
                    ...post,
                    products: tag ? [tag] : null,
                  });
                }}
              />
            ))}
          </div>
        </AppBridgeForm>
      )}

      {!isLoading && hasMore && (
        <div className="flex flex-col items-center gap-2 mt-4">
          <s-button
            onClick={() => setSize(size + 1)}
            disabled={isDirty || undefined}
            {...(loadingMore ? { loading: true } : {})}
          >
            Load more
          </s-button>
          {isDirty && (
            <span className="text-sm text-neutral-500">
              Save or discard your changes to load more posts
            </span>
          )}
        </div>
      )}
    </s-page>
  );
}
