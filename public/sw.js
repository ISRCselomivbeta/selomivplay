// ============================================================
// SERVICE WORKER — PLAY MY v8.1
// ============================================================

const CACHE_NAME = 'playmy-v8.1';
const CACHE_RUNTIME = 'playmy-runtime-v8.1';

// Arquivos essenciais para cache inicial (app shell)
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

// ===== INSTALAR =====
self.addEventListener('install', event => {
  console.log('[SW] Instalando v8.1...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Cache aberto:', CACHE_NAME);
        return Promise.allSettled(
          urlsToCache.map(url => cache.add(url).catch(err => {
            console.warn('[SW] Falha ao cachear (ignorado):', url, err);
          }))
        );
      })
  );
  self.skipWaiting();
});

// ===== INTERCEPTAR REQUISIÇÕES =====
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Nunca interceptar: API, YouTube, Google APIs, GAS, GitHub
  if (
    event.request.method !== 'GET' ||
    url.includes('/api/') ||
    url.includes('youtube.com') ||
    url.includes('youtube-nocookie.com') ||
    url.includes('ytimg.com') ||
    url.includes('googleapis.com') ||
    url.includes('googleusercontent.com') ||
    url.includes('script.google.com') ||
    url.includes('vercel.app/api') ||
    url.includes('github.com') ||
    url.includes('githubusercontent.com') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('blob:')
  ) {
    return;
  }

  // Network-first para HTML (App Shell)
  if (
    event.request.mode === 'navigate' ||
    event.request.destination === 'document' ||
    url.endsWith('.html') ||
    url === '/' ||
    url.endsWith('/')
  ) {
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_RUNTIME).then(cache => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(event.request)
            .then(cachedResponse => {
              if (cachedResponse) return cachedResponse;
              return caches.match('/index.html');
            });
        })
    );
    return;
  }

  // Para outros assets: Cache-first com atualização em background
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          fetch(event.request)
            .then(networkResponse => {
              if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_RUNTIME).then(cache => {
                  cache.put(event.request, responseToCache);
                });
              }
            })
            .catch(() => {});
          return response;
        }

        const fetchRequest = event.request.clone();

        return fetch(fetchRequest)
          .then(networkResponse => {
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_RUNTIME).then(cache => {
              cache.put(event.request, responseToCache);
            });
            return networkResponse;
          })
          .catch(() => {
            if (event.request.destination === 'image') {
              return caches.match('/images/logo.png');
            }
          });
      })
  );
});

// ===== ATIVAR E LIMPAR CACHES ANTIGAS =====
self.addEventListener('activate', event => {
  console.log('[SW] Ativando v8.1...');
  const cacheWhitelist = [CACHE_NAME, CACHE_RUNTIME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('[SW] Removendo cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// ===== MENSAGENS DO APP =====
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then(names => Promise.all(names.map(n => caches.delete(n))));
  }
});

// ===== NOTIFICAÇÕES PUSH =====
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'PLAY MY';
  const options = {
    body: data.body || 'Novas atualizações disponíveis!',
    icon: 'https://github.com/ISRCselomivbeta/selomivplay/raw/main/images/logo.png',
    badge: 'https://github.com/ISRCselomivbeta/selomivplay/raw/main/images/logo.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : '/';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      for (let client of windowClients) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
