import { AccountInformationCard } from "app/components/app-blocks/account-information-card";
import { ThemeBlocksCard } from "app/components/app-blocks/theme-blocks-card";
import SettingCard from "app/components/settings-card";
import { useFetch } from "app/hooks/useFetch";
import { useThemeBlocks } from "app/hooks/useThemeBlocks";
import { delay, enter } from "app/lib/animations";
import { apiFetch } from "app/lib/api-client";
import { FEEDS_KEY } from "app/lib/feeds";
import { useEffect, useRef, useState } from "react";
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
    value: ({ counts: c }) => formatNumber(c.impression),
  },
  {
    key: "views",
    label: "Video views",
    help: "Posts watched for 3 seconds or more",
    value: ({ counts: c }) => formatNumber(c.video_view),
  },
  {
    key: "clicks",
    label: "Clicks",
    help: "Post opens and tagged product clicks",
    value: ({ counts: c }) => formatNumber(c.post_click + c.product_click),
  },
  {
    key: "add_to_carts",
    label: "Add to carts",
    help: "Tagged products added to cart from a feed",
    value: ({ counts: c }) => formatNumber(c.add_to_cart),
  },
  {
    key: "orders",
    // Revenue attribution is a Plus feature.
    access: "revenue",
    label: "Orders",
    help: "Orders with a product added to cart from a feed",
    value: ({ revenue }) =>
      formatNumber(revenue.reduce((sum, r) => sum + r.orders, 0)),
  },
  {
    key: "revenue",
    // Revenue attribution is a Plus feature.
    access: "revenue",
    label: "Revenue",
    help: "Sales of products added to cart from a feed, after line discounts",
    value: ({ revenue }) => formatRevenue(revenue),
  },
];

const METRIC_RANGES = [7, 30, 90];

const formatNumber = (n) => new Intl.NumberFormat().format(n ?? 0);

// One amount per currency the orders were placed in, largest first.
const formatRevenue = (revenue) =>
  revenue.length
    ? revenue
        .map((r) =>
          new Intl.NumberFormat(undefined, {
            style: "currency",
            currency: r.currency,
          }).format(r.amount),
        )
        .join(" · ")
    : formatNumber(0);

const RANGE_LABEL = (d) => `Last ${d} days`;

// Storefront feed metrics, collected by the app's web pixel. Laid out like the
// strip above Shopify's own Orders list: date range on the left, then a
// sideways-scrolling row of metric totals.
const MetricsOverview = () => {
  const [days, setDays] = useState(30);
  const { data, isLoading } = useFetch(`/api/metrics?days=${days}`, ({ key }) =>
    apiFetch(key),
  );
  const metrics = data?.success ? data.data : null;
  const strip = useScrollStrip();

  return (
    <div className="flex flex-col gap-2">
      <s-heading>Feed performance</s-heading>
      <s-section padding="none">
        <div className="flex items-stretch">
          <div className="shrink-0 flex items-center px-3 py-3 border-r border-neutral-200">
            <s-button
              variant="tertiary"
              icon="calendar"
              commandfor="metrics-range"
              accessibilitylabel="Date range"
            >
              {RANGE_LABEL(days)}
            </s-button>
            <s-popover id="metrics-range" accessibilitylabel="Date range">
              <div className="p-1.5 flex flex-col gap-0.5 min-w-36">
                {METRIC_RANGES.map((d) => (
                  <button
                    key={d}
                    type="button"
                    commandfor="metrics-range"
                    command="--hide"
                    onClick={() => setDays(d)}
                    className={`flex items-center justify-between gap-3 px-2 py-1 rounded-md text-left cursor-pointer hover:bg-neutral-100 ${
                      d === days ? "bg-neutral-100 font-semibold" : ""
                    }`}
                  >
                    {RANGE_LABEL(d)}
                    {d === days && <s-icon type="check" size="small" />}
                  </button>
                ))}
              </div>
            </s-popover>
          </div>

          <div className="relative min-w-0 flex-1">
            <div
              ref={strip.ref}
              className="flex overflow-x-auto scroll-smooth snap-x snap-mandatory scrollbar-none [&::-webkit-scrollbar]:hidden"
            >
              {METRIC_TILES.map((tile) => (
                <MetricTile
                  key={tile.key}
                  tile={tile}
                  metrics={metrics}
                  loading={isLoading}
                />
              ))}
            </div>

            {/*
              Outside the scrolling row on purpose: an overflow-x container
              also clips and scrolls vertically, so a tooltip inside it
              stretched the section's height while open. `interestfor` finds
              them by id.
            */}
            {METRIC_TILES.map((tile) => (
              <s-tooltip key={tile.key} id={`metric-help-${tile.key}`}>
                {tile.help}
              </s-tooltip>
            ))}

            {(strip.canPrev || strip.canNext) && (
              <div className="absolute inset-y-0 right-0 flex items-center gap-0.5 pl-8 pr-2 bg-linear-to-l from-white from-60% to-transparent pointer-events-none">
                <StripArrow
                  direction="left"
                  disabled={!strip.canPrev}
                  onClick={() => strip.scrollBy(-1)}
                />
                <StripArrow
                  direction="right"
                  disabled={!strip.canNext}
                  onClick={() => strip.scrollBy(1)}
                />
              </div>
            )}
          </div>
        </div>
      </s-section>
      {data && !data.success && (
        <s-banner tone="critical">Couldn&apos;t load feed metrics.</s-banner>
      )}
    </div>
  );
};

