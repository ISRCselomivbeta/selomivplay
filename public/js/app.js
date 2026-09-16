// ============================================================
// js/app.js — PLAY MY v9.4.0
// Bootstrap final: inicialização, sessão, listeners, aliases, PWA.
// + INSTALAÇÃO INTELIGENTE (baixar e virar app na hora)
// + Detecção de ambiente nativo (Capacitor/TWA)
// + Modal de instruções por plataforma
// Depende de TODOS os módulos anteriores.
// DEVE ser o ÚLTIMO script a carregar (exceto news-unified.js).
//
// MUDANÇAS v9.4.0:
//   - installApp() reescrito: prompt nativo + modal de fallback
//   - Botão "Instalar App" sempre visível (se não instalado)
//   - Detecta se já está instalado (standalone/TWA/Capacitor)
//   - Modal bonito com instruções por plataforma (iOS/Android/Desktop)
//   - Re-registra SW após instalação
//   - Deep link (?section=) preservado após instalar
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
// DETECÇÃO DE AMBIENTE NATIVO / PWA
// ============================================================
window.APP_ENV = (function () {
  const ua = navigator.userAgent || '';
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                       window.navigator.standalone === true;
  const isCapacitor = !!(window.Capacitor && window.Capacitor.isNative);
  const isTWA = document.referrer.includes('android-app://');
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  const isAndroid = /Android/.test(ua);

  return {
    isStandalone,
    isCapacitor,
    isTWA,
    isIOS,
    isAndroid,
    isNative: isCapacitor || isTWA,
    isPWA: isStandalone && !isCapacitor && !isTWA,
    platform: isIOS ? 'ios' : (isAndroid ? 'android' : 'web')
  };
})();

console.log('🌍 Ambiente:', window.APP_ENV);

// ============================================================
// BOOTSTRAP — DISPARA QUANDO O DOM ESTIVER PRONTO
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 PLAY MY v' + CONFIG.VERSION + ' — Modular');
  console.log('📱 Plataforma:', APP_ENV.platform, '| PWA:', APP_ENV.isPWA, '| Nativo:', APP_ENV.isNative);

  // Registra Service Worker imediatamente (PWA instalável)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  // 1. Health check inicial
  HealthCheck.runAll().catch(() => {});

  // 2. Health check periódico (a cada 3 minutos)
  setInterval(() => HealthCheck.runAll(), 180000);

  // 3. Configura botão de instalação
  setupInstallButton();

  // 4. Restaura sessão salva
  const restored = restoreSession();

  if (restored) {
    await initializeApp();
  } else {
    hideLoading();
  }
});

// ============================================================
// PWA — INSTALAÇÃO INTELIGENTE (v9.4.0)
// ============================================================

// Detecta se o app já está instalado
function isPWAInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true ||
         document.referrer.includes('android-app://') ||
         (window.Capacitor && window.Capacitor.isNative);
}

// Mostra/esconde o botão de instalação conforme o estado
function setupInstallButton() {
  const btn = document.getElementById('installAppBtn');
  if (!btn) return;

  if (isPWAInstalled() || APP_ENV.isNative) {
    btn.style.display = 'none';
    btn.classList.add('hidden');
    return;
  }

  // Sempre visível se não instalado
  btn.style.display = 'inline-block';
  btn.classList.remove('hidden');
  btn.textContent = '📲 Instalar App';
  btn.onclick = (e) => {
    e.preventDefault();
    installApp();
  };
}

// Prompt nativo disponível (Android Chrome)
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  state.deferredInstallPrompt = e;
  console.log('📲 PWA: prompt nativo disponível');
  setupInstallButton();
});

// App instalado
window.addEventListener('appinstalled', () => {
  console.log('✅ PWA: app instalado');
  state.deferredInstallPrompt = null;
  const btn = document.getElementById('installAppBtn');
  if (btn) {
    btn.style.display = 'none';
    btn.classList.add('hidden');
  }
  if (typeof showToast === 'function') {
    showToast('✅ App instalado! Procure o ícone PLAY MY na tela inicial.', 'success', 5000);
  }
});

