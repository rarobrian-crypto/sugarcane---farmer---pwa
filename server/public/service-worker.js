// Sugarcane GIS — Farmer PWA service worker
// Caches only the public app shell. Personalized farmer API responses
// are network-only so accounts on a shared phone cannot see each other's farms.

const CACHE_VERSION = "farmer-app-v9-private-farms";
const APP_SHELL = [
  "/farmer/index.html",
  "/farmer/css/app.css?v=lands-dashboard-9",
  "/farmer/js/app.js?v=lands-dashboard-9",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return; // writes are queued client-side, not here

  // App shell + static assets: cache-first
  if (APP_SHELL.some((path) => request.url.endsWith(path.replace(/^https?:\/\/[^/]+/, "")))) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request))
    );
    return;
  }


});

// Push notifications (harvest due, alerts) — requires the backend
// to send a real push using web-push + VAPID keys. See README.
self.addEventListener("push", (event) => {
  let data = { title: "Sugarcane GIS", body: "You have a new update." };
  try { data = event.data.json(); } catch (e) {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png"
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow("/farmer/index.html#/alerts"));
});
