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
    <div className="max-w-249.5 mx-auto p-4 flex flex-col">
      <div className={`flex justify-between items-start ${enter}`}>
        <h1 className="text-xl font-semibold mb-2">
          Hey {instagramAccount?.username} 👋🏻!
        </h1>
      </div>

      <p className={`text-sm text-neutral-500 mb-4 ${enter}`} style={delay(75)}>
        Set up your Instagram feeds in minutes
      </p>
      <div className="grid gap-4 grid-cols-[auto_326px]">
        <div className="min-w-0">
          <SettingCard feeds={feedsData?.data} />
        </div>
        <div>
          <div className="sticky top-4 flex flex-col gap-4">
            <div className={enter} style={delay(200)}>
              <AccountInformationCard instagramAccount={instagramAccount} />
            </div>
            <div className={enter} style={delay(300)}>
              <ThemeBlocksCard />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
