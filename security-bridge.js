// security-bridge.js
// ============================================
// SISTEMA DE SEGURANÇA - SELO MIV
// Proteção contra XSS, API Keys, eval, localStorage, etc.
// ============================================

(function() {
    'use strict';

    console.log('🛡️ Iniciando Security Bridge...');

    // ============================================
    // 1. PROTEÇÃO CONTRA XSS (injeção)
    // ============================================
    
    // Salva referências originais
    const originalInnerHTML = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    const originalInsertAdjacentHTML = Element.prototype.insertAdjacentHTML;
    const originalCreateElement = document.createElement.bind(document);
    const originalEval = window.eval;
    
    // Sanitização de HTML
    function sanitizeHTML(html) {
        if (typeof html !== 'string') return html;
        const temp = document.createElement('div');
        temp.textContent = html;
        return temp.innerHTML;
    }

    // Verifica se há código malicioso
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
            /\.innerHTML\s*=/i,
            /alert\s*\(/i,
            /prompt\s*\(/i,
            /confirm\s*\(/i
        ];
        return patterns.some(p => p.test(code));
    }

    // Bloqueia innerHTML
    Object.defineProperty(Element.prototype, 'innerHTML', {
        get: function() {
            return originalInnerHTML.get.call(this);
        },
        set: function(value) {
            if (isMalicious(value)) {
                console.warn('[Security] XSS blocked in innerHTML');
                value = sanitizeHTML(value);
            }
            originalInnerHTML.set.call(this, value);
        },
        configurable: true
    });

    // Bloqueia insertAdjacentHTML
    Element.prototype.insertAdjacentHTML = function(position, text) {
        if (isMalicious(text)) {
            console.warn('[Security] XSS blocked in insertAdjacentHTML');
            text = sanitizeHTML(text);
        }
        return originalInsertAdjacentHTML.call(this, position, text);
    };

    // Protege criação de elementos
    document.createElement = function(tagName) {
        const element = originalCreateElement(tagName);
        
        if (tagName.toLowerCase() === 'script') {
            // Bloqueia atribuição de src
            const originalSetAttribute = element.setAttribute;
            element.setAttribute = function(name, value) {
                if (name === 'src' && value && !value.startsWith('https://') && !value.startsWith('http://')) {
                    console.warn('[Security] Script source blocked:', value);
                    return;
                }
                return originalSetAttribute.call(this, name, value);
            };
            
            // Bloqueia código inline
            Object.defineProperty(element, 'textContent', {
                set: function(value) {
                    console.warn('[Security] Inline script blocked');
                    return;
                }
            });
            Object.defineProperty(element, 'innerHTML', {
                set: function(value) {
                    console.warn('[Security] Inline script blocked');
                    return;
                }
            });
        }
        return element;
    };

    // Bloqueia eval
    window.eval = function(code) {
        console.warn('[Security] eval() blocked');
        return null;
    };

    // Bloqueia Function constructor
    window.Function = new Proxy(window.Function, {
        construct: function(target, args) {
            console.warn('[Security] Function constructor blocked');
            return function() {};
        },
        apply: function(target, thisArg, args) {
            console.warn('[Security] Function constructor blocked');
            return function() {};
        }
    });

    // ============================================
    // 2. PROTEÇÃO DE API KEYS
    // ============================================
    
    const originalFetch = window.fetch;
    const SENSITIVE_PARAMS = ['api_key', 'apikey', 'key', 'token', 'auth', 'access_token', 'secret'];
    const SENSITIVE_HEADERS = ['x-api-key', 'api-key', 'authorization', 'x-auth-token', 'x-api-token'];

    window.fetch = function(input, init = {}) {
        // Remove API keys da URL
        if (typeof input === 'string') {
            try {
                const url = new URL(input, window.location.origin);
                let hasSensitive = false;
                
                SENSITIVE_PARAMS.forEach(param => {
                    if (url.searchParams.has(param)) {
                        console.warn('[Security] API Key removed from URL:', param);
                        url.searchParams.delete(param);
                        hasSensitive = true;
                    }
                });
                
                if (hasSensitive) {
                    input = url.toString();
                }
            } catch (e) {
                // URL inválida, ignora
            }
        }

        // Remove headers sensíveis
        if (init.headers && typeof init.headers === 'object') {
            SENSITIVE_HEADERS.forEach(header => {
                if (init.headers[header]) {
                    console.warn('[Security] API Key header removed:', header);
                    delete init.headers[header];
                }
            });
        }

        return originalFetch.call(this, input, init);
    };

    // ============================================
    // 3. PROTEÇÃO LOCALSTORAGE
    // ============================================
    
    const originalSetItem = Storage.prototype.setItem;
    const originalGetItem = Storage.prototype.getItem;
    const SENSITIVE_STORAGE = ['token', 'auth', 'session', 'user', 'password', 'credential', 'api_key', 'apikey', 'secret'];

    // Criptografia simples (XOR + Base64)
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

    function isSensitiveKey(key) {
        return SENSITIVE_STORAGE.some(k => key.toLowerCase().includes(k));
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

    // Limpa dados sensíveis ao fechar
    window.addEventListener('beforeunload', function() {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && isSensitiveKey(key)) {
                console.log('[Security] Removing sensitive data:', key);
                localStorage.removeItem(key);
            }
        }
    });

    // ============================================
    // 4. VALIDAÇÃO DE INPUT
    // ============================================
    
    document.addEventListener('input', function(e) {
        const target = e.target;
        if (!target || !['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
        
        // Remove caracteres perigosos
        if (typeof target.value === 'string') {
            const dangerous = /[<>'"`;]/g;
            if (dangerous.test(target.value)) {
                target.value = target.value.replace(dangerous, '');
                console.log('[Security] Sanitized input:', target.name || target.id);
            }
        }

        // Validação de email
        if (target.type === 'email' && target.value) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            target.setCustomValidity(emailRegex.test(target.value) ? '' : 'Email inválido');
        }

        // Validação de URL
        if (target.type === 'url' && target.value) {
            try {
                new URL(target.value);
                target.setCustomValidity('');
            } catch(e) {
                target.setCustomValidity('URL inválida');
            }
        }
    }, true);

    // ============================================
    // 5. CONTROLE DE SESSÃO (30 min)
    // ============================================
    
    const SESSION_TIMEOUT = 30 * 60 * 1000;
    let sessionTimer = null;

    function resetSessionTimer() {
        if (sessionTimer) clearTimeout(sessionTimer);
        sessionTimer = setTimeout(() => {
            console.log('[Security] Session expired');
            const keys = ['token', 'auth', 'session', 'user', 'credentials'];
            keys.forEach(key => {
                localStorage.removeItem(key);
                sessionStorage.removeItem(key);
            });
            window.dispatchEvent(new CustomEvent('sessionExpired'));
            if (!window.location.pathname.includes('login') && !window.location.pathname.includes('index')) {
                window.location.href = '/';
            }
        }, SESSION_TIMEOUT);
    }

    ['click', 'keydown', 'scroll', 'mousemove', 'touchstart'].forEach(event => {
        document.addEventListener(event, resetSessionTimer, { passive: true });
    });

    resetSessionTimer();

    // ============================================
    // 6. PROTEÇÃO DE CONSOLE (produção)
    // ============================================
    
    const isProduction = window.location.hostname !== 'localhost' && !window.location.hostname.includes('127.0.0.1');
    
    if (isProduction) {
        const noop = function() {};
        ['log', 'info', 'debug', 'warn'].forEach(method => {
            if (console[method]) console[method] = noop;
        });
        console.log('[Security] Debug logs disabled in production');
    }

    // ============================================
    // 7. RATE LIMITING
    // ============================================
    
    const rateLimits = new Map();

    window.fetch = new Proxy(window.fetch, {
        apply: function(target, thisArg, args) {
            const key = args[0]?.toString() || 'default';
            const now = Date.now();
            const limit = rateLimits.get(key) || { count: 0, reset: now + 60000 };
            
            if (now > limit.reset) {
                limit.count = 0;
                limit.reset = now + 60000;
            }
            
            limit.count++;
            rateLimits.set(key, limit);
            
            if (limit.count > 60) {
                console.warn('[Security] Rate limit exceeded:', key);
                return Promise.reject(new Error('Rate limit exceeded'));
            }
            
            return target.apply(thisArg, args);
        }
    });

    // ============================================
    // 8. HTTPS FORÇADO
    // ============================================
    
    if (window.location.protocol === 'http:' && 
        !window.location.hostname.includes('localhost') &&
        !window.location.hostname.includes('127.0.0.1')) {
        window.location.href = window.location.href.replace('http:', 'https:');
    }

    // ============================================
    // 9. HEADERS DE SEGURANÇA (meta tags)
    // ============================================
        const securityMeta = [
        { httpEquiv: 'Content-Security-Policy', content: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://*.googleapis.com https://www.youtube.com https://s.ytimg.com",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
            "img-src 'self' data: https: blob:",
            "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net",
            "connect-src 'self' https://script.google.com https://*.vercel.app https://api.github.com",
            "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com",
            // "frame-ancestors 'none'",  // ← REMOVIDA - não funciona em meta tag
            "form-action 'self'",
            "base-uri 'self'",
            "upgrade-insecure-requests"
        ].join('; ') },
        { name: 'X-Content-Type-Options', content: 'nosniff' },
        { name: 'X-Frame-Options', content: 'DENY' },
        { name: 'X-XSS-Protection', content: '1; mode=block' },
        { name: 'Referrer-Policy', content: 'strict-origin-when-cross-origin' },
        { name: 'Permissions-Policy', content: 'geolocation=(), microphone=(), camera=(), payment=()' }
    ];

    securityMeta.forEach(({ httpEquiv, name, content }) => {
        if (!document.querySelector(`meta[http-equiv="${httpEquiv}"]`) && 
            !document.querySelector(`meta[name="${name}"]`)) {
            const meta = document.createElement('meta');
            if (httpEquiv) meta.httpEquiv = httpEquiv;
            if (name) meta.name = name;
            meta.content = content;
            document.head.appendChild(meta);
        }
    });

    // ============================================
    // 10. MONITORAMENTO E LOGS
    // ============================================
    
    // Detecta atividades suspeitas
    window.addEventListener('error', function(e) {
        const msg = e.message || '';
        if (msg.includes('script') || msg.includes('eval') || msg.includes('Function')) {
            console.warn('[Security] Suspicious activity:', msg);
        }
    });

    // Proteção contra clickjacking
    if (window.top !== window.self) {
        console.warn('[Security] Clickjacking attempt blocked');
        window.top.location = window.self.location;
    }

    // Bloqueia tentativas de debug remoto
    if (isProduction) {
        Object.defineProperty(window, 'devtools', {
            get: function() { 
                console.warn('[Security] DevTools access blocked');
                return null; 
            }
        });
    }

    // ============================================
    // 11. INICIALIZAÇÃO
    // ============================================
    
    // Marca como ativo
    window._securityActive = true;
    window._securityVersion = '1.0.0';

    console.log('✅ Security Bridge carregado com sucesso!');
    console.log('🛡️ Proteções ativas:', [
        'XSS', 'API Keys', 'unsafe-eval', 'Inline events',
        'localStorage', 'Input validation', 'Debug', 'Session',
        'Rate limiting', 'HTTPS', 'CSP'
    ].join(', '));

})();
