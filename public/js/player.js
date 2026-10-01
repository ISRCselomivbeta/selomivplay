// ============================================================
// js/player.js — PLAY MY v9.3.2
// Player completo: reprodução, controles, progresso, volume.
// Depende de: config.js, utils.js, state.js, api.js, youtube.js
// DEVE carregar DEPOIS de youtube.js e ANTES de marketplace.js.
//
// MUDANÇAS v9.3.2:
//   - 🐛 FIX: persistência agora funciona com playlists globais (YouTube)
//        saveState() detecta window.playQueue e salva a fila completa
//   - 🐛 FIX: restoreState() restaura a fila de playQueue
//   - 🆕 wrappers em playGlobalPlaylist e playUserPlaylist para salvar
//   - 🆕 pmPlayer.debug() para diagnóstico
//
// MUDANÇAS v9.3.1:
//   - 🐛 FIX: código órfão no final do arquivo
//   - 🎵 AUTO-NEXT robusto (3 camadas)
//
// MUDANÇAS v9.3.0:
//   - 🔗 Media Session DELEGADA ao background-play.js
//   - 🆕 AUTO-NEXT: quando a faixa termina, toca a próxima
//   - 🆕 PERSISTÊNCIA: salva playlist + índice no localStorage
//
// MUDANÇAS v9.2.x: shuffle/repeat, Media Session, wake lock
// ============================================================

// ============================================================
// HELPER INTERNO — resolve o video ID com segurança
// ============================================================
function _safeExtractYouTubeId(link) {
  if (!link) return null;
  if (typeof extractYouTubeId === 'function') {
    try {
      return extractYouTubeId(link);
    } catch (e) {
      console.warn('⚠️ extractYouTubeId falhou:', e.message);
      return null;
    }
  }
  console.warn('⚠️ extractYouTubeId não está disponível');
  return null;
}

// ============================================================
// MEDIA SESSION — DELEGADA ao background-play.js v1.1.2
// ============================================================
function _setupMediaSession(titulo, artista, capaUrl) {
  try {
    if (window.state) {
      window.state.currentTrackTitle = titulo || 'PlayMy';
      window.state.currentArtist = artista || 'PlayMy';
      window.state.currentArtwork = capaUrl || '';
    }
  } catch (e) {}

  if (window.pmBackgroundPlay &&
      typeof window.pmBackgroundPlay.updateMediaSession === 'function') {
    setTimeout(function () {
      try { window.pmBackgroundPlay.updateMediaSession(); } catch (e) {}
    }, 50);
    console.log('🎵 [MediaSession] delegado ao background-play:', titulo, '-', artista);
    return;
  }

  if (!('mediaSession' in navigator)) return;

  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: titulo || 'PLAY MY',
      artist: artista || 'PLAY MY',
      album: 'PLAY MY',
      artwork: capaUrl ? [
        { src: capaUrl, sizes: '96x96',   type: 'image/png' },
        { src: capaUrl, sizes: '128x128', type: 'image/png' },
        { src: capaUrl, sizes: '192x192', type: 'image/png' },
        { src: capaUrl, sizes: '256x256', type: 'image/png' },
        { src: capaUrl, sizes: '384x384', type: 'image/png' },
        { src: capaUrl, sizes: '512x512', type: 'image/png' }
      ] : []
    });

    navigator.mediaSession.setActionHandler('play', () => {
      if (state.youtubePlayer && state.youtubePlayer.playVideo) {
        state.youtubePlayer.playVideo();
        state.isPlaying = true;
        updatePlayerIcons();
      }
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      if (state.youtubePlayer && state.youtubePlayer.pauseVideo) {
        state.youtubePlayer.pauseVideo();
        state.isPlaying = false;
        updatePlayerIcons();
      }
    });
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      if (typeof playPrevious === 'function') playPrevious();
    });
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      if (typeof playNext === 'function') playNext();
    });

    navigator.mediaSession.playbackState = 'playing';
    console.log('🎵 [MediaSession] fallback configurada:', titulo, '-', artista);
  } catch (e) {
    console.warn('⚠️ [MediaSession] erro:', e.message);
  }
}

function _updateMediaSessionState(isPlaying) {
  if (window.pmBackgroundPlay &&
      typeof window.pmBackgroundPlay.updatePlaybackState === 'function') {
    try { window.pmBackgroundPlay.updatePlaybackState(); } catch (e) {}
    return;
  }
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  } catch (e) {}
}

function _updateMediaSessionPosition() {
  if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;
  if (!state.youtubePlayer || !state.youtubePlayer.getCurrentTime) return;
  try {
    const duration = state.youtubePlayer.getDuration();
    const position = state.youtubePlayer.getCurrentTime();
    if (duration > 0 && position >= 0 && position <= duration) {
      navigator.mediaSession.setPositionState({ duration, position, playbackRate: 1 });
    }
  } catch (e) {}
}

