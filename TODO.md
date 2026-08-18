# Known Issues & TODOs

Running list of known limitations, deferred work, and things to revisit.
Add new items at the top of the relevant section. Date entries when added.

---

## Instagram API

### [ ] Rehost Instagram media to Shopify Files — added 2026-04-29
**Issue:** Instagram CDN URLs expire within ~24h (see related item below). Rehosting
media into Shopify Files gives us persistent `cdn.shopify.com` URLs, faster storefront
rendering (same CDN as theme assets), and decouples render-time from IG availability /
rate limits.

**Approach:**
- On sync, call Admin GraphQL `fileCreate` with `originalSource: <ig_media_url>`
  (Shopify pulls the asset; no proxy through our server).
- Persist the IG `media_id` → Shopify `file_id` + permanent `cdn.shopify.com` URL
  mapping in Directus (new column on `instagram_media` or a join table) so we
  dedupe across re-syncs.
- `fileCreate` is async — file lands in `READY/UPLOADED` after Shopify finishes
  pulling. Either poll `node(id:)` for status, or subscribe to the `files/create`
  webhook before treating the file as renderable. Until ready, fall back to the
  IG URL.
- On post deletion in IG (or disconnect), call `fileDelete` to clean up; otherwise
  storage grows unbounded.

**Scope first pass:** images only. Videos are large and storage-expensive — keep
those as direct IG URLs unless merchants ask for video rehosting.

**Tradeoffs:**
- Counts against shop's Files storage (plan-dependent).
- Adds sync complexity (upload + status + dedupe + cleanup).
- One-time backfill needed for shops already connected.

**Supersedes:** the "Instagram media URLs expire after ~24h" item below — rehosting
is option (4) from that item, chosen over short cache TTLs once we hit scale.

**Files:** `app/lib/instagram.server.js` (sync path + new `uploadToShopifyFiles`
helper), `app/routes/api.instagram.sync.jsx`, possibly a new
`app/routes/webhooks.files.create.jsx`.

---

### [ ] Rate limit handling in `fetchAllMedia` — added 2026-04-26
**Issue:** Instagram Graph API limits us to ~200 calls/hour per IG user. `fetchAllMedia`
currently does not read the `X-App-Usage` / `X-Business-Use-Case-Usage` response headers,
and does not back off on HTTP 429.

**Current cost:** ~2 calls per merchant per cron run (50/page × 2 pages, 100-post cap).
At 30-min cadence we have plenty of headroom.

**When to fix:** before scaling beyond ~50 merchants, or sooner if we drop the cron
cadence below 15 min.

**What to do:**
- Inspect `X-App-Usage` after each call; warn if `call_count > 80%`.
- On 429, parse retry-after and either skip that account for this tick (writing to
  `last_sync_error`) or sleep + retry once.

**Files:** `app/lib/instagram.server.js` → `fetchAllMedia`

---

### [ ] Instagram media URLs expire after ~24h — added 2026-04-26
**Issue:** `media_url` and `thumbnail_url` returned by `/me/media` are CDN URLs that
Instagram expires within ~24 hours. If we (or a downstream cache like a CDN) hold
storefront HTML/JSON longer than that, `<img>` tags 404.

**Impact:** Phase D storefront feed will silently break for shops whose sync
last ran > 24h ago, or whose CDN holds the JSON > 24h.

**Options:**
1. Always re-fetch `/me/media` on every storefront `/api/feed` request (simplest, but
   defeats the point of caching in Directus + adds API calls).
2. Re-sync more often than 24h (current cron is 30 min — fine, but storefront cache
   needs `max-age < 24h - sync_interval`).
3. Proxy the image through our own server and stream from Instagram on the fly
   (kills CDN caching benefits).
4. Download images to our own storage (Directus Files, S3, etc.) on sync; serve from
   there. Most resilient, but adds storage cost + need to clean up on prune.

**Recommendation:** start with (2) — set storefront cache `max-age` to ~30 min,
matching cron. If we see merchants paginating through deep history, revisit (4).

**Files:** TBD in Phase D — `app/routes/api.feed.jsx`, theme extension Liquid + JS.

---

## Auth / Sessions

(none yet)

---

## Directus

### [ ] Session lookup is a network hop on every authenticated request — added 2026-04-26
**Issue:** `DirectusSessionStorage.loadSession` hits Directus over HTTP for every
embedded admin request. Fine in dev; added latency in prod.

**When to fix:** before going live with real merchant traffic.

**What to do:** wrap `loadSession` with a small in-memory LRU (TTL ~60s — sessions
don't change mid-request).

**Files:** `app/lib/session-storage.server.js`

---

### [ ] `access_token` on `instagram_accounts` is plaintext — added 2026-04-26
**Issue:** Long-lived IG tokens are stored unencrypted in Directus. If the database
is ever exfiltrated, attackers can act on behalf of every connected merchant.

**When to fix:** before public launch.

**What to do:** encrypt at rest with `TOKEN_ENCRYPTION_KEY` env var; encrypt before
write in `upsertAccount` and decrypt on read in `syncPostsForAccount` /
`disconnectAccount`. Use `crypto.createCipheriv('aes-256-gcm', ...)` so we get
authenticated encryption.

**Files:** `app/lib/instagram.server.js`

---

## Frontend

### [x] App URL exposure on storefront — resolved 2026-04-26
Switched the storefront feed away from a client-side fetch entirely. After every
sync the app writes the latest 24 posts as JSON to a shop-level metafield
(`shop.metafields.$app:insta_feed_posts`). The Liquid block reads the metafield
server-side and renders slides directly — no fetch, no exposed URLs, no CORS,
no signature verification needed. Disconnect clears the metafield.

Files: `app/lib/instagram.server.js` (writeFeedMetafield/clearFeedMetafield),
`extensions/feed-section/blocks/carousel.liquid`, `shopify.app.toml` (metafield
definition). Old public route `app/routes/api.feed.jsx` deleted.

---

---

## Deployment / Ops

(none yet)
