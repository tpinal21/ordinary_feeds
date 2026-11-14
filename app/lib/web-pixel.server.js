// Activates the app's web pixel (extensions/insta-pixel) for a shop, with
// the settings it needs to send feed metrics back to the app. Safe to call
// on every admin load: it only writes when the pixel is missing or its
// settings changed, and remembers shops it already handled in this process.

const READ_PIXEL = `#graphql
  query AppWebPixel {
    webPixel { id settings }
  }`;

const CREATE_PIXEL = `#graphql
  mutation CreateWebPixel($settings: JSON!) {
    webPixelCreate(webPixel: { settings: $settings }) {
      webPixel { id }
      userErrors { code field message }
    }
  }`;

const UPDATE_PIXEL = `#graphql
  mutation UpdateWebPixel($id: ID!, $settings: JSON!) {
    webPixelUpdate(id: $id, webPixel: { settings: $settings }) {
      webPixel { id }
      userErrors { code field message }
    }
  }`;

const ensured = new Set();

const pixelSettings = (shop) => ({
  shop,
  collectUrl: `${(process.env.SHOPIFY_APP_URL || "").replace(/\/$/, "")}/api/metrics/collect`,
});

// Settings come back as a JSON string or an object depending on the API.
const parseSettings = (value) => {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

// The app's pixel, or null when it hasn't been created (Shopify answers
// that with an error rather than null).
async function readPixel(admin) {
  try {
    const res = await admin.graphql(READ_PIXEL);
    const { data } = await res.json();
    return data?.webPixel ?? null;
  } catch {
    return null;
  }
}

export async function ensureWebPixel(admin, shop) {
  if (ensured.has(shop)) return;

  const settings = pixelSettings(shop);
  const pixel = await readPixel(admin);
  const current = parseSettings(pixel?.settings);

  if (
    current?.shop === settings.shop &&
    current?.collectUrl === settings.collectUrl
  ) {
    ensured.add(shop);
    return;
  }

  const res = pixel
    ? await admin.graphql(UPDATE_PIXEL, {
        variables: { id: pixel.id, settings: JSON.stringify(settings) },
      })
    : await admin.graphql(CREATE_PIXEL, {
        variables: { settings: JSON.stringify(settings) },
      });
  const { data } = await res.json();
  const result = data?.webPixelUpdate ?? data?.webPixelCreate;
  const errors = result?.userErrors ?? [];
  if (errors.length) {
    throw new Error(
      `Web pixel ${pixel ? "update" : "create"} failed: ${errors
        .map((e) => `${e.code ?? ""} ${e.message}`.trim())
        .join("; ")}`,
    );
  }

  ensured.add(shop);
}
