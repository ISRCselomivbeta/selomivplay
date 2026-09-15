// ============================================================
// js/app.js — PLAY MY v9.2.0
// Bootstrap final: inicialização, sessão, listeners, aliases, PWA.
// Depende de TODOS os módulos anteriores.
// DEVE ser o ÚLTIMO script a carregar (exceto news-unified.js).
// ============================================================

// ============================================================
// INICIALIZAÇÃO DA APLICAÇÃO (após login)
// ============================================================
window.initializeApp = async function () {
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('mainApp').style.display = 'block';

  updateUserInterface();
  await loadAllData();

  loadYouTubeAPI();

  // Registra Service Worker (PWA)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
};

// ============================================================
// CARREGAR TODOS OS DADOS EM PARALELO
// ============================================================
window.loadAllData = async function () {
  showLoading('Carregando dados...');

  try {
    await Promise.all([
      loadMarketplace(),
      loadExternalMarketplace(),
      loadPortfolio(),
      loadLedger(),
      loadTopInvestments(),
      loadUserPlaylists(),
      loadGlobalPlaylists(),
      loadArtists(),
      loadTickets(),
      loadFollowing()
    ]);

    await updateBalanceDisplay();

    if (state.currentUser && state.currentUser.tipo === 'artista') {
      await loadArtistData();
    }

    if (state.currentUser && state.currentUser.tipo === 'admin') {
      await loadAdminData();
    }

    showToast('Sistema carregado!', 'success');
  } catch (e) {
    console.error('Erro ao carregar dados:', e);
    showToast('Alguns dados não carregaram', 'warning');
  } finally {
    hideLoading();
  }
};

// ============================================================
// BOOTSTRAP — DISPARA QUANDO O DOM ESTIVER PRONTO
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 PLAY MY v' + CONFIG.VERSION + ' — Modular');

  // Registra Service Worker imediatamente (PWA instalável)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  // 1. Health check inicial
  HealthCheck.runAll().catch(() => {});

  // 2. Health check periódico (a cada 3 minutos)
  setInterval(() => HealthCheck.runAll(), 180000);

  // 3. Restaura sessão salva
  const restored = restoreSession();

  if (restored) {
    await initializeApp();
  } else {
    hideLoading();
  }
});

// ============================================================
// PWA — INSTALAÇÃO (celular + PC)
// ============================================================
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  state.deferredInstallPrompt = e;
  const btn = document.getElementById('installAppBtn');
  if (btn) {
    btn.style.display = 'inline-block';
    btn.classList.remove('hidden');
  }
  console.log('📲 PWA: prompt de instalação disponível');
});

window.addEventListener('appinstalled', () => {
  console.log('✅ PWA: app instalado');
  state.deferredInstallPrompt = null;
  const btn = document.getElementById('installAppBtn');
  if (btn) btn.style.display = 'none';
  if (typeof showToast === 'function') {
    showToast('✅ App instalado! Procure o ícone PLAY MY na tela inicial.', 'success', 5000);
  }
});

window.installApp = async function () {
  if (state.deferredInstallPrompt) {
    try {
      state.deferredInstallPrompt.prompt();
      const choice = await state.deferredInstallPrompt.userChoice;
      console.log('📲 PWA: escolha do usuário =', choice.outcome);
      if (choice.outcome === 'accepted') {
        if (typeof showToast === 'function') {
          showToast('✅ Instalando PLAY MY...', 'success', 3000);
        }
      } else {
        if (typeof showToast === 'function') {
          showToast('Instalação cancelada', 'info', 3000);
        }
      }
      state.deferredInstallPrompt = null;
      const btn = document.getElementById('installAppBtn');
      if (btn) btn.style.display = 'none';
      return;
    } catch (e) {
      console.warn('Erro no prompt nativo:', e);
    }
  }

  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  const isAndroid = /Android/.test(ua);

  let msg = '';
  if (isIOS) {
    msg = '📱 No iPhone/iPad:\n\n1. Toque no botão Compartilhar (□↑)\n2. Escolha "Adicionar à Tela de Início"\n3. Confirme com "Adicionar"';
  } else if (isAndroid) {
    msg = '📱 No Android:\n\n1. Toque no menu (⋮) do navegador\n2. Escolha "Instalar app" ou "Adicionar à tela inicial"\n3. Confirme';
  } else {
    msg = '💻 No computador:\n\n1. Clique no ícone de instalação na barra de endereço\n2. Ou vá em Menu → "Instalar PLAY MY"\n3. Confirme';
  }

  alert(msg);
};

// ============================================================
// ALIASES GLOBAIS (compatibilidade total com HTML inline)
// ============================================================

