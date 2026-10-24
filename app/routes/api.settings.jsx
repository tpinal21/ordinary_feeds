import { appSettings } from "app/lib/app-settings";
import { saveAppSettings } from "app/lib/app-settings.server";
import { authenticate } from "../shopify.server";

const badRequest = (error) =>
  Response.json({ success: false, error }, { status: 400 });

export async function action({ request }) {
  const { admin } = await authenticate.admin(request);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return badRequest("invalid_json");
  }

  // Check after normalizing: unknown types are dropped, so a list of only
  // unknown ones ends up just as empty as an unticked one.
  const settings = appSettings(payload);
  if (settings.content.post_types.length === 0) {
    return badRequest("Choose at least one type of post to show");
  }

  try {
    return { success: true, data: await saveAppSettings(admin, settings) };
  } catch (err) {
    console.error("[settings] save failed", err);
    return Response.json(
      { success: false, error: String(err?.message ?? err) },
      { status: 500 },
    );
  }
}
