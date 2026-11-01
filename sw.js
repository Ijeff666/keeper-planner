// App files go network-first so a deploy shows up on the next open; the offline copy is the fallback.
// CDN modules and fonts are versioned URLs, so cache-first is safe. Supabase traffic is never cached.
const CACHE = 'kp-v3';
const SHELL = ['./', './index.html', './css/app.css', './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png',
  './js/app.js', './js/lib.js', './js/config.js', './js/util.js', './js/ui.js', './js/store.js', './js/model.js', './js/seed.js',
  './js/theme.js', './js/calendar.js', './js/workout.js', './js/gym.js', './js/views.js', './js/library.js'];
const CDN = /^(https:\/\/cdn\.jsdelivr\.net|https:\/\/fonts\.(googleapis|gstatic)\.com)\//;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (CDN.test(req.url)) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    })));
    return;
  }
  if (url.origin !== location.origin) return;
  e.respondWith(fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('./index.html'))));
});

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data?.json() || {}; } catch { d = { body: e.data?.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Keeper Planner', {
    body: d.body || '', icon: './icons/icon-192.png', badge: './icons/icon-192.png',
    tag: d.tag || undefined, renotify: !!d.tag, data: { url: d.url || './#today' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = new URL(e.notification.data?.url || './#today', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
    const win = wins.find((w) => w.url.startsWith(self.registration.scope));
    if (win) { win.postMessage({ type: 'open', url: target }); return win.focus(); }
    return self.clients.openWindow(target);
  }));
});