// Auth (auth.js)
window.handleLogin = window.handleLogin || handleLogin;
window.handleRegister = window.handleRegister || handleRegister;
window.logout = window.logout || logout;
window.openResetPasswordModal = window.openResetPasswordModal || openResetPasswordModal;
window.sendResetEmail = window.sendResetEmail || sendResetEmail;
window.showRegisterForm = window.showRegisterForm || showRegisterForm;
window.showLoginForm = window.showLoginForm || showLoginForm;
window.toggleArtistField = window.toggleArtistField || toggleArtistField;

// Modals (modals.js)
window.showModal = window.showModal || showModal;
window.closeModal = window.closeModal || closeModal;
window.updateUserInterface = window.updateUserInterface || updateUserInterface;
window.updateBalanceDisplay = window.updateBalanceDisplay || updateBalanceDisplay;
window.openAddBalanceModal = window.openAddBalanceModal || openAddBalanceModal;
window.setBalanceAmount = window.setBalanceAmount || setBalanceAmount;
window.processBalanceAdd = window.processBalanceAdd || processBalanceAdd;
window.openWithdrawalModal = window.openWithdrawalModal || openWithdrawalModal;
window.requestWithdrawal = window.requestWithdrawal || requestWithdrawal;

// Marketplace (marketplace.js)
window.changeSection = window.changeSection || changeSection;
window.toggleSidebar = window.toggleSidebar || toggleSidebar;
window.loadMarketplace = window.loadMarketplace || loadMarketplace;
window.loadExternalMarketplace = window.loadExternalMarketplace || loadExternalMarketplace;
window.loadTopInvestments = window.loadTopInvestments || loadTopInvestments;
window.loadUserPlaylists = window.loadUserPlaylists || loadUserPlaylists;
window.loadGlobalPlaylists = window.loadGlobalPlaylists || loadGlobalPlaylists;
window.loadArtists = window.loadArtists || loadArtists;
window.loadFollowing = window.loadFollowing || loadFollowing;
window.loadTickets = window.loadTickets || loadTickets;
window.renderMarketplace = window.renderMarketplace || renderMarketplace;
window.renderRecommended = window.renderRecommended || renderRecommended;
window.renderExternalMarketplace = window.renderExternalMarketplace || renderExternalMarketplace;
window.renderTopInvestments = window.renderTopInvestments || renderTopInvestments;
window.renderArtists = window.renderArtists || renderArtists;
window.renderFeaturedArtists = window.renderFeaturedArtists || renderFeaturedArtists;
window.renderPlaylists = window.renderPlaylists || renderPlaylists;
window.renderFavorites = window.renderFavorites || renderFavorites;
window.renderGlobalPlaylists = window.renderGlobalPlaylists || renderGlobalPlaylists;
window.renderAdminGlobalPlaylists = window.renderAdminGlobalPlaylists || renderAdminGlobalPlaylists;
window.renderTickets = window.renderTickets || renderTickets;
window.performSearch = window.performSearch || performSearch;
window.displaySearchResults = window.displaySearchResults || displaySearchResults;
window.openInvestModal = window.openInvestModal || openInvestModal;
window.updateInvestmentTotal = window.updateInvestmentTotal || updateInvestmentTotal;
window.adjustQuantity = window.adjustQuantity || adjustQuantity;
window.confirmInvestment = window.confirmInvestment || confirmInvestment;
window.openInvestExternalModal = window.openInvestExternalModal || openInvestExternalModal;
window.updateExternalInvestmentTotal = window.updateExternalInvestmentTotal || updateExternalInvestmentTotal;
window.adjustExternalQuantity = window.adjustExternalQuantity || adjustExternalQuantity;
window.confirmExternalInvestment = window.confirmExternalInvestment || confirmExternalInvestment;
window.openAddExternalMusicModal = window.openAddExternalMusicModal || openAddExternalMusicModal;
window.submitExternalMusic = window.submitExternalMusic || submitExternalMusic;
window.openAddMusicModal = window.openAddMusicModal || openAddMusicModal;
window.analisarVideoYouTube = window.analisarVideoYouTube || analisarVideoYouTube;
window.finalizarCadastroComYouTube = window.finalizarCadastroComYouTube || finalizarCadastroComYouTube;
window.openCreatePlaylistModal = window.openCreatePlaylistModal || openCreatePlaylistModal;
window.createPlaylist = window.createPlaylist || createPlaylist;
window.playUserPlaylist = window.playUserPlaylist || playUserPlaylist;
window.openCreateGlobalPlaylistModal = window.openCreateGlobalPlaylistModal || openCreateGlobalPlaylistModal;
window.createGlobalPlaylist = window.createGlobalPlaylist || createGlobalPlaylist;
window.openManageGlobalPlaylist = window.openManageGlobalPlaylist || openManageGlobalPlaylist;
window.addMusicToGlobalPlaylist = window.addMusicToGlobalPlaylist || addMusicToGlobalPlaylist;
window.removeMusicFromGlobalPlaylist = window.removeMusicFromGlobalPlaylist || removeMusicFromGlobalPlaylist;
window.playGlobalPlaylist = window.playGlobalPlaylist || playGlobalPlaylist;
window.openCreateTicketModal = window.openCreateTicketModal || openCreateTicketModal;
window.createTicket = window.createTicket || createTicket;
window.redeemTicket = window.redeemTicket || redeemTicket;
window.toggleFollow = window.toggleFollow || toggleFollow;
window.toggleFavoriteMusic = window.toggleFavoriteMusic || toggleFavoriteMusic;

