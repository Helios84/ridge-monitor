// Developed with AI assistance (see README → Use of AI)
// RIDGE Monitor — sw.js
// A small service worker that keeps the app's own files in the browser cache,
// so the app opens with no connection. It only handles requests for this app's
// own files. It never contacts any other server.
'use strict';

const CACHE = 'ridge-monitor-v1';
const FILES = ['./', 'index.html', 'styles.css', 'app.js', 'data.js', 'favicon.svg', 'manifest.json'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network first, so a new version shows up as soon as there is a connection.
// With no connection, answer from the cache.
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req)
      .then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(cache => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match('index.html')))
  );
});