// ============================================================
// INSTALAÇÃO — FLUXO INTELIGENTE
// ============================================================
window.installApp = async function () {
  // 1. Já é nativo (Capacitor/TWA)
  if (APP_ENV.isNative) {
    if (typeof showToast === 'function') {
      showToast('Você já está usando o app nativo!', 'success');
    }
    return;
  }

  // 2. Já está instalado como PWA
  if (isPWAInstalled()) {
    if (typeof showToast === 'function') {
      showToast('O app já está instalado! Procure o ícone PLAY MY.', 'success');
    }
    return;
  }

  // 3. Prompt nativo (Android Chrome) — 1 toque
  if (state.deferredInstallPrompt) {
    try {
      state.deferredInstallPrompt.prompt();
      const choice = await state.deferredInstallPrompt.userChoice;
      console.log('📲 PWA: escolha =', choice.outcome);

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
      if (btn) {
        btn.style.display = 'none';
        btn.classList.add('hidden');
      }
      return;
    } catch (e) {
      console.warn('Erro no prompt nativo:', e);
    }
  }

  // 4. Fallback: modal com instruções por plataforma
  showInstallInstructions();
};

// ============================================================
// MODAL DE INSTRUÇÕES (fallback bonito)
// ============================================================
function showInstallInstructions() {
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  const isAndroid = /Android/.test(ua);

  let title, html;

  if (isIOS) {
    title = '📲 Instalar PLAY MY';
    html = `
      <div style="text-align:center; padding: 8px 4px;">
        <p style="font-size:16px; margin-bottom:18px; color:#fff;">
          No iPhone/iPad (Safari):
        </p>
        <ol style="text-align:left; font-size:15px; line-height:1.9; color:#ddd; padding-left:20px;">
          <li>Toque no botão <b style="color:#ff2d55;">Compartilhar</b> (□↑) na barra inferior</li>
          <li>Role e escolha <b style="color:#ff2d55;">"Adicionar à Tela de Início"</b></li>
          <li>Toque em <b style="color:#ff2d55;">"Adicionar"</b></li>
        </ol>
        <p style="margin-top:18px; color:#888; font-size:13px;">
          O ícone PLAY MY aparecerá na sua tela inicial.
        </p>
      </div>
    `;
  } else if (isAndroid) {
    title = '📲 Instalar PLAY MY';
    html = `
      <div style="text-align:center; padding: 8px 4px;">
        <p style="font-size:16px; margin-bottom:18px; color:#fff;">
          No Android (Chrome):
        </p>
        <ol style="text-align:left; font-size:15px; line-height:1.9; color:#ddd; padding-left:20px;">
          <li>Toque no menu <b style="color:#ff2d55;">⋮</b> (três pontos) no canto superior</li>
          <li>Escolha <b style="color:#ff2d55;">"Instalar app"</b> ou <b style="color:#ff2d55;">"Adicionar à tela inicial"</b></li>
          <li>Confirme tocando em <b style="color:#ff2d55;">"Instalar"</b></li>
        </ol>
        <p style="margin-top:18px; color:#888; font-size:13px;">
          Pronto! O app abre em tela cheia, sem barra do navegador.
        </p>
      </div>
    `;
  } else {
    title = '📲 Instalar PLAY MY';
    html = `
      <div style="text-align:center; padding: 8px 4px;">
        <p style="font-size:16px; margin-bottom:18px; color:#fff;">
          No computador:
        </p>
        <ol style="text-align:left; font-size:15px; line-height:1.9; color:#ddd; padding-left:20px;">
          <li>Clique no ícone de <b style="color:#ff2d55;">instalação</b> na barra de endereço</li>
          <li>Ou vá em <b style="color:#ff2d55;">Menu → "Instalar PLAY MY"</b></li>
          <li>Confirme</li>
        </ol>
      </div>
    `;
  }

  // Usa o showModal do seu módulo, se existir
  if (typeof showModal === 'function') {
    showModal({
      title: title,
      content: html,
      hideFooter: true
    });
    return;
  }

  // Fallback: alert simples
  alert(html.replace(/<[^>]+>/g, '').trim());
}

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

// PWA (v9.4.0)
window.installApp = window.installApp || installApp;

// ============================================================
// LOG FINAL
// ============================================================
console.log('✅ [app.js] v9.4.0 carregado — aplicação inicializada');
console.log('📦 Módulos ativos: config, utils, state, api, auth, youtube, player, marketplace, portfolio, trades, blockchain, modals, news-unified, app');
console.log('🌍 Modo:', APP_ENV.platform, '| PWA:', APP_ENV.isPWA, '| Nativo:', APP_ENV.isNative);
console.log('📲 Instalação inteligente ativa — v9.4.0');