function _clearMediaSession() {
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.playbackState = 'none';
  } catch (e) {}
}

// ============================================================
// AUDIO SESSION + WAKE LOCK
// ============================================================
let _wakeLock = null;
let _wakeLockRequested = false;

function _setAudioSessionType(type) {
  try {
    if (navigator.audioSession && 'type' in navigator.audioSession) {
      navigator.audioSession.type = type || 'playback';
      console.log('🎵 [AudioSession] type =', navigator.audioSession.type);
    }
  } catch (e) {}
}

async function _requestWakeLock() {
  if (_wakeLockRequested) return;
  _wakeLockRequested = true;
  try {
    if ('wakeLock' in navigator && navigator.wakeLock) {
      _wakeLock = await navigator.wakeLock.request('screen');
      console.log('🎵 [WakeLock] ativado');
      _wakeLock.addEventListener('release', () => {
        console.log('🎵 [WakeLock] liberado');
        _wakeLock = null;
      });
    }
  } catch (e) {
    console.log('🎵 [WakeLock] indisponível:', e.message);
  }
}

function _releaseWakeLock() {
  _wakeLockRequested = false;
  if (_wakeLock) {
    try { _wakeLock.release(); } catch (e) {}
    _wakeLock = null;
  }
}

// ============================================================
// HELPERS PARA MOVER O IFRAME DO YOUTUBE
// ============================================================
window._moveYouTubeToExpanded = function () {
  const globalContainer = document.getElementById('youtubePlayerGlobal');
  const expandedContainer = document.getElementById('youtubePlayerExpanded');
  if (!globalContainer || !expandedContainer) return;
  if (!globalContainer.firstChild) return;
  while (globalContainer.firstChild) {
    expandedContainer.appendChild(globalContainer.firstChild);
  }
  console.log('🎵 [Player] iframe movido → expandido');
};

window._moveYouTubeToGlobal = function () {
  const globalContainer = document.getElementById('youtubePlayerGlobal');
  const expandedContainer = document.getElementById('youtubePlayerExpanded');
  if (!globalContainer || !expandedContainer) return;
  if (!expandedContainer.firstChild) return;
  while (expandedContainer.firstChild) {
    globalContainer.appendChild(expandedContainer.firstChild);
  }
  console.log('🎵 [Player] iframe devolvido → global');
};

window._moveYouTubeToExpandedIfOpen = function () {
  const expandedSection = document.getElementById('playerExpandedSection');
  if (expandedSection && expandedSection.classList.contains('active')) {
    window._moveYouTubeToExpanded();
  }
};

// ============================================================
// TOCAR MÚSICA INTERNA
// ============================================================
window.playTrack = function (index) {
  if (state._loadingTrack) {
    console.log('⏳ playTrack ignorado — já carregando');
    return;
  }
  state._loadingTrack = true;

  try {
    console.log('🎵 playTrack chamada com index:', index);

    const t = state.playlist[index];
    if (!t) {
      console.warn('⚠️ playTrack: índice inválido', index);
      return;
    }

    console.log('🎵 Música:', t.titulo, '-', t.artista);
    console.log('🎵 link_youtube:', t.link_youtube);

    state.currentTrackIndex = index;

    const playerSpotify = document.getElementById('playerSpotify');
    if (playerSpotify) playerSpotify.style.display = 'flex';

    const playerTitle = document.getElementById('playerTitle');
    if (playerTitle) playerTitle.textContent = t.titulo || '';

    const playerArtist = document.getElementById('playerArtist');
    if (playerArtist) playerArtist.textContent = t.artista || '';

    const playerAlbumArt = document.getElementById('playerAlbumArt');
    if (playerAlbumArt) playerAlbumArt.src = getCoverUrl(t, false);

    const expandedTitle = document.getElementById('expandedTitle');
    if (expandedTitle) expandedTitle.textContent = t.titulo || 'Sem título';

    const expandedArtist = document.getElementById('expandedArtist');
    if (expandedArtist) expandedArtist.textContent = t.artista || 'Artista desconhecido';

    const expandedAlbumArt = document.getElementById('expandedAlbumArt');
    if (expandedAlbumArt) expandedAlbumArt.src = getCoverUrl(t, false);

    const expandedPrice = document.getElementById('expandedPrice');
    if (expandedPrice) expandedPrice.textContent = formatCurrency(t.valor_acao || 0);

    const expandedAvailable = document.getElementById('expandedAvailable');
    if (expandedAvailable) expandedAvailable.textContent = (t.percentual_disponivel || 0) + '%';

    const expandedReturn = document.getElementById('expandedReturn');
    if (expandedReturn) expandedReturn.textContent = (t.rentabilidade_media || 0) + '%';

    const expandedInvestors = document.getElementById('expandedInvestors');
    if (expandedInvestors) expandedInvestors.textContent = t.total_investidores || 0;

    const trackOverlayIcon = document.getElementById('trackOverlayIcon');
    if (trackOverlayIcon) trackOverlayIcon.className = 'bi bi-play-fill';

    _setupMediaSession(t.titulo, t.artista, getCoverUrl(t, false));
    _setAudioSessionType('playback');
    _requestWakeLock();

    if (t.link_youtube) {
      const v = _safeExtractYouTubeId(t.link_youtube);
      console.log('🎵 YouTube video ID:', v);

      if (v) {
        const loading = document.getElementById('playerLoadingExpanded');
        if (loading) loading.style.display = 'flex';

        loadYouTubeAPI(() => {
          console.log('🎵 YouTube API pronta, inicializando player...');
          initializeYouTubePlayer(v);
        });
      } else {
        console.warn('⚠️ YouTube ID inválido em:', t.link_youtube);
        showToast('Link do YouTube inválido', 'warning');
        const loading = document.getElementById('playerLoadingExpanded');
        if (loading) loading.style.display = 'none';
      }
    } else {
      console.warn('⚠️ Música sem link_youtube');
      showToast('Música sem link do YouTube', 'warning');
      const loading = document.getElementById('playerLoadingExpanded');
      if (loading) loading.style.display = 'none';
    }

    state.isPlaying = true;
    updatePlayerIcons();
  } finally {
    setTimeout(() => {
      state._loadingTrack = false;
    }, 1000);
  }
};

