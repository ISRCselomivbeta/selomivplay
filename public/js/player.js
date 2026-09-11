// ============================================================
// PLAYER.JS - Player de música PLAY MY (YouTube)
// ============================================================

function playTrack(index) {
    const track = state.playlist[index];
    if (index < 0 || index >= state.playlist.length) { showToast('Música não encontrada', 'error'); return; }
    if (track.status === 'paused') { showToast('Música pausada pelo artista', 'warning'); return; }
    if (track.status === 'deleted') { showToast('Música indisponível', 'error'); return; }

    playQueue.items = [];
    playQueue.items.push({ type: 'internal', index, track, trackId: track.id });
    playQueue.currentIndex = 0;

    state.streamingProgress = 0;
    state.streamingLastReward = 0;
    state.streamingTrackId = null;
    state.playerReady = false;
    state.currentTrackIndex = index;

    const player = document.getElementById('playerSpotify');
    if (player) player.style.display = 'flex';

    document.getElementById('playerTitle').textContent = track.titulo || 'Título desconhecido';
    document.getElementById('playerArtist').textContent = track.artista || 'Artista desconhecido';
    const playerAlbumArt = document.getElementById('playerAlbumArt');
    if (playerAlbumArt) {
        let coverUrl = PLACEHOLDERS.MIV_56;
        if (track.link_capa && track.link_capa.trim() !== '') coverUrl = track.link_capa.trim();
        playerAlbumArt.src = coverUrl;
        playerAlbumArt.onerror = function() { this.src = PLACEHOLDERS.MIV_56; };
    }

    const isFavorite = state.favoriteMusicIds?.includes(track.id?.toString()) || false;
    updateFavoriteButton(isFavorite);

    if (track.link_youtube) {
        const videoId = extractYouTubeId(track.link_youtube);
        if (videoId) {
            if (state.youtubeAPILoaded && window.YT) initializeYouTubePlayer(videoId);
            else { loadYouTubeAPI(); setTimeout(() => initializeYouTubePlayer(videoId), 1000); }
        }
    }
    state.isPlaying = true;
    updatePlayerIcons();
    if (document.getElementById('playerExpandedSection')?.classList.contains('active')) updateExpandedPlayer();
    if (state.currentUser && track) registerMusicPlayed(track.id, track.titulo, track.artista, 30);
}

async function registerMusicPlayed(musicId, musicTitle, artist, duration) {
    if (!state.currentUser || !musicId) return;
    try {
        await callAPI('register_streaming', {
            user_id: state.currentUser.id, music_id: musicId,
            music_title: musicTitle, artist, duration: duration || 30,
            timestamp: new Date().toISOString()
        });
        if (!state.streamingHistory) state.streamingHistory = [];
        state.streamingHistory.unshift({ music_id: musicId, music_title: musicTitle, artist, played_at: new Date().toISOString() });
    } catch (error) { console.error(error); }
}

function updateExpandedPlayer() {
    if (state.currentTrackIndex < 0) return;
    let track, isExternal = false;
    if (state.currentTrackIndex >= 1000) {
        const externalIndex = state.currentTrackIndex - 1000;
        if (externalIndex >= 0 && externalIndex < state.externalPlaylist.length) {
            track = state.externalPlaylist[externalIndex];
            isExternal = true;
        }
    } else if (state.currentTrackIndex < state.playlist.length) {
        track = state.playlist[state.currentTrackIndex];
    }
    if (!track) return;
    const expandedTitle = document.getElementById('expandedTitle');
    const expandedArtist = document.getElementById('expandedArtist');
    const expandedAlbumArt = document.getElementById('expandedAlbumArt');
    const expandedPrice = document.getElementById('expandedPrice');
    const expandedAvailable = document.getElementById('expandedAvailable');
    const expandedReturn = document.getElementById('expandedReturn');
    const expandedInvestors = document.getElementById('expandedInvestors');
    const expandedGenre = document.getElementById('expandedGenre');
    if (expandedTitle) expandedTitle.textContent = track.titulo || 'Título desconhecido';
    if (expandedArtist) expandedArtist.textContent = track.artista || 'Artista desconhecido';
    if (expandedAlbumArt) {
        let coverUrl = isExternal ? PLACEHOLDERS.EXT_300 : PLACEHOLDERS.MIV_300;
        if (track.link_capa && track.link_capa.trim() !== '') coverUrl = track.link_capa.trim();
        else if (track.link_youtube) {
            const videoId = extractYouTubeId(track.link_youtube);
            if (videoId) coverUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
        }
        expandedAlbumArt.src = coverUrl;
        expandedAlbumArt.onerror = function() { this.src = isExternal ? PLACEHOLDERS.EXT_300 : PLACEHOLDERS.MIV_300; };
    }
    if (expandedPrice) expandedPrice.textContent = formatCurrency(track.valor_acao || 0);
    if (expandedAvailable) expandedAvailable.textContent = `${track.percentual_disponivel || 0}%`;
    if (expandedReturn) expandedReturn.textContent = `${track.rentabilidade_media || 0}%`;
    if (expandedInvestors) expandedInvestors.textContent = track.total_investidores || 0;
    if (expandedGenre) expandedGenre.textContent = track.genero || 'Música';
}

