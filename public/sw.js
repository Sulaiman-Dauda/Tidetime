// Tidetime service worker — minimal offline shell + network-first navigation.
const CACHE = "tidetime-v2";
// Only the public shell is precached. Authenticated pages are never cached.
const OFFLINE_URLS = ["/"];

// Personalised / sensitive areas that must always come from the network and
// must never be written to the cache (avoids leaking one user's content to the
// next person on a shared device).
const NO_CACHE_PREFIXES = ["/dashboard", "/setup", "/login", "/signup", "/reset-password", "/forgot-password"];

function isNoCachePath(pathname) {
  return NO_CACHE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(OFFLINE_URLS))
      .catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Never cache API or auth traffic.
  if (url.pathname.startsWith("/api/")) return;

  if (req.mode === "navigate") {
    // Authenticated/personalised pages: network-only, never cached.
    if (isNoCachePath(url.pathname)) {
      event.respondWith(fetch(req).catch(() => caches.match("/")));
      return;
    }

    // Public pages: network-first, fall back to cache when offline.
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches
            .open(CACHE)
            .then((cache) => cache.put(req, copy))
            .catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match("/"))),
    );
    return;
  }

  // Cache-first for static assets only.
  event.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req).then((res) => {
          if (
            res.ok &&
            (url.pathname.startsWith("/_next/") ||
              url.pathname.startsWith("/icon"))
          ) {
            const copy = res.clone();
            caches
              .open(CACHE)
              .then((cache) => cache.put(req, copy))
              .catch(() => {});
          }
          return res;
        }),
    ),
  );
});
