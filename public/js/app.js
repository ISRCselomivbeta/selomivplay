// ============================================================
// js/app.js — PLAY MY v9.8.6
// Bootstrap final: inicialização, sessão, listeners, aliases, PWA.
// + Detecção de app nativo (Capacitor/TWA)
// + Safe areas (iPhone notch)
// + Status bar dinâmica
// + Splash screen handling
// + Deep linking (?section=, ?music=ID)
// + INSTALAÇÃO INTELIGENTE via SIDEBAR (sem balão flutuante)
// + loadAllData em 4 ETAPAS SEQUENCIAIS
// Depende de TODOS os módulos anteriores.
// DEVE ser o ÚLTIMO script a carregar (exceto news-unified.js).
//
// MUDANÇAS v9.8.6:
//   - 🆕 Deep link ?music=ID integrado na Etapa 1 do loadAllData
//        (toca automaticamente ao abrir /?music=123)
//   - 🆕 Fallback de ?music=ID no handleDeepLink
//        (caso a Etapa 1 falhe ou demore, tenta de novo no window.load)
//   - ✅ NADA MAIS MUDOU — comportamento idêntico ao v9.8.5
//
// MUDANÇAS v9.8.5:
//   - 🐛 FIX: aliases globais protegidos com typeof (evita ReferenceError
//        se alguma função não existir — era o que quebrava o app em prod)
//   - 🐛 FIX: loadArtistData / loadAdminData agora checam typeof antes
//   - 🐛 FIX: HealthCheck com backoff exponencial (não sobrecarrega)
//   - ✅ NADA MAIS MUDOU — comportamento idêntico ao v9.8.4
//
// MUDANÇAS v9.8.4:
//   - 🆕 loadAllData() reescrita em 4 etapas (Etapa 1 → Etapa 4)
//   - 🆕 hideLoading movido para depois da Etapa 1 (app usável mais rápido)
//   - 🆕 try/catch por etapa (falha de uma não bloqueia as outras)
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
// SPLASH SCREEN
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
// DEEP LINKING
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

  // 🆕 v9.8.6 — Deep link /?music=ID (fallback)
  // Roda no window.load. Se a Etapa 1 do loadAllData já tocou, este bloco
  // detecta que a música já está tocando e NÃO retoca (evita duplo playTrack).
  const musicId = params.get('music');
  if (musicId && typeof state !== 'undefined' && Array.isArray(state.playlist)) {
    const idx = state.playlist.findIndex(m => String(m.id) === String(musicId));
    if (idx >= 0 && typeof playTrack === 'function') {
      const current = state.playlist[state.currentTrackIndex];
      const jaTocando = current && String(current.id) === String(musicId);

      if (!jaTocando) {
        setTimeout(() => {
          try {
            playTrack(idx);
            console.log('🔗 [deep-link/fallback] tocando música', musicId, '→ índice', idx);
            if (window.history && window.history.replaceState) {
              window.history.replaceState({}, '', window.location.pathname);
            }
          } catch (e) {
            console.warn('⚠️ [deep-link/fallback] falhou:', e);
          }
        }, 500);
      } else {
        console.log('🔗 [deep-link/fallback] música', musicId, 'já está tocando — ignorando');
      }
    } else {
      console.warn('⚠️ [deep-link/fallback] música', musicId, 'não encontrada na playlist');
    }
  }
}

