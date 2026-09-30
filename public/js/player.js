// ============================================================
// js/player.js — PLAY MY v9.3.0
// Player completo: reprodução, controles, progresso, volume.
// Depende de: config.js, utils.js, state.js, api.js, youtube.js
// DEVE carregar DEPOIS de youtube.js e ANTES de marketplace.js.
//
// MUDANÇAS v9.3.0 (integração com background-play.js v1.1.2):
//   - 🔗 Media Session DELEGADA ao background-play.js
//        (elimina conflito de metadata + handlers duplicados)
//   - 🆕 AUTO-NEXT: quando a faixa termina, toca a próxima
//        (respeita shuffle + repeat via playNext())
//   - 🆕 PERSISTÊNCIA: salva playlist + índice no localStorage
//        (restaura ao reabrir o app)
//   - 🆕 window.pmPlayer.save() / .restore() / .clear() para debug
//   - 🔧 Fallback completo se background-play.js não existir
//
// MUDANÇAS v9.2.1:
//   - 🔒 playTrack(): trava anti-duplo-clique (state._loadingTrack)
//   - 🛡️ extractYouTubeId(): guarda de tipo antes de chamar
//   - 🛡️ progress bars: validam container antes de getBoundingClientRect
//
// MUDANÇAS v9.2.0:
//   - 🆕 SHUFFLE + REPEAT funcionais (implementação local, sem playQueue)
//     - toggleShuffle embaralha state.playlist e guarda ordem original
//     - toggleRepeat cicla off → all → one → off
//     - playNext respeita repeatMode ('off' | 'all' | 'one')
//     - playPrevious respeita repeat all
//     - Visual dos botões (cor + ícone) atualizado
//   - 🔧 Fonte única de verdade: state.playlist + state.currentTrackIndex
//
// MUDANÇAS v9.1.0:
//   - 🆕 MEDIA SESSION API: suporte a segundo plano no celular
//   - 🆕 AUDIO SESSION + WAKE LOCK
//
// MUDANÇAS v9.0.0:
//   - playTrack/playExternalTrack atualizam o PLAYER EXPANDIDO
//   - registrarStreaming é disparado quando o vídeo começa
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
// O background-play.js já configura:
//   - metadata (título, artista, capa)
//   - setActionHandler (play, pause, next, prev, seek, stop)
//   - playbackState
//   - setPositionState
//
// Aqui só atualizamos window.state e pedimos ao background-play
// para refazer a Media Session. Se ele não existir, fazemos o
// básico como fallback.
// ============================================================

function _setupMediaSession(titulo, artista, capaUrl) {
  // Atualiza window.state para o background-play detectar
  try {
    if (window.state) {
      window.state.currentTrackTitle = titulo || 'PlayMy';
      window.state.currentArtist = artista || 'PlayMy';
      window.state.currentArtwork = capaUrl || '';
    }
  } catch (e) {}

  // Pede ao background-play para atualizar
  if (window.pmBackgroundPlay &&
      typeof window.pmBackgroundPlay.updateMediaSession === 'function') {
    setTimeout(function () {
      try {
        window.pmBackgroundPlay.updateMediaSession();
      } catch (e) {}
    }, 50);
    console.log('🎵 [MediaSession] delegado ao background-play:', titulo, '-', artista);
    return;
  }

  // Fallback: se o background-play não existir, faz o básico
  if (!('mediaSession' in navigator)) {
    console.log('🎵 [MediaSession] não suportado neste navegador');
    return;
  }

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
  // Delegado
  if (window.pmBackgroundPlay &&
      typeof window.pmBackgroundPlay.updatePlaybackState === 'function') {
    try {
      window.pmBackgroundPlay.updatePlaybackState();
    } catch (e) {}
    return;
  }
  // Fallback
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  } catch (e) {}
}

