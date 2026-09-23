// ============================================================
// js/app.js — PLAY MY v9.8.0
// Bootstrap final: inicialização, sessão, listeners, aliases, PWA.
// + Detecção de app nativo (Capacitor/TWA)
// + Safe areas (iPhone notch)
// + Status bar dinâmica
// + Splash screen handling
// + Deep linking (?section=)
// + INSTALAÇÃO INTELIGENTE via SIDEBAR (sem balão flutuante)
// Depende de TODOS os módulos anteriores.
// DEVE ser o ÚLTIMO script a carregar (exceto news-unified.js).
//
// MUDANÇAS v9.8.0:
//   - ETAPA 7: verificação periódica de update (30 min)
//   - ETAPA 7: verificação ao voltar o foco para a aba
//   - SW detecta nova versão automaticamente
//
// MUDANÇAS v9.7.0:
//   - SERVICE WORKER: detecção de update + toast "Nova versão"
//   - controllerchange → reload automático após ativação
//   - Registro do SW centralizado (registerServiceWorker)
//
// MUDANÇAS v9.6.0:
//   - REMOVIDO: balão flutuante do canto inferior direito
//   - MOVIDO: botão "Instalar App" para o SIDEBAR
//   - ID mudou de installAppBtn → installNavItem
//   - setupInstallButton() agora controla o item do menu
//
// MUDANÇAS v9.5.0:
//   - CORRIGIDO: showModal(id) — compatível com modals.js v9.0.0
//   - CORRIGIDO: installApp sobrescreve a versão do modals.js
//   - Modal de instruções criado DINAMICAMENTE (com ID fixo)
//
// MUDANÇAS v9.3.0:
//   - Detecção de ambiente nativo (Capacitor, TWA, standalone)
//   - Safe area insets (notch, home indicator)
//   - Status bar com cor dinâmica por scroll
//   - Splash screen escondida quando o app está pronto
//   - Bloqueio de gestos nativos (pull-to-refresh, pinch-zoom)
//   - Deep linking via URL (?section=marketplace)
//
// MUDANÇAS v9.2.0:
//   - Bootstrap com HealthCheck + restoreSession
//   - Aliases globais para compatibilidade com HTML inline
// ============================================================

// ============================================================
// DETECÇÃO DE AMBIENTE NATIVO
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
// APLICAR SAFE AREAS (notch, home indicator)
// ============================================================
function applySafeAreas() {
  const style = document.createElement('style');
  style.id = 'playmy-safe-areas';
  style.textContent = `
    :root {
      --safe-top: env(safe-area-inset-top, 0px);
      --safe-bottom: env(safe-area-inset-bottom, 0px);
      --safe-left: env(safe-area-inset-left, 0px);
      --safe-right: env(safe-area-inset-right, 0px);
    }

    body {
      padding-top: var(--safe-top);
      padding-left: var(--safe-left);
      padding-right: var(--safe-right);
    }

    .app-header {
      padding-top: var(--safe-top);
    }

    .player-miv {
      padding-bottom: var(--safe-bottom);
    }

    .sidebar {
      padding-top: var(--safe-top);
      padding-bottom: var(--safe-bottom);
    }

    .modal-content {
      max-height: calc(100vh - var(--safe-top) - var(--safe-bottom) - 40px);
    }

    * {
      -webkit-user-select: none;
      user-select: none;
      -webkit-touch-callout: none;
    }

    input, textarea, [contenteditable], .selectable {
      -webkit-user-select: text;
      user-select: text;
    }

    html, body {
      overscroll-behavior-y: contain;
    }

    * {
      touch-action: manipulation;
    }
  `;
  document.head.appendChild(style);
}

// ============================================================
// STATUS BAR DINÂMICA (iOS PWA + Capacitor)
// ============================================================
function setupStatusBar() {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;

  window.addEventListener('scroll', () => {
    const currentScroll = window.scrollY;
    meta.setAttribute('content', currentScroll > 50 ? '#0a0a0a' : '#000000');
  }, { passive: true });
}

// ============================================================
// SPLASH SCREEN (esconder quando o app estiver pronto)
// ============================================================
function hideSplashScreen() {
  const splash = document.getElementById('loadingScreen');
  if (!splash) return;
  if (splash.style.display === 'none') return;

  splash.style.transition = 'opacity 0.4s ease, visibility 0.4s ease';
  splash.style.opacity = '0';
  splash.style.visibility = 'hidden';

  setTimeout(() => {
    splash.style.display = 'none';
  }, 400);
}