// ============================================================
// TOCAR MÚSICA EXTERNA
// ============================================================
window.playExternalTrack = function (index) {
  console.log('🎵 playExternalTrack chamada com index:', index);

  const t = state.externalPlaylist[index];
  if (!t) {
    console.warn('⚠️ playExternalTrack: índice inválido', index);
    return;
  }

  console.log('🎵 Música externa:', t.titulo, '-', t.artista);
  console.log('🎵 link_youtube:', t.link_youtube);

  state.currentTrackIndex = 1000 + index;

  const playerSpotify = document.getElementById('playerSpotify');
  if (playerSpotify) playerSpotify.style.display = 'flex';

  const playerTitle = document.getElementById('playerTitle');
  if (playerTitle) playerTitle.textContent = t.titulo || '';

  const playerArtist = document.getElementById('playerArtist');
  if (playerArtist) playerArtist.textContent = t.artista || '';

  const playerAlbumArt = document.getElementById('playerAlbumArt');
  if (playerAlbumArt) playerAlbumArt.src = getCoverUrl(t, true);

  const expandedTitle = document.getElementById('expandedTitle');
  if (expandedTitle) expandedTitle.textContent = t.titulo || 'Sem título';

  const expandedArtist = document.getElementById('expandedArtist');
  if (expandedArtist) expandedArtist.textContent = t.artista || 'Artista desconhecido';

  const expandedAlbumArt = document.getElementById('expandedAlbumArt');
  if (expandedAlbumArt) expandedAlbumArt.src = getCoverUrl(t, true);

  const expandedPrice = document.getElementById('expandedPrice');
  if (expandedPrice) expandedPrice.textContent = formatCurrency(t.valor_acao || 0);

  const expandedAvailable = document.getElementById('expandedAvailable');
  if (expandedAvailable) expandedAvailable.textContent = (t.percentual_disponivel || 0) + '%';

  _setupMediaSession(t.titulo, t.artista, getCoverUrl(t, true));
  _setAudioSessionType('playback');
  _requestWakeLock();

  if (t.link_youtube) {
    const v = _safeExtractYouTubeId(t.link_youtube);
    console.log('🎵 YouTube video ID:', v);

    if (v) {
      const loading = document.getElementById('playerLoadingExpanded');
      if (loading) loading.style.display = 'flex';

      loadYouTubeAPI(() => {
        console.log('🎵 YouTube API pronta, inicializando player...');
        initializeYouTubePlayer(v);
      });
    }
  } else {
    console.warn('⚠️ Música externa sem link_youtube');
    showToast('Música sem link do YouTube', 'warning');
  }

  state.isPlaying = true;
  updatePlayerIcons();
};

