// ============================================================
// js/player.js — PLAY MY v9.1.0
// Player completo: reprodução, controles, progresso, volume.
// Depende de: config.js, utils.js, state.js, api.js, youtube.js
// DEVE carregar DEPOIS de youtube.js e ANTES de marketplace.js.
//
// MUDANÇAS v9.1.0:
//   - 🆕 MEDIA SESSION API: suporte a segundo plano no celular
//     - metadados (título, artista, capa) na tela de bloqueio
//     - controles play/pause/next/prev no sistema operacional
//     - AudioSession.type = 'playback' (iOS)
//     - Wake Lock (opcional) para não apagar a tela durante a música
//
// MUDANÇAS v9.0.0:
//   - playTrack/playExternalTrack continuam atualizando o PLAYER EXPANDIDO
//   - registrarStreaming é disparado quando o vídeo começa
//   - player.js agora loga o videoId para debug
//   - Nada quebra do v8.5.2
// ============================================================

// ============================================================
// 🆕 MEDIA SESSION — suporte a segundo plano
// ============================================================
let _wakeLock = null;
let _wakeLockRequested = false;

function _setupMediaSession(titulo, artista, capaUrl) {
  if (!('mediaSession' in navigator)) {
    console.log('🎵 [MediaSession] não suportado neste navegador');
    return;
  }

  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: titulo || 'PLAY MY',
      artist: artista || 'PLAY MY',
      album: 'PLAY MY',
      artwork: [
        { src: capaUrl || '/images/logo.png', sizes: '96x96',   type: 'image/png' },
        { src: capaUrl || '/images/logo.png', sizes: '128x128', type: 'image/png' },
        { src: capaUrl || '/images/logo.png', sizes: '192x192', type: 'image/png' },
        { src: capaUrl || '/images/logo.png', sizes: '256x256', type: 'image/png' },
        { src: capaUrl || '/images/logo.png', sizes: '384x384', type: 'image/png' },
        { src: capaUrl || '/images/logo.png', sizes: '512x512', type: 'image/png' }
      ]
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
    navigator.mediaSession.setActionHandler('seekbackward', (details) => {
      if (state.youtubePlayer && state.youtubePlayer.seekTo) {
        const skip = details.seekOffset || 10;
        const t = state.youtubePlayer.getCurrentTime() - skip;
        state.youtubePlayer.seekTo(Math.max(0, t), true);
      }
    });
    navigator.mediaSession.setActionHandler('seekforward', (details) => {
      if (state.youtubePlayer && state.youtubePlayer.seekTo) {
        const skip = details.seekOffset || 10;
        const t = state.youtubePlayer.getCurrentTime() + skip;
        state.youtubePlayer.seekTo(t, true);
      }
    });
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (state.youtubePlayer && state.youtubePlayer.seekTo && details.seekTime != null) {
        state.youtubePlayer.seekTo(details.seekTime, true);
      }
    });

    navigator.mediaSession.playbackState = 'playing';
    console.log('🎵 [MediaSession] configurada:', titulo, '-', artista);
  } catch (e) {
    console.warn('⚠️ [MediaSession] erro:', e.message);
  }
}

