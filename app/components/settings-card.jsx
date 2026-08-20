import {
  CAROUSEL_FEED_DEFAULTS,
  CarouselFeedCard,
} from "app/components/feed-card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "app/components/ui/tabs";
import { enter, enterFast, stagger } from "app/lib/animations";
import { useState } from "react";

const TABS = [
  { value: "HOME_PAGE", label: "Home page" },
  { value: "PRODUCT_PAGE", label: "Product page" },
  { value: "COLLECTION_PAGE", label: "Collection page" },
];

const FEED_STYLES = {
  CAROUSEL: { label: "CAROUSEL", icon: "slideshow" },
  GRID: { label: "GRID", icon: "grid" },
  POPUP: { label: "POPUP", icon: "layout-popup" },
};

export default function SettingCard({ feeds }) {
  const [currentTab, setcurrentTab] = useState("HOME_PAGE");

  const feedFields = feeds
    ?.map((feed) => ({
      ...feed,
      settings: { ...CAROUSEL_FEED_DEFAULTS, ...JSON.parse(feed.settings) },
    }))
    .filter((f) => f.page == currentTab);

  return (
    <Tabs
      defaultValue="HOME_PAGE"
      className="w-full"
      value={currentTab}
      onValueChange={setcurrentTab}
    >
      <TabsList className="w-full p-0 bg-transparent">
        {TABS.map((tab, index) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className={enter}
            style={stagger(index, { start: 150 })}
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="HOME_PAGE" className={enterFast}>
        <s-section>
          <s-stack direction="block" gap="small-300">
            <div className="inline-flex justify-between items-center">
              <s-heading>Home page blocks</s-heading>
              <div className="inline-flex gap-1 items-center">
                <AddFeedButton />
              </div>
            </div>
            <s-description>
              Add one or more feeds to your home page. Each feed can use a
              different style.
            </s-description>
          </s-stack>
          <div className="flex flex-col gap-3 mt-3">
            {feedFields.length === 0 ? (
              <div className="border border-dashed border-neutral-300 rounded-md p-6 text-center text-sm text-neutral-500">
                No feeds yet. Use “Add feed” to place your first Instagram feed
                on this page.
              </div>
            ) : (
              feedFields.map((feed) => (
                <CarouselFeedCard
                  key={feed.id}
                  feed={feed}
                  onRemove={() => {}}
                />
              ))
            )}
          </div>
        </s-section>
      </TabsContent>
      <TabsContent value="PRODUCT_PAGE" className={enterFast}>
        <s-section>
          <s-stack direction="block" gap="small-300">
            <div className="inline-flex justify-between items-center">
              <s-heading>Product page blocks</s-heading>
              <div className="inline-flex gap-1 items-center">
                <AddFeedButton />
              </div>
            </div>
            <s-description>
              Add one or more feeds to your product page. Each feed can use a
              different style.
            </s-description>
          </s-stack>
          <div className="flex flex-col gap-3 mt-3">
            {feedFields.length === 0 ? (
              <div className="border border-dashed border-neutral-300 rounded-md p-6 text-center text-sm text-neutral-500">
                No feeds yet. Use “Add feed” to place your first Instagram feed
                on this page.
              </div>
            ) : (
              feedFields.map((feed) => (
                <CarouselFeedCard
                  key={feed.id}
                  feed={feed}
                  onRemove={() => {}}
                />
              ))
            )}
          </div>
        </s-section>
      </TabsContent>
    </Tabs>
  );
}

const AddFeedButton = () => {
  return (
    <>
      <s-button commandfor="add-feed-popover" icon="plus" variant="primary">
        Add feed
      </s-button>

      <s-popover id="add-feed-popover" accessibilityLabel="Add a feed">
        <div className="p-0.5 flex flex-col gap-0.5">
          {Object.entries(FEED_STYLES).map(([type, { label, icon }]) => (
            <button
              type="button"
              key={type}
              className="inline-flex gap-0.5 px-1.5 cursor-pointer rounded-md hover:bg-neutral-100 py-0.5"
              onClick={() => {}}
              commandfor="add-feed-popover"
              command="--hide"
            >
              <s-icon type={icon} />

              <span>{label}</span>
            </button>
          ))}
        </div>
      </s-popover>
    </>
  );
};
