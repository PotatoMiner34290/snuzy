// Snuzy asset cache: repeat visits skip re-downloading SoundFont samples,
// the piano-AI model, and TF.js (tens of MB). Same-origin app files are
// intentionally NOT cached here — Next.js owns those.
const CACHE = 'snuzy-assets-v1';
const CDN_HOSTS = ['gleitz.github.io', 'storage.googleapis.com', 'cdn.jsdelivr.net', 'tonejs.github.io'];

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  let host = '';
  try {
    host = new URL(event.request.url).hostname;
  } catch {
    return;
  }
  if (!CDN_HOSTS.some((h) => host === h || host.endsWith('.' + h))) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(event.request);
      if (hit) return hit;
      const res = await fetch(event.request);
      if (res && res.ok) {
        try {
          await cache.put(event.request, res.clone());
        } catch {}
      }
      return res;
    })()
  );
});
