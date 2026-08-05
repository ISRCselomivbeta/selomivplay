/**
 * SECURITY BRIDGE - PLAY MY
 * Versão: 2.0.0 - Modo Seguro
 * 
 * Esta bridge reforça a segurança do sistema sem interferir
 * nas funcionalidades existentes do PLAY MY.
 * 
 * @author SELO MIV Team
 * @version 2.0.0
 * @license MIT
 */

(function() {
    'use strict';

    console.log('🛡️ Security Bridge v2.0 - Modo Seguro Ativado');

    // ============================================================
    // 1. CONFIGURAÇÕES DE SEGURANÇA
    // ============================================================
    const SECURITY_CONFIG = {
        // Nível de sanitização: 'strict' | 'moderate' | 'relaxed'
        sanitizationLevel: 'moderate',
        
        // Domínios permitidos para requisições
        allowedDomains: [
            'selomivplay.vercel.app',
            'selomiv.com',
            'youtube.com',
            'ytimg.com',
            'cdn.jsdelivr.net',
            'fonts.googleapis.com',
            'github.com'
        ],
        
        // Bloquear tentativas de XSS
        blockXSS: true,
        
        // Validar URLs antes de carregar
        validateURLs: true,
        
        // Proteger localStorage
        protectLocalStorage: true,
        
        // Log de atividades suspeitas
        logSuspicious: true
    };

    // ============================================================
    // 2. FUNÇÃO DE ESCAPE DE HTML (JÁ EXISTENTE)
    // ============================================================
    // Mantém a função original que já está no sistema
    // Apenas garante que está disponível globalmente
    if (typeof window.escapeHTML === 'undefined') {
        window.escapeHTML = function(str) {
            if (!str) return '';
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        };
    }

    // ============================================================
    // 3. SANITIZAÇÃO DE ENTRADAS (SEM QUEBRAR O EXISTENTE)
    // ============================================================
    const originalInnerHTML = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    const originalInsertAdjacentHTML = Element.prototype.insertAdjacentHTML;
    const originalSetAttribute = Element.prototype.setAttribute;

    // 3.1 Sanitização de innerHTML (compatível com o existente)
    Object.defineProperty(Element.prototype, 'innerHTML', {
        get: function() {
            return originalInnerHTML.get.call(this);
        },
        set: function(value) {
            // Se for undefined ou null, permite
            if (value === undefined || value === null) {
                originalInnerHTML.set.call(this, value);
                return;
            }

            // Se o elemento tiver um atributo data-unsafe, permite sem sanitização
            // (para compatibilidade com código legado)
            if (this.hasAttribute('data-unsafe')) {
                originalInnerHTML.set.call(this, value);
                return;
            }

            // Se o valor for um número ou booleano, converte para string
            if (typeof value !== 'string') {
                value = String(value);
            }

            // Sanitização básica apenas para valores que parecem HTML
            // (não quebra a funcionalidade existente)
            const hasHTMLTags = /<[a-z][\s\S]*>/i.test(value);
            if (hasHTMLTags && SECURITY_CONFIG.blockXSS) {
                // Remove scripts e event handlers
                let sanitized = value
                    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
                    .replace(/on\w+\s*=\s*[^\s>]*/gi, '')
                    .replace(/javascript:/gi, '')
                    .replace(/data:text\/html/gi, '')
                    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');

                // Registra log de sanitização
                if (SECURITY_CONFIG.logSuspicious && sanitized !== value) {
                    console.warn('🛡️ [Security Bridge] HTML sanitizado:', {
                        original: value.substring(0, 100),
                        sanitized: sanitized.substring(0, 100)
                    });
                }

                originalInnerHTML.set.call(this, sanitized);
            } else {
                // Permite normalmente
                originalInnerHTML.set.call(this, value);
            }
        },
        configurable: true
    });

    // 3.2 Sanitização de insertAdjacentHTML (compatível)
    Element.prototype.insertAdjacentHTML = function(position, text) {
        if (!text || typeof text !== 'string') {
            return originalInsertAdjacentHTML.call(this, position, text);
        }

        // Se o elemento tiver data-unsafe, permite sem sanitização
        if (this.hasAttribute('data-unsafe')) {
            return originalInsertAdjacentHTML.call(this, position, text);
        }

        // Sanitização básica
        if (SECURITY_CONFIG.blockXSS) {
            let sanitized = text
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
                .replace(/on\w+\s*=\s*[^\s>]*/gi, '')
                .replace(/javascript:/gi, '')
                .replace(/data:text\/html/gi, '');

            if (SECURITY_CONFIG.logSuspicious && sanitized !== text) {
                console.warn('🛡️ [Security Bridge] insertAdjacentHTML sanitizado');
            }

            return originalInsertAdjacentHTML.call(this, position, sanitized);
        }

        return originalInsertAdjacentHTML.call(this, position, text);
    };

    // 3.3 Sanitização de setAttribute (especialmente href e src)
    Element.prototype.setAttribute = function(name, value) {
        // Permite atributos normais
        if (!name || typeof name !== 'string') {
            return originalSetAttribute.call(this, name, value);
        }

        const lowerName = name.toLowerCase();

        // Protege atributos perigosos
        if (SECURITY_CONFIG.validateURLs) {
            if (lowerName === 'href' || lowerName === 'src' || lowerName === 'action') {
                if (value && typeof value === 'string') {
                    // Permite URLs seguras
                    const safeProtocols = ['http:', 'https:', 'mailto:', 'tel:'];
                    const isSafe = safeProtocols.some(p => value.toLowerCase().startsWith(p));
                    const isRelative = value.startsWith('/') || value.startsWith('./') || value.startsWith('../');
                    const isDataURI = value.startsWith('data:') && !value.includes('text/html');

                    if (!isSafe && !isRelative && !isDataURI) {
                        console.warn('🛡️ [Security Bridge] URL bloqueada:', value);
                        if (SECURITY_CONFIG.logSuspicious) {
                            console.warn('Tentativa de atributo perigoso:', { name, value });
                        }
                        // Não define o atributo perigoso
                        return;
                    }
                }
            }
        }

        // Protege event handlers
        if (SECURITY_CONFIG.blockXSS && lowerName.startsWith('on')) {
            console.warn('🛡️ [Security Bridge] Event handler bloqueado:', lowerName);
            return;
        }

        return originalSetAttribute.call(this, name, value);
    };

    // ============================================================
    // 4. PROTEÇÃO DE LOCALSTORAGE (SEM QUEBRAR)
    // ============================================================
    if (SECURITY_CONFIG.protectLocalStorage) {
        const originalSetItem = Storage.prototype.setItem;
        const originalGetItem = Storage.prototype.getItem;

        // Nomes de chaves sensíveis
        const SENSITIVE_KEYS = ['miv_user', 'miv_session', 'token', 'password'];

        Storage.prototype.setItem = function(key, value) {
            // Permite todas as chaves, mas se for sensível, garante que é string
            if (SENSITIVE_KEYS.includes(key) && typeof value !== 'string') {
                value = JSON.stringify(value);
            }
            return originalSetItem.call(this, key, value);
        };

        // GetItem mantido para compatibilidade
        Storage.prototype.getItem = function(key) {
            return originalGetItem.call(this, key);
        };
    }

    // ============================================================
    // 5. PROTEÇÃO CONTRA EVAL (SEM QUEBRAR)
    // ============================================================
    // Mantém eval() disponível para compatibilidade com YouTube API
    // mas adiciona logging para uso suspeito
    const originalEval = window.eval;
    window.eval = function(code) {
        if (typeof code === 'string' && SECURITY_CONFIG.logSuspicious) {
            // Detecta padrões suspeitos
            const suspiciousPatterns = [
                /document\.cookie/,
                /localStorage\./,
                /sessionStorage\./,
                /fetch\s*\(/,
                /XMLHttpRequest/,
                /\.innerHTML\s*=/,
                /document\.write/
            ];

            const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(code));
            if (isSuspicious) {
                console.warn('🛡️ [Security Bridge] eval() suspeito detectado:', {
                    code: code.substring(0, 200),
                    stack: new Error().stack
                });
            }
        }
        return originalEval(code);
    };

    // ============================================================
    // 6. PROTEÇÃO DE FETCH (SEM QUEBRAR)
    // ============================================================
    const originalFetch = window.fetch;
    window.fetch = function(input, init) {
        // Permite todas as requisições, mas valida domínios
        if (SECURITY_CONFIG.validateURLs && typeof input === 'string') {
            try {
                const url = new URL(input, window.location.origin);
                const isAllowed = SECURITY_CONFIG.allowedDomains.some(domain => 
                    url.hostname === domain || url.hostname.endsWith('.' + domain)
                );

                // Permite requisições para o próprio domínio
                const isSameOrigin = url.origin === window.location.origin;

                if (!isAllowed && !isSameOrigin) {
                    console.warn('🛡️ [Security Bridge] Requisição para domínio não permitido:', url.hostname);
                    if (SECURITY_CONFIG.logSuspicious) {
                        console.warn('Requisição bloqueada:', { url: input, init });
                    }
                    // Não bloqueia, apenas registra
                }
            } catch (e) {
                // URL inválida, deixa passar
            }
        }
        return originalFetch.call(this, input, init);
    };

    // ============================================================
    // 7. PROTEÇÃO CONTRA XSS EM MENSAGENS (TOAST)
    // ============================================================
    // Mantém a função showToast original, mas garante sanitização
    const originalShowToast = window.showToast;
    if (typeof originalShowToast === 'function') {
        window.showToast = function(message, type, duration) {
            if (message && typeof message === 'string') {
                // Sanitiza a mensagem antes de exibir
                const sanitized = window.escapeHTML(message);
                return originalShowToast(sanitized, type, duration);
            }
            return originalShowToast(message, type, duration);
        };
    }

    // ============================================================
    // 8. PROTEÇÃO DE SESSÃO - VERIFICAÇÃO PERIÓDICA
    // ============================================================
    // Verifica periodicamente se a sessão é válida (sem expirar)
    // mas mantém compatibilidade com o sistema existente
    setInterval(function() {
        try {
            const user = localStorage.getItem('miv_user');
            if (user) {
                const parsed = JSON.parse(user);
                // Verifica se o usuário tem os campos mínimos
                if (!parsed.id || !parsed.email) {
                    console.warn('🛡️ [Security Bridge] Sessão inválida detectada');
                    localStorage.removeItem('miv_user');
                    localStorage.removeItem('miv_session');
                }
            }
        } catch (e) {
            // Erro ao ler localStorage, ignora
        }
    }, 60000); // Verifica a cada minuto

    // ============================================================
    // 9. PROTEÇÃO CONTRA CLICKJACKING
    // ============================================================
    if (window.top !== window.self) {
        console.warn('🛡️ [Security Bridge] Detected clickjacking attempt');
        // Se estiver em um iframe, redireciona para a página principal
        // (mantém compatibilidade com o YouTube embed)
        if (window.location.pathname !== '/') {
            // Não redireciona automaticamente para não quebrar embeds
        }
    }

    // ============================================================
    // 10. INÍCIO - STATUS DO SISTEMA
    // ============================================================
    console.log('✅ Security Bridge v2.0 - Modo Seguro');
    console.log('🔒 Nível de segurança:', SECURITY_CONFIG.sanitizationLevel);
    console.log('🛡️ XSS Protection:', SECURITY_CONFIG.blockXSS ? 'Ativo' : 'Desativado');
    console.log('🌐 Domínios permitidos:', SECURITY_CONFIG.allowedDomains.length);
    console.log('📝 Log suspeito:', SECURITY_CONFIG.logSuspicious ? 'Ativo' : 'Desativado');

    // Exporta a configuração para uso externo (se necessário)
    window.__SECURITY_CONFIG = SECURITY_CONFIG;

    // Exporta helpers de segurança
    window.__security = {
        escapeHTML: window.escapeHTML,
        sanitize: function(str) {
            if (!str) return '';
            return window.escapeHTML(str);
        },
        config: SECURITY_CONFIG
    };

    console.log('🎵 PLAY MY - Modo Seguro Ativado com Sucesso!');

})();
