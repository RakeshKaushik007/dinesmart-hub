/*
 * Blennix POS - offline app loading.
 *
 * This only caches the app itself (the screens), never your data. Anything that
 * talks to Supabase is left completely alone, so no stale order, price or stock
 * can ever be served from here.
 *
 * Page loads go to the network first, so a new version is always picked up when
 * online, and fall back to the cached app when there is no connection. Build
 * files carry a hash in their name, so a cached copy is always the right one.
 */
const VERSION = "v1";
const SHELL_CACHE = "blennix-shell-" + VERSION;
const ASSET_CACHE = "blennix-assets-" + VERSION;
const APP_SHELL = "/index.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll([APP_SHELL, "/blennix-logo.png"]))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== ASSET_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Never interfere with anything that changes data.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never interfere with Supabase or any other server.
  if (url.origin !== self.location.origin) return;

  // Opening a page: try the network so updates arrive, fall back to the app.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(APP_SHELL, copy));
          return response;
        })
        .catch(() =>
          caches.match(APP_SHELL).then((cached) => cached || Response.error())
        )
    );
    return;
  }

  // Build files and images: use the cached copy when there is one.
  const isStatic =
    url.pathname.startsWith("/assets/") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".ico") ||
    url.pathname.endsWith(".webmanifest");

  if (isStatic) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
      )
    );
  }
});
