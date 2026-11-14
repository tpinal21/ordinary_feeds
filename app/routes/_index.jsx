import { AccountInformationCard } from "app/components/app-blocks/account-information-card";
import { ThemeBlocksCard } from "app/components/app-blocks/theme-blocks-card";
import SettingCard from "app/components/settings-card";
import { useFetch } from "app/hooks/useFetch";
import { useThemeBlocks } from "app/hooks/useThemeBlocks";
import { delay, enter } from "app/lib/animations";
import { apiFetch } from "app/lib/api-client";
import { FEEDS_KEY } from "app/lib/feeds";
import { useState } from "react";
import { Navigate, useOutletContext } from "react-router";

export default function Index() {
  const { shopDetails } = useOutletContext();
  const { storefrontEnabled } = useThemeBlocks();

  const instagramAccount = shopDetails?.instagram_account.find(
    (acc) => acc.status == "CONNECTED",
  );

  // The root loader already shipped the feeds, so this only fetches once
  // something calls `mutate(FEEDS_KEY)` — e.g. after a feed is edited.
  const { data: feedsData } = useFetch(FEEDS_KEY, ({ key }) => apiFetch(key), {
    fallbackData: { success: true, data: shopDetails?.feeds },
    revalidateOnMount: false,
  });

  if (shopDetails?.instagram_account?.length == 0) {
    return <Navigate to="/setup" />;
  }

  return (
    <s-page heading="" inlineSize="base">
      <div className={`flex flex-col mb-3 items-start ${enter}`}>
        <h1 className="text-xl font-semibold mb-2">
          Hey {instagramAccount?.username} 👋🏻!
        </h1>
        <s-text
          className={`text-sm text-neutral-500 mb-4 ${enter}`}
          style={delay(75)}
        >
          Set up your Instagram feeds in minutes
        </s-text>
      </div>
      {!storefrontEnabled && !!feedsData?.data?.length && (
        <StorefrontDisabledBanner />
      )}
      <MetricsOverview />

      <div className="mt-4">
        <s-divider color="strong" />
      </div>

      <div className="grid gap-4 grid-cols-1 mt-4 md:grid-cols-[auto_326px]">
        <div className="min-w-0">
          <SettingCard feeds={feedsData?.data} />
        </div>
        <div className="order-first md:order-0">
          <div className="sticky top-4 flex flex-col gap-4">
            <AccountInformationCard instagramAccount={instagramAccount} />
            <ThemeBlocksCard />
          </div>
        </div>
      </div>
    </s-page>
  );
}

// The Settings page can hide every feed at once; without this the merchant
// sees "Added" on each card and wonders why nothing shows on the store.
const StorefrontDisabledBanner = () => (
  <div className="mb-3">
    <s-banner tone="warning" heading="Feeds are hidden from your storefront">
      <s-paragraph>
        &quot;Show feeds on your storefront&quot; is turned off in Settings, so
        customers won&apos;t see any feed, even where its block is added to your
        theme.
      </s-paragraph>
      <s-button slot="secondary-actions" href="/settings">
        Go to settings
      </s-button>
    </s-banner>
  </div>
);

const METRIC_TILES = [
  {
    key: "impressions",
    label: "Impressions",
    help: "Times a feed was at least half on screen",
    value: (c) => c.impression,
  },
  {
    key: "views",
    label: "Video views",
    help: "Posts watched for 3 seconds or more",
    value: (c) => c.video_view,
  },
  {
    key: "clicks",
    label: "Clicks",
    help: "Post opens and tagged product clicks",
    value: (c) => c.post_click + c.product_click,
  },
  {
    key: "add_to_carts",
    label: "Add to carts",
    help: "Tagged products added to cart from a feed",
    value: (c) => c.add_to_cart,
  },
];

const METRIC_RANGES = [7, 30, 90];

const formatNumber = (n) => new Intl.NumberFormat().format(n ?? 0);

// Storefront feed metrics, collected by the app's web pixel.
const MetricsOverview = () => {
  const [days, setDays] = useState(30);
  const { data, isLoading } = useFetch(`/api/metrics?days=${days}`, ({ key }) =>
    apiFetch(key),
  );
  const counts = data?.success ? data.data.counts : null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <s-heading>Feed performance</s-heading>
        <div>
          <s-select
            labelAccessibilityVisibility="exclusive"
            label="Date range"
            value={String(days)}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            {METRIC_RANGES.map((d) => (
              <s-option key={d} value={String(d)}>
                Last {d} days
              </s-option>
            ))}
          </s-select>
        </div>
      </div>
      <s-query-container>
        <s-grid
          gridTemplateColumns="@container (inline-size > 640px) 1fr 1fr 1fr 1fr, 1fr 1fr"
          gap="base"
        >
          {METRIC_TILES.map((tile) => (
            <s-section key={tile.key}>
              <s-stack direction="block" gap="small">
                <div className="inline-flex items-center gap-1">
                  <s-heading>{tile.label}</s-heading>
                  <button
                    type="button"
                    interestfor={`metric-help-${tile.key}`}
                    aria-label={tile.help}
                    className="cursor-help"
                  >
                    <s-icon type="info" tone="auto" color="subdued" />
                  </button>
                  <s-tooltip id={`metric-help-${tile.key}`}>
                    {tile.help}
                  </s-tooltip>
                </div>
                {isLoading ? (
                  <s-spinner size="base" />
                ) : (
                  <s-text type="strong">
                    {counts ? formatNumber(tile.value(counts)) : "–"}
                  </s-text>
                )}
              </s-stack>
            </s-section>
          ))}
        </s-grid>
      </s-query-container>
      {data && !data.success && (
        <s-banner tone="critical">Couldn&apos;t load feed metrics.</s-banner>
      )}
    </div>
  );
};
