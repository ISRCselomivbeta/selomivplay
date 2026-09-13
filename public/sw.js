// ============================================================
// SERVICE WORKER — PLAY MY v9.0.0
// Cache inteligente por tipo de recurso + PWA
// ============================================================

const SW_VERSION = '9.0.0';
const CACHE_STATIC  = 'playmy-static-'  + SW_VERSION;
const CACHE_RUNTIME = 'playmy-runtime-' + SW_VERSION;
const CACHE_IMAGES  = 'playmy-images-'  + SW_VERSION;

// Recursos essenciais (instalação imediata)
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/images/logo.png',
  '/css/main.css',
  '/css/auth.css',
  '/css/marketplace.css',
  '/css/player.css',
  '/css/modals.css',
  '/css/blockchain.css',
  '/css/news.css',
  '/css/responsive.css'
];

// Domínios que NUNCA devem ser cacheados (dados em tempo real)
const NO_CACHE_HOSTS = [
  'script.google.com',
  'script.googleusercontent.com',
  'selomivplay-seyv.vercel.app',
  'selomivplay.vercel.app',
  'www.googleapis.com'
];

// ============================================================
// INSTALL — pré-cache dos assets essenciais
// ============================================================
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando v' + SW_VERSION);
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then((cache) => {
        // Cacheia um por um para não falhar tudo se um faltar
        return Promise.all(
          STATIC_ASSETS.map((url) =>
            cache.add(url).catch((err) => {
              console.warn('[SW] Falha ao cachear:', url, err.message);
            })
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

// ============================================================
// ACTIVATE — limpa caches antigos
// ============================================================
self.addEventListener('activate', (event) => {
  console.log('[SW] Ativando v' + SW_VERSION);
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('playmy-') && !key.endsWith(SW_VERSION))
          .map((key) => {
            console.log('[SW] Removendo cache antigo:', key);
            return caches.delete(key);
          })
      ))
      .then(() => self.clients.claim())
  );
});

// ============================================================
// FETCH — estratégia por tipo de recurso
// ============================================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar requisições que não são GET
  if (request.method !== 'GET') return;

  // Ignorar extensões de navegador e devtools
  if (url.protocol === 'chrome-extension:' || url.protocol === 'moz-extension:') return;

  // ============================================================
  // 1. APIs externas conhecidas → SEMPRE da rede (network-only)
  // ============================================================
  if (NO_CACHE_HOSTS.some((host) => url.hostname.includes(host))) {
    return;
  }

  // ============================================================
  // 1.1. API do próprio domínio (/api/...) → network-only
  // ============================================================
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // ============================================================
  // 2. Google News RSS e proxies CORS → network-only
  // ============================================================
  if (
    url.hostname.includes('news.google.com') ||
    url.hostname.includes('allorigins.win') ||
    url.hostname.includes('corsproxy.io') ||
    url.hostname.includes('codetabs.com') ||
    url.hostname.includes('r.jina.ai')
  ) {
    return;
  }

  // ============================================================
  // 3. YouTube → network-only (não cachear iframes/vídeos)
  // ============================================================
  if (
    url.hostname.includes('youtube.com') ||
    url.hostname.includes('ytimg.com') ||
    url.hostname.includes('googlevideo.com')
  ) {
    return;
  }

  // ============================================================
  // 4. CDN (Bootstrap, Bootstrap Icons, jsDelivr) → cache-first
  // ============================================================
  if (
    url.hostname.includes('cdn.jsdelivr.net') ||
    url.hostname.includes('cdnjs.cloudflare.com')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_STATIC).then((cache) => cache.put(request, clone));
          }
          return response;
        }).catch(() => cached);
      })
    );
    return;
  }

  // ============================================================
  // 5. Imagens → cache-first com fallback
  // ============================================================
  if (
    request.destination === 'image' ||
    /\.(png|jpg|jpeg|gif|webp|svg|ico)$/i.test(url.pathname)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          // Atualiza em background
          fetch(request).then((response) => {
            if (response && response.status === 200) {
              caches.open(CACHE_IMAGES).then((cache) => cache.put(request, response));
            }
          }).catch(() => {});
          return cached;
        }
        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_IMAGES).then((cache) => cache.put(request, clone));
          }
          return response;
        }).catch(() => {
          return caches.match('/images/logo.png');
        });
      })
    );
    return;
  }

  // ============================================================
  // 6. HTML/navegação → network-first com fallback para index/offline
  // ============================================================
  if (
    request.mode === 'navigate' ||
    (request.headers.get('accept') || '').includes('text/html')
  ) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_STATIC).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            if (cached) return cached;
            return caches.match('/index.html').then((idx) => {
              if (idx) return idx;
              return caches.match('/offline.html');
            });
          });
        })
    );
    return;
  }

  // ============================================================
  // 7. Outros recursos (JS, CSS) → network-first com cache em background
  // ============================================================
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_RUNTIME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

// ============================================================
// MESSAGE — comunicação com o app (skip waiting, clear cache)
// ============================================================
self.addEventListener('message', (event) => {
  const { data } = event;
  if (!data || !data.type) return;

  switch (data.type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'CLEAR_CACHE':
      event.waitUntil(
        caches.keys()
          .then((keys) =>
            Promise.all(
              keys.filter((k) => k.startsWith('playmy-')).map((k) => caches.delete(k))
            )
          )
          .then(() => {
            if (event.source && event.source.postMessage) {
              event.source.postMessage({ type: 'CACHE_CLEARED' });
            }
          })
      );
      break;

    case 'GET_VERSION':
      if (event.source && event.source.postMessage) {
        event.source.postMessage({ type: 'VERSION', version: SW_VERSION });
      }
      break;
  }
});

console.log('[SW] PLAY MY Service Worker carregado v' + SW_VERSION);