// ============================================================
// TOCAR RESULTADO DE BUSCA
// ============================================================
window.playSearchResult = function (type, id) {
  document.getElementById('searchResults').style.display = 'none';
  document.getElementById('searchInput').value = '';

  if (type === 'internal') {
    const idx = state.playlist.findIndex(t => String(t.id) === String(id));
    if (idx !== -1) playTrack(idx);
  } else if (type === 'external') {
    const idx = state.externalPlaylist.findIndex(t => String(t.id) === String(id));
    if (idx !== -1) playExternalTrack(idx);
  } else if (type === 'youtube') {
    const vid = String(id).replace('yt_', '');
    state.currentTrackIndex = 2000;

    const playerSpotify = document.getElementById('playerSpotify');
    if (playerSpotify) playerSpotify.style.display = 'flex';

    const playerTitle = document.getElementById('playerTitle');
    if (playerTitle) playerTitle.textContent = 'YouTube';

    const playerArtist = document.getElementById('playerArtist');
    if (playerArtist) playerArtist.textContent = 'Vídeo do YouTube';

    const playerAlbumArt = document.getElementById('playerAlbumArt');
    if (playerAlbumArt) playerAlbumArt.src = 'https://img.youtube.com/vi/' + vid + '/hqdefault.jpg';

    const expandedTitle = document.getElementById('expandedTitle');
    if (expandedTitle) expandedTitle.textContent = 'Vídeo do YouTube';

    const expandedArtist = document.getElementById('expandedArtist');
    if (expandedArtist) expandedArtist.textContent = 'Resultado da busca';

    _setupMediaSession('YouTube', 'PLAY MY', 'https://img.youtube.com/vi/' + vid + '/hqdefault.jpg');
    _setAudioSessionType('playback');
    _requestWakeLock();

    const loading = document.getElementById('playerLoadingExpanded');
    if (loading) loading.style.display = 'flex';

    loadYouTubeAPI(() => {
      console.log('🎵 YouTube API pronta, inicializando player de busca...');
      initializeYouTubePlayer(vid);
    });
    state.isPlaying = true;
    updatePlayerIcons();
    showToast('▶️ Tocando do YouTube', 'success');
  }
};

// ============================================================
// CONTROLES BÁSICOS
// ============================================================
window.togglePlay = function () {
  if (!state.youtubePlayer) {
    console.warn('⚠️ togglePlay: youtubePlayer não está inicializado');
    return;
  }
  if (state.isPlaying) {
    state.youtubePlayer.pauseVideo();
  } else {
    state.youtubePlayer.playVideo();
  }
};

window.updatePlayerIcons = function () {
  const ip = state.isPlaying;
  ['playPauseIcon', 'trackOverlayIcon', 'expandedPlayPauseIcon'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.className = ip ? 'bi bi-pause-fill' : 'bi bi-play-fill';
  });
  _updateMediaSessionState(ip);
};

// ============================================================
// VOLUME
// ============================================================
window.toggleMute = function () {
  state.currentVolume = state.currentVolume > 0 ? 0 : 80;
  const b = document.getElementById('volumeSliderBar');
  if (b) b.style.width = state.currentVolume + '%';
  const i = document.getElementById('volumeIcon');
  if (i) i.className = state.currentVolume === 0 ? 'bi bi-volume-mute' : 'bi bi-volume-up';
  if (state.youtubePlayer && state.youtubePlayer.setVolume) {
    state.youtubePlayer.setVolume(state.currentVolume);
  }
};

window.handleVolumeClick = function (e) {
  const s = document.getElementById('volumeSlider');
  if (!s) return;
  const r = s.getBoundingClientRect();
  const p = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
  state.currentVolume = Math.round(p * 100);
  const b = document.getElementById('volumeSliderBar');
  if (b) b.style.width = state.currentVolume + '%';
  if (state.youtubePlayer && state.youtubePlayer.setVolume) {
    state.youtubePlayer.setVolume(state.currentVolume);
  }
};

// ============================================================
// PROGRESSO
// ============================================================
window.handleProgressClick = function (e) {
  if (!state.youtubePlayer || !state.youtubePlayer.seekTo) return;
  const container = document.getElementById('progressContainer');
  if (!container) return;
  const r = container.getBoundingClientRect();
  if (!r || !r.width) return;
  const p = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
  state.youtubePlayer.seekTo(state.youtubePlayer.getDuration() * p, true);
};

window.handleExpandedProgressClick = function (e) {
  if (!state.youtubePlayer || !state.youtubePlayer.seekTo) return;
  const container = document.getElementById('expandedProgressContainer');
  if (!container) return;
  const r = container.getBoundingClientRect();
  if (!r || !r.width) return;
  const p = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
  state.youtubePlayer.seekTo(state.youtubePlayer.getDuration() * p, true);
};

// ============================================================
// SHUFFLE / REPEAT / NEXT / PREV
// ============================================================
(function initShuffleRepeatV2() {
  if (typeof state.isShuffle !== 'boolean') state.isShuffle = false;
  if (typeof state.isRepeat !== 'boolean') state.isRepeat = false;
  if (typeof state.repeatMode !== 'string') state.repeatMode = 'off';
  if (!Array.isArray(state._originalPlaylist)) state._originalPlaylist = null;
  if (typeof state._loadingTrack !== 'boolean') state._loadingTrack = false;
  console.log('🎵 [player] shuffle/repeat inicializado:', {
    isShuffle: state.isShuffle,
    isRepeat: state.isRepeat,
    repeatMode: state.repeatMode,
    playlistLength: (state.playlist && state.playlist.length) || 0
  });
})();

