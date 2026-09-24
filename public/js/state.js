// ============================================================
// js/state.js — PLAY MY v8.5.1
// Estado global da aplicação + fila de reprodução.
// Depende de: config.js
// DEVE carregar DEPOIS de config.js e ANTES de api.js.
//
// MUDANÇAS v8.5.1:
//   - FIX: restoreSession() com fallback robusto (v1.0.2)
//          Agora espera auth.js definir a função antes de envolver
//          (antes rodava cedo demais e o fix era pulado)
// ============================================================

// ============ ESTADO GLOBAL ============
window.state = {
  // Sessão do usuário
  currentUser: null,
  userBalance: 0,
  seloCoinBalance: 0,
  favoriteMusicIds: [],

  // Catálogo de músicas
  playlist: [],              // músicas internas (marketplace)
  externalPlaylist: [],      // músicas externas

  // Dados do usuário
  portfolioAssets: [],
  ledgerData: [],
  topInvestments: [],
  userPlaylists: [],
  globalPlaylists: [],
  artists: [],
  followingArtists: [],
  tickets: [],
  tradesData: { received: [], sent: [], history: [] },

  // Player
  currentTrackIndex: -1,
  isPlaying: false,
  youtubePlayer: null,
  youtubeAPILoaded: false,
  currentVolume: 80,
  isShuffle: false,
  isRepeat: false,
  playerReady: false,
  progressInterval: null,

  // Modais / interações
  currentInvestTrack: null,
  currentExternalTrack: null,
  currentTradeAsset: null,
  currentManagingPlaylistId: null,

  // Streaming / recompensas
  streamingLastReward: 0,

  // Notícias
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

  // PWA
  deferredInstallPrompt: null
};

// ============ FILA DE REPRODUÇÃO ============
window.playQueue = {
  items: [],        // [{ type: 'internal' | 'external', index: number }]
  currentIndex: -1,

  // Toca o item atual da fila
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

  // Próxima faixa
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

  // Faixa anterior
  playPrevious() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.playCurrent();
    }
  },

  // Embaralha a fila (mantém a atual na primeira posição)
  shuffle() {
    if (this.items.length <= 1) return;
    const c = this.items[this.currentIndex];
    const o = this.items.filter((_, i) => i !== this.currentIndex);

    // Fisher-Yates
    for (let i = o.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [o[i], o[j]] = [o[j], o[i]];
    }

    this.items = [c, ...o];
    this.currentIndex = 0;
  },

  // Substitui a fila inteira e começa a tocar do início
  setQueue(items) {
    if (!Array.isArray(items) || !items.length) return;
    this.items = items;
    this.currentIndex = 0;
    this.playCurrent();
  },

  // Limpa a fila
  clear() {
    this.items = [];
    this.currentIndex = -1;
  }
};

// ============================================================
// FIX v1.0.2 — restoreSession() com fallback robusto
// Aplicado DEPOIS que auth.js definir a função.
//
// ⚠️ IMPORTANTE: este bloco roda no carregamento do state.js,
//    mas o auth.js carrega DEPOIS. Por isso usamos tryInstall()
//    que espera a função existir antes de envolvê-la.
// ============================================================
(function installRestoreSessionFix() {
  function tryInstall() {
    const original = window.restoreSession;
    if (typeof original !== 'function') return false;

    // Já foi envolvido nesta sessão? Evita duplo wrap.
    if (original.__fixed) return true;

    const wrapped = function () {
      let result = false;
      try {
        result = original.apply(this, arguments);
      } catch (e) {
        console.warn('[state] restoreSession original falhou:', e);
      }

      // Se não restaurou (ou restaurou sem usuário), tenta fallback
      if (!result || !window.state || !window.state.currentUser) {
        const candidates = [
          'user', 'currentUser', 'playmy_user', 'playmy_current_user',
          'session', 'auth_user', 'usuario', 'loggedUser',
          'playmy_session', 'playmyUser', 'USER', 'User'
        ];

        for (const key of candidates) {
          try {
            const raw = localStorage.getItem(key);
            if (!raw) continue;
            const parsed = JSON.parse(raw);
            if (parsed && (parsed.email || parsed.id || parsed.nome)) {
              window.state = window.state || {};
              window.state.currentUser = parsed;
              console.log('[state] ✅ Sessão restaurada via fallback key:', key);
              result = true;
              break;
            }
          } catch (e) { /* JSON inválido — ignora */ }
        }
      }

      return result;
    };

    wrapped.__fixed = true;
    window.restoreSession = wrapped;
    console.log('[state] 🔧 restoreSession com fallback instalado (v1.0.2)');
    return true;
  }

  // 1ª tentativa: agora (caso auth.js já tenha carregado)
  if (tryInstall()) return;

  // 2ª tentativa: quando o DOM estiver pronto (todos os scripts já rodaram)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (!tryInstall()) {
        console.warn('[state] ⚠️ restoreSession não encontrada após DOM pronto — verifique auth.js');
      }
    });
  } else {
    // DOM já pronto (improvável nesse ponto, mas por segurança)
    setTimeout(() => {
      if (!tryInstall()) {
        console.warn('[state] ⚠️ restoreSession não encontrada — verifique auth.js');
      }
    }, 0);
  }
})();

// ============ LOG DE CARREGAMENTO ============
console.log('✅ [state.js] v8.5.1 carregado — estado global e playQueue prontos');
