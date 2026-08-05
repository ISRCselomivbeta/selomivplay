/**
 * BACKEND CONFIG -PLAY MY
 * Versão: 2.0.0 - Modo Seguro
 */
(function() {
    'use strict';

    console.log('🔧 Iniciando Backend Config...');

    // ============================================================
    // CONFIGURAÇÃO BASE
    // ============================================================
    const BACKEND_CONFIG = {
        VERSION: '7.0.5',
        TIMEOUT: 30000,
        MAX_RETRIES: 3,
        OFFLINE_MODE: false,
        DEFAULT_HEADERS: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        },
        ALLOWED_ORIGINS: [
            'https://playmy.com.br',
            'https://www.playmy.com.br',
            'https://selomivplay.vercel.app',
            'http://localhost:3000',
            'http://localhost:5500'
        ],
        PUBLIC_ROUTES: [
            'login', 'register', 'resend_confirmation',
            'confirm_email', 'get_musicas', 'get_external_musicas',
            'get_top_investments', 'search_youtube', 'get_youtube_stats'
        ]
    };

    // ============================================================
    // DETECÇÃO DE AMBIENTE
    // ============================================================
    function detectEnvironment() {
        const hostname = window.location.hostname;
        
        // Mapeamento de ambientes
        const environments = {
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
            'selomivplay.vercel.app': {
                apiUrl: 'https://selomivplay.vercel.app/api/backend',
                environment: 'production',
                debug: false
            },
            'localhost': {
                apiUrl: 'http://localhost:3000/api/backend',
                environment: 'development',
                debug: true
            }
        };

        // Tenta encontrar o ambiente
        if (environments[hostname]) {
            return environments[hostname];
        }

        // Fallback para subdomínios
        if (hostname.endsWith('playmy.com.br')) {
            return {
                apiUrl: 'https://playmy.com.br/api/backend',
                environment: 'production',
                debug: false
            };
        }

        if (hostname.endsWith('vercel.app')) {
            return {
                apiUrl: 'https://selomivplay.vercel.app/api/backend',
                environment: 'production',
                debug: false
            };
        }

        // Fallback genérico
        return {
            apiUrl: `${window.location.protocol}//${hostname}/api/backend`,
            environment: 'unknown',
            debug: true
        };
    }

    // ============================================================
    // APLICAR CONFIGURAÇÃO
    // ============================================================
    const environment = detectEnvironment();
    BACKEND_CONFIG.API_URL = environment.apiUrl;
    BACKEND_CONFIG.ENVIRONMENT = environment.environment;
    BACKEND_CONFIG.DEBUG = environment.debug;

    // ============================================================
    // EXPORTAR
    // ============================================================
    window.BACKEND_CONFIG = BACKEND_CONFIG;

    // Mantém compatibilidade com código existente
    if (typeof window.CONFIG === 'undefined') {
        window.CONFIG = {
            API_URL: BACKEND_CONFIG.API_URL,
            VERSION: BACKEND_CONFIG.VERSION,
            DEV_MODE: BACKEND_CONFIG.ENVIRONMENT === 'development',
            BLOCKCHAIN_ENABLED: true,
            MERCADO_PAGO_LINK: 'https://link.mercadopago.com.br/selomiv'
        };
    } else {
        window.CONFIG.API_URL = BACKEND_CONFIG.API_URL;
        window.CONFIG.VERSION = BACKEND_CONFIG.VERSION;
        window.CONFIG.DEV_MODE = BACKEND_CONFIG.ENVIRONMENT === 'development';
    }

    // ============================================================
    // FUNÇÕES AUXILIARES
    // ============================================================
    window.__backend = {
        config: BACKEND_CONFIG,
        environment: environment,
        getCSRFToken: function() {
            return 'csrf_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
        },
        isPublicRoute: function(action) {
            return BACKEND_CONFIG.PUBLIC_ROUTES.some(route => 
                action === route || action.startsWith(route + '_')
            );
        }
    };

    // ============================================================
    // STATUS
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
    }

    console.log('✅ Backend Config carregado com sucesso!');
})();