function loadYouTubeAPI(callback) {
    if (window.YT && YT.Player && state.youtubeAPILoaded) {
        if (callback) callback();
        return;
    }
    window.onYouTubeIframeAPIReady = function() {
        state.youtubeAPILoaded = true;
        if (state.currentTrackIndex >= 0 && state.playlist[state.currentTrackIndex]) {
            const track = state.playlist[state.currentTrackIndex];
            if (track && track.link_youtube) {
                setTimeout(() => {
                    const videoId = extractYouTubeId(track.link_youtube);
                    if (videoId) initializeYouTubePlayer(videoId);
                }, 500);
            }
        }
        if (callback) callback();
    };
    const oldScript = document.querySelector('script[src*="youtube.com/iframe_api"]');
    if (oldScript) oldScript.remove();
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.async = true;
    document.head.appendChild(tag);
}

function initializeYouTubePlayer(videoId) {
    const playerElement = document.getElementById('youtubePlayerExpanded');
    if (!playerElement) return;
    const loadingEl = document.getElementById('playerLoadingExpanded');
    if (loadingEl) loadingEl.style.display = 'flex';
    playerElement.innerHTML = '';
    const playerDiv = document.createElement('div');
    playerDiv.id = 'youtube-player-' + Date.now();
    playerElement.appendChild(playerDiv);
    if (typeof YT === 'undefined' || !YT.Player) loadYouTubeAPI(() => createYouTubePlayer(playerDiv.id, videoId));
    else createYouTubePlayer(playerDiv.id, videoId);
}

function createYouTubePlayer(elementId, videoId) {
    try {
        const element = document.getElementById(elementId);
        if (!element) return;
        element.innerHTML = '';
        const playerDiv = document.createElement('div');
        playerDiv.id = 'yt-player-' + Date.now();
        element.appendChild(playerDiv);
        if (state.youtubePlayer && typeof state.youtubePlayer.destroy === 'function') {
            try { state.youtubePlayer.destroy(); } catch (e) {}
        }
        state.youtubePlayer = new YT.Player(playerDiv.id, {
            width: '100%', height: '100%', videoId,
            playerVars: {
                autoplay: 1, controls: 1, modestbranding: 1, rel: 0,
                showinfo: 0, fs: 1, playsinline: 1,
                origin: window.location.origin, enablejsapi: 1
            },
            events: { onReady: onPlayerReady, onStateChange: onPlayerStateChange, onError: onPlayerError }
        });
    } catch (error) {
        console.error('Erro ao criar player:', error);
        showToast('Erro ao inicializar player', 'error');
    }
}

function onPlayerReady(event) {
    state.playerReady = true;
    const loadingEl = document.getElementById('playerLoadingExpanded');
    if (loadingEl) loadingEl.style.display = 'none';
    try { event.target.setVolume(state.currentVolume); } catch (e) {}
    if (state.isPlaying) try { event.target.playVideo(); } catch (e) {}
    startStreamingMonitor();
    if (state.progressInterval) clearInterval(state.progressInterval);
    state.progressInterval = setInterval(updatePlayerProgress, 1000);
    if (state.currentTrackIndex >= 0 && state.currentTrackIndex < state.playlist.length) {
        state.streamingTrackId = state.playlist[state.currentTrackIndex].id;
    }
}

