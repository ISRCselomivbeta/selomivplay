// ============================================================
// PLAYER - PLAY MY v8.2 (YouTube + controles + fila)
// ============================================================

let _ytInitLock = false;

function playTrack(index) {
  if (index < 0 || index >= state.playlist.length) { showToast('Música não encontrada', 'error'); return; }
  const t = state.playlist[index];
  state.streamingProgress = 0; state.streamingLastReward = 0; state.streamingTrackId = null; state.playerReady = false;
  state.currentTrackIndex = index;
  const p = document.getElementById('playerSpotify'); if (p) p.style.display = 'flex';
  document.getElementById('playerTitle').textContent = t.titulo || '';
  document.getElementById('playerArtist').textContent = t.artista || '';
  const art = document.getElementById('playerAlbumArt');
  if (art) { art.src = getCoverUrl(t, false); art.onerror = function() { this.src = PLACEHOLDERS.MIV_56; }; }
  updateFavoriteButton(state.favoriteMusicIds && state.favoriteMusicIds.includes(String(t.id)));
  if (t.link_youtube) { const v = extractYouTubeId(t.link_youtube); if (v) { if (state.youtubeAPILoaded && window.YT) initializeYouTubePlayer(v); else { loadYouTubeAPI(); setTimeout(() => initializeYouTubePlayer(v), 1000); } } }
  state.isPlaying = true; updatePlayerIcons();
  setupMediaSessionTrack(t);
}

function playExternalTrack(index) {
  if (index < 0 || index >= state.externalPlaylist.length) { showToast('Não encontrada', 'error'); return; }
  const t = state.externalPlaylist[index];
  state.currentTrackIndex = 1000 + index;
  document.getElementById('playerSpotify').style.display = 'flex';
  document.getElementById('playerTitle').textContent = t.titulo || '';
  document.getElementById('playerArtist').textContent = t.artista || '';
  const art = document.getElementById('playerAlbumArt');
  if (art) { art.src = getCoverUrl(t, true); art.onerror = function() { this.src = PLACEHOLDERS.EXT_56; }; }
  if (t.link_youtube) { const v = extractYouTubeId(t.link_youtube); if (v) { if (state.youtubeAPILoaded && window.YT) initializeYouTubePlayer(v); else { loadYouTubeAPI(); setTimeout(() => initializeYouTubePlayer(v), 1000); } } }
  state.isPlaying = true; updatePlayerIcons();
  showToast('🎵 Tocando: ' + (t.titulo || ''), 'info');
}

function loadYouTubeAPI(cb) {
  if (window.YT && YT.Player && state.youtubeAPILoaded) { if (cb) cb(); return; }
  window.onYouTubeIframeAPIReady = function() { state.youtubeAPILoaded = true; if (cb) cb(); };
  const old = document.querySelector('script[src*="youtube.com/iframe_api"]');
  if (old && window.YT && YT.Player) { state.youtubeAPILoaded = true; if (cb) cb(); return; }
  if (!old) { const tag = document.createElement('script'); tag.src = 'https://www.youtube.com/iframe_api'; tag.async = true; document.head.appendChild(tag); }
}

function initializeYouTubePlayer(videoId) {
  if (_ytInitLock) return;
  _ytInitLock = true;
  setTimeout(() => { _ytInitLock = false; }, 2000);
  const el = document.getElementById('youtubePlayerExpanded');
  if (!el) return;
  const l = document.getElementById('playerLoadingExpanded');
  if (l) l.style.display = 'flex';
  el.innerHTML = '';
  const div = document.createElement('div');
  div.id = 'yt-' + Date.now();
  el.appendChild(div);
  if (typeof YT === 'undefined' || !YT.Player) {
    loadYouTubeAPI(() => createYouTubePlayer(div.id, videoId));
  } else {
    createYouTubePlayer(div.id, videoId);
  }
}

function createYouTubePlayer(elId, videoId) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.innerHTML = '';
  const div = document.createElement('div');
  div.id = 'ytp-' + Date.now();
  el.appendChild(div);
  if (state.youtubePlayer && state.youtubePlayer.destroy) { try { state.youtubePlayer.destroy(); } catch (e) {} }
  state.youtubePlayer = new YT.Player(div.id, {
    width: '100%', height: '100%', videoId: videoId,
    playerVars: { autoplay: 1, controls: 1, modestbranding: 1, rel: 0, playsinline: 1, enablejsapi: 1, origin: window.location.origin },
    events: { onReady: onPlayerReady, onStateChange: onPlayerStateChange, onError: onPlayerError }
  });
}

function onPlayerReady(e) {
  state.playerReady = true;
  const l = document.getElementById('playerLoadingExpanded'); if (l) l.style.display = 'none';
  try { e.target.setVolume(state.currentVolume); } catch (x) {}
  if (state.isPlaying) try { e.target.playVideo(); } catch (x) {}
  if (state.progressInterval) clearInterval(state.progressInterval);
  state.progressInterval = setInterval(updatePlayerProgress, 1000);
}

