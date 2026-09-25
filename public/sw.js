// ============================================================
// SERVICE WORKER — PLAY MY v9.9.8
// Cache inteligente por tipo de recurso + PWA
//
// MUDANÇAS v9.9.8:
//   - 🔧 SW_VERSION bumpada (9.9.7 → 9.9.8)
//   - 🆕 news-unified.js agora é cacheado com network-first
//        prioritário (evita feed de notícias desatualizado)
//   - 🆕 Domínio do backend /api/backend tem fallback JSON
//        mesmo quando offline (não quebra o app)
//   - 🆕 Suporte a imagens data: e blob: (não tenta cachear)
//   - 🆕 enrichWithOgImage pode buscar imagens externas (http)
//        → tratadas como isImage() e cacheadas com segurança
//
// MUDANÇAS v9.9.7:
//   - 🔧 Adicionado bootstrap.min.css ao pré-cache
//
// MUDANÇAS v9.9.5:
//   - 🔧 CDN: retry 3x + nunca devolver Response vazio
//   - 🔧 FONTES: mesmo tratamento
//   - 🔧 install: retry 3x por asset
//
// MUDANÇAS v9.9.1:
//   - CDN: stale-while-revalidate
//   - Fontes: stale-while-revalidate
//   - install: falha alto com console.error
// ============================================================

const SW_VERSION = '9.9.8';  // 👈 BUMP manual a cada deploy relevante
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

  // 🆕 BOOTSTRAP CSS — CDN
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',

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
  // 🆕 v9.9.8 — não tenta cachear data:/blob: URIs
  if (url.protocol === 'data:' || url.protocol === 'blob:') return false;

  return (
    request.destination === 'image' ||
    /\.(png|jpg|jpeg|gif|webp|svg|ico|avif)$/i.test(url.pathname) ||
    // 🆕 v9.9.8 — imagens externas do og:image (sem extensão explícita)
    //    tratadas como image se vierem de hosts comuns de CDN de notícias
    (request.destination === '' && /image|photo|thumb|media|capa|cover/i.test(url.pathname))
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

// 🆕 v9.9.8 — assets críticos do feed de notícias (network-first prioritário)
function isNewsAsset(url) {
  return (
    url.pathname === '/js/news.js' ||
    url.pathname === '/js/news-unified.js' ||
    url.pathname === '/css/news.css'
  );
}

// 🆕 v9.9.8 — verifica se é endpoint do backend
function isBackendApi(url) {
  return url.pathname === '/api/backend' || url.pathname.startsWith('/api/');
}

// ============================================================
// 🔧 FETCH COM RETRY (para CDN/fontes)
// Tenta até 3x. Se todas falharem, LANÇA o erro (não devolve vazio!)
// ============================================================
async function fetchWithRetry(request, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(request);
      if (response && response.status === 200) return response;
      // Status != 200 — tenta de novo
      if (attempt === maxAttempts) return response;
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      console.warn(`[SW] tentativa ${attempt}/${maxAttempts} falhou:`, request.url, '-', err.message);
      await new Promise(r => setTimeout(r, 300 * attempt));
    }
  }
}

// ============================================================
// INSTALL — pré-cache dos assets essenciais (com retry)
// ============================================================
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando v' + SW_VERSION);
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then((cache) => {
        return Promise.all(
          STATIC_ASSETS.map(async (url) => {
            // 🔧 retry 3x por asset
            for (let attempt = 1; attempt <= 3; attempt++) {
              try {
                // 'reload' evita pegar do HTTP cache um recurso inválido
                const res = await fetch(url, { cache: 'reload' });
                if (!res || !res.ok) {
                  throw new Error('HTTP ' + (res ? res.status : 'sem resposta'));
                }
                await cache.put(url, res);
                if (attempt > 1) {
                  console.log(`[SW] ✅ cacheado na tentativa ${attempt}:`, url);
                }
                return; // sucesso — sai do loop
              } catch (err) {
                console.warn(`[SW] ⚠️ tentativa ${attempt}/3 falhou:`, url, '-', err.message);
                if (attempt === 3) {
                  console.error('[SW] ❌ falha definitiva:', url);
                } else {
                  await new Promise(r => setTimeout(r, 500 * attempt));
                }
              }
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

  // 🆕 v9.9.8 — não intercepta data:/blob: (imagens inline / geradas)
  if (url.protocol === 'data:' || url.protocol === 'blob:') return;

  // 1. Hosts "tempo real" → network-only
  if (NO_CACHE_HOSTS.some((host) => url.hostname.includes(host))) {
    return;
  }

  // 🆕 v9.9.8 — assets críticos de notícias → network-first prioritário
  // (garante que o feed de notícias pegue sempre a versão mais recente)
  if (isNewsAsset(url)) {
    event.respondWith(
      fetchWithTimeout(request, NETWORK_TIMEOUT_MS)
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

  // 2. API do próprio domínio → network-only (com fallback JSON)
  // 🆕 v9.9.8 — fallback JSON melhorado (não quebra o app offline)
  if (isBackendApi(url)) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(
          JSON.stringify({
            success: false,
            offline: true,
            message: 'Sem conexão',
            version: SW_VERSION
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
    );
    return;
  }

  // 3. CDN → stale-while-revalidate com retry
  //    🔧 não devolve mais Response vazio (causava CSS quebrado)
  if (isCDN(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        // Se tem cache, devolve AGORA e revalida em background
        if (cached) {
          fetch(request).then((response) => {
            if (response && response.status === 200) {
              caches.open(CACHE_STATIC).then((cache) => cache.put(request, response));
            }
          }).catch(() => {});
          return cached;
        }

        // Sem cache: tenta rede com retry
        return fetchWithRetry(request, 3).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_STATIC).then((cache) => cache.put(request, clone));
          }
          return response;
        }).catch((err) => {
          console.error('[SW] ❌ CDN falhou após 3 tentativas:', url.href);
          // Propaga o erro — o navegador vai tratar como falha real
          throw err;
        });
      })
    );
    return;
  }

  // 3.5. FONTES → stale-while-revalidate com retry
  //      🔧 não devolve mais 404 vazio (causava "quadrados" sem ícone)
  if (isFont(url)) {
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

        return fetchWithRetry(request, 3).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_STATIC).then((cache) => cache.put(request, clone));
          }
          return response;
        }).catch((err) => {
          console.error('[SW] ❌ Fonte falhou após 3 tentativas:', url.href);
          throw err;
        });
      })
    );
    return;
  }

  // 4. Imagens → stale-while-revalidate
  // 🆕 v9.9.8 — aceita imagens externas (og:image), com fallback inteligente
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
