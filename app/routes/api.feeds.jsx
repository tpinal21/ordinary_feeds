import { updateItem } from "@directus/sdk";
import directus from "app/directus.server";
import { SHOPS } from "app/lib/constants";
import { getShopFeeds } from "app/lib/shops.server";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  try {
    return { success: true, data: await getShopFeeds(shopDomain) };
  } catch (err) {
    console.error("[feeds] get failed", err);
    return Response.json(
      { success: false, error: String(err?.message ?? err) },
      { status: 500 },
    );
  }
}

export async function action({ request }) {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  let feeds;
  try {
    feeds = await request.json();
  } catch {
    return Response.json(
      { success: false, error: "invalid_json" },
      { status: 400 },
    );
  }

  try {
    await directus.request(updateItem(SHOPS, shopDomain, { feeds: feeds }));

    return { success: true };
  } catch (err) {
    console.error("[feeds] save failed", err);
    return Response.json(
      { success: false, error: String(err?.message ?? err) },
      { status: 500 },
    );
  }
}
