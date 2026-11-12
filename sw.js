const V = 'asistencia-v1';
const FILES = ['./', './index.html', './audio-engine.js', './protocol.js', './db.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // Apps Script pasa directo
  e.respondWith(caches.match(e.request).then(c => c || fetch(e.request)));
});
