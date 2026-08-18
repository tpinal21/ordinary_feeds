import crypto from "node:crypto";

const STATE_TTL_MS = 10 * 60 * 1000;
const LONG_LIVED_TTL_MS = 60 * 24 * 60 * 60 * 1000;

const SCOPES = [
  "instagram_business_basic",
  // "instagram_business_manage_messages",
  // "instagram_business_manage_comments",
  // "instagram_business_content_publish",
  // "instagram_business_manage_insights",
];

function getRedirectUri() {
  const base = process.env.SHOPIFY_APP_URL_DEV || process.env.SHOPIFY_APP_URL;
  if (!base) throw new Error("SHOPIFY_APP_URL must be set");
  return `${base.replace(/\/$/, "")}/auth/instagram/callback`;
}

function getSecret() {
  const secret = process.env.SHOPIFY_API_SECRET;
  if (!secret) throw new Error("SHOPIFY_API_SECRET must be set");
  return secret;
}

export function signState(payload) {
  const body = { ...payload, exp: Date.now() + STATE_TTL_MS };
  const b64 = Buffer.from(JSON.stringify(body)).toString("base64url");
  const sig = crypto
    .createHmac("sha256", getSecret())
    .update(b64)
    .digest("base64url");
  return `${b64}.${sig}`;
}

export function verifyState(token) {
  if (!token || typeof token !== "string") return null;
  const [b64, sig] = token.split(".");
  if (!b64 || !sig) return null;
  const expected = crypto
    .createHmac("sha256", getSecret())
    .update(b64)
    .digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(b64, "base64url").toString());
    if (!payload?.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function buildAuthUrl(shop) {
  const url = new URL("https://www.instagram.com/oauth/authorize");
  url.search = new URLSearchParams({
    force_reauth: "true",
    client_id: process.env.META_APP_ID,
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: SCOPES.join(","),
    state: signState({ shop, nonce: crypto.randomUUID() }),
  }).toString();
  return url.toString();
}

export async function exchangeCodeForLongLivedToken(code) {
  const formData = new FormData();
  formData.append("client_id", process.env.META_APP_ID);
  formData.append("client_secret", process.env.META_APP_SECRET);
  formData.append("grant_type", "authorization_code");
  formData.append("redirect_uri", getRedirectUri());
  formData.append("code", code);

  const shortRes = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    body: formData,
  });
  const short = await shortRes.json();
  if (!short.access_token) {
    throw new Error(
      `Short-lived token exchange failed: ${JSON.stringify(short)}`,
    );
  }

  const longRes = await fetch(
    `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${process.env.META_APP_SECRET}&access_token=${short.access_token}`,
  );
  const long = await longRes.json();
  if (!long.access_token) {
    throw new Error(
      `Long-lived token exchange failed: ${JSON.stringify(long)}`,
    );
  }

  return {
    accessToken: long.access_token,
    expiresInSeconds: long.expires_in ?? LONG_LIVED_TTL_MS / 1000,
  };
}

export async function fetchProfileFromInstagram(accessToken) {
  const fields = [
    "id",
    "user_id",
    "username",
    "name",
    "account_type",
    "profile_picture_url",
    "followers_count",
    "media_count",
  ];
  const res = await fetch(
    `https://graph.instagram.com/v21.0/me?fields=${fields.join(",")}&access_token=${accessToken}`,
  );
  const data = await res.json();
  if (!data.id) {
    throw new Error(`Profile fetch failed: ${JSON.stringify(data)}`);
  }
  return data;
}
