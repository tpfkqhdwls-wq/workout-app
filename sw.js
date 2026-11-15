// 오프라인에서도 열리도록 앱 파일을 저장해 둡니다. 온라인이면 항상 최신 파일을 먼저 받아옵니다.
const CACHE = 'ounwan-v4';
const FILES = ['./', 'index.html', 'style.css', 'app.js', 'meta.js', 'ex/upper.js', 'ex/lower.js', 'ex/core.js', 'manifest.webmanifest', 'icon.svg'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request))
  );
});
