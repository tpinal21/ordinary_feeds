import { Modal, TitleBar } from "@shopify/app-bridge-react";
import { useFetch } from "app/hooks/useFetch";
import { useMutation } from "app/hooks/useMutation";
import { apiFetch } from "app/lib/api-client";
import { delay, enter } from "app/lib/animations";
import { useEffect, useState } from "react";

export default function MediaGalleryList() {
  const [currentTab, setCurrentTab] = useState(null);
  const [galleryToDelete, setGalleryToDelete] = useState(null);

  const {
    data: galleriesData,
    isLoading,
    mutate: refetchGalleries,
  } = useFetch("galleries", () => apiFetch("/api/galleries"));

  const galleries = galleriesData?.data || [];

  const { trigger: deleteGallery, isMutating: isDeleting } = useMutation(
    "delete-gallery",
    ({ arg }) =>
      apiFetch("/api/galleries", { method: "DELETE", body: { id: arg } }),
    {
      onSuccess: (res) => {
        shopify.toast.show(
          res.success ? "Gallery deleted" : "Failed to delete gallery",
          { isError: !res.success },
        );

        if (!res.success) return;

        setGalleryToDelete(null);
        refetchGalleries();
      },
    },
  );

  useEffect(() => {
    !currentTab && !!galleries?.length && setCurrentTab(galleries?.at(0)?.id);
  }, [galleries.length]);

  return (
    <div className="max-w-249.5 mx-auto p-4 flex flex-col">
      <div className={`flex gap-2 items-start ${enter}`}>
        <s-button icon="arrow-left" variant="tertiary" href="/"></s-button>
        <h1 className="text-xl font-semibold mb-2">Media gallery</h1>
        <span className="ml-auto">
          <s-button icon="plus" variant="primary" href="/media-gallery/create">
            Create gallery
          </s-button>
        </span>
      </div>

      <p className={`text-sm text-neutral-500 mb-4 ${enter}`} style={delay(75)}>
        Organize your synced Instagram posts into galleries, then display them
        anywhere in your store.
      </p>
      <div className={enter} style={delay(150)}>
        <s-section padding="none" accessibilityLabel="Puzzles table section">
          <s-table loading={isLoading}>
            <s-grid
              slot="filters"
              gap="small-200"
              gridTemplateColumns="1fr auto"
            >
              <s-text-field
                label="Search galleries"
                labelAccessibilityVisibility="exclusive"
                icon="search"
                placeholder="Searching all galleries"
              />
            </s-grid>
            <s-table-header-row>
              <s-table-header listSlot="primary">Title</s-table-header>
              <s-table-header listSlot="secondary">Type</s-table-header>
              <s-table-header format="numeric">Media count</s-table-header>
              <s-table-header>
                <span className="text-center inline-block w-full">Actions</span>
              </s-table-header>
            </s-table-header-row>
            <s-table-body>
              {galleries.map((gallery) => (
                <s-table-row key={gallery?.id}>
                  <s-table-cell>
                    {gallery.title}
                    <s-link
                      id={`gallery-${gallery?.id}-title`}
                      href={`/media-gallery/${gallery?.id}`}
                      tone="neutral"
                    ></s-link>
                  </s-table-cell>
                  <s-table-cell>
                    <s-badge>{gallery.type}</s-badge>
                  </s-table-cell>
                  <s-table-cell>
                    <s-text fontVariantNumeric="tabular-nums">
                      {gallery?.media?.length}
                    </s-text>
                  </s-table-cell>
                  <s-table-cell>
                    <div className="flex gap-1 justify-center">
                      <s-button
                        icon="edit"
                        variant="tertiary"
                        href={`/media-gallery/${gallery?.id}`}
                      ></s-button>
                      <s-button
                        icon="delete"
                        variant="tertiary"
                        tone="critical"
                        accessibilityLabel={`Delete ${gallery.title}`}
                        onClick={() => setGalleryToDelete(gallery)}
                      ></s-button>
                    </div>
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        </s-section>
      </div>

      {galleryToDelete && (
        <Modal
          open
          onHide={() => !isDeleting && setGalleryToDelete(null)}
          variant="small"
        >
          <s-box padding="base">
            <s-paragraph>
              <s-text type="generic" tone="warning">
                "{galleryToDelete.title}"
              </s-text>{" "}
              will be permanently deleted. Any feed using it will stop showing
              these posts. The Instagram posts themselves are not deleted.
            </s-paragraph>
          </s-box>
          <TitleBar title="Delete gallery?">
            <button
              variant="primary"
              tone="critical"
              onClick={() => deleteGallery(galleryToDelete.id)}
              loading={isDeleting ? "" : undefined}
            >
              Delete
            </button>
            <button
              onClick={() => setGalleryToDelete(null)}
              disabled={isDeleting}
            >
              Cancel
            </button>
          </TitleBar>
        </Modal>
      )}
    </div>
  );
}
