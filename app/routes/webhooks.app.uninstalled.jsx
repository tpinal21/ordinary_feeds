import { updateItem } from "@directus/sdk";
import directus from "../directus.server";
import { authenticate, sessionStorage } from "../shopify.server";
import { SHOPS } from "app/lib/constants";

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

  // Remove the session rows (unlinked above) and evict them from the cache.
  // Look up by shop: on webhook retries `session` may already be undefined.
  const sessions = await sessionStorage.findSessionsByShop(shop);
  const ids = sessions.map((s) => s.id);
  if (session?.id && !ids.includes(session.id)) ids.push(session.id);
  await sessionStorage.deleteSessions(ids);

  return new Response();
};
