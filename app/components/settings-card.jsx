import {
  CAROUSEL_FEED_DEFAULTS,
  CarouselFeedCard,
} from "app/components/feed-card";
import { Card, CardContent, CardHeader } from "app/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "app/components/ui/tabs";
import { enter, enterFast, stagger } from "app/lib/animations";

const TABS = [
  { value: "home", label: "Home page" },
  { value: "product", label: "Product page" },
  { value: "collection", label: "Collection page" },
  { value: "other", label: "Other pages" },
];

const FEED_STYLES = {
  CAROUSEL: { label: "CAROUSEL", icon: "slideshow" },
  GRID: { label: "GRID", icon: "grid" },
  POPUP: { label: "POPUP", icon: "layout-popup" },
};

export default function SettingCard({ feeds }) {
  const feedFields = feeds?.map((feed) => ({
    ...feed,
    settings: { ...CAROUSEL_FEED_DEFAULTS, ...JSON.parse(feed.settings) },
  }));

  return (
    <Tabs defaultValue="home" className="w-full">
      <TabsList className="w-full p-0 bg-transparent">
        {TABS.map(({ value, label }, index) => (
          <TabsTrigger
            key={value}
            value={value}
            className={enter}
            style={stagger(index, { start: 150 })}
          >
            {label}
          </TabsTrigger>
        ))}
      </TabsList>

      {/*
        Panels are unmounted while inactive (Base UI `keepMounted` defaults to
        false), so this re-runs on every tab switch as well as on mount. Kept
        short and delay-free so clicking a tab still feels instant.
      */}
      <TabsContent value="home" className={enterFast}>
        <Card>
          <CardHeader>
            <div className="inline-flex justify-between items-center">
              <s-heading>Home page blocks</s-heading>
              <div className="inline-flex gap-1 items-center">
                <AddFeedButton />
              </div>
            </div>
            <s-paragraph>
              Add one or more feeds to your home page. Each feed can use a
              different style.
            </s-paragraph>
          </CardHeader>

          <CardContent>
            <div className="flex flex-col gap-3">
              {feedFields.length === 0 ? (
                <div className="border border-dashed border-neutral-300 rounded-md p-6 text-center text-sm text-neutral-500">
                  No feeds yet. Use “Add feed” to place your first Instagram
                  feed on this page.
                </div>
              ) : (
                feedFields.map((feed) => (
                  <CarouselFeedCard
                    key={feed.field_id}
                    feed={feed}
                    onRemove={() => {}}
                  />
                ))
              )}
            </div>
          </CardContent>
        </Card>
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
