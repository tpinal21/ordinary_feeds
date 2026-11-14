import PostCard from "app/components/post-card";
import { useFetch } from "app/hooks/useFetch";
import { apiFetch } from "app/lib/api-client";
import { pickProductTag } from "app/lib/product-tag";
import { useState } from "react";

// The posts `product` is tagged in, newest first, up to `limit`: what a
// PRODUCT gallery renders on that product's page. Pass a null product to skip
// the fetch.
export const useTaggedPosts = (product, limit) => {
  const { data, isLoading } = useFetch(
    product ? ["tagged-posts", product.id, limit] : null,
    () =>
      apiFetch(
        `/api/instagram/posts?product_id=${encodeURIComponent(product.id)}&limit=${limit}`,
      ),
  );
  return {
    posts: data?.data ?? [],
    isLoading,
    failed: !!data && !data.success,
  };
};

// Opens the Shopify product picker; resolves to `{ id, title, images }`, or
// null if the merchant closed it.
const chooseProduct = async () => (await pickProductTag())?.product_id ?? null;

// Preview-only product state for a PRODUCT gallery: the product chosen here
// is never saved, it only drives a preview.
export const usePreviewProduct = () => {
  const [product, setProduct] = useState(null);
  const choose = async () => {
    const picked = await chooseProduct();
    if (picked) setProduct(picked);
  };
  return { product, choose };
};

// A compact bar for the feed editor: which product the live preview is for,
// and a button to pick it.
export const ProductPreviewBar = ({ product, onChoose, tagged }) => (
  <div className="flex flex-wrap gap-2 items-center justify-between px-3 py-2 rounded-lg bg-neutral-100">
    <div className="inline-flex flex-wrap gap-2 items-center">
      <s-text>Previewing for product:</s-text>
      {product ? (
        <s-badge>{product.title}</s-badge>
      ) : (
        <s-text color="subdued">none selected</s-text>
      )}
      {product && tagged.isLoading && <s-spinner size="base" />}
      {product && tagged.failed && (
        <s-text tone="critical">Couldn&apos;t load tagged posts.</s-text>
      )}
      {product &&
        !tagged.isLoading &&
        !tagged.failed &&
        !tagged.posts.length && (
          <s-text color="subdued">
            This product isn&apos;t tagged in any post yet.
          </s-text>
        )}
    </div>
    <s-button icon="product" onClick={onChoose}>
      {product ? "Change product" : "Select product"}
    </s-button>
  </div>
);

// Preview-only: the product chosen here isn't saved with the gallery. It just
// shows what a PRODUCT gallery would render on that product's page.
export const ProductPreview = ({ limit }) => {
  const { product, choose } = usePreviewProduct();
  const { posts, isLoading, failed } = useTaggedPosts(product, limit);

  return (
    <s-box
      background="subdued"
      border="base"
      borderColor="subdued"
      borderRadius="large-200"
    >
      <div className="px-4 py-2 flex flex-wrap gap-2 items-center justify-between">
        <div className="inline-flex gap-2 items-center">
          <s-heading>Preview for product:</s-heading>
          {product && <s-badge>{product.title}</s-badge>}
        </div>
        <s-button icon="product" onClick={choose}>
          {product ? "Change product" : "Select product"}
        </s-button>
      </div>

      <s-section>
        {!product ? (
          <div className="flex flex-col justify-center items-center gap-3 p-4">
            <s-heading>No product selected</s-heading>
            <s-text>
              Select a product to preview the posts it&apos;s tagged in.
            </s-text>
          </div>
        ) : isLoading ? (
          <s-stack justifyContent="center" direction="inline">
            <s-spinner />
          </s-stack>
        ) : failed ? (
          <s-banner tone="critical">Couldn&apos;t load tagged posts.</s-banner>
        ) : posts.length ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col justify-center items-center gap-3 p-4">
            <s-heading>No tagged posts</s-heading>
            <s-text>
              This product isn&apos;t tagged in any post yet. Tag it from Manage
              posts.
            </s-text>
          </div>
        )}
      </s-section>
    </s-box>
  );
};
