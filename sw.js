/* DULUNOPY Service Worker (PWA) — Versão 7 Otimizada com Auto-Update */
const CACHE_NAME = 'dulunopy-vmtxx28n1';

const PRECACHE_ASSETS = [
  './assets/ui-shell.min.js?v=vmtxx28n1',
  './assets/charts-workspace.min.js?v=vmtxx28n1',
  './assets/weather-workspace.min.js?v=vmtxx28n1',
  './assets/info-workspace.min.js?v=vmtxx28n1',
  './assets/study-tools.min.js?v=vmtxx28n1',
  './assets/route-insights.min.js?v=vmtxx28n1',
  './assets/scenarios.min.js?v=vmtxx28n1',
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/icon-512.svg',
  './assets/icon-512.png',
  './assets/icon-192.png',
  './assets/apple-touch-icon.png',
  './assets/app.min.css?v=vmtxx28n1',
  './assets/integrity.min.js?v=vmtxx28n1',
  './assets/app.min.js?v=vmtxx28n1',
  './assets/haven-features.min.js?v=vmtxx28n1'
];

// Instalação do Service Worker com pré-carregamento tolerante a falhas
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      await Promise.allSettled(
        PRECACHE_ASSETS.map(url => cache.add(url).catch(() => null))
      );
    })
  );
});

// Limpeza agressiva de caches obsoletos na ativação
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => {
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

  // 2. Bibliotecas CDN (Leaflet, MapLibre, Fontes): Cache-First com atualização em background
  const isCdn = url.hostname.includes('unpkg.com') ||
                url.hostname.includes('jsdelivr.net') ||
                url.hostname.includes('fonts.googleapis.com') ||
                url.hostname.includes('fonts.gstatic.com');
  if (isCdn) {
    event.respondWith(
      caches.match(req).then(cached => {
        const fetchPromise = fetch(req).then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(req, clone));
          }
          return res;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // 3. Mesma origem: Network-First com fallback instantâneo para Cache
  if (url.origin === location.origin) {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(req, clone));
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
