import InstagramButton from "app/components/instagram-button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "app/components/ui/accordion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "app/components/ui/card";
import { useFetch } from "app/hooks/useFetch";
import { apiFetch } from "app/lib/api-client";
import { parseAsString, useQueryState } from "nuqs";
import { useEffect } from "react";

const BLOCK_HANDLE = "carousel";

export default function AppSetup({
  shop,
  apiKey,
  instagramAccount,
  themeExtensionEnabled,
  onSetupComplete,
}) {
  const [step, setStep] = useQueryState(
    "step",
    parseAsString.withDefault("connect-account"),
  );
  const themeEditorUrl = `https://${shop}/admin/themes/current/editor?template=index&addAppBlockId=${apiKey}/${BLOCK_HANDLE}&target=newAppsSection`;

  const {
    data: themeCheck,
    mutate: checkThemeExtension,
    isLoading: isLoadingThemeExtension,
    isValidating: isValidatingThemeExtension,
  } = useFetch(
    instagramAccount ? "check-theme-extension" : null,
    () => apiFetch("/api/check-theme-extension", { method: "POST" }),
    {
      onSuccess: (data) => {
        if (data?.success) onSetupComplete();

        if (!themeExtensionEnabled && data?.success) {
          shopify.toast.show("Theme extension enabled successfully!");
        }
      },
    },
  );
  const isThemeBlockAdded = themeCheck?.success ?? themeExtensionEnabled;
  const isCheckingThemeExtension =
    isLoadingThemeExtension || isValidatingThemeExtension;

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") checkThemeExtension();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [checkThemeExtension]);

  useEffect(() => {
    if (instagramAccount?.username && !isThemeBlockAdded) {
      setStep("enable-extension");
    }
  }, [isThemeBlockAdded]);

  return (
    <div className="max-w-249.5 mx-auto p-4 flex flex-col">
      <h1 className="text-xl font-semibold mb-2">Get started!</h1>
      <p className="text-sm text-neutral-500 mb-4">
        Set up your Instagram feeds in minutes
      </p>
      <Card>
        <CardHeader>
          <CardTitle>Setup Guide</CardTitle>
          <CardDescription>
            Follow these steps to set up your Instagram feeds
          </CardDescription>
        </CardHeader>
        <CardContent>
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

            {/* <SettingsSection /> */}

            <AccordionItem
              value="enable-extension"
              className="data-open:pb-3"
              onOpenChange={() =>
                step != "enable-extension" && setStep("enable-extension")
              }
              disabled={!instagramAccount?.username}
            >
              <AccordionTrigger className="py-3.5 px-3 items-center gap-2 font-semibold justify-start">
                {isThemeBlockAdded ? (
                  <s-icon type="check-circle" tone="success" />
                ) : (
                  <s-icon type="circle-dashed" tone="neutral" />
                )}
                Add feed to your theme{" "}
                {isThemeBlockAdded ? (
                  <s-badge tone="success">Complete</s-badge>
                ) : (
                  <s-badge tone="warning">Incomplete</s-badge>
                )}
              </AccordionTrigger>
              <AccordionContent className="bg-[#f7f7f7] mx-3 p-4 flex gap-4 flex-col rounded-lg">
                {isThemeBlockAdded
                  ? "You have successfully enabled the theme extension!"
                  : "Add the feed to your theme to display it on your store."}
                {!isThemeBlockAdded && (
                  <s-button
                    variant="primary"
                    href={themeEditorUrl}
                    target="_blank"
                    loading={isCheckingThemeExtension}
                  >
                    Add to theme
                  </s-button>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
