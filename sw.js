// 召喚｜卡圖快取
// 只處理 shared/cards/ 的卡圖：先給本機快取（瞬間顯示），同時在背景向伺服器確認有沒有新版，有就更新快取。
// 換卡圖後，玩家下次進站就會看到新圖；遊戲程式（html、js）不經過這裡，更新一律即時生效。
// 卡圖大改（例如換一整彈）時，把 VERSION 加 1，舊快取會整個清掉。
const VERSION = 2;
const CACHE = 'summon-cards-img-v' + VERSION;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('summon-cards-img-') && k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || !url.pathname.includes('/shared/cards/')) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(e.request);
    const net = fetch(e.request).then(res => { if (res.ok) cache.put(e.request, res.clone()); return res; });
    if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
    return net;
  })());
});
