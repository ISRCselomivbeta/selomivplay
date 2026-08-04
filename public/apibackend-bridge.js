// ===============================================
// BACKEND BRIDGE - Frontend para backend.js
// Conecta o index.html ao backend.js da Vercel
// Versão: 6.6.1
// ===============================================

const BACKEND_CONFIG = {
    // URL DO SEU BACKEND.JS NA VERCEL
    // ✅ USE ESTA URL (já está correta)
    API_URL: 'https://selomivplay.vercel.app/api/backend',
    
    // Para desenvolvimento local:
    // API_URL: 'http://localhost:3000/api/backend',
    
    VERSION: '6.6.1',
    TIMEOUT: 30000,
    MAX_RETRIES: 3
};

// ========== FUNÇÃO PRINCIPAL ==========
async function callBackend(action, params = {}) {
    console.log(`📡 [Backend] Chamando: ${action}`);
    console.log(`📦 Parâmetros:`, params);
    
    // Se tiver usuário logado, adicionar user_id automaticamente
    if (!params.user_id && window.state?.currentUser?.id) {
        params.user_id = window.state.currentUser.id;
    }
    
    // Adicionar timestamp para evitar cache
    params._t = Date.now();
    
    // Construir URL
    const url = new URL(BACKEND_CONFIG.API_URL);
    url.searchParams.append('action', action);
    
    // Adicionar todos os parâmetros
    Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null) {
            url.searchParams.append(key, params[key]);
        }
    });
    
    // Tentar com retry
    let lastError = null;
    
    for (let attempt = 1; attempt <= BACKEND_CONFIG.MAX_RETRIES; attempt++) {
        try {
            console.log(`🔄 Tentativa ${attempt}/${BACKEND_CONFIG.MAX_RETRIES}`);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), BACKEND_CONFIG.TIMEOUT);
            
            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            console.log(`✅ [Backend] ${action} - Resposta:`, result);
            return result;
            
        } catch (error) {
            console.warn(`⚠️ Tentativa ${attempt} falhou:`, error.message);
            lastError = error;
            
            if (attempt < BACKEND_CONFIG.MAX_RETRIES) {
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
        }
    }
    
    console.error(`❌ [Backend] ${action} - Todas as tentativas falharam:`, lastError);
    
    return {
        success: false,
        message: 'Erro de conexão com o servidor.',
        error: lastError?.message || 'UNKNOWN_ERROR'
    };
}

// ========== WRAPPERS PARA CADA AÇÃO ==========
// (Mantendo compatibilidade com o index.html existente)

