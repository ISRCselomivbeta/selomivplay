// ============================================================
// SERVICE WORKER — PLAY MY v9.9.1
// Cache inteligente por tipo de recurso + PWA
//
// MUDANÇAS v9.9.1:
//   - CDN: cache-first → stale-while-revalidate (corrige ícones velhos)
//   - Fontes: cache-first puro → stale-while-revalidate (corrige .woff2 vazio)
//   - install: falha alto com console.error (antes silenciava erros)
//   - isStaticAsset: inclui fontes
//   - updateViaCache tratado no app.js (não muda aqui)
// ============================================================

const SW_VERSION = '9.9.1';  // 👈 BUMP manual a cada deploy relevante
const CACHE_STATIC  = 'playmy-static-'  + SW_VERSION;
const CACHE_RUNTIME = 'playmy-runtime-' + SW_VERSION;
const CACHE_IMAGES  = 'playmy-images-'  + SW_VERSION;

const NETWORK_TIMEOUT_MS = 6000;

// Recursos essenciais (instalação imediata)
const STATIC_ASSETS = [
  // '/',                 // ← 🚨 COMENTADO: nunca cachear HTML
  // '/index.html',       // ← REMOVIDO: nunca cachear HTML
  '/offline.html',
  '/manifest.json',

  // ÍCONES PWA
  '/images/logo.png',
  '/images/icon-192.png',
  '/images/icon-512.png',
  '/images/icon-maskable-192.png',
  '/images/icon-maskable-512.png',

  // 🆕 BOOTSTRAP ICONS — CDN
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/fonts/bootstrap-icons.woff2',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/fonts/bootstrap-icons.woff',

  // CSS
  '/css/main.css',
  '/css/auth.css',
  '/css/marketplace.css',
  '/css/player.css',
  '/css/modals.css',
  '/css/blockchain.css',
  '/css/news.css',
  '/css/responsive.css',

  // JS
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
  '/js/share.js',
  '/js/royalties-panel.js',
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

function isFont(url) {
  return /\.(woff2?|ttf|otf|eot)$/i.test(url.pathname);
}

function isCDN(url) {
  return (
    url.hostname.includes('cdn.jsdelivr.net') ||
    url.hostname.includes('cdnjs.cloudflare.com') ||
    url.hostname.includes('unpkg.com')
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
        return Promise.all(
          STATIC_ASSETS.map(async (url) => {
            try {
              // 'reload' evita pegar do HTTP cache um recurso inválido
              const res = await fetch(url, { cache: 'reload' });
              if (!res || !res.ok) {
                throw new Error('HTTP ' + (res ? res.status : 'sem resposta'));
              }
              await cache.put(url, res);
            } catch (err) {
              // ✅ NÃO silencia: loga como erro para diagnóstico
              console.error('[SW] ❌ Falha ao cachear:', url, '-', err.message);
            }
          })
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

  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:' || url.protocol === 'moz-extension:') return;

  // 1. Hosts "tempo real" → network-only
  if (NO_CACHE_HOSTS.some((host) => url.hostname.includes(host))) {
    return;
  }

  // 2. API do próprio domínio → network-only
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

  // 3. CDN → stale-while-revalidate
  //    (antes: cache-first puro → servia ícones velhos/incompletos)
  if (isCDN(url)) {
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
          .catch(() => cached || new Response('', { status: 504 }));

        return cached || fetchPromise;
      })
    );
    return;
  }

  // 3.5. FONTES → stale-while-revalidate
  //      (antes: cache-first permanente → .woff2 corrompido ficava pra sempre)
  if (isFont(url)) {
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
          .catch(() => cached || new Response('', { status: 404 }));

        return cached || fetchPromise;
      })
    );
    return;
  }

  // 4. Imagens → stale-while-revalidate
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

  // 5. HTML/navegação → NETWORK-ONLY (nunca cacheia HTML!)
  if (
    request.mode === 'navigate' ||
    (request.headers.get('accept') || '').includes('text/html')
  ) {
    event.respondWith(
      fetchWithTimeout(request, NETWORK_TIMEOUT_MS)
        .then((response) => {
          // ✅ NÃO cacheia HTML — apenas retorna
          return response;
        })
        .catch(() => {
          // Só cai aqui se a rede falhar TOTALMENTE (offline real)
          return caches.match('/offline.html').then((off) => {
            if (off) return off;
            return new Response(
              '<!DOCTYPE html><html><body style="background:#000;color:#fff;font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><h1>📴 Offline</h1><p>Sem conexão.</p><p><button onclick="location.reload()" style="padding:12px 24px;font-size:16px;background:#34c759;color:#fff;border:none;border-radius:8px;cursor:pointer">Tentar de novo</button></p></div></body></html>',
              { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
            );
          });
        })
    );
    return;
  }

  // 6. JS/CSS → network-first com fallback para cache
  if (isStaticAsset(url)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_STATIC).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // 7. Outros → cache-first com revalidate (ACEITA cors também)
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((response) => {
          // ✅ aceita 'basic' E 'cors'
          if (response && response.status === 200 &&
              (response.type === 'basic' || response.type === 'cors')) {
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
      self.skipWaiting().then(() => {
        self.clients.matchAll({ type: 'window' }).then((clients) => {
          clients.forEach((client) => {
            client.postMessage({ type: 'SW_ACTIVATED' });
          });
        });
      });
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
      self.skipWaiting().then(() => {
        self.clients.matchAll({ type: 'window' }).then((clients) => {
          clients.forEach((client) => {
            client.postMessage({ type: 'SW_ACTIVATED' });
          });
        });
      });
      break;
  }
});

console.log('[SW] PLAY MY Service Worker carregado v' + SW_VERSION);