// ============================================================
// BLOQUEIO DE GESTOS NATIVOS
// ============================================================
function blockNativeGestures() {
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('gesturechange', (e) => e.preventDefault());
  document.addEventListener('gestureend', (e) => e.preventDefault());

  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
      e.preventDefault();
    }
    lastTouchEnd = now;
  }, { passive: false });

  document.addEventListener('touchstart', (e) => {
    if (e.touches.length > 1) {
      e.preventDefault();
    }
  }, { passive: false });
}

// ============================================================
// DEEP LINKING (abrir direto numa seção via URL)
// ============================================================
function handleDeepLink() {
  const params = new URLSearchParams(window.location.search);
  const section = params.get('section');
  if (section && typeof changeSection === 'function') {
    setTimeout(() => {
      try {
        changeSection(section);
        console.log('🔗 Deep link →', section);
      } catch (e) {
        console.warn('⚠️ Deep link falhou:', e);
      }
    }, 500);
  }

  const sharedUrl = params.get('url');
  const sharedTitle = params.get('title');
  const sharedText = params.get('text');
  if (sharedUrl || sharedTitle || sharedText) {
    console.log('📤 Compartilhado:', { sharedUrl, sharedTitle, sharedText });
    setTimeout(() => {
      if (sharedUrl && typeof openAddExternalMusicModal === 'function') {
        openAddExternalMusicModal();
        setTimeout(() => {
          const field = document.getElementById('externalYoutubeLinkField');
          if (field) field.value = sharedUrl;
          const titleField = document.getElementById('externalTitleField');
          if (titleField && sharedTitle) titleField.value = sharedTitle;
        }, 300);
      }
    }, 1000);
  }
}

// ============================================================
// SERVICE WORKER — registro + detecção de update (v9.8.0)
// ============================================================
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.register('/sw.js', {
    scope: '/',
    updateViaCache: 'none'
  })
    .then((registration) => {
      console.log('✅ [SW] registrado. Scope:', registration.scope);

      // Checa update a cada 30s
      setInterval(() => {
        registration.update().catch(() => {});
      }, 30000);

      // Detecta novo SW sendo instalado
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('🆕 [SW] Nova versão disponível');
            if (typeof showToast === 'function') {
              showToast('🆕 Nova versão disponível — recarregue', 'info', 6000);
            }
          }
        });
      });

      // Verificação ao voltar o foco para a aba
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          registration.update().catch(() => {});
        }
      });
    })
    .catch((err) => {
      console.error('❌ [SW] falha no registro:', err);
    });

  // 🚨 REMOVIDO: o location.reload() causava flash de versão antiga
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.log('🔄 [SW] Novo SW assumiu o controle (sem reload)');
  });
}

// ============================================================
// INICIALIZAÇÃO DA APLICAÇÃO (após login)
// ============================================================
window.initializeApp = async function () {
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('mainApp').style.display = 'block';

  updateUserInterface();
  await loadAllData();

  loadYouTubeAPI();

  // SW com detecção de update
  registerServiceWorker();

  setTimeout(hideSplashScreen, 300);
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
  console.log('📱 Plataforma:', APP_ENV.platform, '| PWA:', APP_ENV.isPWA, '| Nativo:', APP_ENV.isNative);

  applySafeAreas();
  setupStatusBar();
  blockNativeGestures();

  // SW com detecção de update
  registerServiceWorker();

  // 1. Health check inicial
  HealthCheck.runAll().catch(() => {});

  // 2. Health check periódico (a cada 3 minutos)
  setInterval(() => HealthCheck.runAll(), 180000);

  // 3. Configura item de instalação no sidebar
  setupInstallButton();

  // 4. Restaura sessão salva
  const restored = restoreSession();

  if (restored) {
    await initializeApp();
  } else {
    hideLoading();
    setTimeout(hideSplashScreen, 800);
  }
});

// ============================================================
// PWA — INSTALAÇÃO INTELIGENTE via SIDEBAR (v9.6.0)
// Compatível com showModal(id) do modals.js v9.0.0
// ============================================================

