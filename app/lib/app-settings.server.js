import { appSettings } from "app/lib/app-settings";

const READ_QUERY = `#graphql
  query AppSettings {
    shop {
      id
      metafield(namespace: "$app", key: "settings") {
        jsonValue
      }
    }
  }`;

const WRITE_MUTATION = `#graphql
  mutation SaveAppSettings($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      userErrors {
        field
        message
      }
    }
  }`;

async function readMetafield(admin) {
  const res = await admin.graphql(READ_QUERY);
  const shop = (await res.json()).data?.shop;

  return { shopId: shop?.id, stored: shop?.metafield?.jsonValue ?? {} };
}

export async function getAppSettings(admin) {
  const { stored } = await readMetafield(admin);
  return appSettings(stored);
}

export async function saveAppSettings(admin, values) {
  const { shopId, stored } = await readMetafield(admin);
  const settings = appSettings(values);

  const res = await admin.graphql(WRITE_MUTATION, {
    variables: {
      metafields: [
        {
          ownerId: shopId,
          namespace: "$app",
          key: "settings",
          type: "json",
          // Other keys (e.g. the storefront's `carousel_setting`) share this
          // metafield, so merge over what's there instead of replacing it.
          value: JSON.stringify({ ...stored, ...settings }),
        },
      ],
    },
  });

  const userErrors = (await res.json()).data?.metafieldsSet?.userErrors ?? [];
  if (userErrors.length) {
    throw new Error(userErrors.map((e) => e.message).join(", "));
  }

  return settings;
}
