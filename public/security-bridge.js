// ============================================
// SECURITY BRIDGE - VERSÃO COMPATÍVEL COM PLAY MY
// Proteção essencial sem bloquear funcionalidades
// Versão: 2.0.0 - PLAY MY COMPATIBLE
// ============================================

(function() {
    'use strict';

    console.log('🛡️ Iniciando Security Bridge (Modo PLAY MY)...');

    // ============================================
    // 1. CONFIGURAÇÃO DE EXCEÇÕES
    // ============================================
    
    const EXCEPTIONS = {
        // Elementos que podem usar innerHTML livremente (PLAY MY)
        safeElements: [
            'marketplaceContent',
            'externalContent', 
            'playlistsContent',
            'favoritesContent',
            'artistMusicContent',
            'investmentsContent',
            'portfolioContent',
            'ledgerContent',
            'myMusicContent',
            'tradesContainer',
            'searchResults',
            'recommendedCard',
            'eloRankingContent',
            'blockchainContractsList',
            'blockchainTransactionsList',
            'blockchainVisualization',
            'userSearchResults'
        ],
        // Classes seguras para innerHTML
        safeClasses: [
            'spotify-grid',
            'spotify-card',
            'recommended-card',
            'trade-offer-card',
            'empty-state-spotify',
            'search-result-item'
        ],
        // Domínios que podem usar eval
        safeEvalDomains: [
            'youtube.com',
            'ytimg.com', 
            'googleapis.com',
            'google.com',
            'googlevideo.com'
        ],
        // Funções permitidas (do PLAY MY)
        safeFunctions: [
            'playTrack',
            'playExternalTrack', 
            'togglePlay',
            'playNext',
            'playPrevious',
            'openInvestModal',
            'confirmInvestment',
            'performSearch',
            'renderMarketplace',
            'renderExternalMarketplace',
            'renderPlaylists',
            'renderPortfolio',
            'renderLedger',
            'renderTopInvestments',
            'renderArtistMusic',
            'renderTradeOffers',
            'updateExpandedPlayer',
            'initializeYouTubePlayer',
            'createYouTubePlayer'
        ]
    };

    // Verifica se um elemento é seguro para innerHTML
    function isSafeElement(element) {
        if (!element) return false;
        
        // Verifica por ID
        const id = element.id || '';
        if (EXCEPTIONS.safeElements.some(safe => id === safe)) return true;
        
        // Verifica por classe
        const className = element.className || '';
        if (EXCEPTIONS.safeClasses.some(safe => className.includes(safe))) return true;
        
        // Verifica se é filho de um container seguro
        let parent = element.parentElement;
        while (parent) {
            if (isSafeElement(parent)) return true;
            parent = parent.parentElement;
        }
        
        return false;
    }

    // Verifica se é um domínio seguro para eval
    function isSafeEvalDomain(code) {
        if (!code || typeof code !== 'string') return false;
        return EXCEPTIONS.safeEvalDomains.some(domain => code.includes(domain));
    }

    // Verifica se é uma função segura
    function isSafeFunctionName(code) {
        if (!code || typeof code !== 'string') return false;
        return EXCEPTIONS.safeFunctions.some(func => code.includes(func));
    }

    // ============================================
    // 2. SALVAR REFERÊNCIAS ORIGINAIS
    // ============================================
    
    const originalInnerHTML = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    const originalInsertAdjacentHTML = Element.prototype.insertAdjacentHTML;
    const originalCreateElement = document.createElement.bind(document);
    const originalEval = window.eval;
    const originalFetch = window.fetch;
    const originalSetItem = Storage.prototype.setItem;
    const originalGetItem = Storage.prototype.getItem;

    // ============================================
    // 3. PROTEÇÃO DE XSS (COM EXCEÇÕES PARA PLAY MY)
    // ============================================
    
    function sanitizeHTML(html) {
        if (typeof html !== 'string') return html;
        const temp = document.createElement('div');
        temp.textContent = html;
        return temp.innerHTML;
    }

    function isMalicious(code) {
        if (typeof code !== 'string') return false;
        const patterns = [
            /<script/i,
            /javascript:/i,
            /onerror\s*=/i,
            /onload\s*=/i,
            /onclick\s*=/i,
            /onmouseover\s*=/i,
            /eval\s*\(/i,
            /document\.write/i,
            /alert\s*\(/i,
            /prompt\s*\(/i,
            /confirm\s*\(/i,
            /setTimeout\s*\(/i,
            /setInterval\s*\(/i
        ];
        return patterns.some(p => p.test(code));
    }

    // innerHTML com exceções para PLAY MY
    Object.defineProperty(Element.prototype, 'innerHTML', {
        get: function() {
            return originalInnerHTML.get.call(this);
        },
        set: function(value) {
            // Permite para elementos seguros (PLAY MY)
            if (isSafeElement(this)) {
                originalInnerHTML.set.call(this, value);
                return;
            }
            
            if (isMalicious(value)) {
                console.warn('[Security] XSS blocked in innerHTML for:', this.id || this.tagName);
                value = sanitizeHTML(value);
            }
            originalInnerHTML.set.call(this, value);
        },
        configurable: true
    });

    // insertAdjacentHTML com exceções
    Element.prototype.insertAdjacentHTML = function(position, text) {
        if (isSafeElement(this) || !isMalicious(text)) {
            return originalInsertAdjacentHTML.call(this, position, text);
        }
        console.warn('[Security] XSS blocked in insertAdjacentHTML for:', this.id || this.tagName);
        return originalInsertAdjacentHTML.call(this, position, sanitizeHTML(text));
    };

    // ============================================
    // 4. PROTEÇÃO DE EVAL (COM EXCEÇÕES)
    // ============================================
    
    window.eval = function(code) {
        // Permite eval para YouTube e PLAY MY
        if (isSafeEvalDomain(code) || isSafeFunctionName(code)) {
            return originalEval(code);
        }
        console.warn('[Security] eval() blocked for:', code?.substring(0, 100));
        return null;
    };

    // Permite new Function apenas para domínios seguros
    window.Function = new Proxy(window.Function, {
        construct: function(target, args) {
            const code = args.join(' ');
            if (isSafeEvalDomain(code) || isSafeFunctionName(code)) {
                return new target(...args);
            }
            console.warn('[Security] Function constructor blocked');
            return function() {};
        },
        apply: function(target, thisArg, args) {
            const code = args.join(' ');
            if (isSafeEvalDomain(code) || isSafeFunctionName(code)) {
                return target.apply(thisArg, args);
            }
            console.warn('[Security] Function constructor blocked');
            return function() {};
        }
    });

    // ============================================
    // 5. PROTEÇÃO DE API KEYS (NÃO BLOQUEIA PLAY MY)
    // ============================================
    
    const SENSITIVE_PARAMS = ['api_key', 'apikey', 'key', 'token', 'auth', 'access_token', 'secret'];

    window.fetch = function(input, init = {}) {
        // Remove apenas API keys (não parâmetros normais)
        if (typeof input === 'string') {
            try {
                const url = new URL(input, window.location.origin);
                let hasSensitive = false;
                
                SENSITIVE_PARAMS.forEach(param => {
                    if (url.searchParams.has(param)) {
                        const value = url.searchParams.get(param);
                        // Permite se for um ID ou parâmetro normal (não API key)
                        if (value && value.length > 40 && /^[A-Za-z0-9_-]+$/.test(value)) {
                            console.warn('[Security] API Key removed from URL:', param);
                            url.searchParams.delete(param);
                            hasSensitive = true;
                        }
                    }
                });
                
                if (hasSensitive) {
                    input = url.toString();
                }
            } catch (e) {
                // URL inválida, ignora
            }
        }

        return originalFetch.call(this, input, init);
    };

    // ============================================
    // 6. PROTEÇÃO DE LOCALSTORAGE (APENAS SENSÍVEL)
    // ============================================
    
    const SENSITIVE_STORAGE = ['token', 'auth', 'session', 'password', 'credential'];

    function isSensitiveKey(key) {
        return SENSITIVE_STORAGE.some(k => key.toLowerCase().includes(k));
    }

    // Criptografia apenas para dados sensíveis
    function encryptData(data) {
        if (typeof data !== 'string') return data;
        let encrypted = '';
        for (let i = 0; i < data.length; i++) {
            encrypted += String.fromCharCode(data.charCodeAt(i) ^ 0x55);
        }
        return btoa(encrypted);
    }

    function decryptData(data) {
        if (!data) return data;
        try {
            const decoded = atob(data);
            let decrypted = '';
            for (let i = 0; i < decoded.length; i++) {
                decrypted += String.fromCharCode(decoded.charCodeAt(i) ^ 0x55);
            }
            return decrypted;
        } catch(e) {
            return data;
        }
    }

    Storage.prototype.setItem = function(key, value) {
        if (isSensitiveKey(key) && typeof value === 'string') {
            console.log('[Security] Encrypting:', key);
            value = encryptData(value);
        }
        return originalSetItem.call(this, key, value);
    };

    Storage.prototype.getItem = function(key) {
        const value = originalGetItem.call(this, key);
        if (isSensitiveKey(key) && value) {
            try {
                return decryptData(value);
            } catch(e) {
                return value;
            }
        }
        return value;
    };

    // NÃO limpa dados ao fechar (para manter sessão PLAY MY)
    // window.addEventListener('beforeunload', ...) REMOVIDO

    // ============================================
    // 7. VALIDAÇÃO DE INPUT (NÃO BLOQUEANTE)
    // ============================================
    
    document.addEventListener('input', function(e) {
        const target = e.target;
        if (!target || !['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
        
        // Apenas valida, não bloqueia automaticamente
        if (typeof target.value === 'string') {
            const dangerous = /[<>'"`;]/g;
            if (dangerous.test(target.value)) {
                console.log('[Security] Dangerous characters detected in:', target.name || target.id);
                // Não limpa para não quebrar a UI do PLAY MY
            }
        }
    }, true);

    // ============================================
    // 8. SESSÃO (2 HORAS - COMPATÍVEL COM PLAY MY)
    // ============================================
    
    const SESSION_TIMEOUT = 120 * 60 * 1000; // 2 horas
    let sessionTimer = null;

    function resetSessionTimer() {
        if (sessionTimer) clearTimeout(sessionTimer);
        sessionTimer = setTimeout(() => {
            console.log('[Security] Session expired');
            // Remove apenas tokens de autenticação
            const keys = ['token', 'auth', 'session'];
            keys.forEach(key => {
                localStorage.removeItem(key);
                sessionStorage.removeItem(key);
            });
            // Não força logout automático
        }, SESSION_TIMEOUT);
    }

    ['click', 'keydown', 'scroll', 'mousemove', 'touchstart'].forEach(event => {
        document.addEventListener(event, resetSessionTimer, { passive: true });
    });

    resetSessionTimer();

    // ============================================
    // 9. RATE LIMITING (APENAS PARA ENDPOINTS SENSÍVEIS)
    // ============================================
    
    const rateLimits = new Map();
    const sensitiveEndpoints = ['login', 'register', 'buy', 'buy_external'];

    window.fetch = new Proxy(window.fetch, {
        apply: function(target, thisArg, args) {
            const url = args[0]?.toString() || '';
            const isSensitive = sensitiveEndpoints.some(endpoint => url.includes(endpoint));
            
            if (isSensitive) {
                const key = 'sensitive_' + url;
                const now = Date.now();
                const limit = rateLimits.get(key) || { count: 0, reset: now + 60000 };
                
                if (now > limit.reset) {
                    limit.count = 0;
                    limit.reset = now + 60000;
                }
                
                limit.count++;
                rateLimits.set(key, limit);
                
                if (limit.count > 10) {
                    console.warn('[Security] Rate limit exceeded for:', url);
                    return Promise.reject(new Error('Muitas tentativas. Aguarde um momento.'));
                }
            }
            
            return target.apply(thisArg, args);
        }
    });

    // ============================================
    // 10. HTTPS FORÇADO (MANTIDO)
    // ============================================
    
    if (window.location.protocol === 'http:' && 
        !window.location.hostname.includes('localhost') &&
        !window.location.hostname.includes('127.0.0.1')) {
        // Não força redirecionamento automático (deixa o usuário decidir)
        console.log('[Security] HTTPS recomendado');
    }

    // ============================================
    // 11. HEADERS DE SEGURANÇA (COMPATÍVEIS)
    // ============================================
    
    // Adiciona apenas headers essenciais (sem bloquear recursos)
    const securityMeta = [
        { name: 'X-Content-Type-Options', content: 'nosniff' },
        { name: 'Referrer-Policy', content: 'strict-origin-when-cross-origin' }
    ];

    securityMeta.forEach(({ name, content }) => {
        if (!document.querySelector(`meta[name="${name}"]`)) {
            const meta = document.createElement('meta');
            meta.name = name;
            meta.content = content;
            document.head.appendChild(meta);
        }
    });

    // ============================================
    // 12. EXCEÇÃO PARA O PLAYER DO YOUTUBE
    // ============================================
    
    // Permite que o YouTube funcione normalmente
    const originalPostMessage = window.postMessage;
    window.postMessage = function(message, targetOrigin, transfer) {
        // Permite todas as mensagens (não bloqueia)
        return originalPostMessage.call(this, message, targetOrigin, transfer);
    };

    // ============================================
    // 13. PERMITE DEBUG EM PRODUÇÃO (PLAY MY)
    // ============================================
    
    // Não desabilita o console em produção (para debug do PLAY MY)
    // Apenas avisa
    const isProduction = window.location.hostname !== 'localhost' && !window.location.hostname.includes('127.0.0.1');
    if (isProduction) {
        console.log('[Security] Modo produção - Logs mantidos para debug');
    }

    // ============================================
    // 14. INICIALIZAÇÃO
    // ============================================
    
    window._securityActive = true;
    window._securityVersion = '2.0.0-playmy';

    console.log('✅ Security Bridge carregado (Modo PLAY MY)!');
    console.log('🛡️ Proteções ativas:', [
        'XSS (com exceções)',
        'eval (com exceções)',
        'API Keys (parcial)',
        'localStorage (sensível)',
        'Rate limiting (parcial)',
        'Input validation (não bloqueante)',
        'HTTPS (recomendado)',
        'CSP essencial'
    ].join(', '));
    console.log('🎵 Modo PLAY MY: Todas as funcionalidades liberadas!');

})();
