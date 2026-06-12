// sw.js — Service Worker for Raku Capture PWA
// Copyright (c) 2026 RakuAI, LLC. All rights reserved.
//
// PROTOTYPE SCAFFOLD (raku-runtime/web/capture/).
//
// A minimal service worker that pre-caches the app shell so Raku Capture
// qualifies as an installable PWA. This is what lets the tool run as a phone
// home-screen app AND be served from the Meta Ray-Ban Display web-apps URL
// path (the glasses launch web apps that must be installable / offline-capable
// shells). Android XR (later) follows the same web-app entry path.
//
// Strategy: stale-while-revalidate for the shell. Splat assets fetched from
// cdn.raku.games are intentionally NOT cached here (they are large and handled
// by the viewer/HTTP cache); reconstruction API calls are never cached.
//
// EXCEPTION — booth demo mode (?demo=, AWE USA 2026): the pre-baked sample
// splats listed in samples/manifest.json and the pinned Spark/three viewer
// modules get a dedicated cache-first lane (DEMO_CACHE below) so a booth
// device that loaded the demo once while online can replay it fully offline.
// Only the enumerated URLs/prefixes are eligible; API calls are never cached.
//
// Mirrors web/player/sw.js conventions.

const CACHE_VERSION = 'raku-capture-v7';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;

// ---------------------------------------------------------------------------
// Booth demo cache (offline replay of the pre-baked sample splats)
// ---------------------------------------------------------------------------
// Cache-first with a hard entry cap. Versioned independently of the shell
// cache so a shell bump does not evict ~40 MB of warmed splats; old demo
// cache versions are cleaned in activate.
const DEMO_CACHE = 'raku-demo-splats-v1';

// FIFO entry cap. 3 sample splats (~42 MB total) + 2 viewer modules (~6 MB)
// fit comfortably; the cap bounds growth if the manifest grows.
const DEMO_CACHE_MAX_ENTRIES = 8;

// The pinned viewer modules needed to render offline. Keep in sync with
// THREE_CDN_URL / SPARK_CDN_URL in capture_app.js + the index.html importmap.
const DEMO_CDN_MODULE_URLS = [
  'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js',
  'https://cdn.jsdelivr.net/npm/@sparkjsdev/spark@0.1.10/dist/spark.module.js',
];

// Allowlisted sample-splat URL prefixes — the verified hosts/paths of every
// entry in samples/manifest.json (re-verified 2026-06-07). Keep in sync when
// the manifest changes hosts (e.g. the planned cdn.raku.games migration).
const DEMO_SPLAT_URL_PREFIXES = [
  'https://sparkjs.dev/assets/splats/',
  'https://storage.googleapis.com/forge-dev-public/',
];

function isDemoAsset(url) {
  if (DEMO_CDN_MODULE_URLS.indexOf(url.href) !== -1) return true;
  return DEMO_SPLAT_URL_PREFIXES.some((p) => url.href.startsWith(p));
}

async function demoCacheFirst(request) {
  // Cache Storage can be disabled or throw (Safari/Firefox private browsing,
  // strict policies). A cache failure must degrade to plain network, never
  // kill the fetch handler while the device is online.
  let cache = null;
  try {
    cache = await caches.open(DEMO_CACHE);
    // Match by URL string (not the Request) so a Range-carrying availability
    // probe still hits the cached full response. Serving a complete 200 to a
    // ranged request is spec-permitted (a server MAY ignore Range).
    const cached = await cache.match(request.url);
    if (cached) return cached;
  } catch (err) {
    console.warn('[RakuCapture SW] demo cache unavailable, network only:', err);
  }

  let response;
  try {
    response = await fetch(request);
  } catch (err) {
    // Offline and not cached -> explicit failure, never a fake success. The
    // app maps this to a localized "open it once while online" message.
    return new Response('Demo asset offline and not cached', {
      status: 503,
      statusText: 'Service Unavailable',
    });
  }
  // Cache only complete, successful, readable responses. 206 partials (the
  // app's ranged probe) and opaque/error responses pass through uncached.
  if (cache && response && response.status === 200) {
    try {
      await cache.put(request.url, response.clone());
      await trimDemoCache(cache);
    } catch (err) {
      // Quota/clone failure must not break the render itself.
      console.warn('[RakuCapture SW] demo cache put failed:', err);
    }
  }
  return response;
}