function onPlayerStateChange(event) {
    const loadingEl = document.getElementById('playerLoadingExpanded');
    state.isBuffering = (event.data === YT.PlayerState.BUFFERING);
    switch(event.data) {
        case YT.PlayerState.PLAYING:
            state.isPlaying = true; state.isBuffering = false;
            if (loadingEl) loadingEl.style.display = 'none';
            if (!state.streamingTimer) startStreamingMonitor();
            break;
        case YT.PlayerState.PAUSED:
            state.isPlaying = false; state.isBuffering = false;
            break;
        case YT.PlayerState.BUFFERING:
            state.isBuffering = true;
            if (loadingEl) loadingEl.style.display = 'flex';
            break;
        case YT.PlayerState.ENDED:
            state.isPlaying = false; state.isBuffering = false;
            if (loadingEl) loadingEl.style.display = 'none';
            if (state.isRepeat) event.target.playVideo(); else playNext();
            break;
        case YT.PlayerState.CUED:
            state.playerReady = true; state.isBuffering = false;
            if (loadingEl) loadingEl.style.display = 'none';
            break;
    }
    updatePlayerIcons();
    updateExpandedPlayer();
}

function onPlayerError(event) {
    console.error('Erro YouTube:', event.data);
    state.playerReady = false;
    const loadingEl = document.getElementById('playerLoadingExpanded');
    if (loadingEl) loadingEl.style.display = 'none';
    const msgs = { 2: 'ID inválido', 5: 'Erro HTML5', 100: 'Vídeo removido', 101: 'Embed não permitido', 150: 'Embed não permitido' };
    showToast(msgs[event.data] || 'Erro ao carregar vídeo', 'error');
}

function updatePlayerProgress() {
    if (!state.youtubePlayer?.getCurrentTime) return;
    try {
        const current = state.youtubePlayer.getCurrentTime();
        const duration = state.youtubePlayer.getDuration();
        if (duration > 0) {
            const percent = (current / duration) * 100;
            const bar = document.getElementById('playerProgressBar');
            if (bar) bar.style.width = `${percent}%`;
            const cur = document.getElementById('currentTimeDisplay');
            if (cur) cur.textContent = formatTime(current);
            const tot = document.getElementById('totalTimeDisplay');
            if (tot) tot.textContent = formatTime(duration);
            const eBar = document.getElementById('expandedProgressBar');
            if (eBar) eBar.style.width = `${percent}%`;
            const eCur = document.getElementById('expandedCurrentTime');
            if (eCur) eCur.textContent = formatTime(current);
            const eTot = document.getElementById('expandedTotalTime');
            if (eTot) eTot.textContent = formatTime(duration);
        }
    } catch (e) {}
}

function handleProgressClick(e) {
    if (!state.youtubePlayer?.seekTo) return;
    e.stopPropagation();
    const rect = document.getElementById('progressContainer').getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    state.youtubePlayer.seekTo(state.youtubePlayer.getDuration() * percent, true);
}

function handleExpandedProgressClick(e) {
    if (!state.youtubePlayer?.seekTo) return;
    const rect = document.getElementById('expandedProgressContainer').getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    state.youtubePlayer.seekTo(state.youtubePlayer.getDuration() * percent, true);
}

function updatePlayerIcons() {
    const isPlaying = state.isPlaying;
    const icons = ['playPauseIcon', 'trackOverlayIcon', 'expandedPlayPauseIcon'];
    icons.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.className = isPlaying ? 'bi bi-pause-fill' : 'bi bi-play-fill';
    });
}

function updateFavoriteButton(isFavorite) {
    const btn = document.getElementById('favoriteBtn');
    const icon = document.getElementById('favoriteIcon');
    if (btn && icon) {
        icon.className = isFavorite ? 'bi bi-star-fill' : 'bi bi-star';
        btn.classList.toggle('active', isFavorite);
    }
}

function toggleFavorite() {
    if (state.currentTrackIndex < 0) return;
    const track = state.currentTrackIndex >= 1000
        ? state.externalPlaylist[state.currentTrackIndex - 1000]
        : state.playlist[state.currentTrackIndex];
    if (track) toggleFavoriteMusic(track.id, state.currentTrackIndex);
}

function togglePlay() {
    if (!state.youtubePlayer) {
        if (state.currentTrackIndex >= 0) {
            if (state.currentTrackIndex >= 1000) playExternalTrack(state.currentTrackIndex - 1000);
            else playTrack(state.currentTrackIndex);
        }
        return;
    }
    if (state.isPlaying) state.youtubePlayer.pauseVideo();
    else state.youtubePlayer.playVideo();
}

function playNext() { playQueue.playNext(); }
function playPrevious() { playQueue.playPrevious(); }

function toggleShuffle() {
    state.isShuffle = !state.isShuffle;
    if (state.isShuffle) playQueue.shuffle();
    const btn = document.getElementById('shuffleBtn');
    if (btn) btn.classList.toggle('active', state.isShuffle);
    showToast(state.isShuffle ? 'Modo aleatório ativado' : 'Modo aleatório desativado', 'info');
}

