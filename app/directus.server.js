import { createDirectus, rest, staticToken } from "@directus/sdk";

const url = process.env.DIRECTUS_URL;
const token = process.env.DIRECTUS_ADMIN_TOKEN;

if (!url || !token) {
  throw new Error(
    "DIRECTUS_URL and DIRECTUS_ADMIN_TOKEN must be set in the environment.",
  );
}

const directus = createDirectus(url).with(staticToken(token)).with(rest());

export default directus;
