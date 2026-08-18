import { readItem, updateItem } from "@directus/sdk";
import directus from "app/directus.server";
import { SHOPS, IG_ACCOUNTS } from "app/lib/constants";
import { authenticate } from "../shopify.server";

export async function action({ request }) {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const now = new Date().toISOString();

  const shopDetails = await directus.request(readItem(SHOPS, shopDomain));

  const connectedInstagramAccount = shopDetails.instagram_account.find(
    (acc) => acc.status == "CONNECTED",
  );

  if (connectedInstagramAccount) {
    await directus.request(
      updateItem(IG_ACCOUNTS, connectedInstagramAccount.id, {
        status: "DISCONNECTED",
        disconnected_at: now,
        shop: null,
        reels: null,
      }),
    );
  }

  // clearFeedMetafield()

  return { success: true, message: "" };
}
