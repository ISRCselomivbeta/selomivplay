// ============================================================
// APP.JS - Inicialização e funções globais PLAY MY
// ============================================================

async function updateBalanceDisplay(force = false) {
    const el = document.getElementById('currentBalance');
    if (!el) return;
    if (!state.currentUser?.id) { el.textContent = formatCurrency(0); return; }
    if (!force && !canMakeRequest('Saldo')) return;
    registerRequest('Saldo');
    try {
        const result = await callAPI('get_saldo', { user_id: state.currentUser.id });
        if (result?.success && result.data) {
            state.userBalance = result.data.saldo_disponivel || 0;
            el.textContent = formatCurrency(state.userBalance);
        } else el.textContent = formatCurrency(state.userBalance);
    } catch (error) {
        el.textContent = formatCurrency(state.userBalance);
    }
}

function updateUserInterface() {
    if (!state.currentUser) return;
    const badge = document.getElementById('userBadge');
    if (badge) {
        badge.textContent = state.currentUser.tipo === 'admin' ? 'Admin' : (state.currentUser.tipo === 'artista' ? 'Artista' : 'Ouvinte');
        badge.style.background = state.currentUser.tipo === 'admin' ? '#ff3232' : (state.currentUser.tipo === 'artista' ? '#007bff' : 'var(--neon-green)');
    }
    const artistNav = document.getElementById('artistNavItem');
    if (artistNav) artistNav.style.display = (state.currentUser.tipo === 'artista' || state.currentUser.tipo === 'admin') ? 'block' : 'none';
    updateBalanceDisplay();
}

function changeSection(section) {
    const activeSection = document.querySelector('.section.active');
    if (activeSection) localStorage.setItem('lastSection', activeSection.id.replace('Section', ''));
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    const sectionElement = document.getElementById(section + 'Section');
    if (sectionElement) sectionElement.classList.add('active');
    toggleSidebar();
    window.scrollTo(0, 0);
}

function toggleSidebar() {
    document.getElementById('sidebar')?.classList.toggle('open');
}

async function loadUserFavorites() {
    if (!state.currentUser?.id) return;
    const cached = localStorage.getItem(`miv_favorites_${state.currentUser.id}`);
    if (cached) {
        try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed)) state.favoriteMusicIds = parsed;
        } catch (e) {}
    }
    try {
        const result = await callAPI('get_user_profile', { user_id: state.currentUser.id });
        if (result.success && result.data) {
            let favorites = [];
            if (result.data.favorite_music_ids) {
                if (Array.isArray(result.data.favorite_music_ids)) favorites = result.data.favorite_music_ids;
                else if (typeof result.data.favorite_music_ids === 'string') favorites = result.data.favorite_music_ids.split(',').filter(id => id.trim() !== '');
            }
            state.favoriteMusicIds = favorites;
            localStorage.setItem(`miv_favorites_${state.currentUser.id}`, JSON.stringify(favorites));
        }
    } catch (error) { console.error(error); }
}

function createOfflineBadge() {
    let badge = document.getElementById('offlineBadge');
    if (!badge) {
        badge = document.createElement('div');
        badge.id = 'offlineBadge';
        badge.className = 'offline-badge';
        badge.innerHTML = '<i class="bi bi-wifi-off"></i> Modo Offline';
        document.body.appendChild(badge);
    }
    return badge;
}

function updateOnlineStatus() {
    const badge = createOfflineBadge();
    if (navigator.onLine) badge.style.display = 'none';
    else badge.style.display = 'block';
}

window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

