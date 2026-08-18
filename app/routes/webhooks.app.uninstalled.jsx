import { updateItem } from "@directus/sdk";
import directus from "../directus.server";
import { authenticate } from "../shopify.server";
import { SHOPS, IG_ACCOUNTS } from "app/lib/constants";

export const action = async ({ request }) => {
  const { shop, session, ...topic } = await authenticate.webhook(request);

  try {
    await directus.request(
      updateItem(SHOPS, shop, {
        status: "UNINSTALLED",
        uninstalled_at: new Date().toISOString(),
        session: null,
      }),
    );
  } catch (err) {
    console.error("[directus] failed to mark shop uninstalled", err);
  }

  return new Response();
};
