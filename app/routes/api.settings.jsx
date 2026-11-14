import { appSettings } from "app/lib/app-settings";
import { getAppSettings, saveAppSettings } from "app/lib/app-settings.server";
import { badRequest, readJsonBody } from "app/lib/http.server";
import { authenticate } from "../shopify.server";

// The shop's settings, normalized. Lets any screen (e.g. the feed previews'
// post-click behaviour) read them without its own loader.
export async function loader({ request }) {
  const { admin } = await authenticate.admin(request);

  try {
    return { success: true, data: await getAppSettings(admin) };
  } catch (err) {
    console.error("[settings] read failed", err);
    return Response.json(
      { success: false, error: String(err?.message ?? err) },
      { status: 500 },
    );
  }
}

export async function action({ request }) {
  const { admin } = await authenticate.admin(request);

  const payload = await readJsonBody(request);

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