const SELO_BACKEND = {
    // Configuração
    config: BACKEND_CONFIG,
    
    // Função principal
    call: callBackend,
    
    // ===== USUÁRIOS =====
    login: (email, password) => callBackend('login', { email, password }),
    
    register: (nome, email, senha, tipo, workLink) => 
        callBackend('register', { nome, email, senha, tipo, workLink: workLink || '' }),
    
    confirmEmail: (token) => callBackend('confirm_email', { token }),
    
    checkOldAccount: (token) => callBackend('check_old_account', { token }),
    
    requestPasswordReset: (email) => callBackend('request_password_reset', { email }),
    
    verifyResetToken: (token) => callBackend('verify_reset_token', { token }),
    
    resetPassword: (token, newPassword, confirmPassword) => 
        callBackend('reset_password', { token, new_password: newPassword, confirm_password: confirmPassword }),
    
    getUserProfile: (userId) => callBackend('get_user_profile', { user_id: userId }),
    
    updateProfile: (userId, data) => callBackend('update_profile', { user_id: userId, ...data }),
    
    // ===== MÚSICAS =====
    getMusicas: (page = 1, limit = 20) => callBackend('get_musicas', { page, limit }),
    
    getMusicDetails: (musicId) => callBackend('get_music_details', { music_id: musicId }),
    
    uploadMusic: (data) => callBackend('upload_music', data),
    
    updateMusic: (data) => callBackend('update_music', data),
    
    pauseMusic: (musicId, actionType) => callBackend('pause_music', { music_id: musicId, action_type: actionType }),
    
    deleteMusic: (musicId) => callBackend('delete_music', { music_id: musicId }),
    
    // ===== INVESTIMENTOS =====
    getSaldo: (userId) => callBackend('get_saldo', { user_id: userId }),
    
    getCarteira: (userId) => callBackend('get_carteira', { user_id: userId }),
    
    getExtrato: (userId, limit = 50) => callBackend('get_extrato', { user_id: userId, limit }),
    
    buyMusic: (userId, musicId, quantidade, valorUnitario, valorTotal) => 
        callBackend('buy', { user_id: userId, music_id: musicId, quantidade, valor_unitario: valorUnitario, valor_total: valorTotal }),
    
    buyExternalMusic: (userId, externalId, quantidade, valorUnitario, valorTotal) => 
        callBackend('buy_external', { user_id: userId, external_id: externalId, quantidade, valor_unitario: valorUnitario, valor_total: valorTotal }),
    
    addBalance: (userId, amount) => callBackend('add_balance', { user_id: userId, amount }),
    
    requestWithdrawal: (userId, valor, metodo, dadosBancarios) => 
        callBackend('request_withdrawal', { user_id: userId, valor, metodo, dados_bancarios: dadosBancarios }),
    
    getWithdrawals: (userId, status = null) => callBackend('get_withdrawals', { user_id: userId, status }),
    
    // ===== EXTERNAL MUSIC =====
    getExternalMusicas: (page = 1, limit = 20) => callBackend('get_external_musicas', { page, limit }),
    
    suggestExternalMusic: (data) => callBackend('suggest_external_music', data),
    
    // ===== PLAYLISTS =====
    getPlaylists: (userId) => callBackend('get_playlists', { user_id: userId }),
    
    createPlaylist: (userId, nome, publica = false, musicas = []) => 
        callBackend('create_playlist', { user_id: userId, nome, publica, musicas: musicas.join(',') }),
    
    // ===== FAVORITOS =====
    toggleFavorite: (userId, musicId, action) => 
        callBackend('toggle_favorite', { user_id: userId, music_id: musicId, action }),
    
    // ===== ARTISTA =====
    getArtistData: (userId) => callBackend('get_artist_data', { user_id: userId }),
    
    // ===== TRADES =====
    createTrade: (sellerId, buyerEmail, musicId, quantity, price, total, message = '') => 
        callBackend('create_trade', { seller_id: sellerId, buyer_email: buyerEmail, music_id: musicId, quantity, price, total, message }),
    
    getTrades: (userId) => callBackend('get_trades', { user_id: userId }),
    
    processTrade: (tradeId, actionType) => callBackend('process_trade', { trade_id: tradeId, action_type: actionType }),
    
    getTradeDetails: (tradeId) => callBackend('get_trade_details', { trade_id: tradeId }),
    
    addTransaction: (userId, tipo, valor, descricao, referencia) => 
        callBackend('add_transaction', { user_id: userId, tipo, valor, descricao, referencia }),
    
    transferShares: (fromUser, toUser, musicId, quantity) => 
        callBackend('transfer_shares', { from_user: fromUser, to_user: toUser, music_id: musicId, quantity }),
    
    // ===== STREAMING =====
    registerStreaming: (userId, musicId, duration, totalDuration, youtubeTime, playerState, verification) => 
        callBackend('register_streaming', { 
            user_id: userId, 
            music_id: musicId, 
            duration, 
            total_duration: totalDuration, 
            youtube_time: youtubeTime || 0, 
            player_state: playerState || 'playing', 
            verification: verification || 'web' 
        }),
    
    getStreamingStats: (userId) => callBackend('get_streaming_stats', { user_id: userId }),
    
    // ===== BLOCKCHAIN =====
    getMiningBlocks: (limit = 20, userId = null) => callBackend('get_mining_blocks', { limit, user_id: userId }),
    
    getMiningStats: (userId = null) => callBackend('get_mining_stats', { user_id: userId }),
    
    getMiningRanking: (limit = 20) => callBackend('get_mining_ranking', { limit }),
    
    mineStreamingBlock: (data) => callBackend('mine_streaming_block', data),
    
    // ===== RECOMENDAÇÕES =====
    getRecommendations: (userId, limit = 10) => callBackend('get_recommendations', { user_id: userId, limit }),
    
    registerInteraction: (userId, musicId, type, value = 1, source = 'web', metadata = null) => 
        callBackend('register_interaction', { user_id: userId, music_id: musicId, type, value, source, metadata: metadata ? JSON.stringify(metadata) : null }),
    
    // ===== YOUTUBE =====
    searchYouTube: (query, limit = 8) => callBackend('search_youtube', { query, limit }),
    
    searchISRC: (youtubeUrl) => callBackend('search_isrc', { youtube_url: youtubeUrl }),
    
    getYouTubeEarnings: (videoId) => callBackend('get_youtube_earnings', { video_id: videoId }),
    
    getYouTubeStats: (videoId) => callBackend('get_youtube_stats', { video_id: videoId }),
    
    getYouTubeInfo: (videoId) => callBackend('get_youtube_info', { video_id: videoId }),
    
    // ===== PIX =====
    createPixPayment: (userId, amount) => callBackend('create_pix_payment', { user_id: userId, amount }),
    
    checkPixPayment: (paymentId) => callBackend('check_pix_payment', { payment_id: paymentId }),
    
    getUserPixPayments: (userId) => callBackend('get_user_pix_payments', { user_id: userId }),
    
    // ===== SISTEMA =====
    getStats: () => callBackend('get_stats'),
    
    getTopInvestments: () => callBackend('get_top_investments'),
    
    backup: () => callBackend('backup'),
    
    health: () => callBackend('health'),
    
    testGAS: () => callBackend('test_gas'),
    
    ping: () => callBackend('ping'),
    
    setup: () => callBackend('setup'),
    
    atualizarBase: () => callBackend('atualizar_base')
};

// ===== EXPORTAR PARA USO GLOBAL =====
window.SELO_BACKEND = SELO_BACKEND;

console.log('✅ Backend Bridge carregado!');
console.log('📡 Conectando a:', BACKEND_CONFIG.API_URL);
console.log('📦 Versão:', BACKEND_CONFIG.VERSION);
console.log('🔄 Retry máximo:', BACKEND_CONFIG.MAX_RETRIES);
