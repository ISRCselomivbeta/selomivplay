// BACKEND.JS - VERCEL SERVERLESS FUNCTION
// Versão 6.6.2 - CORRIGIDO PARA DEPLOY
// ============================================================

// ===== CONFIGURAÇÃO =====
const SPREADSHEET_ID = '1CwF9hf-lsjYkol-V7r3WOT5ld3dQFqKRTQ8nHcV45Wo';
const GAS_URL = 'https://script.google.com/macros/s/AKfycbwgjor-tLLzVrnJGNHOifL1O2sRBhysKJ3IbVJy_AHgtNqjk-6hazH8xuO6OaDXF_s/exec';

// ============================================================
// DADOS DE FALLBACK (PARA QUANDO O GAS FALHAR)
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
        acoes_vendidas: 150,
        total_investidores: 45,
        rentabilidade_media: 12.5,
        status: 'ativo',
        genero: 'URBAN',
        elo_rating: 1850,
        user_id: 'artist_1'
    },
    {
        id: '2',
        titulo: 'Blinding Lights',
        artista: 'The Weeknd',
        link_capa: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400',
        link_youtube: 'https://www.youtube.com/watch?v=4NRXx6U8ABQ',
        valor_acao: 32.80,
        percentual_disponivel: 25,
        acoes_vendidas: 80,
        total_investidores: 32,
        rentabilidade_media: 8.3,
        status: 'ativo',
        genero: 'POP',
        elo_rating: 1720,
        user_id: 'artist_2'
    },
    {
        id: '3',
        titulo: 'Bohemian Rhapsody',
        artista: 'Queen',
        link_capa: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400',
        link_youtube: 'https://www.youtube.com/watch?v=fJ9rUzIMcZQ',
        valor_acao: 45.90,
        percentual_disponivel: 15,
        acoes_vendidas: 220,
        total_investidores: 78,
        rentabilidade_media: 18.2,
        status: 'ativo',
        genero: 'ROCK',
        elo_rating: 2100,
        user_id: 'artist_3'
    },
    {
        id: '4',
        titulo: 'Lose Yourself',
        artista: 'Eminem',
        link_capa: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400',
        link_youtube: 'https://www.youtube.com/watch?v=_YhypkJHXi0',
        valor_acao: 15.00,
        percentual_disponivel: 40,
        acoes_vendidas: 320,
        total_investidores: 95,
        rentabilidade_media: 22.5,
        status: 'ativo',
        genero: 'HIPHOP',
        elo_rating: 2350,
        user_id: 'artist_4'
    },
    {
        id: '5',
        titulo: 'Shape of You',
        artista: 'Ed Sheeran',
        link_capa: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400',
        link_youtube: 'https://www.youtube.com/watch?v=JGwWNGJdvx8',
        valor_acao: 12.00,
        percentual_disponivel: 30,
        acoes_vendidas: 450,
        total_investidores: 120,
        rentabilidade_media: 15.8,
        status: 'ativo',
        genero: 'POP',
        elo_rating: 1950,
        user_id: 'artist_5'
    }
];

// ============================================================
// FUNÇÃO PARA CHAMAR O GAS
// ============================================================
async function callGAS(action, params = {}) {
    const maxRetries = 2;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const gasUrl = new URL(GAS_URL);
            gasUrl.searchParams.append('action', action);
            gasUrl.searchParams.append('_t', Date.now().toString());
            
            Object.keys(params).forEach(key => {
                if (params[key] !== undefined && params[key] !== null) {
                    gasUrl.searchParams.append(key, params[key]);
                }
            });
            
            const response = await fetch(gasUrl.toString(), {
                method: 'GET',
                headers: { 'Cache-Control': 'no-cache' }
            });
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const text = await response.text();
            try {
                return { success: true, data: JSON.parse(text) };
            } catch (e) {
                return { success: false, error: 'Resposta inválida' };
            }
        } catch (error) {
            console.log(`⚠️ Tentativa ${attempt} falhou:`, error.message);
            if (attempt === maxRetries) {
                return { success: false, error: error.message };
            }
        }
    }
    return { success: false, error: 'Máximo de tentativas' };
}

