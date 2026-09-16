// ============================================================
// SERVICE WORKER — PLAY MY v9.6.0
// Cache inteligente por tipo de recurso + PWA
//
// MUDANÇAS v9.6.0:
//   - Adicionados os 4 ícones novos ao pré-cache
//   - SW_VERSION atualizado para forçar limpeza de cache antigo
//   - Mantém NAVIGATE_HOME, JS pré-cache, stale-while-revalidate
//
// MUDANÇAS v9.1.0:
//   - Adicionado NAVIGATE_HOME (usado pelo offline.html)
//   - JS adicionado ao pré-cache (api.js, router.js, auth.js...)
//   - Estratégia de JS/CSS: cache-first + revalidate em background
//   - Imagens: stale-while-revalidate
//   - Navegação: network-first com timeout de 6s
//   - Fallback para offline.html quando index.html não está em cache
// ============================================================

const SW_VERSION = '9.6.0';
const CACHE_STATIC  = 'playmy-static-'  + SW_VERSION;
const CACHE_RUNTIME = 'playmy-runtime-' + SW_VERSION;
const CACHE_IMAGES  = 'playmy-images-'  + SW_VERSION;

const NETWORK_TIMEOUT_MS = 6000;

// Recursos essenciais (instalação imediata)
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',

  // ÍCONES PWA (v9.6.0)
  '/images/logo.png',
  '/images/icon-192.png',
  '/images/icon-512.png',
  '/images/icon-maskable-192.png',
  '/images/icon-maskable-512.png',

  // CSS
  '/css/main.css',
  '/css/auth.css',
  '/css/marketplace.css',
  '/css/player.css',
  '/css/modals.css',
  '/css/blockchain.css',
  '/css/news.css',
  '/css/responsive.css',

  // JS (ordem importa para o router; mas cache não depende de ordem)
  '/js/config.js',
  '/js/utils.js',
  '/js/state.js',
  '/js/router.js',
  '/js/api.js',
  '/js/auth.js',
  '/js/youtube.js',
  '/js/player.js',
  '/js/marketplace.js',
  '/js/portfolio.js',
  '/js/trades.js',
  '/js/blockchain.js',
  '/js/modals.js',
  '/js/news.js',
  '/js/news-unified.js',
  '/js/stream-tracker.js',
  '/js/valuation-panel.js',
  '/js/elo-panel.js',
  '/js/streams-panel.js',
  '/js/brand-info.js',
  '/js/app.js'
];

// Domínios que NUNCA devem ser cacheados (dados em tempo real)
const NO_CACHE_HOSTS = [
  'script.google.com',
  'script.googleusercontent.com',
  'selomivplay-seyv.vercel.app',
  'selomivplay.vercel.app',
  'www.googleapis.com',
  'news.google.com',
  'allorigins.win',
  'corsproxy.io',
  'codetabs.com',
  'r.jina.ai',
  'youtube.com',
  'ytimg.com',
  'googlevideo.com'
];

// ============================================================
// HELPERS
// ============================================================
function fetchWithTimeout(request, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(request).then(
      (res) => { clearTimeout(timer); resolve(res); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/css/') ||
    url.pathname.startsWith('/js/') ||
    url.pathname.startsWith('/images/') ||
    /\.(css|js)$/i.test(url.pathname)
  );
}

function isImage(request, url) {
  return (
    request.destination === 'image' ||
    /\.(png|jpg|jpeg|gif|webp|svg|ico|avif)$/i.test(url.pathname)
  );
}

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
              console.warn('[SW] Falha ao cachear:', url, '-', err.message);
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
  // 1. Hosts conhecidos como "tempo real" → network-only
  // ============================================================
  if (NO_CACHE_HOSTS.some((host) => url.hostname.includes(host))) {
    return;
  }

  // ============================================================
  // 1.1. API do próprio domínio (/api/...) → network-only
  // ============================================================
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(
          JSON.stringify({ success: false, offline: true, message: 'Sem conexão' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
    );
    return;
  }

  // ============================================================
  // 2. CDN (jsDelivr, cdnjs) → cache-first
  // ============================================================
  if (
    url.hostname.includes('cdn.jsdelivr.net') ||
    url.hostname.includes('cdnjs.cloudflare.com')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          fetch(request).then((response) => {
            if (response && response.status === 200) {
              caches.open(CACHE_STATIC).then((cache) => cache.put(request, response));
            }
          }).catch(() => {});
          return cached;
        }
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
  // 3. Imagens → stale-while-revalidate
  // ============================================================
  if (isImage(request, url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              const clone = response.clone();
              caches.open(CACHE_IMAGES).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => cached || caches.match('/images/logo.png'));

        return cached || fetchPromise;
      })
    );
    return;
  }

  // ============================================================
  // 4. HTML/navegação → network-first com timeout + fallback
  // ============================================================
  if (
    request.mode === 'navigate' ||
    (request.headers.get('accept') || '').includes('text/html')
  ) {
    event.respondWith(
      fetchWithTimeout(request, NETWORK_TIMEOUT_MS)
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
              return caches.match('/offline.html').then((off) => {
                if (off) return off;
                return new Response(
                  '<!DOCTYPE html><html><body style="background:#000;color:#fff;font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><h1>📴 Offline</h1><p>Sem conexão e sem cache disponível.</p></div></body></html>',
                  { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
                );
              });
            });
          });
        })
    );
    return;
  }

  // ============================================================
  // 5. JS/CSS e demais estáticos → cache-first + revalidate
  // ============================================================
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              const clone = response.clone();
              caches.open(CACHE_STATIC).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => cached);

        return cached || fetchPromise;
      })
    );
    return;
  }

  // ============================================================
  // 6. Outros recursos → cache-first com revalidate
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
// MESSAGE — comunicação com o app
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

    case 'NAVIGATE_HOME':
      event.waitUntil(
        self.clients.matchAll({ type: 'window' }).then((clients) => {
          clients.forEach((client) => {
            client.navigate((data && data.url) || '/');
          });
        })
      );
      break;

    case 'FORCE_UPDATE':
      self.skipWaiting();
      break;
  }
});

console.log('[SW] PLAY MY Service Worker carregado v' + SW_VERSION);