window.toggleShuffle = function () {
  state.isShuffle = !state.isShuffle;
  const playlist = state.playlist || [];
  if (!playlist.length) {
    if (typeof showToast === 'function') showToast('⚠️ Fila vazia', 'warning');
    state.isShuffle = false;
    return;
  }

  if (state.isShuffle) {
    if (!state._originalPlaylist) state._originalPlaylist = playlist.slice();
    const shuffled = playlist.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = shuffled[i];
      shuffled[i] = shuffled[j];
      shuffled[j] = tmp;
    }
    const idxAtual = state.currentTrackIndex;
    if (idxAtual >= 0 && idxAtual < playlist.length) {
      const atual = playlist[idxAtual];
      const pos = shuffled.findIndex(function (t) {
        return t && atual && String(t.id) === String(atual.id);
      });
      if (pos > 0) {
        shuffled.splice(pos, 1);
        shuffled.unshift(atual);
      }
    }
    state.playlist = shuffled;
    state.currentTrackIndex = 0;
    if (typeof showToast === 'function') showToast('🔀 Aleatório ON', 'info');
  } else {
    if (state._originalPlaylist) {
      state.playlist = state._originalPlaylist.slice();
      const atual2 = state._originalPlaylist[state.currentTrackIndex];
      if (atual2) {
        const pos2 = state.playlist.findIndex(function (t) {
          return t && atual2 && String(t.id) === String(atual2.id);
        });
        state.currentTrackIndex = pos2 >= 0 ? pos2 : 0;
      } else {
        state.currentTrackIndex = 0;
      }
      state._originalPlaylist = null;
    }
    if (typeof showToast === 'function') showToast('🔀 Aleatório OFF', 'info');
  }

  const btn = document.getElementById('shuffleBtn');
  if (btn) {
    btn.style.color = state.isShuffle ? 'var(--apple-green)' : '';
    btn.style.background = state.isShuffle ? 'rgba(52,199,89,0.15)' : '';
  }
};

window.toggleRepeat = function () {
  const ciclo = ['off', 'all', 'one'];
  const atual = ciclo.indexOf(state.repeatMode);
  const proximo = ciclo[(atual + 1) % ciclo.length];
  state.repeatMode = proximo;
  state.isRepeat = (proximo !== 'off');
  console.log('🔁 Repeat:', proximo);

  const msgs = { 'off': '🔁 Repetir OFF', 'all': '🔁 Repetir FILA', 'one': '🔂 Repetir MÚSICA' };
  if (typeof showToast === 'function') showToast(msgs[proximo], 'info');

  const btn = document.getElementById('repeatBtn');
  if (btn) {
    const icon = btn.querySelector('i');
    if (proximo === 'off') {
      btn.style.color = '';
      btn.style.background = '';
      if (icon) icon.className = 'bi bi-repeat';
    } else if (proximo === 'all') {
      btn.style.color = 'var(--apple-green)';
      btn.style.background = 'rgba(52,199,89,0.15)';
      if (icon) icon.className = 'bi bi-repeat';
    } else if (proximo === 'one') {
      btn.style.color = 'var(--apple-green)';
      btn.style.background = 'rgba(52,199,89,0.15)';
      if (icon) icon.className = 'bi bi-repeat-1';
    }
  }
};

window.playNext = function () {
  if (window.playQueue &&
      Array.isArray(window.playQueue.items) &&
      window.playQueue.items.length > 0) {
    console.log('▶️ playNext → usando playQueue');
    try {
      window.playQueue.playNext();
      return;
    } catch (e) {
      console.warn('⚠️ playQueue.playNext falhou:', e.message);
    }
  }

  const playlist = state.playlist || [];
  if (!playlist.length) {
    console.warn('⚠️ playNext: fila vazia');
    return;
  }

  if (state.repeatMode === 'one') {
    const idx = state.currentTrackIndex;
    if (idx >= 0 && idx < playlist.length) {
      playTrack(idx);
      return;
    }
  }

  let nextIdx = state.currentTrackIndex + 1;
  if (nextIdx >= playlist.length) {
    if (state.repeatMode === 'all') {
      nextIdx = 0;
    } else {
      if (typeof showToast === 'function') showToast('⏹️ Fim da fila', 'info');
      if (state.youtubePlayer && state.youtubePlayer.pauseVideo) {
        state.youtubePlayer.pauseVideo();
        state.isPlaying = false;
        updatePlayerIcons();
      }
      return;
    }
  }
  console.log('▶️ Próxima:', nextIdx + 1, '/', playlist.length);
  playTrack(nextIdx);
};

