// ============================================================
// js/player.js — PLAY MY v9.2.0
// Player completo: reprodução, controles, progresso, volume.
// Depende de: config.js, utils.js, state.js, api.js, youtube.js
// DEVE carregar DEPOIS de youtube.js e ANTES de marketplace.js.
//
// MUDANÇAS v9.2.0:
//   - 🆕 SHUFFLE + REPEAT funcionais (implementação local, sem playQueue)
//     - toggleShuffle embaralha state.playlist e guarda ordem original
//     - toggleRepeat cicla off → all → one → off
//     - playNext respeita repeatMode ('off' | 'all' | 'one')
//     - playPrevious respeita repeat all
//     - Visual dos botões (cor + ícone) atualizado
//   - 🔧 Fonte única de verdade: state.playlist + state.currentTrackIndex
//     (não depende mais de playQueue.items, que ficava dessincronizado)
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
// 🆕 HELPERS PARA MOVER O IFRAME DO YOUTUBE
// O iframe vive no #youtubePlayerGlobal (fora das seções).
// openPlayerExpanded() MOVE pra seção expandida.
// closePlayerExpanded() DEVOLVE pro global.
// A música NÃO pausa ao navegar entre seções.
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

// ============================================================
// 🆕 v9.2.0 — SHUFFLE / REPEAT / NEXT / PREV
// Implementação local, sem depender do playQueue.
// Fonte única de verdade: state.playlist + state.currentTrackIndex
// ============================================================

// Inicializa os campos de shuffle/repeat
(function initShuffleRepeatV2() {
  if (typeof state.isShuffle !== 'boolean') state.isShuffle = false;
  if (typeof state.isRepeat !== 'boolean') state.isRepeat = false;
  if (typeof state.repeatMode !== 'string') state.repeatMode = 'off';
  if (!Array.isArray(state._originalPlaylist)) state._originalPlaylist = null;
  console.log('🎵 [player] shuffle/repeat inicializado:', {
    isShuffle: state.isShuffle,
    isRepeat: state.isRepeat,
    repeatMode: state.repeatMode,
    playlistLength: (state.playlist && state.playlist.length) || 0
  });
})();

// ------------------------------------------------------------
// TOGGLE SHUFFLE
// ------------------------------------------------------------
window.toggleShuffle = function () {
  state.isShuffle = !state.isShuffle;

  const playlist = state.playlist || [];
  if (!playlist.length) {
    if (typeof showToast === 'function') showToast('⚠️ Fila vazia', 'warning');
    state.isShuffle = false;
    return;
  }

  if (state.isShuffle) {
    // Salva a ordem original
    if (!state._originalPlaylist) {
      state._originalPlaylist = playlist.slice();
    }

    // Fisher-Yates
    const shuffled = playlist.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = shuffled[i];
      shuffled[i] = shuffled[j];
      shuffled[j] = tmp;
    }

    // Mantém a música atual na frente
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
    console.log('🔀 Shuffle ON — playlist embaralhada');
  } else {
    // Restaura ordem original
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
    console.log('🔀 Shuffle OFF — playlist restaurada');
  }

  // Visual
  const btn = document.getElementById('shuffleBtn');
  if (btn) {
    btn.style.color = state.isShuffle ? 'var(--apple-green)' : '';
    btn.style.background = state.isShuffle ? 'rgba(52,199,89,0.15)' : '';
  }
};

// ------------------------------------------------------------
// TOGGLE REPEAT — cicla: off → all → one → off
// ------------------------------------------------------------
window.toggleRepeat = function () {
  const ciclo = ['off', 'all', 'one'];
  const atual = ciclo.indexOf(state.repeatMode);
  const proximo = ciclo[(atual + 1) % ciclo.length];

  state.repeatMode = proximo;
  state.isRepeat = (proximo !== 'off');

  console.log('🔁 Repeat:', proximo);

  const msgs = {
    'off': '🔁 Repetir OFF',
    'all': '🔁 Repetir FILA',
    'one': '🔂 Repetir MÚSICA'
  };

  if (typeof showToast === 'function') showToast(msgs[proximo], 'info');

  // Visual
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

// ------------------------------------------------------------
// PLAY NEXT — respeita shuffle + repeat
// ------------------------------------------------------------
window.playNext = function () {
  const playlist = state.playlist || [];
  if (!playlist.length) {
    console.warn('⚠️ playNext: fila vazia');
    return;
  }

  // 1) Repeat one → repete a mesma
  if (state.repeatMode === 'one') {
    const idx = state.currentTrackIndex;
    if (idx >= 0 && idx < playlist.length) {
      console.log('🔂 Repeat one — repetindo:', playlist[idx] && playlist[idx].titulo);
      playTrack(idx);
      return;
    }
  }

  // 2) Próximo índice
  let nextIdx = state.currentTrackIndex + 1;

  // 3) Chegou no fim?
  if (nextIdx >= playlist.length) {
    if (state.repeatMode === 'all') {
      nextIdx = 0;
      console.log('🔁 Repeat all — voltando ao início');
    } else {
      console.log('⏹️ Fim da fila');
      if (typeof showToast === 'function') showToast('⏹️ Fim da fila', 'info');
      if (state.youtubePlayer && state.youtubePlayer.pauseVideo) {
        state.youtubePlayer.pauseVideo();
        state.isPlaying = false;
        updatePlayerIcons();
      }
      return;
    }
  }

  // 4) Toca
  console.log('▶️ Próxima:', nextIdx + 1, '/', playlist.length, '-', playlist[nextIdx] && playlist[nextIdx].titulo);
  playTrack(nextIdx);
};

// ------------------------------------------------------------
// PLAY PREVIOUS — respeita repeat all
// ------------------------------------------------------------
window.playPrevious = function () {
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

  console.log('⏮️ Anterior:', prevIdx + 1, '/', playlist.length, '-', playlist[prevIdx] && playlist[prevIdx].titulo);
  playTrack(prevIdx);
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

  // 🆕 Move o iframe do YouTube pra dentro do player expandido
  window._moveYouTubeToExpanded();
};
window.closePlayerExpanded = function () {
  // 🆕 Devolve o iframe pro container global (não pausa a música)
  window._moveYouTubeToGlobal();

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
// 🆕 v9.2.0 — APLICAR ESTADO INICIAL DOS BOTÕES
// Garante que o visual reflita o estado atual ao carregar
// ============================================================
window._aplicarEstadoShuffleRepeat = function () {
  // Shuffle
  const btnShuffle = document.getElementById('shuffleBtn');
  if (btnShuffle) {
    btnShuffle.style.color = state.isShuffle ? 'var(--apple-green)' : '';
    btnShuffle.style.background = state.isShuffle ? 'rgba(52,199,89,0.15)' : '';
  }

  // Repeat
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
// LOG DE CARREGAMENTO
// ============================================================
console.log('✅ [player.js] v9.2.0 carregado — shuffle + repeat + Media Session + segundo plano');
