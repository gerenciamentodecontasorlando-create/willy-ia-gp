/* Agenda Zen PWA Service Worker */
const CACHE_NAME = "agenda-zen-pwa-v1";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(CORE_ASSETS);
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k))));
    self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (url.origin !== self.location.origin) return;

  // Navegação: tenta online, cai no cache
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put("./index.html", fresh.clone());
        cache.put("./", fresh.clone());
        return fresh;
      } catch (e) {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match("./index.html")) || (await cache.match("./"));
      }
    })());
    return;
  }

  // Assets: cache-first com atualização em background
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);
    const fetchPromise = fetch(req)
      .then((res) => {
        if (res && res.status === 200) cache.put(req, res.clone());
        return res;
      })
      .catch(() => null);

    return cached || (await fetchPromise) || new Response("Offline", { status: 503, statusText: "Offline" });
  })());
});