window.playPrevious = function () {
  if (window.playQueue &&
      Array.isArray(window.playQueue.items) &&
      window.playQueue.items.length > 0 &&
      typeof window.playQueue.playPrevious === 'function') {
    try {
      window.playQueue.playPrevious();
      return;
    } catch (e) {}
  }

  const playlist = state.playlist || [];
  if (!playlist.length) return;
  let prevIdx = state.currentTrackIndex - 1;
  if (prevIdx < 0) {
    if (state.repeatMode === 'all') {
      prevIdx = playlist.length - 1;
    } else {
      prevIdx = 0;
    }
  }
  playTrack(prevIdx);
};

// ============================================================
// FAVORITOS / PLAYER EXPANDIDO
// ============================================================
window.toggleFavorite = function () {
  showToast('Adicione aos favoritos pelo card', 'info');
};

window.openPlayerExpanded = function () {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('playerExpandedSection');
  if (el) el.classList.add('active');
  window._moveYouTubeToExpanded();
};

window.closePlayerExpanded = function () {
  window._moveYouTubeToGlobal();
  if (typeof changeSection === 'function') {
    changeSection('marketplace');
  } else {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    const el = document.getElementById('marketplaceSection');
    if (el) el.classList.add('active');
  }
};

window._onPlayerStop = function () {
  _releaseWakeLock();
  _clearMediaSession();
  _setAudioSessionType('auto');
};

setInterval(() => {
  if (state.isPlaying) _updateMediaSessionPosition();
}, 5000);

window._aplicarEstadoShuffleRepeat = function () {
  const btnShuffle = document.getElementById('shuffleBtn');
  if (btnShuffle) {
    btnShuffle.style.color = state.isShuffle ? 'var(--apple-green)' : '';
    btnShuffle.style.background = state.isShuffle ? 'rgba(52,199,89,0.15)' : '';
  }
  const btnRepeat = document.getElementById('repeatBtn');
  if (btnRepeat) {
    const icon = btnRepeat.querySelector('i');
    if (state.repeatMode === 'off') {
      btnRepeat.style.color = '';
      btnRepeat.style.background = '';
      if (icon) icon.className = 'bi bi-repeat';
    } else if (state.repeatMode === 'all') {
      btnRepeat.style.color = 'var(--apple-green)';
      btnRepeat.style.background = 'rgba(52,199,89,0.15)';
      if (icon) icon.className = 'bi bi-repeat';
    } else if (state.repeatMode === 'one') {
      btnRepeat.style.color = 'var(--apple-green)';
      btnRepeat.style.background = 'rgba(52,199,89,0.15)';
      if (icon) icon.className = 'bi bi-repeat-1';
    }
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(window._aplicarEstadoShuffleRepeat, 200);
  });
} else {
  setTimeout(window._aplicarEstadoShuffleRepeat, 200);
}

// ============================================================
// AUTO-NEXT ROBUSTO (3 camadas)
// ============================================================
(function bindAutoNext() {
  var _autoNextBound = false;
  var _autoNextTimer = null;
  var _lastState = -1;
  var _lastEndedAt = 0;
  var _debounceMs = 2000;

  function decidirProxima() {
    var now = Date.now();
    if (now - _lastEndedAt < _debounceMs) {
      console.log('🎵 [AutoNext] debounce — ignorando');
      return;
    }
    _lastEndedAt = now;
    console.log('🎵 [AutoNext] faixa terminou — decidindo próxima');

    if (window.playQueue &&
        Array.isArray(window.playQueue.items) &&
        window.playQueue.items.length > 0 &&
        typeof window.playQueue.playNext === 'function') {
      console.log('🎵 [AutoNext] usando playQueue.playNext()');
      try {
        window.playQueue.playNext();
        return;
      } catch (e) {
        console.warn('⚠️ [AutoNext] playQueue.playNext falhou:', e.message);
      }
    }

    if (typeof window.playNext === 'function') {
      console.log('🎵 [AutoNext] usando playNext() global');
      try {
        window.playNext();
        return;
      } catch (e) {
        console.warn('⚠️ [AutoNext] playNext falhou:', e.message);
      }
    }
  }

  function bindYouTubeAutoNext() {
    if (_autoNextBound) return;
    if (!state.youtubePlayer || !state.youtubePlayer.addEventListener) return;
    try {
      state.youtubePlayer.addEventListener('onStateChange', function (event) {
        if (event.data === 0) {
          console.log('🎵 [AutoNext] (listener) vídeo terminou');
          decidirProxima();
        }
      });
      _autoNextBound = true;
      console.log('🎵 [AutoNext] listener vinculado');
      if (_autoNextTimer) {
        clearInterval(_autoNextTimer);
        _autoNextTimer = null;
      }
    } catch (e) {
      console.warn('⚠️ [AutoNext] erro ao vincular listener:', e.message);
    }
  }

  function iniciarPolling() {
    if (_autoNextTimer) return;
    _autoNextTimer = setInterval(function () {
      if (!_autoNextBound) bindYouTubeAutoNext();
      if (!state.youtubePlayer || !state.youtubePlayer.getPlayerState) return;
      try {
        var s = state.youtubePlayer.getPlayerState();
        if (s === 0 && _lastState !== 0) {
          console.log('🎵 [AutoNext] (polling) detectou ENDED');
          decidirProxima();
        }
        _lastState = s;
      } catch (e) {}
    }, 1000);
  }

  var _originalInitialize = window.initializeYouTubePlayer;
  if (typeof _originalInitialize === 'function') {
    window.initializeYouTubePlayer = function () {
      _autoNextBound = false;
      _lastState = -1;
      var result = _originalInitialize.apply(this, arguments);
      setTimeout(bindYouTubeAutoNext, 500);
      setTimeout(bindYouTubeAutoNext, 1500);
      return result;
    };
  }

  iniciarPolling();
  setTimeout(bindYouTubeAutoNext, 1000);
  console.log('🎵 [AutoNext] sistema robusto inicializado');
})();