function _updateMediaSessionState(isPlaying) {
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
    const rate = 1;
    if (duration > 0 && position >= 0 && position <= duration) {
      navigator.mediaSession.setPositionState({ duration, position, playbackRate: rate });
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
// 🆕 AUDIO SESSION + WAKE LOCK (iOS + Android)
// ============================================================
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
// 🆕 PATCH: updatePlayerProgress agora atualiza a posição da Media Session
// ============================================================
const _originalUpdatePlayerProgress = window.updatePlayerProgress;

// ============ TOCAR MÚSICA INTERNA ============
window.playTrack = function (index) {
  console.log('🎵 playTrack chamada com index:', index);

  const t = state.playlist[index];
  if (!t) {
    console.warn('⚠️ playTrack: índice inválido', index);
    return;
  }

  console.log('🎵 Música:', t.titulo, '-', t.artista);
  console.log('🎵 link_youtube:', t.link_youtube);

  state.currentTrackIndex = index;

  // ✅ Atualiza mini-player (rodapé)
  const playerSpotify = document.getElementById('playerSpotify');
  if (playerSpotify) playerSpotify.style.display = 'flex';

  const playerTitle = document.getElementById('playerTitle');
  if (playerTitle) playerTitle.textContent = t.titulo || '';

  const playerArtist = document.getElementById('playerArtist');
  if (playerArtist) playerArtist.textContent = t.artista || '';

  const playerAlbumArt = document.getElementById('playerAlbumArt');
  if (playerAlbumArt) playerAlbumArt.src = getCoverUrl(t, false);

  // ✅ Atualiza PLAYER EXPANDIDO
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

  // ✅ Atualiza o overlay do track
  const trackOverlayIcon = document.getElementById('trackOverlayIcon');
  if (trackOverlayIcon) trackOverlayIcon.className = 'bi bi-play-fill';

  // 🆕 MEDIA SESSION — configura título/artista/capa na tela de bloqueio
  _setupMediaSession(t.titulo, t.artista, getCoverUrl(t, false));
  _setAudioSessionType('playback');
  _requestWakeLock();

  // ✅ Carrega o player do YouTube
  if (t.link_youtube) {
    const v = extractYouTubeId(t.link_youtube);
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
};

// ============ TOCAR MÚSICA EXTERNA ============
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

  // ✅ Atualiza mini-player
  const playerSpotify = document.getElementById('playerSpotify');
  if (playerSpotify) playerSpotify.style.display = 'flex';

  const playerTitle = document.getElementById('playerTitle');
  if (playerTitle) playerTitle.textContent = t.titulo || '';

  const playerArtist = document.getElementById('playerArtist');
  if (playerArtist) playerArtist.textContent = t.artista || '';

  const playerAlbumArt = document.getElementById('playerAlbumArt');
  if (playerAlbumArt) playerAlbumArt.src = getCoverUrl(t, true);

  // ✅ Atualiza PLAYER EXPANDIDO
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

  // 🆕 MEDIA SESSION
  _setupMediaSession(t.titulo, t.artista, getCoverUrl(t, true));
  _setAudioSessionType('playback');
  _requestWakeLock();

  // ✅ Carrega o player do YouTube
  if (t.link_youtube) {
    const v = extractYouTubeId(t.link_youtube);
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

// ============ TOCAR RESULTADO DE BUSCA ============
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

    // Atualiza também o player expandido
    const expandedTitle = document.getElementById('expandedTitle');
    if (expandedTitle) expandedTitle.textContent = 'Vídeo do YouTube';

    const expandedArtist = document.getElementById('expandedArtist');
    if (expandedArtist) expandedArtist.textContent = 'Resultado da busca';

    // 🆕 MEDIA SESSION
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

// ============ CONTROLES BÁSICOS ============
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

window.playNext = function () {
  if (typeof playQueue !== 'undefined' && playQueue.playNext) {
    playQueue.playNext();
  }
};

window.playPrevious = function () {
  if (typeof playQueue !== 'undefined' && playQueue.playPrevious) {
    playQueue.playPrevious();
  }
};

// ============ ÍCONES DO PLAYER ============
window.updatePlayerIcons = function () {
  const ip = state.isPlaying;
  ['playPauseIcon', 'trackOverlayIcon', 'expandedPlayPauseIcon'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.className = ip ? 'bi bi-pause-fill' : 'bi bi-play-fill';
  });

  // 🆕 Atualiza a Media Session também
  _updateMediaSessionState(ip);
};

// ============ VOLUME ============
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

// ============ PROGRESSO ============
window.handleProgressClick = function (e) {
  if (!state.youtubePlayer || !state.youtubePlayer.seekTo) return;

  const r = document.getElementById('progressContainer').getBoundingClientRect();
  const p = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
  state.youtubePlayer.seekTo(state.youtubePlayer.getDuration() * p, true);
};

window.handleExpandedProgressClick = function (e) {
  if (!state.youtubePlayer || !state.youtubePlayer.seekTo) return;

  const r = document.getElementById('expandedProgressContainer').getBoundingClientRect();
  const p = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
  state.youtubePlayer.seekTo(state.youtubePlayer.getDuration() * p, true);
};

// ============ SHUFFLE / REPEAT ============
window.toggleShuffle = function () {
  state.isShuffle = !state.isShuffle;
  if (state.isShuffle && typeof playQueue !== 'undefined' && playQueue.shuffle) {
    playQueue.shuffle();
  }
  showToast(state.isShuffle ? 'Aleatório ON' : 'Aleatório OFF', 'info');

  const btn = document.getElementById('shuffleBtn');
  if (btn) {
    btn.style.color = state.isShuffle ? 'var(--apple-green)' : '';
  }
};

window.toggleRepeat = function () {
  state.isRepeat = !state.isRepeat;
  showToast(state.isRepeat ? 'Repetir ON' : 'Repetir OFF', 'info');

  const btn = document.getElementById('repeatBtn');
  if (btn) {
    btn.style.color = state.isRepeat ? 'var(--apple-green)' : '';
  }
};

// ============ FAVORITOS (a partir do player) ============
window.toggleFavorite = function () {
  showToast('Adicione aos favoritos pelo card', 'info');
};

// ============ PLAYER EXPANDIDO ============
window.openPlayerExpanded = function () {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('playerExpandedSection');
  if (el) el.classList.add('active');
};

window.closePlayerExpanded = function () {
  if (typeof changeSection === 'function') {
    changeSection('marketplace');
  } else {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    const el = document.getElementById('marketplaceSection');
    if (el) el.classList.add('active');
  }
};

// ============================================================
// 🆕 LIBERAÇÃO DE RECURSOS
// Chamado quando a música termina ou é pausada por muito tempo
// ============================================================
window._onPlayerStop = function () {
  _releaseWakeLock();
  _clearMediaSession();
  _setAudioSessionType('auto');
};

// ============================================================
// 🆕 PATCH: atualiza a posição da Media Session junto com o progresso
// ============================================================
const _progressIntervalPatch = setInterval(() => {
  if (state.isPlaying) _updateMediaSessionPosition();
}, 5000);

// ============================================================
// LOG DE CARREGAMENTO
// ============================================================
console.log('✅ [player.js] v9.1.0 carregado — Media Session + segundo plano');
