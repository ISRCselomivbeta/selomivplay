// ============================================================
// js/state.js — PLAY MY v8.5.2
// Estado global da aplicação + fila de reprodução.
// Depende de: config.js
// DEVE carregar DEPOIS de config.js e ANTES de api.js.
//
// MUDANÇAS v8.5.2:
//   - FIX: fallback agora inclui 'miv_user' (chave real usada pelo auth.js)
//   - FIX: reforço de retorno — se o original não restaurou, o fallback tenta
//
// MUDANÇAS v8.5.1:
//   - FIX: restoreSession() com fallback robusto (v1.0.2)
//          Agora espera auth.js definir a função antes de envolver
// ============================================================

// ============ ESTADO GLOBAL ============
window.state = {
  currentUser: null,
  userBalance: 0,
  seloCoinBalance: 0,
  favoriteMusicIds: [],

  playlist: [],
  externalPlaylist: [],

  portfolioAssets: [],
  ledgerData: [],
  topInvestments: [],
  userPlaylists: [],
  globalPlaylists: [],
  artists: [],
  followingArtists: [],
  tickets: [],
  tradesData: { received: [], sent: [], history: [] },

  currentTrackIndex: -1,
  isPlaying: false,
  youtubePlayer: null,
  youtubeAPILoaded: false,
  currentVolume: 80,
  isShuffle: false,
  isRepeat: false,
  playerReady: false,
  progressInterval: null,

  currentInvestTrack: null,
  currentExternalTrack: null,
  currentTradeAsset: null,
  currentManagingPlaylistId: null,

  streamingLastReward: 0,

  news: {
    items: [],
    filter: 'all',
    page: 1,
    hasMore: true,
    loading: false,
    seenIds: [],
    seenDate: '',
    preferences: {}
  },

  deferredInstallPrompt: null
};

// ============ FILA DE REPRODUÇÃO ============
window.playQueue = {
  items: [],
  currentIndex: -1,

  playCurrent() {
    if (this.currentIndex < 0 || this.currentIndex >= this.items.length) return;
    const c = this.items[this.currentIndex];
    if (!c) return;

    if (c.type === 'internal') {
      window.playTrack(c.index);
    } else {
      window.playExternalTrack(c.index);
    }
  },

  playNext() {
    if (this.currentIndex < this.items.length - 1) {
      this.currentIndex++;
      this.playCurrent();
    } else if (state.isRepeat) {
      this.currentIndex = 0;
      this.playCurrent();
    } else {
      state.isPlaying = false;
      window.updatePlayerIcons();
    }
  },

  playPrevious() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.playCurrent();
    }
  },

  shuffle() {
    if (this.items.length <= 1) return;
    const c = this.items[this.currentIndex];
    const o = this.items.filter((_, i) => i !== this.currentIndex);

    for (let i = o.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [o[i], o[j]] = [o[j], o[i]];
    }

    this.items = [c, ...o];
    this.currentIndex = 0;
  },

  setQueue(items) {
    if (!Array.isArray(items) || !items.length) return;
    this.items = items;
    this.currentIndex = 0;
    this.playCurrent();
  },

  clear() {
    this.items = [];
    this.currentIndex = -1;
  }
};

// ============================================================
// FIX v1.0.3 — restoreSession() com fallback robusto
// ✅ Inclui 'miv_user' (chave real usada pelo auth.js)
// ============================================================
(function installRestoreSessionFix() {
  function tryInstall() {
    const original = window.restoreSession;
    if (typeof original !== 'function') return false;
    if (original.__fixed) return true;

    const wrapped = function () {
      let result = false;
      try {
        result = original.apply(this, arguments);
      } catch (e) {
        console.warn('[state] restoreSession original falhou:', e);
      }

      if (!result || !window.state || !window.state.currentUser) {
        // ✅ LISTA COMPLETA — inclui 'miv_user' (chave real do auth.js)
        const candidates = [
          'miv_user',                  // ✅ CHAVE CORRETA
          'user', 'currentUser',
          'playmy_user', 'playmy_current_user',
          'session', 'auth_user',
          'usuario', 'loggedUser',
          'playmy_session', 'playmyUser',
          'USER', 'User'
        ];

        for (const key of candidates) {
          try {
            const raw = localStorage.getItem(key);
            if (!raw) continue;
            const parsed = JSON.parse(raw);
            if (parsed && (parsed.email || parsed.id || parsed.nome)) {
              window.state = window.state || {};
              window.state.currentUser = parsed;
              window.state.userBalance = parsed.saldo || 0;
              window.state.seloCoinBalance = parsed.selo_coin || 0;
              window.state.favoriteMusicIds = Array.isArray(parsed.favorite_music_ids)
                ? parsed.favorite_music_ids
                : [];
              console.log('[state] ✅ Sessão restaurada via fallback key:', key);
              result = true;
              break;
            }
          } catch (e) { /* JSON inválido */ }
        }
      }

      return result;
    };

    wrapped.__fixed = true;
    window.restoreSession = wrapped;
    console.log('[state] 🔧 restoreSession com fallback instalado (v1.0.3)');
    return true;
  }

  if (tryInstall()) return;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (!tryInstall()) {
        console.warn('[state] ⚠️ restoreSession não encontrada após DOM pronto');
      }
    });
  } else {
    setTimeout(() => {
      if (!tryInstall()) {
        console.warn('[state] ⚠️ restoreSession não encontrada');
      }
    }, 0);
  }
})();

// ============ LOG DE CARREGAMENTO ============
console.log('✅ [state.js] v8.5.2 carregado — estado global e playQueue prontos');
