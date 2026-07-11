const CACHE_NAME = "finance-pwa-v47";
const BASE_PATH = new URL(self.registration.scope).pathname.replace(/\/$/, "");
const APP_SHELL = [
  `${BASE_PATH}/`,
  `${BASE_PATH}/manifest.webmanifest`,
  `${BASE_PATH}/icons/icon.svg`,
  `${BASE_PATH}/icons/icon-192.png`,
  `${BASE_PATH}/icons/icon-512.png`,
  `${BASE_PATH}/apple-touch-icon.png`,
  `${BASE_PATH}/ui-icons/home.png`,
  `${BASE_PATH}/ui-icons/home-inactive.png`,
  `${BASE_PATH}/ui-icons/investment.png`,
  `${BASE_PATH}/ui-icons/investment-active.png`,
  `${BASE_PATH}/ui-icons/settings.png`,
  `${BASE_PATH}/ui-icons/settings-active.png`,
  `${BASE_PATH}/ui-icons/saved.png`,
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match(`${BASE_PATH}/`)))
  );
});