// FIFO-ish cap: the Cache API has no eviction policy, so drop the oldest
// entries (cache.keys() preserves insertion order) beyond the cap.
async function trimDemoCache(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - DEMO_CACHE_MAX_ENTRIES; i++) {
    await cache.delete(keys[i]);
  }
}

const SHELL_URLS = [
  './',
  './index.html',
  './help.html',
  './capture_app.js',
  './scale_calibration.js',
  './sensor_metadata.js',
  './capture_history.js',
  './captures_view.js',
  './i18n.js',
  './locales/en.json',
  './locales/ja.json',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './samples/manifest.json',
];

// Basenames of SHELL_URLS, derived once so the fetch matcher never drifts
// out of sync with the precache list. The filter drops './' (basename '').
const SHELL_NAMES = SHELL_URLS.map((u) => u.split('/').pop()).filter((n) => n !== '');

// ---------------------------------------------------------------------------
// Install — pre-cache the app shell
// ---------------------------------------------------------------------------
self.addEventListener('install', (event) => {
  console.log('[RakuCapture SW] Installing');
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      cache.addAll(SHELL_URLS).catch((err) => {
        console.warn('[RakuCapture SW] Some shell URLs failed to cache:', err);
      })
    )
  );
  self.skipWaiting();
});

// ---------------------------------------------------------------------------
// Activate — clean up old caches
// ---------------------------------------------------------------------------
self.addEventListener('activate', (event) => {
  console.log('[RakuCapture SW] Activating');
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter(
            (n) =>
              (n.startsWith('raku-capture-') && n !== SHELL_CACHE) ||
              (n.startsWith('raku-demo-splats-') && n !== DEMO_CACHE)
          )
          .map((n) => caches.delete(n))
      )
    )
  );
  self.clients.claim();
});

// ---------------------------------------------------------------------------
// Fetch — shell: stale-while-revalidate; everything else: passthrough
// ---------------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== 'GET') return;

  // Booth demo assets (sample splats + pinned viewer modules): cache-first so
  // the ?demo= flow replays offline after one online view. Checked before the
  // cross-origin passthrough below because these are all cross-origin URLs;
  // only the enumerated allowlist above is eligible.
  if (isDemoAsset(url)) {
    event.respondWith(demoCacheFirst(event.request));
    return;
  }

  // Never intercept other cross-origin requests (cdn.raku.games splats,
  // reconstruction API). Let the network/HTTP cache handle those.
  if (url.origin !== self.location.origin) return;

  // Only handle our shell resources; let other same-origin requests pass.
  // SHELL_NAMES is derived from SHELL_URLS above — matching SHELL_URLS
  // directly fails because './' -> '' and endsWith('') is always true.
  // isRoot must match ONLY the app root ('/capture-app/'), not every
  // sub-directory (e.g. '/capture-app/locales/'): a bare endsWith('/')
  // test would wrongly treat those as the shell and shell-cache them.
  const rootPath = new URL('./', self.registration.scope).pathname;
  const isRoot = url.pathname === rootPath;
  const isShell =
    isRoot ||
    SHELL_NAMES.some(
      (n) => url.pathname.endsWith('/' + n) || url.pathname.endsWith(n)
    );
  if (!isShell) return;

  event.respondWith(staleWhileRevalidate(event.request, SHELL_CACHE));
});

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  // Revalidate with a *clean* Request built from just the URL. WebKit's SW
  // fetch implementation can trigger spurious "access control checks" errors
  // when the original request carries cache-mode directives (e.g.
  // { cache: 'no-cache' } from i18n.js / capture_app.js). A plain Request
  // avoids carrying those directives into the SW-internal fetch while still
  // hitting the network for a fresh copy.
  const revalidateReq = new Request(request.url);
  const fetchPromise = fetch(revalidateReq)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  return (
    cached ||
    (await fetchPromise) ||
    new Response('Offline', { status: 503, statusText: 'Service Unavailable' })
  );
}
