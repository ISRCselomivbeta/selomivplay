/**
 * BACKEND CONFIG - PLAY MY
 * Versão: 2.0.0 - Modo Seguro
 * 
 * Configuração centralizada para comunicação com o backend,
 * com suporte a múltiplos ambientes e proteções de segurança.
 * 
 * @author SELO MIV Team
 * @version 2.0.0
 * @license MIT
 */

(function() {
    'use strict';

    // ============================================================
    // 1. CONFIGURAÇÃO BASE
    // ============================================================
    
    /**
     * Configuração principal do backend
     * A URL é definida dinamicamente baseada no ambiente
     */
    const BACKEND_CONFIG = {
        // Versão da API
        VERSION: '6.6.2',
        
        // Timeout padrão para requisições (ms)
        TIMEOUT: 30000,
        
        // Número máximo de tentativas em caso de falha
        MAX_RETRIES: 3,
        
        // Modo offline (apenas para desenvolvimento)
        OFFLINE_MODE: false,
        
        // Headers padrão para todas as requisições
        DEFAULT_HEADERS: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        },
        
        // Domínios permitidos para CORS
        ALLOWED_ORIGINS: [
            'https://playmy.com.br',
            'https://www.playmy.com.br',
            'https://selomivplay.vercel.app',
            'http://localhost:3000',
            'http://localhost:5500'
        ],
        
        // Rotas públicas (não requerem autenticação)
        PUBLIC_ROUTES: [
            'login',
            'register',
            'resend_confirmation',
            'confirm_email',
            'get_musicas',
            'get_external_musicas',
            'get_top_investments',
            'search_youtube',
            'get_youtube_stats'
        ]
    };

    // ============================================================
    // 2. DETECÇÃO DE AMBIENTE
    // ============================================================
    
    /**
     * Detecta o ambiente atual e define a URL da API
     */
    function detectEnvironment() {
        const hostname = window.location.hostname;
        const protocol = window.location.protocol;
        
        // Ambientes conhecidos
        const environments = {
            // Produção - playmy.com.br
            'playmy.com.br': {
                apiUrl: 'https://playmy.com.br/api/backend',
                environment: 'production',
                debug: false
            },
            'www.playmy.com.br': {
                apiUrl: 'https://playmy.com.br/api/backend',
                environment: 'production',
                debug: false
            },
            
            // Vercel - selomivplay
            'selomivplay.vercel.app': {
                apiUrl: 'https://selomivplay.vercel.app/api/backend',
                environment: 'production',
                debug: false
            },
            
            // Localhost (desenvolvimento)
            'localhost': {
                apiUrl: 'http://localhost:3000/api/backend',
                environment: 'development',
                debug: true
            },
            '127.0.0.1': {
                apiUrl: 'http://localhost:3000/api/backend',
                environment: 'development',
                debug: true
            }
        };

        // Tenta encontrar o ambiente atual
        let env = environments[hostname];
        
        // Se não encontrou, tenta com fallback
        if (!env) {
            // Se for subdomínio de playmy.com.br
            if (hostname.endsWith('playmy.com.br')) {
                env = {
                    apiUrl: 'https://playmy.com.br/api/backend',
                    environment: 'production',
                    debug: false
                };
            } 
            // Se for subdomínio de vercel.app
            else if (hostname.endsWith('vercel.app')) {
                env = {
                    apiUrl: 'https://selomivplay.vercel.app/api/backend',
                    environment: 'production',
                    debug: false
                };
            }
            // Fallback genérico
            else {
                env = {
                    apiUrl: `${protocol}//${hostname}/api/backend`,
                    environment: 'unknown',
                    debug: true
                };
            }
        }

        return env;
    }

    // ============================================================
    // 3. CONFIGURAÇÃO DINÂMICA
    // ============================================================
    
    const environment = detectEnvironment();
    
    // Atualiza a URL da API baseada no ambiente
    BACKEND_CONFIG.API_URL = environment.apiUrl;
    BACKEND_CONFIG.ENVIRONMENT = environment.environment;
    BACKEND_CONFIG.DEBUG = environment.debug;

    // ============================================================
    // 4. FUNÇÕES DE VALIDAÇÃO
    // ============================================================
    
    /**
     * Valida se uma URL é segura para requisição
     */
    function isValidApiUrl(url) {
        if (!url || typeof url !== 'string') return false;
        
        try {
            const parsed = new URL(url);
            
            // Protocolo deve ser HTTPS em produção
            if (BACKEND_CONFIG.ENVIRONMENT === 'production' && parsed.protocol !== 'https:') {
                console.warn('⚠️ [Backend Config] URL não usa HTTPS em produção:', url);
                return false;
            }
            
            // Domínio deve ser permitido
            const isAllowed = BACKEND_CONFIG.ALLOWED_ORIGINS.some(origin => {
                try {
                    const originUrl = new URL(origin);
                    return originUrl.hostname === parsed.hostname;
                } catch {
                    return false;
                }
            });
            
            // Se não for localhost, deve estar na lista de permitidos
            if (parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1' && !isAllowed) {
                console.warn('⚠️ [Backend Config] Domínio não permitido:', parsed.hostname);
                return false;
            }
            
            return true;
        } catch (error) {
            console.error('❌ [Backend Config] URL inválida:', url, error);
            return false;
        }
    }

    // ============================================================
    // 5. FUNÇÕES DE SEGURANÇA
    // ============================================================
    
    /**
     * Gera um token CSRF para proteção contra ataques
     */
    function generateCSRFToken() {
        const token = 'csrf_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
        try {
            sessionStorage.setItem('csrf_token', token);
        } catch (e) {
            // Fallback se sessionStorage não estiver disponível
        }
        return token;
    }

    /**
     * Obtém o token CSRF atual
     */
    function getCSRFToken() {
        try {
            return sessionStorage.getItem('csrf_token') || generateCSRFToken();
        } catch (e) {
            return generateCSRFToken();
        }
    }

    /**
     * Valida se uma rota é pública (não requer autenticação)
     */
    function isPublicRoute(action) {
        if (!action) return false;
        return BACKEND_CONFIG.PUBLIC_ROUTES.some(route => 
            action === route || action.startsWith(route + '_')
        );
    }

    // ============================================================
    // 6. CONFIGURAÇÃO DE RETRY E TIMEOUT
    // ============================================================
    
    /**
     * Configuração de retry para requisições
     */
    const RETRY_CONFIG = {
        maxRetries: BACKEND_CONFIG.MAX_RETRIES,
        delay: (attempt) => Math.min(1000 * Math.pow(2, attempt), 10000),
        retryableStatuses: [408, 429, 500, 502, 503, 504],
        retryableErrors: ['NetworkError', 'TimeoutError', 'AbortError']
    };

    /**
     * Verifica se uma requisição deve ser repetida
     */
    function shouldRetry(error, status, attempt) {
        if (attempt >= RETRY_CONFIG.maxRetries) return false;
        
        // Erros de rede
        if (error && RETRY_CONFIG.retryableErrors.some(e => error.name === e || error.message?.includes(e))) {
            return true;
        }
        
        // Status HTTP retryable
        if (status && RETRY_CONFIG.retryableStatuses.includes(status)) {
            return true;
        }
        
        return false;
    }

    // ============================================================
    // 7. EXPORTAÇÃO
    // ============================================================
    
    // Configuração principal
    window.BACKEND_CONFIG = BACKEND_CONFIG;
    
    // Funções auxiliares
    window.__backend = {
        config: BACKEND_CONFIG,
        environment: environment,
        isValidApiUrl: isValidApiUrl,
        generateCSRFToken: generateCSRFToken,
        getCSRFToken: getCSRFToken,
        isPublicRoute: isPublicRoute,
        shouldRetry: shouldRetry,
        retryConfig: RETRY_CONFIG
    };

    // ============================================================
    // 8. INICIALIZAÇÃO
    // ============================================================
    
    console.log('🔧 Backend Config v2.0');
    console.log(`🌐 Ambiente: ${BACKEND_CONFIG.ENVIRONMENT}`);
    console.log(`📡 API URL: ${BACKEND_CONFIG.API_URL}`);
    console.log(`🔒 Modo Offline: ${BACKEND_CONFIG.OFFLINE_MODE ? 'Ativo' : 'Desativado'}`);
    console.log(`🔄 Max Retries: ${BACKEND_CONFIG.MAX_RETRIES}`);
    console.log(`⏱️ Timeout: ${BACKEND_CONFIG.TIMEOUT}ms`);
    
    if (BACKEND_CONFIG.DEBUG) {
        console.log('🐛 Modo Debug: Ativo');
        console.log('📋 Rotas Públicas:', BACKEND_CONFIG.PUBLIC_ROUTES);
        console.log('🌐 Domínios Permitidos:', BACKEND_CONFIG.ALLOWED_ORIGINS);
    }

    // ============================================================
    // 9. COMPATIBILIDADE COM CÓDIGO EXISTENTE
    // ============================================================
    
    // Mantém compatibilidade com o código existente que usa CONFIG
    if (typeof window.CONFIG === 'undefined') {
        window.CONFIG = {
            API_URL: BACKEND_CONFIG.API_URL,
            VERSION: BACKEND_CONFIG.VERSION,
            DEV_MODE: BACKEND_CONFIG.ENVIRONMENT === 'development',
            BLOCKCHAIN_ENABLED: true,
            MERCADO_PAGO_LINK: 'https://link.mercadopago.com.br/selomiv'
        };
    } else {
        // Atualiza a configuração existente
        window.CONFIG.API_URL = BACKEND_CONFIG.API_URL;
        window.CONFIG.VERSION = BACKEND_CONFIG.VERSION;
        window.CONFIG.DEV_MODE = BACKEND_CONFIG.ENVIRONMENT === 'development';
    }

    console.log('✅ Backend Config carregado com sucesso!');
    console.log('🎵 PLAY MY - Sistema pronto!');

})();
