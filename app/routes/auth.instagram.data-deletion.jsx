import { deleteItems, readItems } from "@directus/sdk";
import directus from "app/directus.server";
import { IG_ACCOUNTS, IG_MEDIA } from "app/lib/constants";
import crypto from "node:crypto";
import {
  getAppUrl,
  instagramUserFilter,
  parseSignedRequest,
} from "app/lib/instagram.server";

// Meta "Data deletion request URL": deletes everything stored for the
// Instagram user, then answers with a confirmation code and a status URL that
// Meta shows the user.
export async function action({ request }) {
  const form = await request.formData();
  const data = parseSignedRequest(form.get("signed_request"));

  if (!data?.user_id) {
    return Response.json({ error: "invalid_signed_request" }, { status: 400 });
  }

  try {
    const accounts = await directus.request(
      readItems(IG_ACCOUNTS, {
        filter: instagramUserFilter(data.user_id),
        fields: ["id", "media"],
        limit: -1,
      }),
    );

    const mediaIds = accounts.flatMap((a) => a.media ?? []);
    if (mediaIds.length) {
      await directus.request(deleteItems(IG_MEDIA, mediaIds));
    }
    if (accounts.length) {
      await directus.request(
        deleteItems(
          IG_ACCOUNTS,
          accounts.map((a) => a.id),
        ),
      );
    }
  } catch (err) {
    console.error("[instagram] data deletion failed", err);
    return Response.json({ error: "deletion_failed" }, { status: 500 });
  }

  const confirmationCode = crypto.randomUUID();
  console.log(
    `[instagram] deleted data for user ${data.user_id}, code ${confirmationCode}`,
  );

  return Response.json({
    url: `${getAppUrl()}/auth/instagram/data-deletion?code=${confirmationCode}`,
    confirmation_code: confirmationCode,
  });
}

// The status page Meta links the user to. Deletion runs synchronously in the
// action, so any request that got a code is already complete.
export async function loader({ request }) {
  const code = new URL(request.url).searchParams.get("code");

  if (!code) {
    return new Response("Missing confirmation code", { status: 400 });
  }

  return new Response(
    `Data deletion request ${code}: your Instagram data has been deleted from this app.`,
    { headers: { "Content-Type": "text/plain; charset=utf-8" } },
  );
}
