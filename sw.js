/* DULUNOPY Service Worker (PWA) — Versão 7 Otimizada com Auto-Update */
const CACHE_NAME = 'dulunopy-vmu1qb2uy';
const CACHE_PREFIX = 'dulunopy-';
const RUNTIME_CACHE = `${CACHE_NAME}-runtime`;
const CDN_CACHE = `${CACHE_NAME}-cdn`;
const CURRENT_CACHES = new Set([CACHE_NAME, RUNTIME_CACHE, CDN_CACHE]);
const RUNTIME_LIMIT = 180;
const CDN_LIMIT = 40;

const PRECACHE_ASSETS = [
  './assets/ui-shell.min.js?v=vmu1qb2uy',
  './assets/charts-workspace.min.js?v=vmu1qb2uy',
  './assets/weather-workspace.min.js?v=vmu1qb2uy',
  './assets/info-workspace.min.js?v=vmu1qb2uy',
  './assets/study-tools.min.js?v=vmu1qb2uy',
  './assets/route-insights.min.js?v=vmu1qb2uy',
  './assets/scenarios.min.js?v=vmu1qb2uy',
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/icon-512.svg',
  './assets/icon-512.png',
  './assets/icon-192.png',
  './assets/apple-touch-icon.png',
  './assets/app.min.css?v=vmu1qb2uy',
  './assets/integrity.min.js?v=vmu1qb2uy',
  './assets/app.min.js?v=vmu1qb2uy',
  './assets/haven-features.min.js?v=vmu1qb2uy'
];

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - maxEntries)).map(key => cache.delete(key)));
}

async function cacheResponse(cacheName, request, response, limit) {
  if (!response || (!response.ok && response.type !== 'opaque')) return;
  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
  await trimCache(cacheName, limit);
}

// Recursos essenciais são atômicos: qualquer falha impede uma instalação incompleta.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Limpa apenas versões antigas pertencentes ao DULUNOPY.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key.startsWith(CACHE_PREFIX) && !CURRENT_CACHES.has(key)).map(k => {
        console.log('[SW] Purgando cache antigo:', k);
        return caches.delete(k);
      })
    )).then(() => self.clients.claim())
  );
});

// Estratégias inteligentes de requisição
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 1. APIs dinâmicas ao vivo: sempre direto pela rede (ADS-B, Radar Chuva, METAR, VATSIM, IVAO, SIGMET)
  const isLiveApi = url.hostname.includes('opensky-network.org') ||
                    url.hostname.includes('rainviewer.com') ||
                    url.hostname.includes('aviationweather.gov') ||
                    url.hostname.includes('vatsim.net') ||
                    url.hostname.includes('ivao.aero') ||
                    url.pathname.includes('/api/');
  if (isLiveApi) {
    return;
  }

  // 2. Bibliotecas CDN: Cache-First limitado, com atualização em background.
  const isCdn = url.hostname.includes('unpkg.com') ||
                url.hostname.includes('jsdelivr.net') ||
                url.hostname.includes('fonts.googleapis.com') ||
                url.hostname.includes('fonts.gstatic.com');
  if (isCdn) {
    event.respondWith(
      caches.match(req).then(cached => {
        const fetchPromise = fetch(req).then(async res => {
          if (res.ok) {
            await cacheResponse(CDN_CACHE, req, res, CDN_LIMIT);
          }
          return res;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // 3. Runtime público conhecido: Network-First, com cache limitado.
  const isRuntimeAsset = req.mode === 'navigate' ||
                         /\.(?:html|css|js|json|webmanifest|png|jpg|jpeg|webp|svg|ico|woff2?)$/i.test(url.pathname) ||
                         url.pathname.endsWith('/');
  if (url.origin === location.origin && isRuntimeAsset) {
    event.respondWith(
      fetch(req)
        .then(async res => {
          if (res.ok) {
            await cacheResponse(RUNTIME_CACHE, req, res, RUNTIME_LIMIT);
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          if (req.mode === 'navigate') {
            return caches.match('./index.html') || caches.match('./');
          }
          return new Response('Offline', { status: 503, statusText: 'Offline' });
        })
    );
  }
});
