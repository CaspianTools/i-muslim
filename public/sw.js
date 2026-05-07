// i-muslim service worker.
//
// Goals:
//  1. Make the app installable as a PWA (browsers require a registered SW with
//     a fetch handler).
//  2. Serve a simple offline experience for static assets.
//
// Non-goals:
//  - Caching HTML routes / RSC payloads. Next 16 stamps build IDs into RSC
//    responses, so caching them ships stale shells after every deploy.
//  - Pre-caching Quran JSON. The current data path doesn't expose a
//    cache-friendly `/api/quran/*` JSON surface; revisit when one exists.
//
// Bump CACHE_VERSION on any logic change to evict old caches on next install.
const CACHE_VERSION = "v1";
const STATIC_CACHE = `i-muslim-static-${CACHE_VERSION}`;

self.addEventListener("install", (event) => {
  // Activate this SW as soon as it's installed instead of waiting for the
  // next page navigation.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("i-muslim-") && k !== STATIC_CACHE)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Static / fingerprinted assets — cache-first. Next emits these under
  // `/_next/static/...` with hashed filenames, so cached entries are always
  // valid for their lifetime.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // Brand assets and SVGs in /public — cache-first with stale-while-revalidate
  // semantics so they show up offline.
  if (url.pathname.startsWith("/icons/") || url.pathname.endsWith(".svg")) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // Everything else (HTML routes, RSC payloads, API): network-only. We do not
  // cache HTML because RSC payloads carry build IDs that invalidate every
  // deploy — caching here would ship stale shells.
});

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    // Network failure with no cache hit — let the browser show its native
    // offline page. Throwing keeps the response promise rejected.
    throw err;
  }
}
