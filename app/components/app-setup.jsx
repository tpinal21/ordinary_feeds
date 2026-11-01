import InstagramButton from "app/components/instagram-button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "app/components/ui/accordion";
import { useFetch } from "app/hooks/useFetch";
import { themeEditorUrl, useThemeBlocks } from "app/hooks/useThemeBlocks";
import { apiFetch } from "app/lib/api-client";
import { FEEDS_KEY } from "app/lib/feeds";
import { parseAsString, useQueryState } from "nuqs";
import { useEffect, useRef } from "react";
import { ThemeBlockNotices } from "./theme-block-notices";
import SettingCard from "./settings-card";
import { useOutletContext } from "react-router";

export default function AppSetup({
  shop,
  apiKey,
  instagramAccount,
  themeExtensionEnabled,
  onSetupComplete,
}) {
  const { shopDetails } = useOutletContext();

  // No default: an explicit `?step=` (e.g. the post-connect redirect to
  // create-feed) always wins; otherwise the first unfinished step opens.
  const [stepParam, setStep] = useQueryState("step", parseAsString);

  // Same SWR entry the home page uses, seeded from the root loader. Creating a
  // feed calls `mutate(FEEDS_KEY)`, so new feeds show up here without a reload.
  const { data: feedsData } = useFetch(FEEDS_KEY, ({ key }) => apiFetch(key), {
    fallbackData: { success: true, data: shopDetails?.feeds },
    revalidateOnMount: false,
  });
  const feeds = feedsData?.data ?? [];

  const {
    data: themeCheck,
    feedStatus,
    isChecking: isCheckingThemeExtension,
  } = useThemeBlocks({ enabled: !!instagramAccount });
  const isThemeBlockAdded = themeCheck?.success ?? themeExtensionEnabled;
  const addedCount = feeds.filter((feed) => feedStatus(feed).added).length;

  // Setup is done once every feed is actually placed in the theme — a block
  // alone (maybe with no feed picked) isn't enough. Fires once per visit, so
  // focus re-checks can't bounce the merchant around.
  const allFeedsPlaced = feeds.length > 0 && addedCount === feeds.length;
  // Step 3's tick: every feed placed, or (before any feed exists) any block.
  const isThemeStepDone = feeds.length ? allFeedsPlaced : isThemeBlockAdded;
  const completedRef = useRef(false);
  useEffect(() => {
    if (!allFeedsPlaced || completedRef.current) return;
    completedRef.current = true;
    shopify.toast.show("Your feeds are live in your theme!");
    onSetupComplete();
  }, [allFeedsPlaced, onSetupComplete]);

  const suggestedStep = !instagramAccount?.username
    ? "connect-account"
    : !feeds.length
      ? "create-feed"
      : "enable-extension";
  const step = stepParam || suggestedStep;

  return (
    <s-page>
      <h1 className="text-xl font-semibold mb-2">Get started!</h1>
      <p className="text-sm text-neutral-500 mb-4">
        Set up your Instagram feeds in minutes
      </p>
      <s-section>
        <s-stack gap="small-200">
          <s-stack gap="small-300">
            <s-heading>Setup Guide</s-heading>
            <s-paragraph>
              Follow these steps to set up your Instagram feeds
            </s-paragraph>
          </s-stack>

          <Accordion
            value={[step]}
            className="border border-[#e3e3e3] rounded-md"
            multiple={false}
          >
            <AccordionItem
              value="connect-account"
              className="data-open:pb-3"
              onOpenChange={() =>
                step != "connect-account" && setStep("connect-account")
              }
            >
              <AccordionTrigger className="py-3.5 px-3 items-center gap-2 font-semibold justify-start">
                {instagramAccount?.username ? (
                  <s-icon type="check-circle" tone="success" />
                ) : (
                  <s-icon type="circle-dashed" tone="subdued" />
                )}
                Connect Instagram account
                {step != "connect-account" && instagramAccount?.username && (
                  <s-badge tone="neutral">
                    @{instagramAccount?.username}
                  </s-badge>
                )}
              </AccordionTrigger>
              <AccordionContent className="bg-[#f7f7f7] mx-3 p-4 flex gap-4 flex-col rounded-lg">
                {instagramAccount
                  ? ""
                  : "Link your Instagram account to display your posts directly on your store."}
                <InstagramButton account={instagramAccount} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem
              value="create-feed"
              className="data-open:pb-3"
              onOpenChange={() =>
                step != "create-feed" && setStep("create-feed")
              }
              disabled={!instagramAccount?.username}
            >
              <AccordionTrigger className="py-3.5 px-3 items-center gap-2 font-semibold justify-start">
                {feeds.length ? (
                  <s-icon type="check-circle" tone="success" />
                ) : (
                  <s-icon type="circle-dashed" tone="neutral" />
                )}
                Create shoppable widget{" "}
              </AccordionTrigger>
              <AccordionContent className="bg-[#f7f7f7] mx-3 p-4 flex gap-4 flex-col rounded-lg">
                <SettingCard feeds={feeds} usedInSetup />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem
              value="enable-extension"
              className="data-open:pb-3"
              onOpenChange={() =>
                step != "enable-extension" && setStep("enable-extension")
              }
              disabled={!instagramAccount?.username}
            >
              <AccordionTrigger className="py-3.5 px-3 items-center gap-2 font-semibold justify-start">
                {isThemeStepDone ? (
                  <s-icon type="check-circle" tone="success" />
                ) : (
                  <s-icon type="circle-dashed" tone="neutral" />
                )}
                Add widget to your theme{" "}
                {isThemeStepDone ? (
                  <s-badge tone="success">Complete</s-badge>
                ) : (
                  <s-badge tone="warning">Incomplete</s-badge>
                )}
                {!!feeds.length && (
                  <s-badge tone="neutral">
                    {addedCount}/{feeds.length} feeds added
                  </s-badge>
                )}
              </AccordionTrigger>
              <AccordionContent className="bg-[#f7f7f7] mx-3 p-4 flex gap-4 flex-col rounded-lg">
                {feeds.length ? (
                  <>
                    <s-paragraph>
                      Add a block to your theme. It shows the page&apos;s first
                      feed automatically; to show a different one, paste its
                      label into the block&apos;s Feed label setting.
                    </s-paragraph>
                    <ThemeBlockNotices />
                    <s-stack gap="small-200">
                      {feeds.map((feed) => {
                        const { added } = feedStatus(feed);
                        return (
                          <div
                            key={feed.id}
                            className="flex items-center justify-between gap-2 rounded-md bg-white px-3 py-2 border border-[#e3e3e3]"
                          >
                            <div className="inline-flex items-center gap-2">
                              <s-text type="strong">{feed.label}</s-text>
                              {added ? (
                                <s-badge tone="success" icon="check">
                                  Added
                                </s-badge>
                              ) : (
                                <s-badge tone="warning">Not added</s-badge>
                              )}
                            </div>
                            {!added && (
                              <s-button
                                variant="secondary"
                                icon="app-extension"
                                href={themeEditorUrl({
                                  shop,
                                  apiKey,
                                  page: feed.page,
                                  type: feed.type,
                                })}
                                target="_blank"
                                loading={isCheckingThemeExtension}
                              >
                                Add to theme
                              </s-button>
                            )}
                          </div>
                        );
                      })}
                    </s-stack>
                  </>
                ) : (
                  <>
                    {isThemeBlockAdded
                      ? "You have successfully enabled the theme extension!"
                      : "Add the feed to your theme to display it on your store."}
                    {!isThemeBlockAdded && (
                      <s-button
                        variant="primary"
                        href={themeEditorUrl({ shop, apiKey })}
                        target="_blank"
                        loading={isCheckingThemeExtension}
                      >
                        Add to theme
                      </s-button>
                    )}
                  </>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </s-stack>
      </s-section>
    </s-page>
  );
}