function _updateMediaSessionPosition() {
  // O background-play atualiza via timeupdate do <audio>.
  // Aqui só reforçamos quando o player do YouTube está ativo.
  if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;
  if (!state.youtubePlayer || !state.youtubePlayer.getCurrentTime) return;
  try {
    const duration = state.youtubePlayer.getDuration();
    const position = state.youtubePlayer.getCurrentTime();
    if (duration > 0 && position >= 0 && position <= duration) {
      navigator.mediaSession.setPositionState({
        duration,
        position,
        playbackRate: 1
      });
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
// AUDIO SESSION + WAKE LOCK (iOS + Android)
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
// PATCH: updatePlayerProgress agora atualiza a posição da Media Session
// ============================================================
const _originalUpdatePlayerProgress = window.updatePlayerProgress;

// ============ TOCAR MÚSICA INTERNA ============
window.playTrack = function (index) {
  // 🔒 Trava anti-duplo-clique
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

    // 🆕 MEDIA SESSION — delegada ao background-play.js
    _setupMediaSession(t.titulo, t.artista, getCoverUrl(t, false));
    _setAudioSessionType('playback');
    _requestWakeLock();

    // ✅ Carrega o player do YouTube
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
    // 🔓 Libera a trava após 1s (evita clique duplo)
    setTimeout(() => {
      state._loadingTrack = false;
    }, 1000);
  }
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

  // 🆕 MEDIA SESSION — delegada
  _setupMediaSession(t.titulo, t.artista, getCoverUrl(t, true));
  _setAudioSessionType('playback');
  _requestWakeLock();

  // ✅ Carrega o player do YouTube
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

    // 🆕 MEDIA SESSION — delegada
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

// ============ PROGRESSO (com validação de container) ============
window.handleProgressClick = function (e) {
  if (!state.youtubePlayer || !state.youtubePlayer.seekTo) return;

  const container = document.getElementById('progressContainer');
  if (!container) {
    console.warn('⚠️ handleProgressClick: progressContainer não encontrado');
    return;
  }

  const r = container.getBoundingClientRect();
  if (!r || !r.width) return;

  const p = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
  state.youtubePlayer.seekTo(state.youtubePlayer.getDuration() * p, true);
};

window.handleExpandedProgressClick = function (e) {
  if (!state.youtubePlayer || !state.youtubePlayer.seekTo) return;

  const container = document.getElementById('expandedProgressContainer');
  if (!container) {
    console.warn('⚠️ handleExpandedProgressClick: expandedProgressContainer não encontrado');
    return;
  }

  const r = container.getBoundingClientRect();
  if (!r || !r.width) return;

  const p = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
  state.youtubePlayer.seekTo(state.youtubePlayer.getDuration() * p, true);
};

// ============================================================
// SHUFFLE / REPEAT / NEXT / PREV
// ============================================================

// Inicializa os campos de shuffle/repeat
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
// LIBERAÇÃO DE RECURSOS
// ============================================================
window._onPlayerStop = function () {
  _releaseWakeLock();
  _clearMediaSession();
  _setAudioSessionType('auto');
};

// ============================================================
// PATCH: atualiza a posição da Media Session junto com o progresso
// ============================================================
const _progressIntervalPatch = setInterval(() => {
  if (state.isPlaying) _updateMediaSessionPosition();
}, 5000);

// ============================================================
// APLICAR ESTADO INICIAL DOS BOTÕES
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
// 🆕 v9.3.0 — AUTO-NEXT: quando a faixa termina, toca a próxima
// ============================================================
(function bindAutoNext() {
  var _autoNextBound = false;
  var _autoNextTimer = null;

  function bindYouTubeAutoNext() {
    if (_autoNextBound) return;
    if (!state.youtubePlayer || !state.youtubePlayer.addEventListener) return;

    try {
      state.youtubePlayer.addEventListener('onStateChange', function (event) {
        // YT.PlayerState.ENDED = 0
        if (event.data === 0) {
          console.log('🎵 [AutoNext] faixa terminou — tocando próxima');
          if (typeof playNext === 'function') {
            playNext();
          }
        }
      });
      _autoNextBound = true;
      console.log('🎵 [AutoNext] vinculado ao player do YouTube');

      if (_autoNextTimer) {
        clearInterval(_autoNextTimer);
        _autoNextTimer = null;
      }
    } catch (e) {
      console.warn('⚠️ [AutoNext] erro ao vincular:', e.message);
    }
  }

  // Tenta vincular a cada 1s (o player pode demorar para carregar)
  _autoNextTimer = setInterval(bindYouTubeAutoNext, 1000);

  // Também vincula quando o player for recriado
  var _originalInitialize = window.initializeYouTubePlayer;
  if (typeof _originalInitialize === 'function') {
    window.initializeYouTubePlayer = function () {
      _autoNextBound = false;
      var result = _originalInitialize.apply(this, arguments);
      setTimeout(bindYouTubeAutoNext, 500);
      return result;
    };
  }
})();

// ============================================================
// 🆕 v9.3.0 — PERSISTÊNCIA: salva e restaura playlist atual
// ============================================================
(function bindPersistence() {
  var STORAGE_KEY = 'playmy_player_state_v1';

  // ------------------------------------------------------------
  // Salva o estado atual
  // ------------------------------------------------------------
  function saveState() {
    try {
      if (!state.playlist || !state.playlist.length) return;
      if (typeof state.currentTrackIndex !== 'number') return;

      var track = state.playlist[state.currentTrackIndex];
      if (!track) return;

      var payload = {
        // Playlist completa (só os IDs para economizar espaço)
        playlistIds: state.playlist.map(function (t) { return t.id; }),
        currentIndex: state.currentTrackIndex,
        // Snapshot da faixa atual (caso a playlist mude)
        currentTrack: {
          id: track.id,
          titulo: track.titulo,
          artista: track.artista,
          link_youtube: track.link_youtube,
          capa: track.capa || track.cover || ''
        },
        // Modo
        shuffle: state.isShuffle || false,
        repeatMode: state.repeatMode || 'off',
        // Timestamp
        savedAt: Date.now()
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      console.log('💾 [Persist] estado salvo:', track.titulo);
    } catch (e) {
      console.warn('⚠️ [Persist] erro ao salvar:', e.message);
    }
  }

  // ------------------------------------------------------------
  // Restaura o estado ao carregar
  // ------------------------------------------------------------
  function restoreState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      var payload = JSON.parse(raw);

      // Descarta se passou mais de 7 dias
      if (Date.now() - payload.savedAt > 7 * 24 * 60 * 60 * 1000) {
        localStorage.removeItem(STORAGE_KEY);
        return;
      }

      console.log('💾 [Persist] estado encontrado:', payload.currentTrack.titulo);

      // Restaura modo
      state.isShuffle = payload.shuffle || false;
      state.repeatMode = payload.repeatMode || 'off';
      state.isRepeat = state.repeatMode !== 'off';

      // Restaura a faixa atual no mini-player (SEM tocar)
      // — o navegador bloqueia autoplay sem interação
      var track = payload.currentTrack;

      // Atualiza o mini-player visual
      var playerSpotify = document.getElementById('playerSpotify');
      if (playerSpotify) playerSpotify.style.display = 'flex';

      var playerTitle = document.getElementById('playerTitle');
      if (playerTitle) playerTitle.textContent = track.titulo || '';

      var playerArtist = document.getElementById('playerArtist');
      if (playerArtist) playerArtist.textContent = track.artista || '';

      var playerAlbumArt = document.getElementById('playerAlbumArt');
      if (playerAlbumArt && track.capa) playerAlbumArt.src = track.capa;

      // Atualiza player expandido
      var expandedTitle = document.getElementById('expandedTitle');
      if (expandedTitle) expandedTitle.textContent = track.titulo || '';

      var expandedArtist = document.getElementById('expandedArtist');
      if (expandedArtist) expandedArtist.textContent = track.artista || '';

      var expandedAlbumArt = document.getElementById('expandedAlbumArt');
      if (expandedAlbumArt && track.capa) expandedAlbumArt.src = track.capa;

      // Atualiza Media Session (deixa pronto para o usuário dar play)
      _setupMediaSession(track.titulo, track.artista, track.capa);

      // Guarda o índice para o usuário poder dar "play" e continuar
      state._pendingResumeIndex = payload.currentIndex;
      state._pendingResumePlaylistIds = payload.playlistIds;

      // Aplica estado visual dos botões
      if (typeof window._aplicarEstadoShuffleRepeat === 'function') {
        window._aplicarEstadoShuffleRepeat();
      }

      console.log('💾 [Persist] pronto para retomar no índice:', payload.currentIndex);

    } catch (e) {
      console.warn('⚠️ [Persist] erro ao restaurar:', e.message);
    }
  }

  // ------------------------------------------------------------
  // Salva automaticamente a cada troca de faixa
  // ------------------------------------------------------------
  var _originalPlayTrack = window.playTrack;
  if (typeof _originalPlayTrack === 'function') {
    window.playTrack = function () {
      var result = _originalPlayTrack.apply(this, arguments);
      // Salva depois de 500ms (dá tempo do state atualizar)
      setTimeout(saveState, 500);
      return result;
    };
  }

  var _originalPlayExternal = window.playExternalTrack;
  if (typeof _originalPlayExternal === 'function') {
    window.playExternalTrack = function () {
      var result = _originalPlayExternal.apply(this, arguments);
      setTimeout(saveState, 500);
      return result;
    };
  }

  // ------------------------------------------------------------
  // Restaura quando o usuário logar
  // ------------------------------------------------------------
  function tryRestore() {
    if (!window.state || !window.state.user) {
      // Tenta de novo em 1s
      setTimeout(tryRestore, 1000);
      return;
    }
    restoreState();
  }

  // ------------------------------------------------------------
  // API pública para debug
  // ------------------------------------------------------------
  window.pmPlayer = {
    save: saveState,
    restore: restoreState,
    clear: function () {
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
      console.log('💾 [Persist] estado limpo');
    }
  };

  // ------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------
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
console.log('✅ [player.js] v9.3.0 carregado — shuffle + repeat + Media Session delegada + auto-next + persistência');