// ============================================================
// SERVICE WORKER — registro + detecção de update
// ============================================================
let __swRegistered = false;
let __swRefreshing = false;
const __swHadController = !!navigator.serviceWorker.controller;

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  if (__swRegistered) return;
  __swRegistered = true;

  navigator.serviceWorker.register('/sw.js', {
    scope: '/',
    updateViaCache: 'none'
  })
    .then((registration) => {
      console.log('✅ [SW] registrado. Scope:', registration.scope);

      setInterval(() => {
        registration.update().catch(() => {});
      }, 30000);

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('🆕 [SW] Nova versão instalada — ativando...');

            newWorker.postMessage({ type: 'SKIP_WAITING' });

            if (typeof showToast === 'function') {
              showToast('🆕 Atualizando para nova versão...', 'info', 3000);
            }
          }
        });
      });

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          registration.update().catch(() => {});
        }
      });
    })
    .catch((err) => {
      console.error('❌ [SW] falha no registro:', err);
    });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (__swRefreshing) return;

    if (!__swHadController) {
      console.log('🔄 [SW] Primeiro SW assumiu o controle (sem reload)');
      return;
    }

    __swRefreshing = true;
    console.log('🔄 [SW] Novo SW assumiu o controle — recarregando');
    window.location.reload();
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

  try {
    if (typeof window.renderMarketplace === 'function') window.renderMarketplace();
    if (typeof window.renderGlobalPlaylists === 'function') window.renderGlobalPlaylists();
    if (typeof window.renderFeaturedArtists === 'function') window.renderFeaturedArtists();
    if (typeof window.renderRecommended === 'function') window.renderRecommended();
    console.log('✅ [app] re-render pós-loadAllData concluído');
  } catch (e) {
    console.warn('⚠️ [app] re-render falhou:', e);
  }

  loadYouTubeAPI();

  registerServiceWorker();

  setTimeout(hideSplashScreen, 300);
};

// ============================================================
// CARREGAR DADOS EM 4 ETAPAS SEQUENCIAIS
// ============================================================
window.loadAllData = async function () {
  showLoading('Carregando dados...');

  // ------------------------------------------------------------
  // ETAPA 1 — CRÍTICA
  // ------------------------------------------------------------
  try {
    console.log('📦 [app] Etapa 1/4 — dados críticos');
    await Promise.allSettled([
      updateBalanceDisplay(),
      loadUserPlaylists(),
      (async () => {
        try {
          if (typeof callAPI === 'function') {
            const r = await callAPI('get_musicas');
            if (r && r.success && Array.isArray(r.data)) {
              state.playlist = r.data;
              if (typeof window.renderMarketplace === 'function') {
                window.renderMarketplace();
              }

              // 🆕 v9.8.6 — Deep link /?music=ID
              // Executa assim que a playlist existe, garantindo que a música
              // está disponível para tocar. Limpa a query depois pra não
              // retocar em refresh.
              try {
                const params = new URLSearchParams(window.location.search);
                const musicId = params.get('music');
                if (musicId) {
                  const idx = state.playlist.findIndex(
                    m => String(m.id) === String(musicId)
                  );
                  if (idx >= 0 && typeof playTrack === 'function') {
                    console.log('🔗 [deep-link] tocando música', musicId, '→ índice', idx);
                    playTrack(idx);
                    if (window.history && window.history.replaceState) {
                      window.history.replaceState({}, '', window.location.pathname);
                    }
                  } else {
                    console.warn('⚠️ [deep-link] música', musicId, 'não encontrada na playlist');
                  }
                }
              } catch (e) {
                console.warn('⚠️ [deep-link] falhou:', e.message);
              }
            }
          }
        } catch (e) {
          console.warn('⚠️ [app] Etapa 1 get_musicas falhou:', e.message);
        }
      })()
    ]);
  } catch (e) {
    console.warn('⚠️ [app] Etapa 1 falhou:', e.message);
  }

  hideLoading();

  // ------------------------------------------------------------
  // ETAPA 2 — DADOS DO USUÁRIO
  // ------------------------------------------------------------
  try {
    console.log('📦 [app] Etapa 2/4 — dados do usuário');
    await Promise.allSettled([
      loadPortfolio(),
      loadLedger(),
      loadFollowing()
    ]);
  } catch (e) {
    console.warn('⚠️ [app] Etapa 2 falhou:', e.message);
  }

  // ------------------------------------------------------------
  // ETAPA 3 — RANKINGS E ARTISTAS
  // ------------------------------------------------------------
  try {
    console.log('📦 [app] Etapa 3/4 — rankings e artistas');
    await Promise.allSettled([
      loadMarketplace(),
      loadArtists()
    ]);
  } catch (e) {
    console.warn('⚠️ [app] Etapa 3 falhou:', e.message);
  }

  // ------------------------------------------------------------
  // ETAPA 4 — SECUNDÁRIO
  // ------------------------------------------------------------
  try {
    console.log('📦 [app] Etapa 4/4 — dados secundários');
    await Promise.allSettled([
      loadTopInvestments(),
      loadTickets(),
      loadExternalMarketplace(),
      loadGlobalPlaylists()
    ]);
  } catch (e) {
    console.warn('⚠️ [app] Etapa 4 falhou:', e.message);
  }

  // ------------------------------------------------------------
  // PÓS-ETAPAS — artista / admin
  // ------------------------------------------------------------
  try {
    if (state.currentUser && state.currentUser.tipo === 'artista') {
      // 🐛 v9.8.5 — protege contra função inexistente
      if (typeof loadArtistData === 'function') {
        await loadArtistData();
      }
    }

    if (state.currentUser && state.currentUser.tipo === 'admin') {
      // 🐛 v9.8.5 — protege contra função inexistente
      if (typeof loadAdminData === 'function') {
        await loadAdminData();
      }
    }
  } catch (e) {
    console.warn('⚠️ [app] pós-etapas falhou:', e.message);
  }

  showToast('Sistema carregado!', 'success');
  console.log('✅ [app] loadAllData concluído (4 etapas)');
};

