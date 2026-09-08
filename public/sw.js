const CACHE_NAME = "rhythians-mobile-v1";
const CORE = ["/", "/mobile", "/manifest.webmanifest", "/favicon.ico"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE)).catch(() => undefined));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/").then((response) => response || Response.error())));
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname === "/favicon.ico" || url.pathname === "/manifest.webmanifest") {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => undefined);
      return response;
    })));
  }
});
