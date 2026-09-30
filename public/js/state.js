// ============================================================
// js/state.js — PLAY MY v8.5.3
// Estado global da aplicação + fila de reprodução.
// Depende de: config.js
// DEVE carregar DEPOIS de config.js e ANTES de api.js.
//
// MUDANÇAS v8.5.3:
//   - 🆕 playQueue.playCurrent() agora suporta vídeos do YouTube
//        (item com index:-1 + youtubeData:{videoId, titulo, artista})
//   - 🔗 Delega Media Session ao background-play.js v1.1.2
//   - 💾 Integra com player.js v9.3.0 (window.pmPlayer.save)
//
// MUDANÇAS v8.5.2:
//   - FIX: fallback agora inclui 'miv_user' (chave real usada pelo auth.js)
//   - FIX: reforço de retorno — se o original não restaurou, o fallback tenta
//
// MUDANÇAS v8.5.1:
//   - FIX: restoreSession() com fallback robusto (v1.0.2)
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

    // ============================================================
    // v8.5.3 — Suporte a vídeos do YouTube na fila
    // ============================================================
    // Item pode ser:
    //   1. { type: 'internal', index: N }           → música do Selo MIV
    //   2. { type: 'external', index: N }           → música externa
    //   3. { type: 'internal', index: -1, youtubeData: {...} }
    //                                                → vídeo do YouTube
    // ============================================================

    // Caso especial: vídeo do YouTube (index -1 + youtubeData)
    if (c.index === -1 && c.youtubeData && c.youtubeData.videoId) {
      const videoId = c.youtubeData.videoId;
      const titulo = c.youtubeData.titulo || 'Vídeo do YouTube';
      const artista = c.youtubeData.artista || '';

      console.log('🎵 [playQueue] tocando vídeo do YouTube:', videoId, '-', titulo);

      // Atualiza o mini-player
      const playerSpotify = document.getElementById('playerSpotify');
      if (playerSpotify) playerSpotify.style.display = 'flex';

      const playerTitle = document.getElementById('playerTitle');
      if (playerTitle) playerTitle.textContent = titulo;

      const playerArtist = document.getElementById('playerArtist');
      if (playerArtist) playerArtist.textContent = artista;

      const playerAlbumArt = document.getElementById('playerAlbumArt');
      if (playerAlbumArt) {
        playerAlbumArt.src = 'https://img.youtube.com/vi/' + videoId + '/hqdefault.jpg';
      }

      // Atualiza o player expandido
      const expandedTitle = document.getElementById('expandedTitle');
      if (expandedTitle) expandedTitle.textContent = titulo;

      const expandedArtist = document.getElementById('expandedArtist');
      if (expandedArtist) expandedArtist.textContent = artista;

      const expandedAlbumArt = document.getElementById('expandedAlbumArt');
      if (expandedAlbumArt) {
        expandedAlbumArt.src = 'https://img.youtube.com/vi/' + videoId + '/hqdefault.jpg';
      }

      // Media Session (delega ao background-play se existir)
      if (window.pmBackgroundPlay && typeof window.pmBackgroundPlay.updateMediaSession === 'function') {
        try {
          if (window.state) {
            window.state.currentTrackTitle = titulo;
            window.state.currentArtist = artista;
            window.state.currentArtwork = 'https://img.youtube.com/vi/' + videoId + '/hqdefault.jpg';
          }
          setTimeout(() => {
            try { window.pmBackgroundPlay.updateMediaSession(); } catch (e) {}
          }, 50);
        } catch (e) {}
      }

      // Atualiza o índice (usa um valor especial para marcar YouTube)
      state.currentTrackIndex = 2000;

      // Carrega o vídeo no player do YouTube
      const loading = document.getElementById('playerLoadingExpanded');
      if (loading) loading.style.display = 'flex';

      if (typeof loadYouTubeAPI === 'function' && typeof initializeYouTubePlayer === 'function') {
        loadYouTubeAPI(() => {
          console.log('🎵 [playQueue] YouTube API pronta, inicializando player...');
          initializeYouTubePlayer(videoId);
        });
      } else {
        console.error('❌ [playQueue] loadYouTubeAPI ou initializeYouTubePlayer não disponível');
      }

      state.isPlaying = true;
      if (typeof updatePlayerIcons === 'function') updatePlayerIcons();

      // Persiste o estado (se o player.js v9.3.0 estiver ativo)
      if (window.pmPlayer && typeof window.pmPlayer.save === 'function') {
        setTimeout(() => {
          try { window.pmPlayer.save(); } catch (e) {}
        }, 500);
      }

      return;
    }

    // Caso normal: música interna ou externa
    if (c.type === 'internal') {
      window.playTrack(c.index);
    } else if (c.type === 'external') {
      window.playExternalTrack(c.index);
    } else {
      console.warn('⚠️ [playQueue] tipo de item desconhecido:', c);
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
        const candidates = [
          'miv_user',
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
console.log('✅ [state.js] v8.5.3 carregado — estado global + playQueue com suporte a YouTube');
