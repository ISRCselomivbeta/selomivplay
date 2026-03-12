// ========== SERVICE WORKER - SELO MIV v6.0.0 ==========
const CACHE_NAME = 'selo-miv-v6';
const urlsToCache = [
    '/',
    '/index.html',
    '/confirm-email.html',
    '/reset-password.html',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css',
    'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;700&display=swap',
    'https://github.com/ISRCselomivbeta/selomivplay/raw/main/images/logo.png'
];

// Instalar Service Worker - cache dos arquivos estáticos
self.addEventListener('install', event => {
    console.log('📦 Service Worker instalando...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('✅ Cache criado');
                return cache.addAll(urlsToCache);
            })
            .then(() => self.skipWaiting())
    );
});

// Ativar - limpar caches antigos
self.addEventListener('activate', event => {
    console.log('🚀 Service Worker ativado');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('🗑️ Removendo cache antigo:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Estratégia: Stale-While-Revalidate para navegação
self.addEventListener('fetch', event => {
    // Ignorar requisições de API e YouTube
    if (event.request.url.includes('/api/') || 
        event.request.url.includes('youtube.com') ||
        event.request.url.includes('googleapis.com')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                // Se tiver no cache, retorna e atualiza em background
                if (cachedResponse) {
                    // Atualizar cache em background
                    fetch(event.request)
                        .then(networkResponse => {
                            if (networkResponse && networkResponse.status === 200) {
                                const responseToCache = networkResponse.clone();
                                caches.open(CACHE_NAME)
                                    .then(cache => {
                                        cache.put(event.request, responseToCache);
                                    });
                            }
                        })
                        .catch(() => {});
                    
                    return cachedResponse;
                }

                // Se não tiver no cache, busca da rede
                return fetch(event.request)
                    .then(networkResponse => {
                        if (!networkResponse || networkResponse.status !== 200) {
                            return networkResponse;
                        }

                        // Salva no cache para próxima vez
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });

                        return networkResponse;
                    })
                    .catch(() => {
                        // Se falhar e for página HTML, mostra página offline
                        if (event.request.mode === 'navigate') {
                            return caches.match('/offline.html');
                        }
                    });
            })
    );
});

// Sincronização em background (para quando voltar online)
self.addEventListener('sync', event => {
    console.log('🔄 Sincronizando:', event.tag);
    
    if (event.tag === 'sync-trades') {
        event.waitUntil(syncTrades());
    }
    
    if (event.tag === 'sync-favorites') {
        event.waitUntil(syncFavorites());
    }
});

// Notificações push
self.addEventListener('push', event => {
    const options = {
        body: event.data ? event.data.text() : 'Nova atualização no SELO MIV!',
        icon: 'https://github.com/ISRCselomivbeta/selomivplay/raw/main/images/logo.png',
        badge: 'https://github.com/ISRCselomivbeta/selomivplay/raw/main/images/logo.png',
        vibrate: [200, 100, 200],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            {
                action: 'open',
                title: 'Abrir app'
            },
            {
                action: 'close',
                title: 'Fechar'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification('SELO MIV', options)
    );
});

// Clique na notificação
self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    if (event.action === 'open' || !event.action) {
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

// ===== FUNÇÕES DE SINCRONIZAÇÃO =====
async function syncTrades() {
    console.log('🔄 Sincronizando negociações pendentes...');
    
    try {
        // Buscar trades pendentes do IndexedDB
        const db = await openDatabase();
        const pendingTrades = await getPendingTrades(db);
        
        for (const trade of pendingTrades) {
            try {
                const response = await fetch('/api/sync-trade', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(trade)
                });
                
                if (response.ok) {
                    await markTradeAsSynced(db, trade.id);
                    console.log('✅ Trade sincronizado:', trade.id);
                }
            } catch (error) {
                console.log('❌ Erro ao sincronizar trade:', trade.id);
            }
        }
        
    } catch (error) {
        console.error('Erro na sincronização:', error);
    }
}

async function syncFavorites() {
    console.log('🔄 Sincronizando favoritos...');
    // Implementar sincronização de favoritos
}

// ===== INDEXEDDB PARA ARMAZENAMENTO OFFLINE =====
function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('SeloMIVOffline', 1);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        
        request.onupgradeneeded = event => {
            const db = event.target.result;
            
            if (!db.objectStoreNames.contains('pendingTrades')) {
                db.createObjectStore('pendingTrades', { keyPath: 'id' });
            }
            
            if (!db.objectStoreNames.contains('favorites')) {
                db.createObjectStore('favorites', { keyPath: 'id' });
            }
            
            if (!db.objectStoreNames.contains('playlist')) {
                db.createObjectStore('playlist', { keyPath: 'id' });
            }
        };
    });
}

async function getPendingTrades(db) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['pendingTrades'], 'readonly');
        const store = transaction.objectStore('pendingTrades');
        const request = store.getAll();
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

async function markTradeAsSynced(db, tradeId) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['pendingTrades'], 'readwrite');
        const store = transaction.objectStore('pendingTrades');
        const request = store.delete(tradeId);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
    });
}
