import { FeedCard } from "app/components/feed-card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "app/components/ui/tabs";
import { enter, enterFast, stagger } from "app/lib/animations";
import { APP_WINDOW_CHANNEL } from "app/lib/app-window";
import {
  FEEDS_KEY,
  FEED_TYPES,
  feedCreateWindowId,
  feedSettings,
} from "app/lib/feeds";
import { Fragment, useEffect, useState } from "react";
import { mutate } from "swr";
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
      settings: feedSettings(feed),
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
                <FeedCard
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
                <FeedCard
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
                <FeedCard
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
  <s-section accessibilitylabel="Empty state section">
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
  // The create route renders in a sibling iframe, so it can't reach the
  // `s-app-window` element — it broadcasts instead and this frame hides it.
  useEffect(() => {
    const windowIds = FEED_TYPES.map((type) => feedCreateWindowId(type, page));

    const channel = new BroadcastChannel(APP_WINDOW_CHANNEL);
    channel.onmessage = ({ data }) => {
      if (data?.type !== "close" || !windowIds.includes(data.id)) return;

      document.getElementById(data.id)?.hide();
      // The feed was created in the window's own frame, so this frame's cache
      // doesn't know about it yet.
      mutate(FEEDS_KEY);
    };
    return () => channel.close();
  }, [page]);

  return (
    <>
      <s-button
        commandfor="add-feed-popover"
        accessibilitylabel="Add feed"
        icon="plus"
        variant="primary"
      >
        Add feed
      </s-button>
      <s-popover id="add-feed-popover" accessibilitylabel="Add a feed">
        <div className="p-0.5 flex flex-col gap-0.5">
          {Object.entries(FEED_STYLES).map(([type, { label, icon }]) => {
            const appWindowId = feedCreateWindowId(type, page);
            return (
              <Fragment key={appWindowId}>
                <button
                  type="button"
                  className="inline-flex gap-0.5 px-1.5 cursor-pointer rounded-md hover:bg-neutral-100 py-0.5"
                  accessibilitylabel="Create feed"
                  commandfor={appWindowId}
                  command="--show"
                >
                  <s-icon type={icon} />
                  <span>{label}</span>
                </button>
                <s-app-window
                  id={appWindowId}
                  src={`/feeds/create?type=${type}&page=${page}`}
                ></s-app-window>
              </Fragment>
            );
          })}
        </div>
      </s-popover>
    </>
  );
};
