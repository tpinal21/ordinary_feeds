import { updateItem } from "@directus/sdk";
import directus from "app/directus.server";
import { redirect } from "react-router";
import {
  exchangeCodeForLongLivedToken,
  fetchProfileFromInstagram,
  verifyState,
} from "../lib/instagram.server";
import { SHOPS, IG_ACCOUNTS } from "app/lib/constants";

function buildEmbeddedRedirect(shop, params) {
  const handle = process.env.SHOPIFY_APP_HANDLE;
  const qs = new URLSearchParams(params);
  return `https://admin.shopify.com/store/${shop}/apps/${handle}?${qs.toString()}`;
}

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return new Response(`Instagram authorization failed: ${error}`, {
      status: 400,
    });
  }

  const verified = verifyState(state);
  if (!verified?.shop) {
    return new Response("Invalid or expired state", { status: 400 });
  }
  if (!code) {
    return new Response("Missing authorization code", { status: 400 });
  }

  const shopDomain = verified.shop;
  const shopHandle = shopDomain.replace(".myshopify.com", "");

  try {
    const { accessToken, expiresInSeconds } =
      await exchangeCodeForLongLivedToken(code);

    const account = await fetchProfileFromInstagram(accessToken);

    const now = new Date();

    const res = await directus.request(
      updateItem(SHOPS, shopDomain, {
        instagram_account: [
          {
            ...account,
            id: `${account.id}-${shopHandle}`,
            is_syncing: true, // sync media from instagram instantly after connection
            status: "CONNECTED",
            connected_at: now.toISOString(),
            access_token: accessToken,
            token_expires_at: new Date(
              now.getTime() + expiresInSeconds * 1000,
            ).toISOString(),
          },
        ],
      }),
    );

    throw redirect(buildEmbeddedRedirect(shopHandle, { ig_connected: "1" }));
  } catch (err) {
    if (err instanceof Response) throw err;
    console.error("[instagram] callback failed", err);
    throw redirect(
      buildEmbeddedRedirect(shopHandle, {
        ig_connected: "0",
        error: "exchange_failed",
      }),
    );
  }
};