// Portfolio (portfolio.js)
window.loadPortfolio = window.loadPortfolio || loadPortfolio;
window.loadLedger = window.loadLedger || loadLedger;
window.loadArtistData = window.loadArtistData || loadArtistData;
window.loadAdminData = window.loadAdminData || loadAdminData;
window.renderPortfolio = window.renderPortfolio || renderPortfolio;
window.updatePortfolioValue = window.updatePortfolioValue || updatePortfolioValue;
window.renderLedger = window.renderLedger || renderLedger;
window.renderArtistMusic = window.renderArtistMusic || renderArtistMusic;

// Trades (trades.js)
window.openTradeModal = window.openTradeModal || openTradeModal;
window.createTradeOffer = window.createTradeOffer || createTradeOffer;
window.loadTradeOffers = window.loadTradeOffers || loadTradeOffers;
window.renderTrades = window.renderTrades || renderTrades;
window.renderTradeCard = window.renderTradeCard || renderTradeCard;
window.acceptTradeOffer = window.acceptTradeOffer || acceptTradeOffer;
window.declineTradeOffer = window.declineTradeOffer || declineTradeOffer;
window.cancelTradeOffer = window.cancelTradeOffer || cancelTradeOffer;

// Blockchain (blockchain.js)
window.openBlockchainExplorer = window.openBlockchainExplorer || openBlockchainExplorer;
window.loadBlockchainData = window.loadBlockchainData || loadBlockchainData;

// News (news-unified.js) — compatibilidade com botões existentes
window.pmNewsReload = window.pmNewsReload || function () {};
window.pmNewsLoadMore = window.pmNewsLoadMore || function () {};

// Player (player.js)
window.playTrack = window.playTrack || playTrack;
window.playExternalTrack = window.playExternalTrack || playExternalTrack;
window.playSearchResult = window.playSearchResult || playSearchResult;
window.togglePlay = window.togglePlay || togglePlay;
window.playNext = window.playNext || playNext;
window.playPrevious = window.playPrevious || playPrevious;
window.updatePlayerIcons = window.updatePlayerIcons || updatePlayerIcons;
window.toggleMute = window.toggleMute || toggleMute;
window.handleVolumeClick = window.handleVolumeClick || handleVolumeClick;
window.handleProgressClick = window.handleProgressClick || handleProgressClick;
window.handleExpandedProgressClick = window.handleExpandedProgressClick || handleExpandedProgressClick;
window.toggleShuffle = window.toggleShuffle || toggleShuffle;
window.toggleRepeat = window.toggleRepeat || toggleRepeat;
window.toggleFavorite = window.toggleFavorite || toggleFavorite;
window.openPlayerExpanded = window.openPlayerExpanded || openPlayerExpanded;
window.closePlayerExpanded = window.closePlayerExpanded || closePlayerExpanded;

// YouTube (youtube.js)
window.searchYouTubeDirect = window.searchYouTubeDirect || searchYouTubeDirect;
window.loadYouTubeAPI = window.loadYouTubeAPI || loadYouTubeAPI;
window.initializeYouTubePlayer = window.initializeYouTubePlayer || initializeYouTubePlayer;
window.updatePlayerProgress = window.updatePlayerProgress || updatePlayerProgress;

// API (api.js)
window.callAPI = window.callAPI || callAPI;
window.getFallbackData = window.getFallbackData || getFallbackData;

// ============================================================
// LOG FINAL
// ============================================================
console.log('✅ [app.js] v9.2.0 carregado — aplicação inicializada');
console.log('📦 Módulos ativos: config, utils, state, api, auth, youtube, player, marketplace, portfolio, trades, blockchain, modals, news-unified, app');
