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
// Mirrors web/player/sw.js conventions.

const CACHE_VERSION = 'raku-capture-v4';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;

const SHELL_URLS = [
  './',
  './index.html',
  './help.html',
  './capture_app.js',
  './scale_calibration.js',
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
          .filter((n) => n.startsWith('raku-capture-') && n !== SHELL_CACHE)
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

  // Never intercept cross-origin (Spark/three CDN, cdn.raku.games splats,
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
  const fetchPromise = fetch(request)
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