// ============================================================
// 🆕 v9.8.5 — HEALTH CHECK COM BACKOFF EXPONENCIAL
// ------------------------------------------------------------
// Antes: rodava a cada 3 min sem backoff.
// Agora: se falhar, espera 2x mais antes de tentar de novo.
// Ao voltar a funcionar, volta ao intervalo normal.
// ============================================================
(function setupHealthCheckWithBackoff() {
  var _baseInterval = 180000;   // 3 min (original)
  var _maxInterval = 1800000;   // 30 min (máximo)
  var _currentInterval = _baseInterval;
  var _timer = null;
  var _consecutiveFails = 0;

  function runCheck() {
    if (typeof HealthCheck === 'undefined' || typeof HealthCheck.runAll !== 'function') {
      console.warn('⚠️ [app] HealthCheck não disponível');
      return;
    }

    Promise.resolve()
      .then(function () { return HealthCheck.runAll(); })
      .then(function (result) {
        // Se retornou com sucesso, reseta o intervalo
        if (result && (result.vercel || result.gas)) {
          if (_consecutiveFails > 0) {
            console.log('✅ [app] HealthCheck recuperado após', _consecutiveFails, 'falhas');
          }
          _consecutiveFails = 0;
          _currentInterval = _baseInterval;
        } else {
          _consecutiveFails++;
          _currentInterval = Math.min(_baseInterval * Math.pow(2, _consecutiveFails), _maxInterval);
          console.warn('⚠️ [app] HealthCheck falhou', _consecutiveFails, 'vezes — próximo em', Math.round(_currentInterval / 1000), 's');
        }
      })
      .catch(function () {
        _consecutiveFails++;
        _currentInterval = Math.min(_baseInterval * Math.pow(2, _consecutiveFails), _maxInterval);
        console.warn('⚠️ [app] HealthCheck erro', _consecutiveFails, '— próximo em', Math.round(_currentInterval / 1000), 's');
      })
      .finally(function () {
        scheduleNext();
      });
  }

  function scheduleNext() {
    if (_timer) clearTimeout(_timer);
    _timer = setTimeout(runCheck, _currentInterval);
  }

  // Expõe pra debug
  window._healthCheck = {
    run: runCheck,
    stop: function () { if (_timer) clearTimeout(_timer); _timer = null; },
    getStatus: function () {
      return {
        currentInterval: _currentInterval,
        consecutiveFails: _consecutiveFails,
        baseInterval: _baseInterval,
        maxInterval: _maxInterval
      };
    }
  };

  // Primeira execução (após 3s pra não competir com o boot)
  setTimeout(runCheck, 3000);
})();

