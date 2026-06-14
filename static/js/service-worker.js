const CACHE_NAME = 'season-v6';
const STATIC_ASSETS = [
  '/static/css/style.css?v=33',
  '/static/css/pro.css?v=45',
  '/static/js/auth.js?v=4',
  '/static/js/app.js?v=32',
  '/static/js/floorplan.js?v=43',
  '/static/js/reservations.js?v=29',
  '/static/js/clients.js?v=24',
  '/static/js/waitlist.js?v=24',
  '/static/js/calendar.js?v=26',
  '/static/js/reports.js?v=34',
  '/static/images/season-logo.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Never cache API calls, auth, or socket.io
  if (url.pathname.startsWith('/api/') ||
      url.pathname.startsWith('/socket.io') ||
      url.pathname === '/login' ||
      url.pathname === '/logout') {
    return;
  }

  // Cache-first for static assets (CSS, JS, images, fonts)
  if (url.pathname.startsWith('/static/') || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Network-first for HTML pages
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
