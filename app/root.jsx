import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { getShopDetails, toFeed } from "app/lib/shops.server";
import { authenticate } from "app/shopify.server";
import { NuqsAdapter } from "nuqs/adapters/react-router/v7";
import {
  Links,
  Meta,
  Outlet,
  redirect,
  replace,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useLocation,
  useNavigation,
  useRouteError,
} from "react-router";
import "./app.css";
import { useAppBridge } from "@shopify/app-bridge-react";
import { useEffect, useRef } from "react";

const LIBRARY_AUTH_PATHS = ["/auth/session-token", "/auth/exit-iframe"];

const STICKY_EMBEDDED_PARAMS = ["shop", "host", "embedded"];

export async function loader({ request }) {
  const url = new URL(request.url);
  const { session } = await authenticate.admin(request);

  const shopDomain = session.shop;

  const shopDetails = await getShopDetails(shopDomain);
  const instagramAccount = shopDetails?.instagram_account;

  // if (!instagramAccount) {
  //   return redirect(`/setup?${url.searchParams.toString()}`);
  // }

  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
    shopDetails: {
      ...shopDetails,
      feeds: shopDetails?.feeds?.map(toFeed),
    },
    shopDomain,
    isLibraryAuthRoute: LIBRARY_AUTH_PATHS.includes(url.pathname),
  };
}

export default function App() {
  const { apiKey, shopDomain, isLibraryAuthRoute } = useLoaderData();

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link
          rel="stylesheet"
          href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
          preload="true"
        />
        <Meta />
        <Links />
      </head>
      <body className="font-inter">
        <NuqsAdapter>
          {isLibraryAuthRoute ? (
            <Outlet />
          ) : (
            <AppProvider embedded apiKey={apiKey}>
              <StickyEmbeddedParams shop={shopDomain} />
              <s-app-nav>
                <s-link href="/media-gallery">Media Gallery</s-link>
                <s-link href="/manage-posts">Manage Posts</s-link>
              </s-app-nav>
              <LoadingProgressBarProvider />
              <Outlet />
            </AppProvider>
          )}
        </NuqsAdapter>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

const LoadingProgressBarProvider = () => {
  const navigation = useNavigation();
  const shopify = useAppBridge();

  useEffect(() => {
    shopify?.loading?.(navigation.state !== "idle");
  }, [navigation.state, shopify]);

  return <></>;
};

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};

const StickyEmbeddedParams = ({ shop }) => {
  const location = useLocation();
  const stickyRef = useRef({});

  useEffect(() => {
    const url = new URL(window.location.href);

    // Seed from whatever the URL still carries — the initial embedded load has all of
    // them — so later param-less navigations can be topped back up.
    for (const key of STICKY_EMBEDDED_PARAMS) {
      const value = url.searchParams.get(key);
      if (value) stickyRef.current[key] = value;
    }

    // `shop` is authoritative from the server session; `embedded` is only ever
    // re-applied if it was there to begin with, since forcing it would make
    // `ensureAppIsEmbeddedIfRequired` skip its redirect on a genuine non-embedded load.
    if (shop) stickyRef.current.shop = shop;

    let changed = false;
    for (const [key, value] of Object.entries(stickyRef.current)) {
      if (url.searchParams.get(key) !== value) {
        url.searchParams.set(key, value);
        changed = true;
      }
    }

    if (changed) {
      // replaceState rather than a Remix navigation: this must not run loaders or add a
      // history entry. Remix's own history state is passed through untouched, and since
      // Remix's `location` is left unchanged the app's `useSearchParams`/nuqs consumers
      // never see these params — the effect just re-runs and re-appends if they rewrite
      // the query string.
      window.history.replaceState(window.history.state, "", url.toString());
    }
  }, [location.key, location.pathname, location.search, shop]);

  return null;
};
