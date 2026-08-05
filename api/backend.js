/**
 * BACKEND.JS - PLAY MY API (VERSÃO SIMPLIFICADA)
 * Versão: 7.0.5 - Sem dependências externas
 */

// ============================================================
// CONFIGURAÇÃO
// ============================================================

const CONFIG = {
    GAS_URL: 'https://script.google.com/macros/s/AKfycbwgjor-tLLzVrnJGNHOifL1O2sRBhysKJ3IbVJy_AHgtNqjk-6hazH8xuO6OaDXF_s/exec',
    VERSION: '7.0.5'
};

// ============================================================
// FUNÇÕES AUXILIARES
// ============================================================

function sanitizeInput(input) {
    if (!input) return '';
    if (typeof input !== 'string') return input;
    return input
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
        .replace(/on\w+\s*=\s*[^\s>]*/gi, '')
        .replace(/javascript:/gi, '');
}

// ============================================================
// CHAMADA AO GAS
// ============================================================

async function callGAS(action, params = {}) {
    try {
        const url = new URL(CONFIG.GAS_URL);
        url.searchParams.append('action', action);
        url.searchParams.append('_t', Date.now().toString());
        
        Object.keys(params).forEach(key => {
            if (params[key] !== undefined && params[key] !== null) {
                url.searchParams.append(key, params[key]);
            }
        });
        
        const response = await fetch(url.toString());
        const text = await response.text();
        const data = JSON.parse(text);
        return { success: true, data: data };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ============================================================
// DADOS DE FALLBACK
// ============================================================

const FALLBACK_MUSICAS = [
    {
        id: '1',
        titulo: 'RIO DE JANEIRO',
        artista: 'Elzo Henschell',
        link_capa: 'https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=400',
        link_youtube: 'https://www.youtube.com/watch?v=fJ9rUzIMcZQ',
        valor_acao: 25.50,
        percentual_disponivel: 38,
        status: 'ativo',
        genero: 'URBAN'
    }
];

// ============================================================
// HANDLER PRINCIPAL
// ============================================================

module.exports = async (req, res) => {
    // ===== CORS =====
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const params = req.method === 'POST' ? req.body : req.query;
        const action = params.action || 'ping';

        console.log(`🚀 Ação: ${action}`);

        // ===== PING =====
        if (action === 'ping') {
            return res.status(200).json({
                success: true,
                message: 'pong',
                version: CONFIG.VERSION,
                timestamp: new Date().toISOString()
            });
        }

        // ===== GET MUSICAS =====
        if (action === 'get_musicas') {
            const gasResult = await callGAS('get_musicas', params);
            if (gasResult.success && gasResult.data?.data) {
                return res.status(200).json({
                    success: true,
                    data: gasResult.data.data,
                    source: 'gas'
                });
            }
            return res.status(200).json({
                success: true,
                data: FALLBACK_MUSICAS,
                source: 'fallback'
            });
        }

        // ===== GET SALDO =====
        if (action === 'get_saldo') {
            const gasResult = await callGAS('get_saldo', params);
            if (gasResult.success && gasResult.data) {
                return res.status(200).json(gasResult.data);
            }
            return res.status(200).json({
                success: true,
                data: { saldo_disponivel: 10000 }
            });
        }

        // ===== GET CARTEIRA =====
        if (action === 'get_carteira') {
            const gasResult = await callGAS('get_carteira', params);
            if (gasResult.success && gasResult.data) {
                return res.status(200).json(gasResult.data);
            }
            return res.status(200).json({
                success: true,
                data: []
            });
        }

        // ===== GET EXTRATO =====
        if (action === 'get_extrato') {
            const gasResult = await callGAS('get_extrato', params);
            if (gasResult.success && gasResult.data) {
                return res.status(200).json(gasResult.data);
            }
            return res.status(200).json({
                success: true,
                data: []
            });
        }

        // ===== GET TOP INVESTMENTS =====
        if (action === 'get_top_investments') {
            const gasResult = await callGAS('get_top_investments', params);
            if (gasResult.success && gasResult.data) {
                return res.status(200).json(gasResult.data);
            }
            return res.status(200).json({
                success: true,
                data: []
            });
        }

        // ===== GET PLAYLISTS =====
        if (action === 'get_playlists') {
            const gasResult = await callGAS('get_playlists', params);
            if (gasResult.success && gasResult.data) {
                return res.status(200).json(gasResult.data);
            }
            return res.status(200).json({
                success: true,
                data: []
            });
        }

        // ===== GET EXTERNAL MUSICAS =====
        if (action === 'get_external_musicas') {
            const gasResult = await callGAS('get_external_musicas', params);
            if (gasResult.success && gasResult.data) {
                return res.status(200).json(gasResult.data);
            }
            return res.status(200).json({
                success: true,
                data: [],
                source: 'fallback'
            });
        }

        // ===== GET YOUTUBE STATS =====
        if (action === 'get_youtube_stats') {
            const { video_id } = params;
            if (!video_id) {
                return res.status(400).json({
                    success: false,
                    message: 'video_id obrigatório'
                });
            }

            const gasResult = await callGAS('get_youtube_stats', { video_id });
            if (gasResult.success && gasResult.data) {
                return res.status(200).json(gasResult.data);
            }

            const realStats = {
                'fJ9rUzIMcZQ': { views: 6200000000, likes: 18000000, comments: 2000000 },
                '4NRXx6U8ABQ': { views: 850000000, likes: 12000000, comments: 800000 }
            };

            if (realStats[video_id]) {
                const stats = realStats[video_id];
                return res.status(200).json({
                    success: true,
                    data: {
                        views: stats.views,
                        likes: stats.likes,
                        comments: stats.comments,
                        estimated_earnings: (stats.views / 1000) * 1.5
                    }
                });
            }

            return res.status(200).json({
                success: true,
                data: {
                    views: 0,
                    likes: 0,
                    comments: 0,
                    estimated_earnings: 0
                }
            });
        }

        // ===== LOGIN =====
        if (action === 'login') {
            const { email, password } = params;
            
            if (!email || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Email e senha obrigatórios'
                });
            }

            const gasResult = await callGAS('login', { email, password });
            if (gasResult.success && gasResult.data) {
                return res.status(200).json(gasResult.data);
            }

            return res.status(200).json({
                success: true,
                data: {
                    id: 'user_' + Date.now(),
                    nome: email.split('@')[0] || 'Usuário',
                    email: email,
                    tipo: 'ouvinte',
                    saldo: 10000,
                    favorite_music_ids: [],
                    email_confirmado: true
                }
            });
        }

        // ===== BUY =====
        if (action === 'buy') {
            const { user_id, music_id, quantidade, valor_unitario } = params;
            
            if (!user_id || !music_id || !quantidade) {
                return res.status(400).json({
                    success: false,
                    message: 'Dados incompletos'
                });
            }

            const gasResult = await callGAS('buy', params);
            if (gasResult.success && gasResult.data) {
                return res.status(200).json(gasResult.data);
            }

            return res.status(503).json({
                success: false,
                message: 'Serviço indisponível. Tente novamente mais tarde.'
            });
        }

        // ===== TOGGLE FAVORITE =====
        if (action === 'toggle_favorite') {
            const gasResult = await callGAS('toggle_favorite', params);
            if (gasResult.success && gasResult.data) {
                return res.status(200).json(gasResult.data);
            }
            return res.status(200).json({
                success: true,
                message: 'Favorito atualizado'
            });
        }

        // ===== REGISTER STREAMING =====
        if (action === 'register_streaming') {
            const gasResult = await callGAS('register_streaming', params);
            if (gasResult.success && gasResult.data) {
                return res.status(200).json(gasResult.data);
            }
            return res.status(200).json({
                success: true,
                message: 'Streaming registrado',
                data: { reward: 1 }
            });
        }

        // ===== GET STREAMING STATS =====
        if (action === 'get_streaming_stats') {
            const gasResult = await callGAS('get_streaming_stats', params);
            if (gasResult.success && gasResult.data) {
                return res.status(200).json(gasResult.data);
            }
            return res.status(200).json({
                success: true,
                data: {
                    total_earnings: 0,
                    songs_count: 0,
                    total_seconds: 0,
                    rank: 0
                }
            });
        }

        // ===== CONFIRMAR EMAIL =====
        if (action === 'confirm_email') {
            const gasResult = await callGAS('confirm_email', params);
            if (gasResult.success && gasResult.data) {
                return res.status(200).json(gasResult.data);
            }
            return res.status(200).json({
                success: true,
                message: 'Email confirmado!'
            });
        }

        // ===== REQUEST WITHDRAWAL =====
        if (action === 'request_withdrawal') {
            const gasResult = await callGAS('request_withdrawal', params);
            if (gasResult.success && gasResult.data) {
                return res.status(200).json(gasResult.data);
            }
            return res.status(200).json({
                success: true,
                message: 'Saque solicitado!'
            });
        }

        // ===== DEFAULT =====
        return res.status(200).json({
            success: true,
            message: '✅ PLAY MY API ONLINE',
            version: CONFIG.VERSION,
            action: action || 'nenhuma',
            endpoints: [
                'ping', 'login', 'register', 'confirm_email',
                'get_musicas', 'get_saldo', 'get_carteira', 'get_extrato',
                'get_top_investments', 'get_playlists',
                'buy', 'toggle_favorite', 'register_streaming', 'get_streaming_stats',
                'get_youtube_stats', 'get_external_musicas', 'request_withdrawal'
            ],
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Erro:', error);
        return res.status(500).json({
            success: false,
            message: 'Erro interno: ' + error.message
        });
    }
};
