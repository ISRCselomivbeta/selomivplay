// ============================================================
// js/state.js — PLAY MY v8.5.0
// Estado global da aplicação + fila de reprodução.
// Depende de: config.js
// DEVE carregar DEPOIS de config.js e ANTES de api.js.
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

// ============ LOG DE CARREGAMENTO ============
console.log('✅ [state.js] carregado — estado global e playQueue prontos');