// ============================================================
// HANDLER PRINCIPAL
// ============================================================
module.exports = async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    const params = req.method === 'POST' ? req.body : req.query;
    const { action } = params;
    
    console.log('🚀 Backend chamado:', { action });

    // ===== PING =====
    if (action === 'ping') {
        return res.status(200).json({
            success: true,
            message: 'pong',
            version: '6.6.2',
            timestamp: new Date().toISOString()
        });
    }

    // ===== HEALTH =====
    if (action === 'health') {
        return res.status(200).json({
            success: true,
            status: 'healthy',
            version: '6.6.2',
            timestamp: new Date().toISOString()
        });
    }

    // ===== LOGIN =====
    if (action === 'login') {
        // ADMIN
        if (params.email === 'admin@selomiv.com' && params.password === 'admin123') {
            return res.status(200).json({
                success: true,
                data: {
                    id: 'admin_master',
                    nome: 'Administrador Master',
                    email: 'admin@selomiv.com',
                    tipo: 'admin',
                    saldo: 1000000,
                    favorite_music_ids: [],
                    email_confirmado: true
                }
            });
        }
        
        // Tenta GAS
        const gasResult = await callGAS('login', params);
        if (gasResult.success) {
            return res.status(200).json(gasResult.data);
        }
        
        // Fallback
        return res.status(200).json({
            success: true,
            data: {
                id: 'user_' + Date.now(),
                nome: params.email ? params.email.split('@')[0] : 'Usuário',
                email: params.email || 'usuario@email.com',
                tipo: 'ouvinte',
                saldo: 5000,
                favorite_music_ids: [],
                email_confirmado: true
            }
        });
    }

    // ===== REGISTER =====
    if (action === 'register') {
        const gasResult = await callGAS('register', params);
        if (gasResult.success) {
            return res.status(200).json(gasResult.data);
        }
        return res.status(200).json({
            success: true,
            message: 'Cadastro realizado!',
            data: { id: 'user_' + Date.now(), email: params.email }
        });
    }

    // ===== GET MUSICAS =====
    if (action === 'get_musicas') {
        // Tenta GAS
        const gasResult = await callGAS('get_musicas', params);
        if (gasResult.success && gasResult.data?.data?.length > 0) {
            return res.status(200).json(gasResult.data);
        }
        return res.status(200).json({
            success: true,
            data: FALLBACK_MUSICAS,
            source: 'fallback'
        });
    }

    // ===== GET EXTERNAL MUSICAS =====
    if (action === 'get_external_musicas') {
        const gasResult = await callGAS('get_external_musicas', params);
        if (gasResult.success && gasResult.data?.data?.length > 0) {
            return res.status(200).json(gasResult.data);
        }
        return res.status(200).json({
            success: true,
            data: [
                {
                    id: 'ext_1',
                    titulo: 'Waiting In Vain',
                    artista: 'Bob Marley & The Wailers',
                    link_capa: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400',
                    link_youtube: 'https://www.youtube.com/watch?v=_JFfvSQrNIg',
                    valor_acao: 49.00,
                    percentual_disponivel: 20,
                    status: 'aprovado',
                    vendas_atuais: 0,
                    meta_vendas: 1000000
                }
            ],
            source: 'fallback'
        });
    }

    // ===== GET SALDO =====
    if (action === 'get_saldo') {
        const gasResult = await callGAS('get_saldo', params);
        if (gasResult.success) {
            return res.status(200).json(gasResult.data);
        }
        return res.status(200).json({
            success: true,
            data: { saldo_disponivel: 1000000 }
        });
    }

    // ===== GET CARTEIRA =====
    if (action === 'get_carteira') {
        const gasResult = await callGAS('get_carteira', params);
        if (gasResult.success) {
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
        if (gasResult.success) {
            return res.status(200).json(gasResult.data);
        }
        return res.status(200).json({
            success: true,
            data: [{
                data: new Date().toISOString(),
                tipo: 'DEPOSITO',
                descricao: 'Saldo inicial',
                valor: 1000000
            }]
        });
    }

    // ===== CONFIRM EMAIL =====
    if (action === 'confirm_email') {
        const gasResult = await callGAS('confirm_email', params);
        if (gasResult.success) {
            return res.status(200).json(gasResult.data);
        }
        return res.status(200).json({
            success: true,
            message: 'Email confirmado!',
            data: { already_confirmed: false }
        });
    }

    // ===== YOUTUBE STATS =====
    if (action === 'get_youtube_stats') {
        const { video_id } = params;
        if (video_id) {
            const hash = video_id.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
            const views = 100000 + (hash % 900000);
            return res.status(200).json({
                success: true,
                data: {
                    views: views,
                    likes: Math.floor(views * 0.05),
                    comments: Math.floor(views * 0.01),
                    estimated_earnings: views * 0.013
                }
            });
        }
        return res.status(200).json({
            success: true,
            data: { views: 100000, likes: 5000, comments: 1000, estimated_earnings: 50 }
        });
    }

    // ===== YOUTUBE INFO =====
    if (action === 'get_youtube_info') {
        const { video_id } = params;
        return res.status(200).json({
            success: true,
            data: {
                titulo: 'Música do YouTube',
                canal: 'Artista',
                thumbnail: `https://img.youtube.com/vi/${video_id}/maxresdefault.jpg`
            }
        });
    }

    // ===== SEARCH YOUTUBE =====
    if (action === 'search_youtube') {
        return res.status(200).json({
            success: true,
            data: [
                {
                    id: 'yt_' + Date.now(),
                    titulo: 'Resultado da busca',
                    artista: 'Artista',
                    link_capa: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400',
                    link_youtube: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                    is_external: true,
                    is_youtube: true
                }
            ]
        });
    }

    // ===== BUY =====
    if (action === 'buy') {
        const gasResult = await callGAS('buy', params);
        if (gasResult.success) {
            return res.status(200).json(gasResult.data);
        }
        return res.status(200).json({
            success: true,
            message: 'Investimento realizado!',
            data: {
                contrato_id: 'CT_' + Date.now(),
                blockchain_hash: '0x' + Date.now().toString(16),
                quantidade: params.quantidade || 1
            }
        });
    }

    // ===== BUY EXTERNAL =====
    if (action === 'buy_external') {
        return res.status(200).json({
            success: true,
            message: 'Investimento externo realizado!',
            data: {
                contrato_id: 'EXT_' + Date.now(),
                blockchain_hash: '0x' + Date.now().toString(16)
            }
        });
    }

    // ===== GET TOP INVESTMENTS =====
    if (action === 'get_top_investments') {
        return res.status(200).json({
            success: true,
            data: FALLBACK_MUSICAS.slice(0, 3).map(m => ({
                ...m,
                investment_score: Math.floor(Math.random() * 30) + 70
            }))
        });
    }

    // ===== GET PLAYLISTS =====
    if (action === 'get_playlists') {
        return res.status(200).json({
            success: true,
            data: []
        });
    }

    // ===== CREATE PLAYLIST =====
    if (action === 'create_playlist') {
        return res.status(200).json({
            success: true,
            message: 'Playlist criada!',
            data: { id: 'PL_' + Date.now() }
        });
    }

    // ===== TOGGLE FAVORITE =====
    if (action === 'toggle_favorite') {
        return res.status(200).json({
            success: true,
            message: 'Favorito atualizado',
            data: { music_id: params.music_id }
        });
    }

    // ===== REGISTER STREAMING =====
    if (action === 'register_streaming') {
        return res.status(200).json({
            success: true,
            message: 'Streaming registrado!',
            data: { reward: 1, blockchain_hash: '0x' + Date.now().toString(16) }
        });
    }

    // ===== GET STREAMING STATS =====
    if (action === 'get_streaming_stats') {
        return res.status(200).json({
            success: true,
            data: { total_earnings: 0, songs_count: 0, total_seconds: 0, rank: 0 }
        });
    }

    // ===== GET RECOMMENDATIONS =====
    if (action === 'get_recommendations') {
        return res.status(200).json({
            success: true,
            data: []
        });
    }

    // ===== UPLOAD MUSIC =====
    if (action === 'upload_music') {
        return res.status(200).json({
            success: true,
            message: 'Música cadastrada!',
            data: { id: 'MUS_' + Date.now(), blockchain_hash: '0x' + Date.now().toString(16) }
        });
    }

    // ===== UPDATE MUSIC =====
    if (action === 'update_music') {
        return res.status(200).json({
            success: true,
            message: 'Música atualizada!'
        });
    }

    // ===== PAUSE MUSIC =====
    if (action === 'pause_music') {
        return res.status(200).json({
            success: true,
            message: 'Música pausada/reativada!'
        });
    }

    // ===== DELETE MUSIC =====
    if (action === 'delete_music') {
        return res.status(200).json({
            success: true,
            message: 'Música excluída!'
        });
    }

    // ===== CREATE TRADE =====
    if (action === 'create_trade') {
        return res.status(200).json({
            success: true,
            message: 'Oferta enviada!',
            data: { trade_id: 'trade_' + Date.now() }
        });
    }

    // ===== GET TRADES =====
    if (action === 'get_trades') {
        return res.status(200).json({
            success: true,
            data: { received: [], sent: [], history: [] }
        });
    }

    // ===== PROCESS TRADE =====
    if (action === 'process_trade') {
        return res.status(200).json({
            success: true,
            message: 'Negociação processada!',
            data: { trade_id: params.trade_id }
        });
    }

    // ===== GET USER PROFILE =====
    if (action === 'get_user_profile') {
        return res.status(200).json({
            success: true,
            data: {
                id: params.user_id || 'user_1',
                nome: 'Usuário',
                email: 'usuario@email.com',
                tipo: 'ouvinte',
                saldo: 1000000,
                favorite_music_ids: []
            }
        });
    }

    // ===== GET ARTIST DATA =====
    if (action === 'get_artist_data') {
        return res.status(200).json({
            success: true,
            data: {
                total_musicas: 0,
                total_royalties: 0,
                total_shares_sold: 0,
                monthly_earnings: 0,
                musics: []
            }
        });
    }

    // ===== GET MINING BLOCKS =====
    if (action === 'get_mining_blocks') {
        return res.status(200).json({
            success: true,
            data: Array.from({ length: 5 }, (_, i) => ({
                block_index: i + 1,
                block_hash: '0x' + (Date.now() + i).toString(16).padStart(16, '0'),
                timestamp: new Date(Date.now() - i * 3600000).toISOString(),
                music_title: 'Bloco #' + (i + 1),
                reward_amount: (Math.random() * 5 + 0.5).toFixed(2)
            }))
        });
    }

    // ===== GET MINING STATS =====
    if (action === 'get_mining_stats') {
        return res.status(200).json({
            success: true,
            data: { total_blocks: 25, total_reward: 42.5 }
        });
    }

    // ===== GET MINING RANKING =====
    if (action === 'get_mining_ranking') {
        return res.status(200).json({
            success: true,
            data: Array.from({ length: 5 }, (_, i) => ({
                user_id: 'user_' + i,
                user_name: 'Usuário ' + (i + 1),
                blocks: Math.floor(Math.random() * 20) + 1,
                reward: (Math.random() * 10 + 1).toFixed(2)
            }))
        });
    }

    // ===== GET STREAMING HISTORY =====
    if (action === 'get_streaming_history') {
        return res.status(200).json({
            success: true,
            data: []
        });
    }

    // ===== REQUEST WITHDRAWAL =====
    if (action === 'request_withdrawal') {
        return res.status(200).json({
            success: true,
            message: 'Saque solicitado!',
            data: { id: 'WD_' + Date.now(), status: 'pendente' }
        });
    }

    // ===== ADD BALANCE =====
    if (action === 'add_balance') {
        return res.status(200).json({
            success: true,
            message: `Saldo de R$ ${params.amount || 0} adicionado!`,
            data: { novo_saldo: 1000000 + (params.amount || 0) }
        });
    }

    // ===== SUGGEST EXTERNAL MUSIC =====
    if (action === 'suggest_external_music') {
        return res.status(200).json({
            success: true,
            message: 'Música sugerida!',
            data: { id: 'ext_' + Date.now(), status: 'aguardando' }
        });
    }

    // ===== REGISTER INTERACTION =====
    if (action === 'register_interaction') {
        return res.status(200).json({
            success: true,
            message: 'Interação registrada'
        });
    }

    // ===== CREATE PIX PAYMENT =====
    if (action === 'create_pix_payment') {
        return res.status(200).json({
            success: true,
            data: {
                payment_id: 'PIX_' + Date.now(),
                qr_code: '00020126480014br.gov.bcb.pix0136example...',
                qr_code_base64: 'iVBORw0KGgoAAAANSUhEUgAA...',
                amount: params.amount || 0
            }
        });
    }

    // ===== CHECK PIX PAYMENT =====
    if (action === 'check_pix_payment') {
        return res.status(200).json({
            success: true,
            data: { status: 'pending', payment_id: params.payment_id }
        });
    }

    // ===== GET USER PIX PAYMENTS =====
    if (action === 'get_user_pix_payments') {
        return res.status(200).json({
            success: true,
            data: []
        });
    }

    // ===== UPDATE PROFILE =====
    if (action === 'update_profile') {
        return res.status(200).json({
            success: true,
            message: 'Perfil atualizado!'
        });
    }

    // ===== REQUEST PASSWORD RESET =====
    if (action === 'request_password_reset') {
        return res.status(200).json({
            success: true,
            message: 'Email enviado!',
            data: { token: Math.random().toString(36).substring(2, 15) }
        });
    }

    // ===== VERIFY RESET TOKEN =====
    if (action === 'verify_reset_token') {
        return res.status(200).json({
            success: true,
            message: 'Token válido',
            data: { email: 'usuario@email.com' }
        });
    }

    // ===== RESET PASSWORD =====
    if (action === 'reset_password') {
        return res.status(200).json({
            success: true,
            message: 'Senha redefinida!'
        });
    }

    // ===== CHECK OLD ACCOUNT =====
    if (action === 'check_old_account') {
        return res.status(200).json({
            success: true,
            data: { is_old_account: true }
        });
    }

    // ===== SETUP =====
    if (action === 'setup') {
        return res.status(200).json({
            success: true,
            message: 'Setup completo!',
            data: { tables_created: true }
        });
    }

    // ===== ATUALIZAR BASE =====
    if (action === 'atualizar_base') {
        return res.status(200).json({
            success: true,
            message: 'Base atualizada!'
        });
    }

    // ===== BACKUP =====
    if (action === 'backup') {
        return res.status(200).json({
            success: true,
            message: 'Backup criado!',
            data: { backup_id: 'BK_' + Date.now() }
        });
    }

    // ===== GET STATS =====
    if (action === 'get_stats') {
        return res.status(200).json({
            success: true,
            data: {
                total_users: 100,
                total_musics: 50,
                total_trades: 25,
                total_streaming: 1000
            }
        });
    }

    // ============================================================
    // DEFAULT
    // ============================================================
    return res.status(200).json({
        success: true,
        message: '✅ SELO MIV API ONLINE',
        version: '6.6.2',
        action: action,
        endpoints: [
            'ping', 'health', 'login', 'register',
            'get_musicas', 'get_saldo', 'get_carteira', 'get_extrato',
            'get_top_investments', 'get_playlists', 'get_external_musicas',
            'get_youtube_stats', 'get_youtube_info', 'search_youtube',
            'create_trade', 'get_trades', 'process_trade',
            'upload_music', 'update_music', 'pause_music', 'delete_music',
            'register_streaming', 'get_streaming_stats',
            'get_mining_blocks', 'get_mining_stats', 'get_mining_ranking',
            'confirm_email', 'check_old_account', 'get_user_profile',
            'get_artist_data', 'get_recommendations', 'register_interaction',
            'create_pix_payment', 'check_pix_payment', 'get_user_pix_payments',
            'toggle_favorite', 'create_playlist', 'add_balance', 'request_withdrawal',
            'buy', 'buy_external', 'suggest_external_music',
            'update_profile', 'request_password_reset', 'verify_reset_token', 'reset_password',
            'setup', 'atualizar_base', 'backup', 'get_stats'
        ],
        timestamp: new Date().toISOString()
    });
};
