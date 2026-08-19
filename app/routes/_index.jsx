import { AccountInformationCard } from "app/components/app-blocks/account-information-card";
import { ThemeBlocksCard } from "app/components/app-blocks/theme-blocks-card";
import SettingCard from "app/components/settings-card";
import { useFetch } from "app/hooks/useFetch";
import { delay, enter } from "app/lib/animations";
import { apiFetch } from "app/lib/api-client";
import { FEEDS_KEY } from "app/lib/feeds";
import { useRouteLoaderData } from "react-router";

export default function Index() {
  const { shopDetails } = useRouteLoaderData("root");

  const instagramAccount = shopDetails?.instagram_account.find(
    (acc) => acc.status == "CONNECTED",
  );

  // The root loader already shipped the feeds, so this only fetches once
  // something calls `mutate(FEEDS_KEY)` — e.g. after a feed is edited.
  const { data: feedsData } = useFetch(FEEDS_KEY, ({ key }) => apiFetch(key), {
    fallbackData: { success: true, data: shopDetails?.feeds },
    revalidateOnMount: false,
  });

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
      <s-query-container>
        <s-grid
          gridTemplateColumns="@container (inline-size > 640px) 1fr 1fr 1fr 1fr, 1fr 1fr"
          gap="base"
        >
          <s-section>
            <s-stack direction="block" gap="small">
              <s-heading>Clicks</s-heading>
              <s-text fontVariantNumeric="tabular-nums">102</s-text>
            </s-stack>
          </s-section>
          <s-section>
            <s-stack direction="block" gap="small">
              <s-heading>Impressions</s-heading>
              <s-text fontVariantNumeric="tabular-nums">12,123</s-text>
            </s-stack>
          </s-section>
          <s-section>
            <s-stack direction="block" gap="small">
              <s-heading>Impressions</s-heading>
              <s-text fontVariantNumeric="tabular-nums">12,123</s-text>
            </s-stack>
          </s-section>
          <s-section>
            <s-stack direction="block" gap="small">
              <s-heading>Impressions</s-heading>
              <s-text fontVariantNumeric="tabular-nums">12,123</s-text>
            </s-stack>
          </s-section>
        </s-grid>
      </s-query-container>

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