// ============================================================
// PERSISTÊNCIA v9.3.2 — funciona com playlists globais (YouTube)
// ============================================================
(function bindPersistence() {
  var STORAGE_KEY = 'playmy_player_state_v1';

  // ----------------------------------------------------------
  // Salva o estado atual
  // ----------------------------------------------------------
  function saveState() {
    try {
      // ============================================================
      // CASO 1: playQueue ativa (playlist global com YouTube)
      // ============================================================
      if (window.playQueue &&
          Array.isArray(window.playQueue.items) &&
          window.playQueue.items.length > 0 &&
          window.playQueue.currentIndex >= 0) {

        var curItem = window.playQueue.items[window.playQueue.currentIndex];

        // Item de YouTube (index -1 + youtubeData)
        if (curItem && curItem.index === -1 && curItem.youtubeData && curItem.youtubeData.videoId) {
          var ytPayload = {
            version: 2,
            playlistType: 'youtube',
            queueItems: window.playQueue.items.map(function (it) {
              return {
                type: it.type || 'internal',
                index: (typeof it.index === 'number') ? it.index : -1,
                youtubeData: it.youtubeData || null
              };
            }),
            currentIndex: window.playQueue.currentIndex,
            currentTrack: {
              id: 'yt_' + curItem.youtubeData.videoId,
              titulo: curItem.youtubeData.titulo,
              artista: curItem.youtubeData.artista,
              link_youtube: 'https://www.youtube.com/watch?v=' + curItem.youtubeData.videoId,
              capa: 'https://img.youtube.com/vi/' + curItem.youtubeData.videoId + '/hqdefault.jpg',
              is_youtube: true
            },
            shuffle: state.isShuffle || false,
            repeatMode: state.repeatMode || 'off',
            savedAt: Date.now()
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(ytPayload));
          console.log('💾 [Persist] salvo (YouTube):', curItem.youtubeData.titulo);
          return;
        }

        // Item normal da playQueue
        if (curItem && (curItem.type === 'internal' || curItem.type === 'external')) {
          var qPayload = {
            version: 2,
            playlistType: 'queue',
            queueItems: window.playQueue.items.map(function (it) {
              return {
                type: it.type || 'internal',
                index: (typeof it.index === 'number') ? it.index : -1,
                youtubeData: it.youtubeData || null
              };
            }),
            currentIndex: window.playQueue.currentIndex,
            currentTrack: null,
            shuffle: state.isShuffle || false,
            repeatMode: state.repeatMode || 'off',
            savedAt: Date.now()
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(qPayload));
          console.log('💾 [Persist] salvo (queue index ' + window.playQueue.currentIndex + ')');
          return;
        }
      }

      // ============================================================
      // CASO 2: playlist linear normal
      // ============================================================
      if (!state.playlist || !state.playlist.length) return;
      if (typeof state.currentTrackIndex !== 'number') return;
      if (state.currentTrackIndex < 0 || state.currentTrackIndex >= state.playlist.length) return;

      var track = state.playlist[state.currentTrackIndex];
      if (!track) return;

      var payload = {
        version: 2,
        playlistType: 'linear',
        playlistIds: state.playlist.map(function (t) { return t.id; }),
        currentIndex: state.currentTrackIndex,
        currentTrack: {
          id: track.id,
          titulo: track.titulo,
          artista: track.artista,
          link_youtube: track.link_youtube,
          capa: track.capa || track.cover || ''
        },
        shuffle: state.isShuffle || false,
        repeatMode: state.repeatMode || 'off',
        savedAt: Date.now()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      console.log('💾 [Persist] salvo (linear):', track.titulo);
    } catch (e) {
      console.warn('⚠️ [Persist] erro ao salvar:', e.message);
    }
  }

  // ----------------------------------------------------------
  // Restaura o estado ao carregar
  // ----------------------------------------------------------
  function restoreState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var payload = JSON.parse(raw);

      if (Date.now() - payload.savedAt > 7 * 24 * 60 * 60 * 1000) {
        localStorage.removeItem(STORAGE_KEY);
        return;
      }

      console.log('💾 [Persist] estado encontrado:', payload.playlistType);

      state.isShuffle = payload.shuffle || false;
      state.repeatMode = payload.repeatMode || 'off';
      state.isRepeat = state.repeatMode !== 'off';

      if ((payload.playlistType === 'youtube' || payload.playlistType === 'queue') &&
          Array.isArray(payload.queueItems)) {
        if (window.playQueue) {
          window.playQueue.items = payload.queueItems;
          window.playQueue.currentIndex = payload.currentIndex || 0;
          console.log('💾 [Persist] fila restaurada:', payload.queueItems.length, 'itens');
        }
      } else if (payload.playlistType === 'linear') {
        state._pendingResumeIndex = payload.currentIndex;
        state._pendingResumePlaylistIds = payload.playlistIds;
      }

      var track = payload.currentTrack;
      if (!track) return;

      var ps = document.getElementById('playerSpotify');
      if (ps) ps.style.display = 'flex';

      var pt = document.getElementById('playerTitle');
      if (pt) pt.textContent = track.titulo || '';

      var pa = document.getElementById('playerArtist');
      if (pa) pa.textContent = track.artista || '';

      var pai = document.getElementById('playerAlbumArt');
      if (pai && track.capa) pai.src = track.capa;

      var et = document.getElementById('expandedTitle');
      if (et) et.textContent = track.titulo || '';

      var ea = document.getElementById('expandedArtist');
      if (ea) ea.textContent = track.artista || '';

      var eai = document.getElementById('expandedAlbumArt');
      if (eai && track.capa) eai.src = track.capa;

      _setupMediaSession(track.titulo, track.artista, track.capa);

      if (typeof window._aplicarEstadoShuffleRepeat === 'function') {
        window._aplicarEstadoShuffleRepeat();
      }

      console.log('💾 [Persist] pronto para retomar:', track.titulo);
    } catch (e) {
      console.warn('⚠️ [Persist] erro ao restaurar:', e.message);
    }
  }

  // ----------------------------------------------------------
  // Wrappers em playTrack / playExternalTrack
  // ----------------------------------------------------------
  var _origPlayTrack = window.playTrack;
  if (typeof _origPlayTrack === 'function') {
    window.playTrack = function () {
      var r = _origPlayTrack.apply(this, arguments);
      setTimeout(saveState, 800);
      return r;
    };
  }

  var _origPlayExternal = window.playExternalTrack;
  if (typeof _origPlayExternal === 'function') {
    window.playExternalTrack = function () {
      var r = _origPlayExternal.apply(this, arguments);
      setTimeout(saveState, 800);
      return r;
    };
  }

  // ----------------------------------------------------------
  // Wrappers em playGlobalPlaylist / playUserPlaylist
  // ----------------------------------------------------------
  var _origPlayGlobal = window.playGlobalPlaylist;
  if (typeof _origPlayGlobal === 'function') {
    window.playGlobalPlaylist = function () {
      var r = _origPlayGlobal.apply(this, arguments);
      setTimeout(saveState, 1500);
      setTimeout(saveState, 3000);
      return r;
    };
    console.log('💾 [Persist] wrapper em playGlobalPlaylist instalado');
  }

  var _origPlayUser = window.playUserPlaylist;
  if (typeof _origPlayUser === 'function') {
    window.playUserPlaylist = function () {
      var r = _origPlayUser.apply(this, arguments);
      setTimeout(saveState, 1500);
      setTimeout(saveState, 3000);
      return r;
    };
    console.log('💾 [Persist] wrapper em playUserPlaylist instalado');
  }

  // ----------------------------------------------------------
  // API pública
  // ----------------------------------------------------------
  window.pmPlayer = {
    save: saveState,
    restore: restoreState,
    clear: function () {
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
      console.log('💾 [Persist] estado limpo');
    },
    debug: function () {
      console.log('--- pmPlayer.debug() ---');
      console.log('STORAGE_KEY:', STORAGE_KEY);
      console.log('Conteúdo:', localStorage.getItem(STORAGE_KEY));
      console.log('playQueue.items:', window.playQueue ? window.playQueue.items.length : 'sem playQueue');
      console.log('playQueue.currentIndex:', window.playQueue ? window.playQueue.currentIndex : 'sem playQueue');
    }
  };

  // ----------------------------------------------------------
  // Restaura quando o usuário logar
  // ----------------------------------------------------------
  function tryRestore() {
    if (!window.state || !window.state.currentUser) {
      setTimeout(tryRestore, 1000);
      return;
    }
    restoreState();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(tryRestore, 2000);
    });
  } else {
    setTimeout(tryRestore, 2000);
  }
})();

// ============================================================
// LOG DE CARREGAMENTO
// ============================================================
console.log('✅ [player.js] v9.3.2 carregado — auto-next + persistência (YouTube + playlist global)');
