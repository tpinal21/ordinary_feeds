// Opens the Shopify product picker and returns the picked product in the
// shape `instagram_media.products` uses (one M2M junction row), or null if
// the merchant closed the picker without choosing.
export async function pickProductTag() {
  const selection = await shopify.resourcePicker({
    type: "product",
    filter: { variants: false },
    multiple: false,
  });
  const product = selection?.[0];
  if (!product) return null;

  return {
    product_id: {
      id: product.id,
      title: product.title,
      images: (product.images ?? []).map((img) => ({
        id: img.id,
        alt_text: img.altText ?? null,
        original_src: img.originalSrc,
      })),
    },
  };
}

export const isTagged = (post) => (post?.products?.length ?? 0) > 0;
