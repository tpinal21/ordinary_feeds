import { readItems, updateItem } from "@directus/sdk";
import directus from "app/directus.server";
import { IG_ACCOUNTS } from "app/lib/constants";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  try {
    const instagramAccount = await directus.request(
      readItems(IG_ACCOUNTS, {
        filter: {
          _and: [
            { shop: { _eq: shopDomain } },
            { status: { _eq: "CONNECTED" } },
          ],
        },
        fields: ["access_token,shop.shop_handle"],
      }),
    );

    const instagramAccountDetails = instagramAccount.at(0);

    const token = instagramAccountDetails?.access_token;

    const fields = [
      "id",
      "media_type",
      "media_product_type",
      "media_url",
      "thumbnail_url",
      "permalink",
      "caption",
      "timestamp",
    ].join(",");

    const media = await fetch(
      `https://graph.instagram.com/v21.0/me/media?fields=${fields}&limit=100&access_token=${token}`,
    ).then((_) => _.json());

    const timeNow = new Date().toISOString();

    return {
      success: true,
      data: media.data
        ?.filter((m) => m.media_type == "VIDEO")
        .map((m) => ({
          media_id: `${m.id}-${instagramAccountDetails.shop.shop_handle}`,
          // instagram_account: instagramAccountDetails.id,
          media_type: m.media_type,
          media_url: m.media_url ?? null,
          thumbnail_url: m.thumbnail_url ?? null,
          // permalink: m.permalink ?? null,
          caption: m.caption ?? null,
          timestamp: m.timestamp ? new Date(m.timestamp).toISOString() : null,
          last_synced_at: timeNow,
        })),
    };
  } catch (err) {
    console.error("[instagram] posts fetch failed", err);
    return Response.json(
      { success: false, error: String(err?.message ?? err) },
      { status: 500 },
    );
  }
}

export async function action({ request }) {
  await authenticate.admin(request);

  let values;
  try {
    values = await request.json();
  } catch {
    return Response.json(
      { success: false, error: "invalid_json" },
      { status: 400 },
    );
  }

  const media = (Array.isArray(values?.media) ? values.media : []).filter(
    (m) => m?.id,
  );
  const ig_account_id = media[0]?.instagram_account;

  if (!ig_account_id) {
    return Response.json(
      { success: false, error: "missing_instagram_account" },
      { status: 400 },
    );
  }

  try {
    await directus.request(
      updateItem(IG_ACCOUNTS, ig_account_id, {
        reels: media.map((m) => ({
          id: m.id,
          products: m.products,
        })),
      }),
    );

    return { success: true };
  } catch (err) {
    console.error("[instagram] posts save failed", err);
    return Response.json(
      { success: false, error: String(err?.message ?? err) },
      { status: 500 },
    );
  }
}