function toggleRepeat() {
    state.isRepeat = !state.isRepeat;
    const btn = document.getElementById('repeatBtn');
    if (btn) btn.classList.toggle('active', state.isRepeat);
    showToast(state.isRepeat ? 'Repetição ativada' : 'Repetição desativada', 'info');
}

function toggleMute() {
    state.currentVolume = state.currentVolume > 0 ? 0 : (state.lastVolume || 80);
    setVolume(state.currentVolume);
}

function setVolume(value) {
    state.currentVolume = Math.max(0, Math.min(100, parseInt(value)));
    const bar = document.getElementById('volumeSliderBar');
    if (bar) bar.style.width = `${state.currentVolume}%`;
    const icon = document.getElementById('volumeIcon');
    if (icon) {
        if (state.currentVolume === 0) icon.className = 'bi bi-volume-mute';
        else if (state.currentVolume < 50) icon.className = 'bi bi-volume-down';
        else icon.className = 'bi bi-volume-up';
    }
    if (state.youtubePlayer && typeof state.youtubePlayer.setVolume === 'function') {
        try { state.youtubePlayer.setVolume(state.currentVolume); } catch (e) {}
    }
}

function handleVolumeClick(event) {
    event.stopPropagation();
    const slider = document.getElementById('volumeSlider');
    if (!slider) return;
    const rect = slider.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    setVolume(Math.round(percent * 100));
}

function toggleQueue() { showToast('Fila em desenvolvimento', 'info'); }

function openPlayerExpanded() {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    const playerSection = document.getElementById('playerExpandedSection');
    if (playerSection) playerSection.classList.add('active');
    updateExpandedPlayer();
    loadYouTubeAPI();
    document.getElementById('sidebar')?.classList.remove('open');
    window.scrollTo(0, 0);
}

function closePlayerExpanded() {
    const lastSection = localStorage.getItem('lastSection') || 'marketplace';
    changeSection(lastSection);
    showToast('Player minimizado', 'info');
}

function startStreamingMonitor() {
    if (state.streamingTimer) clearInterval(state.streamingTimer);
    state.streamingTimer = setInterval(checkStreamingProgress, 1000);
}

function stopStreamingMonitor() {
    if (state.streamingTimer) { clearInterval(state.streamingTimer); state.streamingTimer = null; }
}

async function checkStreamingProgress() {
    if (!state.youtubePlayer || !state.playerReady) return;
    try {
        if (typeof state.youtubePlayer.getPlayerState !== 'function') return;
        const playerState = state.youtubePlayer.getPlayerState();
        const currentTime = state.youtubePlayer.getCurrentTime() || 0;
        const duration = state.youtubePlayer.getDuration() || 0;
        updatePlayerProgress();
        if (playerState === 1 && duration > 0 && currentTime >= 30) {
            const now = Date.now();
            if (now - state.streamingLastReward > 29000) {
                if (state.currentTrackIndex >= 0 && state.currentTrackIndex < state.playlist.length) {
                    const currentTrack = state.playlist[state.currentTrackIndex];
                    if (currentTrack && currentTrack.id !== state.streamingTrackId) {
                        state.streamingTrackId = currentTrack.id;
                        state.streamingLastReward = 0;
                    }
                    if (state.streamingLastReward === 0 || now - state.streamingLastReward > 29000) {
                        registerRealStreamingReward(currentTrack, currentTime, duration);
                        state.streamingLastReward = now;
                    }
                }
            }
        }
    } catch (error) { console.error('Erro monitor streaming:', error); }
}

async function registerRealStreamingReward(track, currentTime, duration) {
    if (!track || !track.id || !state.currentUser) return;
    if (duration < 30 || currentTime < 30) return;
    const key = `reward_${track.id}_${state.currentUser.id}`;
    if (localStorage.getItem(key)) return;
    try {
        const result = await callAPI('register_streaming', {
            music_id: track.id, user_id: state.currentUser.id,
            duration: Math.floor(currentTime), total_duration: Math.floor(duration),
            timestamp: new Date().toISOString(), verification: 'real'
        });
        if (result?.success) {
            localStorage.setItem(key, 'true');
            showToast(`⏱️ +1 SELO COIN por "${track.titulo}"`, 'success');
            setTimeout(() => { updateBalanceDisplay(true); loadLedger(true); }, 2000);
        }
    } catch (error) { console.error(error); }
}