function onPlayerStateChange(e) {
  const l = document.getElementById('playerLoadingExpanded');
  state.isBuffering = e.data === YT.PlayerState.BUFFERING;
  switch (e.data) {
    case YT.PlayerState.PLAYING: state.isPlaying = true; if (l) l.style.display = 'none'; break;
    case YT.PlayerState.PAUSED: state.isPlaying = false; break;
    case YT.PlayerState.BUFFERING: if (l) l.style.display = 'flex'; break;
    case YT.PlayerState.ENDED: state.isPlaying = false; if (l) l.style.display = 'none'; if (state.isRepeat) e.target.playVideo(); else playQueue.playNext(); break;
    case YT.PlayerState.CUED: state.playerReady = true; if (l) l.style.display = 'none'; break;
  }
  updatePlayerIcons();
  updateExpandedPlayer();
}

function onPlayerError() { showToast('Erro ao carregar vídeo', 'error'); }

function updatePlayerProgress() {
  if (!state.youtubePlayer || !state.youtubePlayer.getCurrentTime) return;
  try {
    const c = state.youtubePlayer.getCurrentTime(); const d = state.youtubePlayer.getDuration();
    if (d > 0) {
      const p = (c / d) * 100;
      const b = document.getElementById('playerProgressBar'); if (b) b.style.width = p + '%';
      const cc = document.getElementById('currentTimeDisplay'); if (cc) cc.textContent = formatTime(c);
      const t = document.getElementById('totalTimeDisplay'); if (t) t.textContent = formatTime(d);
      const eb = document.getElementById('expandedProgressBar'); if (eb) eb.style.width = p + '%';
      const ec = document.getElementById('expandedCurrentTime'); if (ec) ec.textContent = formatTime(c);
      const et = document.getElementById('expandedTotalTime'); if (et) et.textContent = formatTime(d);
    }
  } catch (e) {}
}

function handleProgressClick(e) { if (!state.youtubePlayer || !state.youtubePlayer.seekTo) return; e.stopPropagation(); const r = document.getElementById('progressContainer').getBoundingClientRect(); const p = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); state.youtubePlayer.seekTo(state.youtubePlayer.getDuration() * p, true); }
function handleExpandedProgressClick(e) { if (!state.youtubePlayer || !state.youtubePlayer.seekTo) return; const r = document.getElementById('expandedProgressContainer').getBoundingClientRect(); const p = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); state.youtubePlayer.seekTo(state.youtubePlayer.getDuration() * p, true); }
function updatePlayerIcons() { const ip = state.isPlaying; ['playPauseIcon', 'trackOverlayIcon', 'expandedPlayPauseIcon'].forEach(id => { const el = document.getElementById(id); if (el) el.className = ip ? 'bi bi-pause-fill' : 'bi bi-play-fill'; }); }
function updateFavoriteButton(f) { const b = document.getElementById('favoriteBtn'), i = document.getElementById('favoriteIcon'); if (b && i) { i.className = f ? 'bi bi-star-fill' : 'bi bi-star'; b.classList.toggle('active', f); } }
function toggleFavorite() { if (state.currentTrackIndex < 0) return; const t = state.currentTrackIndex >= 1000 ? state.externalPlaylist[state.currentTrackIndex - 1000] : state.playlist[state.currentTrackIndex]; if (t) toggleFavoriteMusic(t.id); }

async function toggleFavoriteMusic(id) {
  if (!state.currentUser) { showToast('Faça login', 'error'); return; }
  const sid = String(id);
  const isFav = state.favoriteMusicIds && state.favoriteMusicIds.includes(sid);
  if (isFav) { state.favoriteMusicIds = state.favoriteMusicIds.filter(x => x !== sid); showToast('⭐ Removido', 'success'); }
  else { if (!state.favoriteMusicIds) state.favoriteMusicIds = []; state.favoriteMusicIds.push(sid); showToast('⭐ Adicionado!', 'success'); }
  state.currentUser.favorite_music_ids = state.favoriteMusicIds;
  localStorage.setItem('miv_user', JSON.stringify(state.currentUser));
  renderPlaylists();
  updateFavoriteButton(state.favoriteMusicIds.includes(sid));
  try { await callAPI('toggle_favorite', { user_id: state.currentUser.id, music_id: id, action: isFav ? 'remove' : 'add' }); } catch (e) {}
}

function togglePlay() { if (!state.youtubePlayer) { if (state.currentTrackIndex >= 0) { if (state.currentTrackIndex >= 1000) playExternalTrack(state.currentTrackIndex - 1000); else playTrack(state.currentTrackIndex); } return; } if (state.isPlaying) state.youtubePlayer.pauseVideo(); else state.youtubePlayer.playVideo(); }
function playNext() { playQueue.playNext(); }
function playPrevious() { playQueue.playPrevious(); }
function toggleShuffle() { state.isShuffle = !state.isShuffle; if (state.isShuffle) playQueue.shuffle(); showToast(state.isShuffle ? 'Aleatório ON' : 'Aleatório OFF', 'info'); }
function toggleRepeat() { state.isRepeat = !state.isRepeat; showToast(state.isRepeat ? 'Repetir ON' : 'Repetir OFF', 'info'); }
function toggleMute() { state.currentVolume = state.currentVolume > 0 ? 0 : (state.lastVolume || 80); setVolume(state.currentVolume); }

