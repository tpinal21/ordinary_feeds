import {
  createItem,
  deleteItem,
  deleteItems,
  readItem,
  readItems,
  updateItem,
} from "@directus/sdk";
import { Session } from "@shopify/shopify-api";
import { SHOPS } from "app/lib/constants";
import { apiVersion } from "app/shopify.server";
import directus from "../directus.server";

const SESSIONS = "sessions";

const SESSION_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const sessionCache = new Map();

function getCachedSession(id) {
  const entry = sessionCache.get(id);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    sessionCache.delete(id);
    return undefined;
  }
  return entry.session;
}

function setCachedSession(id, session) {
  sessionCache.set(id, {
    session,
    expiresAt: Date.now() + SESSION_CACHE_TTL_MS,
  });
}

function invalidateCachedSession(id) {
  sessionCache.delete(id);
}

// storeSession saves to Directus in the background; readers of the shop row
// await this so a fresh install doesn't read the row before it exists.
const pendingShopWrites = new Map();

export function waitForShopWrite(shopDomain) {
  return pendingShopWrites.get(shopDomain) ?? Promise.resolve();
}

function logDirectusError(label, err) {
  const errors = err?.errors;
  if (Array.isArray(errors) && errors.length) {
    console.error(`[directus] ${label}:`, JSON.stringify(errors, null, 2));
  } else {
    console.error(`[directus] ${label}:`, err);
  }
}

function sessionToRow(session) {
  const obj = session.toObject();
  return {
    id: obj.id,
    shop: obj.shop,
    expires: obj.expires ? new Date(obj.expires).toISOString() : null,
    data: obj,
  };
}

function rowToSession(row) {
  if (!row?.data) return undefined;
  const data = { ...row.data };
  if (data.expires) data.expires = new Date(data.expires);
  return new Session(data);
}

export class DirectusSessionStorage {
  storeSession(_session) {
    const now = new Date().toISOString();
    const session = sessionToRow(_session);
    const shopDomain = session.shop;

    // Cache first so the request can continue without waiting on Directus.
    setCachedSession(session.id, _session);

    // DEBUG: external call disabled to measure load time
    // // Start from a resolved Promise so synchronous throws (e.g. from updateItem) land in .catch.
    // const write = Promise.resolve()
    //   .then(() =>
    //     directus.request(
    //       updateItem(SHOPS, shopDomain, {
    //         status: "INSTALLED",
    //         last_seen_at: now,
    //         uninstalled_at: null,
    //         session: {
    //           id: session.id,
    //           expires: session.expires,
    //           data: session.data,
    //         },
    //       }),
    //     ),
    //   )
    //   .catch(() =>
    //     fetch(`https://${_session.shop}/admin/api/${apiVersion}/graphql.json`, {
    //       method: "POST",
    //       headers: {
    //         "Content-Type": "application/json",
    //         "X-Shopify-Access-Token": _session.accessToken,
    //       },
    //       body: JSON.stringify({ query: `query { shop { id } }` }),
    //     })
    //       .then((res) => res.json())
    //       .then((json) => {
    //         const shopGid = json?.data?.shop?.id ?? null;
    //
    //         return directus.request(
    //           createItem(SHOPS, {
    //             gid: shopGid,
    //             shop_domain: shopDomain,
    //             shop_handle: shopDomain.replace(".myshopify.com", ""),
    //             session: {
    //               id: session.id,
    //               expires: session.expires,
    //               data: session.data,
    //             },
    //             installed_at: now,
    //             last_seen_at: now,
    //             feeds: [
    //               {
    //                 page: "HOME_PAGE",
    //                 label: "CAROUSEL_HP_01",
    //                 type: "CAROUSEL",
    //                 settings: {
    //                   media_auto_play: true,
    //                   loop: false,
    //                   slides_per_view: 7,
    //                   speed: 0.7,
    //                   auto_scroll: false,
    //                 },
    //                 gallery: {
    //                   title: "Latest posts",
    //                   type: "AUTO",
    //                   shop: shopDomain,
    //                 },
    //               },
    //             ],
    //           }),
    //         );
    //       })
    //       .then(() => undefined)
    //       .catch((error) => {
    //         console.log(error, "---------in error");
    //       }),
    //   )
    //   .catch((err) =>
    //     logDirectusError(`storeSession(${session.id}) failed`, err),
    //   )
    //   .finally(() => {
    //     if (pendingShopWrites.get(shopDomain) === write) {
    //       pendingShopWrites.delete(shopDomain);
    //     }
    //   });
    //
    // pendingShopWrites.set(shopDomain, write);
    return Promise.resolve(true);
  }

  loadSession(id) {
    console.log(
      "---------------------------------------- loadSession called",
      id,
    );

    const cached = getCachedSession(id);
    if (cached) return Promise.resolve(cached);

    // DEBUG: external call disabled to measure load time
    // return Promise.resolve()
    //   .then(() => directus.request(readItem(SESSIONS, id)))
    //   .then((row) => {
    //     const session = rowToSession(row);
    //     if (session) setCachedSession(id, session);
    //     return session;
    //   })
    //   .catch((err) => {
    //     const code = err?.errors?.[0]?.extensions?.code;
    //
    //     if (code === "FORBIDDEN" || code === "RECORD_NOT_UNIQUE") {
    //       return undefined;
    //     }
    //     logDirectusError(`loadSession(${id}) failed`, err);
    //     return undefined;
    //   });
    return Promise.resolve(undefined);
  }

  async deleteSession(id) {
    invalidateCachedSession(id);
    try {
      await directus.request(deleteItem(SESSIONS, id));
      return true;
    } catch (err) {
      const code = err?.errors?.[0]?.extensions?.code;
      if (code === "FORBIDDEN" || code === "RECORD_NOT_UNIQUE") return true;
      logDirectusError(`deleteSession(${id}) failed`, err);
      return false;
    }
  }

  async deleteSessions(ids) {
    if (!ids?.length) return true;
    ids.forEach(invalidateCachedSession);
    try {
      await directus.request(deleteItems(SESSIONS, ids));
      return true;
    } catch (err) {
      logDirectusError("deleteSessions failed", err);
      return false;
    }
  }

  async findSessionsByShop(shop) {
    try {
      const rows = await directus.request(
        readItems(SESSIONS, {
          filter: { shop: { _eq: shop } },
          limit: -1,
        }),
      );
      return rows.map(rowToSession).filter(Boolean);
    } catch (err) {
      logDirectusError(`findSessionsByShop(${shop}) failed`, err);
      return [];
    }
  }
}
