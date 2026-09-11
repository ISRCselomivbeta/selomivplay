// ============================================================
// SERVICE WORKER - PLAY MY / SELO MIV v8.1
// ============================================================

const CACHE_NAME = 'playmy-v8.1';
const CACHE_RUNTIME = 'playmy-runtime-v8.1';

// Arquivos essenciais para cache inicial (app shell)
const urlsToCache = [
    '/',
    '/index.html',
    '/offline.html',
    '/confirm-email.html',
    '/reset-password.html',
    '/manifest.json',
    '/images/logo.png',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css'
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

    // Nunca interceptar: API/backend, YouTube, Google APIs, Google Apps Script
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
        url.startsWith('chrome-extension://') ||
        url.startsWith('blob:')
    ) {
        return;
    }

    // 🔥 CORREÇÃO: Network-first para HTML (App Shell)
    if (event.request.mode === 'navigate' || 
        event.request.destination === 'document' ||
        url.endsWith('.html') || 
        url === '/' || 
        url.endsWith('/')) {
        
        event.respondWith(
            fetch(event.request)
                .then(networkResponse => {
                    // Atualiza o cache com a versão mais recente
                    if (networkResponse && networkResponse.status === 200) {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_RUNTIME).then(cache => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                    return networkResponse;
                })
                .catch(() => {
                    // Se a rede falhar, tenta o cache
                    return caches.match(event.request)
                        .then(cachedResponse => {
                            if (cachedResponse) return cachedResponse;
                            // Fallback final: offline.html
                            return caches.match('/offline.html');
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
                    // Retorna do cache e atualiza em background
                    const fetchPromise = fetch(event.request)
                        .then(networkResponse => {
                            if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                                const responseToCache = networkResponse.clone();
                                caches.open(CACHE_RUNTIME).then(cache => {
                                    cache.put(event.request, responseToCache);
                                });
                            }
                            return networkResponse;
                        })
                        .catch(() => {});
                    return response;
                }

                const fetchRequest = event.request.clone();

                return fetch(fetchRequest).then(networkResponse => {
                    if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                        return networkResponse;
                    }

                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_RUNTIME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });

                    return networkResponse;
                }).catch(() => {
                    // Se for imagem, retorna placeholder
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

// ===== MENSAGENS DO APP (para forçar update) =====
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        caches.keys().then(names => Promise.all(names.map(n => caches.delete(n))));
    }
});

// ===== SINCRONIZAÇÃO EM BACKGROUND =====
self.addEventListener('sync', event => {
    if (event.tag === 'sync-trades') {
        event.waitUntil(syncTrades());
    }
});

async function syncTrades() {
    try {
        const trades = await getPendingTrades();
        for (const trade of trades) {
            await fetch('/api/sync-trade', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(trade)
            });
        }
    } catch (error) {
        console.log('[SW] Erro na sincronização:', error);
    }
}

async function getPendingTrades() {
    return [];
}

// ===== NOTIFICAÇÕES PUSH =====
self.addEventListener('push', event => {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'PLAY MY';
    const options = {
        body: data.body || 'Novas atualizações disponíveis!',
        icon: '/images/logo.png',
        badge: '/images/logo.png',
        vibrate: [200, 100, 200],
        data: {
            url: data.url || '/'
        }
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    const url = event.notification.data?.url || '/';
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
