// ===== SERVICE WORKER - PLAY MY / SELO MIV =====
// Antes, o conteúdo do service worker também existia duplicado como uma
// string JS morta (`swContent`) dentro do index.html, nunca usada de fato —
// isso foi removido do index.html para não haver duas fontes de verdade.

const CACHE_NAME = 'selo-miv-v6.1';
const urlsToCache = [
    '/',
    '/index.html',
    '/offline.html',
    '/confirm-email.html',
    '/reset-password.html',
    '/security-bridge.js',
    '/manifest.json',
    '/images/logo.png',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css',
    'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;700&display=swap'
];

// Instalar Service Worker
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] Cache aberto');
                // Promise.allSettled evita que a instalação inteira falhe
                // caso um único recurso (ex: um CDN externo) esteja fora do ar
                return Promise.allSettled(
                    urlsToCache.map(url => cache.add(url).catch(err => {
                        console.warn('[SW] Falha ao cachear (ignorado):', url, err);
                    }))
                );
            })
    );
    self.skipWaiting();
});

// Interceptar requisições (cache-first com fallback de rede)
self.addEventListener('fetch', event => {
    // Nunca interceptar API/backend, YouTube ou Google APIs — precisam
    // sempre ser buscados em tempo real, nunca vir do cache
    if (
        event.request.method !== 'GET' ||
        event.request.url.includes('/api/') ||
        event.request.url.includes('youtube.com') ||
        event.request.url.includes('youtube-nocookie.com') ||
        event.request.url.includes('googleapis.com') ||
        event.request.url.includes('googleusercontent.com') ||
        event.request.url.includes('script.google.com')
    ) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }

                const fetchRequest = event.request.clone();

                return fetch(fetchRequest).then(networkResponse => {
                    if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                        return networkResponse;
                    }

                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });

                    return networkResponse;
                }).catch(() => {
                    // Sem rede: se for navegação de página, mostra offline.html
                    // (arquivo real do projeto)
                    if (event.request.mode === 'navigate') {
                        return caches.match('/offline.html');
                    }
                });
            })
    );
});

// Limpar caches antigos ao ativar uma nova versão
self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Sincronização em background (mantido do projeto original, para negociações pendentes)
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
    // Implementar lógica para buscar trades pendentes do IndexedDB, se desejar
    return [];
}