const MetricTile = ({ tile, metrics, loading }) => (
  <div className="snap-start shrink-0 w-34 flex items-end px-4 py-3">
    <div className="flex flex-col gap-1 min-w-0">
      {/* Dotted underline, as in Shopify's admin: hover for what it counts. */}
      <button
        type="button"
        interestfor={`metric-help-${tile.key}`}
        aria-label={`${tile.label}: ${tile.help}`}
        className="self-start text-sm font-semibold whitespace-nowrap cursor-help border-b-2 border-dotted border-neutral-300"
      >
        {tile.label}
      </button>
      {loading ? (
        <span className="h-4.75 w-12 rounded bg-neutral-200 animate-pulse" />
      ) : metrics && !metrics.access?.[tile.access ?? "metrics"] ? (
        // Held back by the plan (api.metrics.jsx); still recorded meanwhile.
        <a
          href="/plans"
          className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:underline"
        >
          <s-icon type="lock" size="small" />
          {tile.access === "revenue" ? "Plus" : "Pro"}
        </a>
      ) : (
        <span className="text-sm font-semibold tabular-nums truncate">
          {metrics ? tile.value(metrics) : "-"}
        </span>
      )}
    </div>
  </div>
);

const StripArrow = ({ direction, disabled, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={direction === "left" ? "Previous metrics" : "Next metrics"}
    className="pointer-events-auto inline-flex items-center justify-center size-7 rounded-lg cursor-pointer text-neutral-800 hover:bg-neutral-200 disabled:text-neutral-400 disabled:hover:bg-transparent disabled:cursor-default"
  >
    <s-icon type={direction === "left" ? "chevron-left" : "chevron-right"} />
  </button>
);

// Scroll state for the metrics row: whether there's more on either side, and
// a page-wise scroll for the arrow buttons.
function useScrollStrip() {
  const ref = useRef(null);
  const [edges, setEdges] = useState({ canPrev: false, canNext: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () =>
      setEdges({
        canPrev: el.scrollLeft > 1,
        canNext: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
      });
    update();
    el.addEventListener("scroll", update, { passive: true });
    const resize = new ResizeObserver(update);
    resize.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      resize.disconnect();
    };
  }, []);

  const scrollBy = (dir) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8 });
  };

  return { ref, scrollBy, ...edges };
}
