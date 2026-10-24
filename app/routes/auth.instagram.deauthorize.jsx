import { readItems, updateItems } from "@directus/sdk";
import directus from "app/directus.server";
import { IG_ACCOUNTS } from "app/lib/constants";
import {
  instagramUserFilter,
  parseSignedRequest,
} from "app/lib/instagram.server";

// Meta "Deauthorize callback URL": called when a user removes the app from
// their Instagram settings. Their token is dead from here on, so drop it and
// detach the account from every shop it was connected to.
export async function action({ request }) {
  const form = await request.formData();
  const data = parseSignedRequest(form.get("signed_request"));

  if (!data?.user_id) {
    return new Response("Invalid signed_request", { status: 400 });
  }

  try {
    const accounts = await directus.request(
      readItems(IG_ACCOUNTS, {
        filter: instagramUserFilter(data.user_id),
        fields: ["id"],
        limit: -1,
      }),
    );

    if (accounts.length) {
      await directus.request(
        updateItems(
          IG_ACCOUNTS,
          accounts.map((a) => a.id),
          {
            status: "DISCONNECTED",
            disconnected_at: new Date().toISOString(),
            access_token: null,
            shop: null,
            reels: null,
          },
        ),
      );
    }
  } catch (err) {
    console.error("[instagram] deauthorize failed", err);
    return new Response("Deauthorize failed", { status: 500 });
  }

  return new Response();
}
