// ============================================================
// APP.JS - Inicialização e Orquestração
// ============================================================

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 PLAY MY v' + CONFIG.VERSION);
    
    // Verificar sessão
    const stored = localStorage.getItem('miv_user');
    if (stored) {
        try {
            state.currentUser = JSON.parse(stored);
            state.userBalance = state.currentUser.saldo || 0;
            
            if (state.currentUser.favorite_music_ids) {
                if (Array.isArray(state.currentUser.favorite_music_ids)) {
                    state.favoriteMusicIds = state.currentUser.favorite_music_ids;
                } else if (typeof state.currentUser.favorite_music_ids === 'string') {
                    state.favoriteMusicIds = state.currentUser.favorite_music_ids.split(',').filter(id => id.trim() !== '');
                } else {
                    state.favoriteMusicIds = [];
                }
            } else {
                state.favoriteMusicIds = [];
            }
            
            setTimeout(() => loadYouTubeAPI(), 2000);
            initializeApp();
        } catch (e) { 
            console.error('Erro ao restaurar sessão:', e);
            localStorage.removeItem('miv_user'); 
            localStorage.removeItem('miv_session'); 
            hideLoading(); 
        }
    } else {
        hideLoading();
        setTimeout(() => loadYouTubeAPI(), 3000);
    }
    
    // Configurar eventos de visibilidade
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            if (state.streamingTimer) {
                clearInterval(state.streamingTimer);
                state.streamingTimer = null;
                console.log('⏸️ Monitoramento pausado (aba inativa)');
            }
        } else {
            if (state.isPlaying && state.playerReady) {
                startStreamingMonitor();
                console.log('▶️ Monitoramento retomado (aba ativa)');
            }
        }
    });
    
    // Criar badge offline
    createOfflineBadge();
    updateOnlineStatus();
    
    // Adicionar botão de compartilhar
    setTimeout(addShareButton, 2000);
});

// ===== INICIALIZAR APP =====
async function initializeApp() {
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    updateUserInterface();
    await loadAllData();
    await loadUserFavorites();
    await initializeRecommendations();
    loadYouTubeAPI();
    
    setInterval(() => {
        if (state.currentUser) {
            updateBalanceDisplay();
        }
    }, 30000);
    
    setInterval(() => {
        if (state.currentUser) {
            loadStreamingStats();
        }
    }, 60000);
}

// ===== CARREGAR TODOS OS DADOS =====
async function loadAllData() {
    showLoading('Carregando dados...');
    try {
        await Promise.all([
            loadMarketplace(),
            loadExternalMarketplace(),
            loadPortfolio(),
            loadLedger(),
            loadTopInvestments(),
            loadUserPlaylists()
        ]);
        
        await updateBalanceDisplay();
        
        if (state.currentUser?.tipo === 'artista') await loadArtistData();
        showToast('Sistema carregado!', 'success');
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        showToast('Alguns dados não foram carregados', 'warning');
    } finally {
        hideLoading();
    }
}

// ===== DETECTAR CONEXÃO =====
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

function updateOnlineStatus() {
    const offlineBadge = document.getElementById('offlineBadge') || createOfflineBadge();
    
    if (navigator.onLine) {
        offlineBadge.style.display = 'none';
        showToast('📶 Conexão restabelecida!', 'success');
        refreshAllData();
    } else {
        offlineBadge.style.display = 'block';
        showToast('📴 Modo offline - algumas funções podem estar limitadas', 'warning', 5000);
    }
}

function createOfflineBadge() {
    const badge = document.createElement('div');
    badge.id = 'offlineBadge';
    badge.className = 'offline-badge';
    badge.innerHTML = '<i class="bi bi-wifi-off"></i> Modo Offline';
    document.body.appendChild(badge);
    return badge;
}

// ===== COMPARTILHAR COMO APP =====
function shareAsApp() {
    if (navigator.share) {
        navigator.share({
            title: 'SELO MIV',
            text: 'Invista em música com blockchain!',
            url: window.location.href
        }).catch(console.error);
    } else {
        navigator.clipboard.writeText(window.location.href);
        showToast('Link copiado! Compartilhe com amigos', 'success');
    }
}

function addShareButton() {
    const headerRight = document.querySelector('.header-content .d-flex.gap-2');
    if (headerRight && !document.getElementById('shareAppBtn')) {
        const shareBtn = document.createElement('button');
        shareBtn.id = 'shareAppBtn';
        shareBtn.className = 'btn btn-sm btn-outline-success ms-2';
        shareBtn.innerHTML = '<i class="bi bi-share"></i>';
        shareBtn.onclick = shareAsApp;
        shareBtn.title = 'Compartilhar App';
        headerRight.appendChild(shareBtn);
    }
}

// ===== FECHAR MODAL PERSONALIZADO =====
function closeCustomModal() {
    const modal = document.getElementById('confirmEmailModal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }, 300);
    }
}

// ===== EXPORTAR FUNÇÕES GLOBAIS =====
// As funções já estão sendo exportadas nos arquivos individuais
// Mas algumas precisam ser re-exportadas aqui para garantir

window.initializeApp = initializeApp;
window.loadAllData = loadAllData;
window.updateOnlineStatus = updateOnlineStatus;
window.shareAsApp = shareAsApp;
window.addShareButton = addShareButton;
window.closeCustomModal = closeCustomModal;