// ============================================================
// BOOTSTRAP — DISPARA QUANDO O DOM ESTIVER PRONTO
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 PLAY MY v' + (window.CONFIG && window.CONFIG.VERSION ? CONFIG.VERSION : '?') + ' — Modular');
  console.log('📱 Plataforma:', APP_ENV.platform, '| PWA:', APP_ENV.isPWA, '| Nativo:', APP_ENV.isNative);

  applySafeAreas();
  setupStatusBar();
  blockNativeGestures();

  registerServiceWorker();

  // Health check inicial (uma vez)
  if (typeof HealthCheck !== 'undefined' && typeof HealthCheck.runAll === 'function') {
    HealthCheck.runAll().catch(() => {});
  }

  setupInstallButton();

  const restored = restoreSession();

  if (restored) {
    await initializeApp();
  } else {
    hideLoading();
    setTimeout(hideSplashScreen, 800);
  }
});

// ============================================================
// PWA — INSTALAÇÃO INTELIGENTE via SIDEBAR
// ============================================================
function isPWAInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true ||
         document.referrer.includes('android-app://') ||
         (window.Capacitor && window.Capacitor.isNative);
}

function setupInstallButton() {
  const navItem = document.getElementById('installNavItem');
  if (!navItem) return;

  if (isPWAInstalled() || APP_ENV.isNative) {
    navItem.style.display = 'none';
    return;
  }

  navItem.style.display = 'block';
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  state.deferredInstallPrompt = e;
  console.log('📲 PWA: prompt nativo disponível');
  setupInstallButton();
});

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
// INSTALAÇÃO — FLUXO INTELIGENTE
// ============================================================
window.installApp = async function () {
  if (APP_ENV.isNative) {
    if (typeof showToast === 'function') {
      showToast('Você já está usando o app nativo!', 'success');
    }
    return;
  }

  if (isPWAInstalled()) {
    if (typeof showToast === 'function') {
      showToast('O app já está instalado! Procure o ícone PLAY MY.', 'success');
    }
    return;
  }

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

  showInstallInstructions();
};

