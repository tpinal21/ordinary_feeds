import { authenticate } from "../shopify.server";
import { buildAuthUrl } from "../lib/instagram.server";

export async function action({ request }) {
  const { session } = await authenticate.admin(request);
  const url = buildAuthUrl(session.shop);
  return { url };
}
