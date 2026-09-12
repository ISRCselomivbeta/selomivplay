// ============================================================
// SERVICE WORKER — PLAY MY v8.5.8
// Cache inteligente por tipo de recurso
// ============================================================

const SW_VERSION = '8.5.8';
const CACHE_STATIC = 'playmy-static-' + SW_VERSION;
const CACHE_RUNTIME = 'playmy-runtime-' + SW_VERSION;
const CACHE_IMAGES = 'playmy-images-' + SW_VERSION;

// Recursos essenciais (instalação imediata)
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/images/logo.png'
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
      .then((cache) => cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('[SW] Erro ao pré-cachear:', err);
      }))
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
        keys.filter((key) => key.startsWith('playmy-') && !key.endsWith(SW_VERSION))
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
  // 1. APIs e dados em tempo real → SEMPRE da rede (network-only)
  // ============================================================
  if (NO_CACHE_HOSTS.some(host => url.hostname.includes(host))) {
    return;
  }

  // ============================================================
  // 2. Google News RSS (proxy) → network-only
  // ============================================================
  if (url.hostname.includes('news.google.com') || url.hostname.includes('allorigins.win')) {
    return;
  }

  // ============================================================
  // 3. YouTube → network-only (não cachear iframes/vídeos)
  // ============================================================
  if (url.hostname.includes('youtube.com') || url.hostname.includes('ytimg.com') || url.hostname.includes('googlevideo.com')) {
    return;
  }

  // ============================================================
  // 4. CDN (Bootstrap, Bootstrap Icons) → cache-first (immutable)
  // ============================================================
  if (url.hostname.includes('cdn.jsdelivr.net') || url.hostname.includes('cdnjs.cloudflare.com')) {
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
  if (request.destination === 'image' || /\.(png|jpg|jpeg|gif|webp|svg|ico)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
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
  // 6. HTML/navegação → network-first com fallback para index
  // ============================================================
  if (request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html')) {
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
            return caches.match('/index.html');
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
      const fetchPromise = fetch(request).then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_RUNTIME).then((cache) => cache.put(request, clone));
        }
        return response;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

// ============================================================
// MESSAGE — permite comunicação com o app (skip waiting, clear cache)
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
        caches.keys().then((keys) =>
          Promise.all(keys.filter((k) => k.startsWith('playmy-')).map((k) => caches.delete(k)))
        ).then(() => {
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