function setVolume(v) {
  state.currentVolume = Math.max(0, Math.min(100, parseInt(v)));
  const b = document.getElementById('volumeSliderBar'); if (b) b.style.width = state.currentVolume + '%';
  const i = document.getElementById('volumeIcon'); if (i) i.className = state.currentVolume === 0 ? 'bi bi-volume-mute' : (state.currentVolume < 50 ? 'bi bi-volume-down' : 'bi bi-volume-up');
  if (state.youtubePlayer && state.youtubePlayer.setVolume) try { state.youtubePlayer.setVolume(state.currentVolume); } catch (e) {}
}

function handleVolumeClick(e) { e.stopPropagation(); const s = document.getElementById('volumeSlider'); if (!s) return; const r = s.getBoundingClientRect(); const p = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); setVolume(Math.round(p * 100)); }

function openPlayerExpanded() { document.querySelectorAll('.section').forEach(s => s.classList.remove('active')); const p = document.getElementById('playerExpandedSection'); if (p) p.classList.add('active'); updateExpandedPlayer(); loadYouTubeAPI(); document.getElementById('sidebar').classList.remove('open'); window.scrollTo(0, 0); }
function closePlayerExpanded() { changeSection(localStorage.getItem('lastSection') || 'marketplace'); }

function updateExpandedPlayer() {
  if (state.currentTrackIndex < 0) return;
  let t, isExt = false;
  if (state.currentTrackIndex >= 1000 && state.currentTrackIndex < 2000) { const i = state.currentTrackIndex - 1000; if (i < state.externalPlaylist.length) { t = state.externalPlaylist[i]; isExt = true; } }
  else if (state.currentTrackIndex < state.playlist.length) t = state.playlist[state.currentTrackIndex];
  if (!t) return;
  const s = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  s('expandedTitle', t.titulo || 'Sem título'); s('expandedArtist', t.artista || 'Artista');
  s('expandedPrice', formatCurrency(t.valor_acao || 0)); s('expandedAvailable', (t.percentual_disponivel || 0) + '%');
  s('expandedReturn', (t.rentabilidade_media || 0) + '%'); s('expandedInvestors', t.total_investidores || 0);
  const art = document.getElementById('expandedAlbumArt');
  if (art) { art.src = getCoverUrl(t, isExt); art.onerror = function() { this.src = isExt ? PLACEHOLDERS.EXT_300 : PLACEHOLDERS.MIV_300; }; }
}

function setupMediaSession() {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.setActionHandler('play', () => { if (state.youtubePlayer) { state.youtubePlayer.playVideo(); state.isPlaying = true; updatePlayerIcons(); } });
  navigator.mediaSession.setActionHandler('pause', () => { if (state.youtubePlayer) { state.youtubePlayer.pauseVideo(); state.isPlaying = false; updatePlayerIcons(); } });
  navigator.mediaSession.setActionHandler('previoustrack', () => playPrevious());
  navigator.mediaSession.setActionHandler('nexttrack', () => playNext());
}

function setupMediaSessionTrack(t) {
  if (!('mediaSession' in navigator) || !t) return;
  try { navigator.mediaSession.metadata = new MediaMetadata({ title: t.titulo || 'PLAY MY', artist: t.artista || 'PLAY MY', album: 'PLAY MY', artwork: [{ src: getCoverUrl(t, false), sizes: '512x512', type: 'image/jpeg' }] }); } catch (e) {}
}

window.playTrack = playTrack;
window.playExternalTrack = playExternalTrack;
window.loadYouTubeAPI = loadYouTubeAPI;
window.initializeYouTubePlayer = initializeYouTubePlayer;
window.createYouTubePlayer = createYouTubePlayer;
window.updatePlayerProgress = updatePlayerProgress;
window.handleProgressClick = handleProgressClick;
window.handleExpandedProgressClick = handleExpandedProgressClick;
window.updatePlayerIcons = updatePlayerIcons;
window.updateFavoriteButton = updateFavoriteButton;
window.toggleFavorite = toggleFavorite;
window.toggleFavoriteMusic = toggleFavoriteMusic;
window.togglePlay = togglePlay;
window.playNext = playNext;
window.playPrevious = playPrevious;
window.toggleShuffle = toggleShuffle;
window.toggleRepeat = toggleRepeat;
window.toggleMute = toggleMute;
window.setVolume = setVolume;
window.handleVolumeClick = handleVolumeClick;
window.openPlayerExpanded = openPlayerExpanded;
window.closePlayerExpanded = closePlayerExpanded;
window.updateExpandedPlayer = updateExpandedPlayer;
window.setupMediaSession = setupMediaSession;
window.setupMediaSessionTrack = setupMediaSessionTrack;
