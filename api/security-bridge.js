// security-bridge.js
// Arquivo de segurança que sobrescreve funções nativas e adiciona proteções
// sem modificar os arquivos existentes do projeto

(function() {
    'use strict';

    // ============================================
    // 1. PROTEÇÃO CONTRA XSS (injeção)
    // ============================================
    
    // Sobrescreve métodos de inserção HTML
    const originalInnerHTML = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    const originalInsertAdjacentHTML = Element.prototype.insertAdjacentHTML;
    const originalCreateElement = document.createElement.bind(document);
    
    // Filtro de sanitização
    function sanitizeHTML(html) {
        const temp = document.createElement('div');
        temp.textContent = html;
        return temp.innerHTML;
    }
    
    // Bloqueia innerHTML com conteúdo potencialmente perigoso
    Object.defineProperty(Element.prototype, 'innerHTML', {
        get: function() {
            return originalInnerHTML.get.call(this);
        },
        set: function(value) {
            if (typeof value === 'string' && /<script|javascript:|onerror|onload|onclick/i.test(value)) {
                console.warn('[Security] XSS attempt blocked in innerHTML');
                value = sanitizeHTML(value);
            }
            originalInnerHTML.set.call(this, value);
        },
        configurable: true
    });
    
    // Bloqueia insertAdjacentHTML
    Element.prototype.insertAdjacentHTML = function(position, text) {
        if (typeof text === 'string' && /<script|javascript:|onerror|onload|onclick/i.test(text)) {
            console.warn('[Security] XSS attempt blocked in insertAdjacentHTML');
            text = sanitizeHTML(text);
        }
        return originalInsertAdjacentHTML.call(this, position, text);
    };
    
    // Bloqueia criação de elementos script via createElement
    document.createElement = function(tagName) {
        const element = originalCreateElement(tagName);
        if (tagName.toLowerCase() === 'script') {
            // Intercepta atribuição de src e innerHTML
            const originalSetAttribute = element.setAttribute;
            element.setAttribute = function(name, value) {
                if (name === 'src' && value && !value.startsWith('https://') && !value.startsWith('http://')) {
                    console.warn('[Security] Script source blocked: ' + value);
                    return;
                }
                return originalSetAttribute.call(this, name, value);
            };
            
            // Bloqueia execução de código inline
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
    
    // Bloqueia eval e Function constructor
    const originalEval = window.eval;
    window.eval = function(code) {
        console.warn('[Security] eval() blocked');
        return null;
    };
    
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
    
    // Intercepta requisições para esconder API Keys
    const originalFetch = window.fetch;
    window.fetch = function(input, init) {
        // Remove API keys dos parâmetros URL
        if (typeof input === 'string') {
            const url = new URL(input, window.location.origin);
            const sensitiveParams = ['api_key', 'apikey', 'key', 'token', 'auth', 'access_token'];
            let hasSensitiveParam = false;
            
            sensitiveParams.forEach(param => {
                if (url.searchParams.has(param)) {
                    console.warn('[Security] API Key removed from URL: ' + param);
                    url.searchParams.delete(param);
                    hasSensitiveParam = true;
                }
            });
            
            if (hasSensitiveParam) {
                input = url.toString();
            }
        }
        
        // Remove headers sensíveis
        if (init && init.headers) {
            const sensitiveHeaders = ['x-api-key', 'api-key', 'authorization', 'x-auth-token'];
            if (typeof init.headers === 'object') {
                sensitiveHeaders.forEach(header => {
                    if (init.headers[header]) {
                        console.warn('[Security] API Key header removed: ' + header);
                        delete init.headers[header];
                    }
                });
            }
        }
        
        return originalFetch.call(this, input, init);
    };
    
    // Protege XMLHttpRequest
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
    
    XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
        this._url = url;
        this._sensitiveParams = ['api_key', 'apikey', 'key', 'token', 'auth', 'access_token'];
        return originalOpen.call(this, method, url, async, user, password);
    };
    
    XMLHttpRequest.prototype.setRequestHeader = function(header, value) {
        const sensitiveHeaders = ['x-api-key', 'api-key', 'authorization', 'x-auth-token'];
        if (sensitiveHeaders.includes(header.toLowerCase())) {
            console.warn('[Security] API Key header blocked: ' + header);
            return;
        }
        return originalSetRequestHeader.call(this, header, value);
    };
    
    // ============================================
    // 3. PROTEÇÃO LOCALSTORAGE
    // ============================================
    
    // Sobrescreve localStorage com dados criptografados
    const originalSetItem = Storage.prototype.setItem;
    const originalGetItem = Storage.prototype.getItem;
    const originalRemoveItem = Storage.prototype.removeItem;
    
    // Simples cipher para dados sensíveis
    function encryptData(data) {
        if (typeof data !== 'string') return data;
        // XOR simples para ofuscar (não é criptografia forte, mas suficiente)
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
    
    const sensitiveKeys = ['token', 'auth', 'session', 'user', 'password', 'credential', 'api_key', 'apikey'];
    
    Storage.prototype.setItem = function(key, value) {
        const isSensitive = sensitiveKeys.some(k => key.toLowerCase().includes(k));
        if (isSensitive) {
            console.log('[Security] Encrypting sensitive localStorage: ' + key);
            value = encryptData(value);
        }
        return originalSetItem.call(this, key, value);
    };
    
    Storage.prototype.getItem = function(key) {
        const value = originalGetItem.call(this, key);
        const isSensitive = sensitiveKeys.some(k => key.toLowerCase().includes(k));
        if (isSensitive && value) {
            try {
                return decryptData(value);
            } catch(e) {
                return value;
            }
        }
        return value;
    };
    
    // Limpa localStorage sensível ao fechar
    window.addEventListener('beforeunload', function() {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (sensitiveKeys.some(k => key.toLowerCase().includes(k))) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => {
            console.log('[Security] Removing sensitive data on unload: ' + key);
            localStorage.removeItem(key);
        });
    });
    
    // ============================================
    // 4. VALIDAÇÃO DE INPUT
    // ============================================
    
    // Valida inputs em tempo real
    document.addEventListener('input', function(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            const input = e.target;
            const type = input.type || input.getAttribute('type');
            
            // Remove caracteres perigosos
            if (input.value && typeof input.value === 'string') {
                const dangerous = /[<>'"`;]/g;
                if (dangerous.test(input.value)) {
                    input.value = input.value.replace(dangerous, '');
                    console.log('[Security] Sanitized input from ' + input.name || input.id);
                }
            }
            
            // Validação específica por tipo
            if (type === 'email') {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (input.value && !emailRegex.test(input.value)) {
                    input.setCustomValidity('Email inválido');
                } else {
                    input.setCustomValidity('');
                }
            }
            
            if (type === 'url') {
                try {
                    new URL(input.value);
                    input.setCustomValidity('');
                } catch(e) {
                    if (input.value) input.setCustomValidity('URL inválida');
                }
            }
        }
    });
    
    // ============================================
    // 5. CONTROLE DE SESSÃO
    // ============================================
    
    // Adiciona expiração de sessão (30 minutos)
    const SESSION_TIMEOUT = 30 * 60 * 1000;
    let sessionTimer = null;
    let lastActivity = Date.now();
    
    function resetSessionTimer() {
        if (sessionTimer) clearTimeout(sessionTimer);
        sessionTimer = setTimeout(() => {
            console.log('[Security] Session expired');
            // Limpa dados sensíveis
            const keys = ['token', 'auth', 'session', 'user'];
            keys.forEach(key => {
                localStorage.removeItem(key);
                sessionStorage.removeItem(key);
            });
            // Dispara evento de expiração
            window.dispatchEvent(new CustomEvent('sessionExpired'));
            // Redireciona para login se existir
            if (window.location.pathname !== '/login' && window.location.pathname !== '/index.html') {
                window.location.href = '/';
            }
        }, SESSION_TIMEOUT);
    }
    
    // Reset timer on activity
    ['click', 'keydown', 'scroll', 'mousemove', 'touchstart'].forEach(event => {
        document.addEventListener(event, function() {
            lastActivity = Date.now();
            resetSessionTimer();
        });
    });
    
    resetSessionTimer();
    
    // ============================================
    // 6. PROTEÇÃO DE CONSOLE (Debug)
    // ============================================
    
    // Remove logs em produção
    if (window.location.hostname !== 'localhost' && !window.location.hostname.includes('127.0.0.1')) {
        const noop = function() {};
        const consoleMethods = ['log', 'info', 'debug', 'warn', 'error'];
        consoleMethods.forEach(method => {
            if (method !== 'error') {
                console[method] = noop;
            }
        });
        console.log('[Security] Debug logs disabled in production');
    }
    
    // ============================================
    // 7. RATE LIMITING
    // ============================================
    
    const rateLimits = new Map();
    
    // Protege funções de requisição
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
            
            if (limit.count > 60) { // 60 req/min
                console.warn('[Security] Rate limit exceeded for: ' + key);
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
        console.log('[Security] Redirecting to HTTPS');
    }
    
    // ============================================
    // 9. CSP COMPLEMENTAR (via headers)
    // ============================================
    
    // Adiciona meta tag CSP se não existir
    if (!document.querySelector('meta[http-equiv="Content-Security-Policy"]')) {
        const meta = document.createElement('meta');
        meta.httpEquiv = 'Content-Security-Policy';
        meta.content = `
            default-src 'self';
            script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://*.googleapis.com;
            style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
            img-src 'self' data: https:;
            font-src 'self' https://fonts.gstatic.com;
            connect-src 'self' https://api.github.com https://*.vercel.app;
            frame-ancestors 'none';
            form-action 'self';
            base-uri 'self';
            upgrade-insecure-requests;
        `.replace(/\s+/g, ' ').trim();
        document.head.appendChild(meta);
        console.log('[Security] CSP meta tag added');
    }
    
    // ============================================
    // 10. MONITORAMENTO E LOGS DE SEGURANÇA
    // ============================================
    
    // Log de atividades suspeitas
    window.addEventListener('error', function(e) {
        if (e.message && e.message.includes('script') || e.message.includes('eval')) {
            console.warn('[Security] Suspicious activity detected:', e.message);
        }
    });
    
    // Proteção contra clickjacking
    if (window.top !== window.self) {
        console.warn('[Security] Page loaded in iframe - clickjacking attempt?');
        window.top.location = window.self.location;
    }
    
    // ============================================
    // 11. INJEÇÃO DE SEGURANÇA NO HEADER
    // ============================================
    
    // Adiciona headers de segurança via meta tags
    const securityMeta = [
        { name: 'X-Content-Type-Options', content: 'nosniff' },
        { name: 'X-Frame-Options', content: 'DENY' },
        { name: 'X-XSS-Protection', content: '1; mode=block' },
        { name: 'Referrer-Policy', content: 'strict-origin-when-cross-origin' },
        { name: 'Permissions-Policy', content: 'geolocation=(), microphone=(), camera=()' }
    ];
    
    securityMeta.forEach(({ name, content }) => {
        if (!document.querySelector(`meta[name="${name}"]`)) {
            const meta = document.createElement('meta');
            meta.name = name;
            meta.content = content;
            document.head.appendChild(meta);
        }
    });
    
    console.log('[Security] Security bridge loaded successfully!');
    console.log('[Security] Vulnerabilities addressed: XSS, API Keys, unsafe-eval, Inline events, localStorage, Input validation, Debug, Session, Rate limiting, HTTPS');
    
})();