// ============================================================
// EXPOR FUNÇÕES GLOBALMENTE (para onclick)
// ============================================================
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.logout = logout;
window.toggleSidebar = toggleSidebar;
window.changeSection = changeSection;
window.showRegisterForm = showRegisterForm;
window.showLoginForm = showLoginForm;
window.toggleArtistField = toggleArtistField;
window.resendConfirmationEmail = resendConfirmationEmail;
window.playTrack = playTrack;
window.playExternalTrack = playExternalTrack;
window.togglePlay = togglePlay;
window.playNext = playNext;
window.playPrevious = playPrevious;
window.toggleShuffle = toggleShuffle;
window.toggleRepeat = toggleRepeat;
window.toggleMute = toggleMute;
window.handleVolumeClick = handleVolumeClick;
window.toggleFavorite = toggleFavorite;
window.toggleFavoriteMusic = toggleFavoriteMusic;
window.openInvestModalFromPlayer = openInvestModalFromPlayer;
window.openAddBalanceModal = openAddBalanceModal;
window.openWithdrawalModal = openWithdrawalModal;
window.openCreatePlaylistModal = openCreatePlaylistModal;
window.openAddExternalMusicModal = openAddExternalMusicModal;
window.openAddMusicModal = openAddMusicModal;
window.closeModal = closeModal;
window.adjustQuantity = adjustQuantity;
window.adjustExternalQuantity = adjustExternalQuantity;
window.confirmInvestment = confirmInvestment;
window.confirmExternalInvestment = confirmExternalInvestment;
window.submitExternalMusic = submitExternalMusic;
window.registerMusic = registerMusic;
window.createPlaylist = createPlaylist;
window.requestWithdrawal = requestWithdrawal;
window.processBalanceAdd = processBalanceAdd;
window.setBalanceAmount = setBalanceAmount;
window.exportExtrato = exportExtrato;
window.printContract = printContract;
window.loadMarketplace = loadMarketplace;
window.loadExternalMarketplace = loadExternalMarketplace;
window.loadPortfolio = loadPortfolio;
window.loadLedger = loadLedger;
window.loadTopInvestments = loadTopInvestments;
window.loadArtistData = loadArtistData;
window.viewContract = viewContract;
window.updateInvestmentTotal = updateInvestmentTotal;
window.updateExternalInvestmentTotal = updateExternalInvestmentTotal;
window.validateBalanceAmount = validateBalanceAmount;
window.validateWithdrawalAmount = validateWithdrawalAmount;
window.openEditMusicModal = openEditMusicModal;
window.updateMusic = updateMusic;
window.pauseMusic = pauseMusic;
window.unpauseMusic = unpauseMusic;
window.requestDeleteMusic = requestDeleteMusic;
window.openBlockchainExplorer = openBlockchainExplorer;
window.showELORanking = showELORanking;
window.openTradeModal = openTradeModal;
window.adjustTradeQuantity = adjustTradeQuantity;
window.updateTradeCalculation = updateTradeCalculation;
window.searchUserByEmail = searchUserByEmail;
window.selectUser = selectUser;
window.createTradeOffer = createTradeOffer;
window.loadTradeOffers = loadTradeOffers;
window.switchTradeTab = switchTradeTab;
window.acceptTradeOffer = acceptTradeOffer;
window.declineTradeOffer = declineTradeOffer;
window.cancelTradeOffer = cancelTradeOffer;
window.openTermsModal = openTermsModal;
window.openPrivacyModal = openPrivacyModal;
window.acceptTermsFromModal = acceptTermsFromModal;
window.openPlayerExpanded = openPlayerExpanded;
window.closePlayerExpanded = closePlayerExpanded;
window.handleProgressClick = handleProgressClick;
window.handleExpandedProgressClick = handleExpandedProgressClick;
window.gerarBlocosSimuladosParaVisualizacao = gerarBlocosSimuladosParaVisualizacao;
window.autoFillMusicInfo = autoFillMusicInfo;
window.fallbackFillMusicInfo = fallbackFillMusicInfo;
window.analisarVideoYouTube = analisarVideoYouTube;
window.aplicarValorYouTube = aplicarValorYouTube;
window.finalizarCadastroComYouTube = finalizarCadastroComYouTube;
window.performSearch = performSearch;
window.playSearchResult = playSearchResult;
window.filterMarketplace = filterMarketplace;
window.switchMyMusicTab = switchMyMusicTab;
window.loadUserStreamingHistory = loadUserStreamingHistory;
window.closeCustomModal = closeCustomModal;
window.resendConfirmationEmailFromModal = resendConfirmationEmailFromModal;
window.renderMarketplace = renderMarketplace;
window.renderExternalMarketplace = renderExternalMarketplace;
window.renderPortfolio = renderPortfolio;
window.renderLedger = renderLedger;
window.renderPlaylists = renderPlaylists;
window.loadUserFavorites = loadUserFavorites;
window.loadBlockchainData = loadBlockchainData;

// ============================================================
// INICIALIZAÇÃO
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 PLAY MY v' + CONFIG.VERSION);

    createOfflineBadge();
    updateOnlineStatus();

    const stored = localStorage.getItem('miv_user');
    if (stored) {
        try {
            state.currentUser = JSON.parse(stored);
            state.userBalance = state.currentUser.saldo || 0;
            if (state.currentUser.favorite_music_ids) {
                if (Array.isArray(state.currentUser.favorite_music_ids)) state.favoriteMusicIds = state.currentUser.favorite_music_ids;
                else if (typeof state.currentUser.favorite_music_ids === 'string') state.favoriteMusicIds = state.currentUser.favorite_music_ids.split(',').filter(id => id.trim() !== '');
                else state.favoriteMusicIds = [];
            } else state.favoriteMusicIds = [];

            setTimeout(() => loadYouTubeAPI(), 2000);
            initializeApp();
        } catch (e) {
            console.error('Erro restaurar sessão:', e);
            localStorage.removeItem('miv_user');
            hideLoading();
        }
    } else {
        hideLoading();
        setTimeout(() => loadYouTubeAPI(), 3000);
    }
});

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        if (state.streamingTimer) { clearInterval(state.streamingTimer); state.streamingTimer = null; }
    } else {
        if (state.isPlaying && state.playerReady) startStreamingMonitor();
    }
});

// Salvar estado periodicamente
setInterval(() => {
    if (!state.currentUser) return;
    const appState = {
        user: state.currentUser,
        balance: state.userBalance,
        favorites: state.favoriteMusicIds,
        timestamp: Date.now()
    };
    localStorage.setItem('miv_app_state', JSON.stringify(appState));
}, 60000);
