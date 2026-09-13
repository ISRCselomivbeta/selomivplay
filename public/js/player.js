// ============================================================
// js/player.js — PLAY MY v8.5.2
// Player completo: reprodução, controles, progresso, volume.
// Depende de: config.js, utils.js, state.js, api.js, youtube.js
// DEVE carregar DEPOIS de youtube.js e ANTES de marketplace.js.
//
// MUDANÇAS v8.5.2:
//   - playTrack/playExternalTrack agora atualizam o PLAYER EXPANDIDO
//   - Logs de debug para identificar problemas
//   - Tratamento robusto de link_youtube inválido
// ============================================================

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

  // ✅ Atualiza PLAYER EXPANDIDO (isso estava faltando!)
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

// ============ LOG DE CARREGAMENTO ============
console.log('✅ [player.js] carregado — v8.5.2 (player expandido corrigido)');