// ============================================================
// MODAL DE INSTRUÇÕES
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
// 🆕 v9.8.5 — ALIASES GLOBAIS SEGUROS
// ------------------------------------------------------------
// ANTES: `window.X = window.X || X;` → se `X` não existir,
//        lança ReferenceError e QUEBRA o carregamento do app.
//
// AGORA: `if (typeof X !== 'undefined') window.X = window.X || X;`
//        → se `X` não existir, simplesmente não faz nada.
// ============================================================
(function installSafeAliases() {
  function alias(name, fn) {
    if (typeof fn === 'function') {
      window[name] = window[name] || fn;
    }
  }

  // Auth
  alias('handleLogin', typeof handleLogin !== 'undefined' ? handleLogin : null);
  alias('handleRegister', typeof handleRegister !== 'undefined' ? handleRegister : null);
  alias('logout', typeof logout !== 'undefined' ? logout : null);
  alias('openResetPasswordModal', typeof openResetPasswordModal !== 'undefined' ? openResetPasswordModal : null);
  alias('sendResetEmail', typeof sendResetEmail !== 'undefined' ? sendResetEmail : null);
  alias('showRegisterForm', typeof showRegisterForm !== 'undefined' ? showRegisterForm : null);
  alias('showLoginForm', typeof showLoginForm !== 'undefined' ? showLoginForm : null);
  alias('toggleArtistField', typeof toggleArtistField !== 'undefined' ? toggleArtistField : null);

  // Modals
  alias('showModal', typeof showModal !== 'undefined' ? showModal : null);
  alias('closeModal', typeof closeModal !== 'undefined' ? closeModal : null);
  alias('updateUserInterface', typeof updateUserInterface !== 'undefined' ? updateUserInterface : null);
  alias('updateBalanceDisplay', typeof updateBalanceDisplay !== 'undefined' ? updateBalanceDisplay : null);
  alias('openAddBalanceModal', typeof openAddBalanceModal !== 'undefined' ? openAddBalanceModal : null);
  alias('setBalanceAmount', typeof setBalanceAmount !== 'undefined' ? setBalanceAmount : null);
  alias('processBalanceAdd', typeof processBalanceAdd !== 'undefined' ? processBalanceAdd : null);
  alias('openWithdrawalModal', typeof openWithdrawalModal !== 'undefined' ? openWithdrawalModal : null);
  alias('requestWithdrawal', typeof requestWithdrawal !== 'undefined' ? requestWithdrawal : null);

  // Marketplace
  alias('changeSection', typeof changeSection !== 'undefined' ? changeSection : null);
  alias('toggleSidebar', typeof toggleSidebar !== 'undefined' ? toggleSidebar : null);
  alias('loadMarketplace', typeof loadMarketplace !== 'undefined' ? loadMarketplace : null);
  alias('loadExternalMarketplace', typeof loadExternalMarketplace !== 'undefined' ? loadExternalMarketplace : null);
  alias('loadTopInvestments', typeof loadTopInvestments !== 'undefined' ? loadTopInvestments : null);
  alias('loadUserPlaylists', typeof loadUserPlaylists !== 'undefined' ? loadUserPlaylists : null);
  alias('loadGlobalPlaylists', typeof loadGlobalPlaylists !== 'undefined' ? loadGlobalPlaylists : null);
  alias('loadArtists', typeof loadArtists !== 'undefined' ? loadArtists : null);
  alias('loadFollowing', typeof loadFollowing !== 'undefined' ? loadFollowing : null);
  alias('loadTickets', typeof loadTickets !== 'undefined' ? loadTickets : null);
  alias('renderMarketplace', typeof renderMarketplace !== 'undefined' ? renderMarketplace : null);
  alias('renderRecommended', typeof renderRecommended !== 'undefined' ? renderRecommended : null);
  alias('renderExternalMarketplace', typeof renderExternalMarketplace !== 'undefined' ? renderExternalMarketplace : null);
  alias('renderTopInvestments', typeof renderTopInvestments !== 'undefined' ? renderTopInvestments : null);
  alias('renderArtists', typeof renderArtists !== 'undefined' ? renderArtists : null);
  alias('renderFeaturedArtists', typeof renderFeaturedArtists !== 'undefined' ? renderFeaturedArtists : null);
  alias('renderPlaylists', typeof renderPlaylists !== 'undefined' ? renderPlaylists : null);
  alias('renderFavorites', typeof renderFavorites !== 'undefined' ? renderFavorites : null);
  alias('renderGlobalPlaylists', typeof renderGlobalPlaylists !== 'undefined' ? renderGlobalPlaylists : null);
  alias('renderAdminGlobalPlaylists', typeof renderAdminGlobalPlaylists !== 'undefined' ? renderAdminGlobalPlaylists : null);
  alias('renderTickets', typeof renderTickets !== 'undefined' ? renderTickets : null);
  alias('performSearch', typeof performSearch !== 'undefined' ? performSearch : null);
  alias('displaySearchResults', typeof displaySearchResults !== 'undefined' ? displaySearchResults : null);
  alias('openInvestModal', typeof openInvestModal !== 'undefined' ? openInvestModal : null);
  alias('updateInvestmentTotal', typeof updateInvestmentTotal !== 'undefined' ? updateInvestmentTotal : null);
  alias('adjustQuantity', typeof adjustQuantity !== 'undefined' ? adjustQuantity : null);
  alias('confirmInvestment', typeof confirmInvestment !== 'undefined' ? confirmInvestment : null);
  alias('openInvestExternalModal', typeof openInvestExternalModal !== 'undefined' ? openInvestExternalModal : null);
  alias('updateExternalInvestmentTotal', typeof updateExternalInvestmentTotal !== 'undefined' ? updateExternalInvestmentTotal : null);
  alias('adjustExternalQuantity', typeof adjustExternalQuantity !== 'undefined' ? adjustExternalQuantity : null);
  alias('confirmExternalInvestment', typeof confirmExternalInvestment !== 'undefined' ? confirmExternalInvestment : null);
  alias('openAddExternalMusicModal', typeof openAddExternalMusicModal !== 'undefined' ? openAddExternalMusicModal : null);
  alias('submitExternalMusic', typeof submitExternalMusic !== 'undefined' ? submitExternalMusic : null);
  alias('openAddMusicModal', typeof openAddMusicModal !== 'undefined' ? openAddMusicModal : null);
  alias('analisarVideoYouTube', typeof analisarVideoYouTube !== 'undefined' ? analisarVideoYouTube : null);
  alias('finalizarCadastroComYouTube', typeof finalizarCadastroComYouTube !== 'undefined' ? finalizarCadastroComYouTube : null);
  alias('openCreatePlaylistModal', typeof openCreatePlaylistModal !== 'undefined' ? openCreatePlaylistModal : null);
  alias('createPlaylist', typeof createPlaylist !== 'undefined' ? createPlaylist : null);
  alias('playUserPlaylist', typeof playUserPlaylist !== 'undefined' ? playUserPlaylist : null);
  alias('openCreateGlobalPlaylistModal', typeof openCreateGlobalPlaylistModal !== 'undefined' ? openCreateGlobalPlaylistModal : null);
  alias('createGlobalPlaylist', typeof createGlobalPlaylist !== 'undefined' ? createGlobalPlaylist : null);
  alias('openManageGlobalPlaylist', typeof openManageGlobalPlaylist !== 'undefined' ? openManageGlobalPlaylist : null);
  alias('addMusicToGlobalPlaylist', typeof addMusicToGlobalPlaylist !== 'undefined' ? addMusicToGlobalPlaylist : null);
  alias('removeMusicFromGlobalPlaylist', typeof removeMusicFromGlobalPlaylist !== 'undefined' ? removeMusicFromGlobalPlaylist : null);
  alias('playGlobalPlaylist', typeof playGlobalPlaylist !== 'undefined' ? playGlobalPlaylist : null);
  alias('openCreateTicketModal', typeof openCreateTicketModal !== 'undefined' ? openCreateTicketModal : null);
  alias('createTicket', typeof createTicket !== 'undefined' ? createTicket : null);
  alias('redeemTicket', typeof redeemTicket !== 'undefined' ? redeemTicket : null);
  alias('toggleFollow', typeof toggleFollow !== 'undefined' ? toggleFollow : null);
  alias('toggleFavoriteMusic', typeof toggleFavoriteMusic !== 'undefined' ? toggleFavoriteMusic : null);

  // Portfolio
  alias('loadPortfolio', typeof loadPortfolio !== 'undefined' ? loadPortfolio : null);
  alias('loadLedger', typeof loadLedger !== 'undefined' ? loadLedger : null);
  alias('loadArtistData', typeof loadArtistData !== 'undefined' ? loadArtistData : null);
  alias('loadAdminData', typeof loadAdminData !== 'undefined' ? loadAdminData : null);
  alias('renderPortfolio', typeof renderPortfolio !== 'undefined' ? renderPortfolio : null);
  alias('updatePortfolioValue', typeof updatePortfolioValue !== 'undefined' ? updatePortfolioValue : null);
  alias('updatePortfolioMetrics', typeof updatePortfolioMetrics !== 'undefined' ? updatePortfolioMetrics : null);
  alias('renderLedger', typeof renderLedger !== 'undefined' ? renderLedger : null);
  alias('renderArtistMusic', typeof renderArtistMusic !== 'undefined' ? renderArtistMusic : null);
  alias('loadDividends', typeof loadDividends !== 'undefined' ? loadDividends : null);
  alias('carregarELOsEValuations', typeof carregarELOsEValuations !== 'undefined' ? carregarELOsEValuations : null);

  // Sell modal
  alias('openSellModal', typeof openSellModal !== 'undefined' ? openSellModal : null);
  alias('updateSellTotal', typeof updateSellTotal !== 'undefined' ? updateSellTotal : null);
  alias('adjustSellQuantity', typeof adjustSellQuantity !== 'undefined' ? adjustSellQuantity : null);
  alias('setSellPrice', typeof setSellPrice !== 'undefined' ? setSellPrice : null);
  alias('confirmSell', typeof confirmSell !== 'undefined' ? confirmSell : null);

  // Trades
  alias('openTradeModal', typeof openTradeModal !== 'undefined' ? openTradeModal : null);
  alias('createTradeOffer', typeof createTradeOffer !== 'undefined' ? createTradeOffer : null);
  alias('loadTradeOffers', typeof loadTradeOffers !== 'undefined' ? loadTradeOffers : null);
  alias('renderTrades', typeof renderTrades !== 'undefined' ? renderTrades : null);
  alias('renderTradeCard', typeof renderTradeCard !== 'undefined' ? renderTradeCard : null);
  alias('acceptTradeOffer', typeof acceptTradeOffer !== 'undefined' ? acceptTradeOffer : null);
  alias('declineTradeOffer', typeof declineTradeOffer !== 'undefined' ? declineTradeOffer : null);
  alias('cancelTradeOffer', typeof cancelTradeOffer !== 'undefined' ? cancelTradeOffer : null);

  // Blockchain
  alias('openBlockchainExplorer', typeof openBlockchainExplorer !== 'undefined' ? openBlockchainExplorer : null);
  alias('loadBlockchainData', typeof loadBlockchainData !== 'undefined' ? loadBlockchainData : null);

  // News (stub se não existir)
  window.pmNewsReload = window.pmNewsReload || function () {};
  window.pmNewsLoadMore = window.pmNewsLoadMore || function () {};

  // Player
  alias('playTrack', typeof playTrack !== 'undefined' ? playTrack : null);
  alias('playExternalTrack', typeof playExternalTrack !== 'undefined' ? playExternalTrack : null);
  alias('playSearchResult', typeof playSearchResult !== 'undefined' ? playSearchResult : null);
  alias('togglePlay', typeof togglePlay !== 'undefined' ? togglePlay : null);
  alias('playNext', typeof playNext !== 'undefined' ? playNext : null);
  alias('playPrevious', typeof playPrevious !== 'undefined' ? playPrevious : null);
  alias('updatePlayerIcons', typeof updatePlayerIcons !== 'undefined' ? updatePlayerIcons : null);
  alias('toggleMute', typeof toggleMute !== 'undefined' ? toggleMute : null);
  alias('handleVolumeClick', typeof handleVolumeClick !== 'undefined' ? handleVolumeClick : null);
  alias('handleProgressClick', typeof handleProgressClick !== 'undefined' ? handleProgressClick : null);
  alias('handleExpandedProgressClick', typeof handleExpandedProgressClick !== 'undefined' ? handleExpandedProgressClick : null);
  alias('toggleShuffle', typeof toggleShuffle !== 'undefined' ? toggleShuffle : null);
  alias('toggleRepeat', typeof toggleRepeat !== 'undefined' ? toggleRepeat : null);
  alias('toggleFavorite', typeof toggleFavorite !== 'undefined' ? toggleFavorite : null);
  alias('openPlayerExpanded', typeof openPlayerExpanded !== 'undefined' ? openPlayerExpanded : null);
  alias('closePlayerExpanded', typeof closePlayerExpanded !== 'undefined' ? closePlayerExpanded : null);

  // YouTube
  alias('searchYouTubeDirect', typeof searchYouTubeDirect !== 'undefined' ? searchYouTubeDirect : null);
  alias('loadYouTubeAPI', typeof loadYouTubeAPI !== 'undefined' ? loadYouTubeAPI : null);
  alias('initializeYouTubePlayer', typeof initializeYouTubePlayer !== 'undefined' ? initializeYouTubePlayer : null);
  alias('updatePlayerProgress', typeof updatePlayerProgress !== 'undefined' ? updatePlayerProgress : null);

  // API
  alias('callAPI', typeof callAPI !== 'undefined' ? callAPI : null);
  alias('getFallbackData', typeof getFallbackData !== 'undefined' ? getFallbackData : null);

  console.log('✅ [app] aliases globais instalados com segurança');
})();

// ============================================================
// DEEP LINK
// ============================================================
window.addEventListener('load', () => {
  setTimeout(handleDeepLink, 1000);
});

// ============================================================
// LOG FINAL
// ============================================================
console.log('✅ [app.js] v9.8.6 carregado — 4 etapas + aliases seguros + health check com backoff + deep link ?music=ID');
console.log('📦 Módulos ativos: config, utils, state, api, auth, youtube, player, marketplace, portfolio, trades, blockchain, modals, news-unified, app');
console.log('🌍 Modo:', APP_ENV.platform, '| PWA:', APP_ENV.isPWA, '| Nativo:', APP_ENV.isNative);
console.log('📲 Instalação via sidebar ativa — v9.8.6');