// Detecta se o app já está instalado
function isPWAInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true ||
         document.referrer.includes('android-app://') ||
         (window.Capacitor && window.Capacitor.isNative);
}

// Mostra/esconde o ITEM DE INSTALAÇÃO NO SIDEBAR
function setupInstallButton() {
  const navItem = document.getElementById('installNavItem');
  if (!navItem) return;

  if (isPWAInstalled() || APP_ENV.isNative) {
    navItem.style.display = 'none';
    return;
  }

  // Mostra o item no menu lateral
  navItem.style.display = 'block';
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

  const navItem = document.getElementById('installNavItem');
  if (navItem) navItem.style.display = 'none';

  if (typeof showToast === 'function') {
    showToast('✅ App instalado! Procure o ícone PLAY MY na tela inicial.', 'success', 5000);
  }
});

// ============================================================
// INSTALAÇÃO — FLUXO INTELIGENTE (v9.6.0)
// SOBRESCREVE a versão simples do modals.js
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
      setupInstallButton();
      return;
    } catch (e) {
      console.warn('Erro no prompt nativo:', e);
    }
  }

  // 4. Fallback: modal com instruções por plataforma
  showInstallInstructions();
};

// ============================================================
// MODAL DE INSTRUÇÕES — CRIA DINAMICAMENTE
// ============================================================
function showInstallInstructions() {
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  const isAndroid = /Android/.test(ua);

  const MODAL_ID = 'installInstructionsModal';

  const old = document.getElementById(MODAL_ID);
  if (old) old.remove();

  let conteudo;

  if (isIOS) {
    conteudo = `
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
    conteudo = `
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
    conteudo = `
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

  const modal = document.createElement('div');
  modal.id = MODAL_ID;
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 420px; margin: 10% auto;">
      <div style="display:flex; justify-content:space-between; align-items:center; padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.08);">
        <h3 style="margin:0; color:#fff; font-size:18px;">📲 Instalar PLAY MY</h3>
        <button onclick="closeModal('${MODAL_ID}')" 
                style="background:none;border:none;color:#888;font-size:24px;cursor:pointer;padding:0 8px;">×</button>
      </div>
      <div style="padding: 20px;">
        ${conteudo}
      </div>
      <div style="padding: 12px 20px 20px; text-align:center;">
        <button onclick="closeModal('${MODAL_ID}')" 
                style="background:linear-gradient(135deg,#ff2d55,#ff6b35);color:#fff;border:none;border-radius:12px;padding:12px 28px;font-size:15px;font-weight:600;cursor:pointer;">
          Entendi
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  if (typeof showModal === 'function') {
    try {
      showModal(MODAL_ID);
      console.log('📲 Modal de instruções aberto');
      return;
    } catch (e) {
      console.warn('showModal falhou:', e);
    }
  }

  modal.classList.add('show');
  document.body.style.overflow = 'hidden';
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
window.updatePortfolioMetrics = window.updatePortfolioMetrics || updatePortfolioMetrics;
window.renderLedger = window.renderLedger || renderLedger;
window.renderArtistMusic = window.renderArtistMusic || renderArtistMusic;
window.loadDividends = window.loadDividends || loadDividends;
window.carregarELOsEValuations = window.carregarELOsEValuations || carregarELOsEValuations;

// Sell modal (portfolio.js v9.4.0)
window.openSellModal = window.openSellModal || openSellModal;
window.updateSellTotal = window.updateSellTotal || updateSellTotal;
window.adjustSellQuantity = window.adjustSellQuantity || adjustSellQuantity;
window.setSellPrice = window.setSellPrice || setSellPrice;
window.confirmSell = window.confirmSell || confirmSell;

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

// News (news-unified.js)
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
// DEEP LINK — roda depois do boot
// ============================================================
window.addEventListener('load', () => {
  setTimeout(handleDeepLink, 1000);
});

// ============================================================
// LOG FINAL
// ============================================================
console.log('✅ [app.js] v9.8.0 carregado — aplicação inicializada');
console.log('📦 Módulos ativos: config, utils, state, api, auth, youtube, player, marketplace, portfolio, trades, blockchain, modals, news-unified, app');
console.log('🌍 Modo:', APP_ENV.platform, '| PWA:', APP_ENV.isPWA, '| Nativo:', APP_ENV.isNative);
console.log('📲 Instalação via sidebar ativa — v9.8.0');
