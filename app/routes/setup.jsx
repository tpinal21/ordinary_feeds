import AppSetup from "app/components/app-setup";
import { authenticate } from "app/shopify.server";
import { parseAsString, useQueryStates } from "nuqs";
import { useEffect } from "react";
import { useLoaderData, useNavigate, useOutletContext } from "react-router";

export async function loader({ request }) {
  const { session, admin } = await authenticate.admin(request);

  return {
    shop: session.shop,
    apiKey: process.env.SHOPIFY_API_KEY,
  };
}

// Error codes `auth.instagram.callback` redirects back with.
const CONNECT_ERRORS = {
  exchange_failed: "We couldn't finish connecting to Instagram.",
  account_switch_failed:
    "We couldn't clear the previous Instagram account's feeds, galleries and posts, so the new account wasn't connected.",
};

export default function Index() {
  const [searchParams, setSearchParams] = useQueryStates({
    ig_connected: parseAsString.withDefault(""),
    step: parseAsString.withDefault(""),
    error: parseAsString.withDefault(""),
  });
  const navigate = useNavigate();

  const { shop, apiKey } = useLoaderData();
  const { shopDetails } = useOutletContext();

  const themeExtensionEnabled = shopDetails?.theme_extension_enabled;
  const instagramAccount = shopDetails?.instagram_account?.find(
    (acc) => acc.status == "CONNECTED",
  );

  useEffect(() => {
    if (searchParams.ig_connected !== "1") return;

    shopify.toast.show("Instagram connected successfully!");
    const timer = setTimeout(() => {
      setSearchParams({ ig_connected: "", error: "", step: "create-feed" });
    }, 1000);
    return () => clearTimeout(timer);
  }, [searchParams.ig_connected, setSearchParams]);

  const connectFailed = searchParams.ig_connected === "0";
  const connectError =
    CONNECT_ERRORS[searchParams.error] ?? CONNECT_ERRORS.exchange_failed;

  return (
    <AppSetup
      notice={
        connectFailed && (
          <s-banner tone="critical" heading="Instagram account not connected">
            {connectError} Please try connecting again.
          </s-banner>
        )
      }
      shop={shop}
      apiKey={apiKey}
      instagramAccount={instagramAccount}
      themeExtensionEnabled={themeExtensionEnabled}
      onSetupComplete={() => {
        setTimeout(() => navigate("/"), 1000);
      }}
    />
  );
}
