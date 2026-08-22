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
import { Fragment, useState } from "react";
import FeedIllustration from "app/components/illustrations/feed-illustration";

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
          {!!feedFields?.length && (
            <s-stack direction="block" gap="small-300">
              <div className="inline-flex justify-between items-center">
                <s-heading>Home page blocks</s-heading>
                <div className="inline-flex gap-1 items-center">
                  <AddFeedButton page="HP" />
                </div>
              </div>
              <s-description>
                Add one or more feeds to your home page. Each feed can use a
                different style.
              </s-description>
            </s-stack>
          )}
          <div className="flex flex-col gap-3 mt-3">
            {feedFields.length === 0 ? (
              <EmptyStateCard page="HP" />
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
          {!!feedFields?.length && (
            <s-stack direction="block" gap="small-300">
              <div className="inline-flex justify-between items-center">
                <s-heading>Product page blocks</s-heading>
                <div className="inline-flex gap-1 items-center">
                  <AddFeedButton page="PP" />
                </div>
              </div>
              <s-description>
                Add one or more feeds to your product page. Each feed can use a
                different style.
              </s-description>
            </s-stack>
          )}
          <div className="flex flex-col gap-3 mt-3">
            {feedFields.length === 0 ? (
              <EmptyStateCard page="PP" />
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
      <TabsContent value="COLLECTION_PAGE" className={enterFast}>
        <s-section>
          {!!feedFields?.length && (
            <s-stack direction="block" gap="small-300">
              <div className="inline-flex justify-between items-center">
                <s-heading>Collection page blocks</s-heading>
                <div className="inline-flex gap-1 items-center">
                  <AddFeedButton page="CP" />
                </div>
              </div>
              <s-description>
                Add one or more feeds to your collection page. Each feed can use
                a different style.
              </s-description>
            </s-stack>
          )}
          <div className="flex flex-col gap-3 mt-3">
            {feedFields.length === 0 ? (
              <EmptyStateCard page="CP" />
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

const EmptyStateCard = ({ page }) => (
  <s-section accessibilityLabel="Empty state section">
    <s-grid gap="base" justifyItems="center" paddingBlockEnd="large-400">
      <FeedIllustration className="size-52" />
      <s-grid justifyItems="center" maxInlineSize="450px" gap="base">
        <s-stack alignItems="center" gap="small">
          <s-heading>No feeds yet</s-heading>
          <s-paragraph>
            Create your first Instagram feed on this page.
          </s-paragraph>
        </s-stack>
        <AddFeedButton page={page} />
      </s-grid>
    </s-grid>
  </s-section>
);

const AddFeedButton = ({ page }) => {
  return (
    <>
      <s-button commandfor="add-feed-popover" icon="plus" variant="primary">
        Add feed
      </s-button>
      <s-popover id="add-feed-popover" accessibilityLabel="Add a feed">
        <div className="p-0.5 flex flex-col gap-0.5">
          {Object.entries(FEED_STYLES).map(([type, { label, icon }]) => {
            const appWindowId = `${type}_${page}`;
            return (
              <Fragment key={appWindowId}>
                <button
                  type="button"
                  className="inline-flex gap-0.5 px-1.5 cursor-pointer rounded-md hover:bg-neutral-100 py-0.5"
                  accessibilityLabel="Create feed"
                  commandfor={appWindowId}
                  command="--show"
                >
                  <s-icon type={icon} />
                  <span>{label}</span>
                </button>
                <s-app-window
                  id={appWindowId}
                  src={`/feeds/create?type=${appWindowId}`}
                ></s-app-window>
              </Fragment>
            );
          })}
        </div>
      </s-popover>
    </>
  );
};
