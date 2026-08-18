import AppSetup from "app/components/app-setup";
import { authenticate } from "app/shopify.server";
import { parseAsString, useQueryStates } from "nuqs";
import { useEffect } from "react";
import { useLoaderData, useNavigate, useRouteLoaderData } from "react-router";

export async function loader({ request }) {
  const { session, admin } = await authenticate.admin(request);

  return {
    shop: session.shop,
    apiKey: process.env.SHOPIFY_API_KEY,
  };
}

export default function Index() {
  const [searchParams, setSearchParams] = useQueryStates({
    ig_connected: parseAsString.withDefault(""),
    step: parseAsString.withDefault(""),
  });
  const navigate = useNavigate();

  const { shop, apiKey } = useLoaderData();
  const { shopDetails } = useRouteLoaderData("root");

  const themeExtensionEnabled = shopDetails?.theme_extension_enabled;
  const instagramAccount = shopDetails?.instagram_account.find(
    (acc) => acc.status == "CONNECTED",
  );

  useEffect(() => {
    if (searchParams.ig_connected == "1") {
      shopify.toast.show("Instagram connected successfully!");
      setTimeout(() => navigate("/"), 1000);
    }
  }, [searchParams.ig_connected]);

  <AppSetup
    shop={shop}
    apiKey={apiKey}
    instagramAccount={instagramAccount}
    themeExtensionEnabled={themeExtensionEnabled}
    onSetupComplete={() => {
      setTimeout(() => navigate("/"), 1000);
    }}
  />;
}
