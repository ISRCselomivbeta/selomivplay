// ============================================================
// PLAYER.JS - Player, YouTube API, Media Session
// ============================================================

// ===== CARREGAR YOUTUBE API =====
function loadYouTubeAPI(callback) {
    if (window.YT && YT.Player && state.youtubeAPILoaded) {
        console.log('✅ API do YouTube já carregada');
        if (callback) callback();
        return;
    }
    console.log('📥 Carregando API do YouTube com HTTPS...');
    window.onYouTubeIframeAPIReady = function() {
        console.log('✅ API do YouTube carregada com sucesso');
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
    tag.onload = () => console.log('📦 Script do YouTube carregado');
    tag.onerror = (e) => {
        console.error('❌ Erro ao carregar script do YouTube:', e);
        showToast('Erro ao carregar player do YouTube', 'error');
        setTimeout(() => loadYouTubeAPI(callback), 2000);
    };
    document.head.appendChild(tag);
}

// ===== INICIALIZAR PLAYER YOUTUBE =====
function initializeYouTubePlayer(videoId) {
    const playerElement = document.getElementById('youtubePlayerExpanded');
    if (!playerElement) return;
    const loadingEl = document.getElementById('playerLoadingExpanded');
    if (loadingEl) loadingEl.style.display = 'flex';
    playerElement.innerHTML = '';
    const playerDiv = document.createElement('div');
    playerDiv.id = 'youtube-player-' + Date.now();
    playerElement.appendChild(playerDiv);
    if (typeof YT === 'undefined' || !YT.Player) {
        loadYouTubeAPI(() => createYouTubePlayer(playerDiv.id, videoId));
    } else {
        createYouTubePlayer(playerDiv.id, videoId);
    }
}

// ===== CRIAR PLAYER =====
function createYouTubePlayer(elementId, videoId) {
    try {
        const element = document.getElementById(elementId);
        if (!element) {
            console.error('❌ Elemento do player não encontrado:', elementId);
            return;
        }
        element.innerHTML = '';
        const playerDiv = document.createElement('div');
        playerDiv.id = 'yt-player-' + Date.now();
        element.appendChild(playerDiv);
        console.log('🎬 Criando player YouTube para:', videoId);
        if (state.youtubePlayer && typeof state.youtubePlayer.destroy === 'function') {
            try { state.youtubePlayer.destroy(); } catch (e) { console.warn('Erro ao destruir player antigo:', e); }
        }
        const playerOptions = {
            width: '100%',
            height: '100%',
            videoId: videoId,
            playerVars: {
                autoplay: 1,
                controls: 1,
                modestbranding: 1,
                rel: 0,
                showinfo: 0,
                fs: 1,
                playsinline: 1,
                origin: window.location.origin,
                enablejsapi: 1,
                disablekb: 0
            },
            events: {
                onReady: onPlayerReady,
                onStateChange: onPlayerStateChange,
                onError: onPlayerError
            }
        };
        state.youtubePlayer = new YT.Player(playerDiv.id, playerOptions);
    } catch (error) {
        console.error('❌ Erro ao criar player:', error);
        showToast('Erro ao inicializar player', 'error');
        const loadingEl = document.getElementById('playerLoadingExpanded');
        if (loadingEl) {
            loadingEl.innerHTML = `
                <div class="loading-spinner"></div>
                <span class="text-danger">Erro ao carregar vídeo</span>
                <button class="btn btn-sm btn-outline-success mt-3" onclick="window.location.reload()">
                    <i class="bi bi-arrow-clockwise me-2"></i>Recarregar
                </button>
            `;
        }
    }
}

// ===== EVENTOS DO PLAYER =====
function onPlayerReady(event) {
    console.log('✅ YouTube Player pronto - evento disparado');
    state.playerReady = true;
    const loadingEl = document.getElementById('playerLoadingExpanded');
    if (loadingEl) loadingEl.style.display = 'none';
    try { event.target.setVolume(state.currentVolume); } catch (e) { console.warn('Erro ao setar volume:', e); }
    if (state.isPlaying) {
        try { event.target.playVideo(); } catch (e) { console.warn('Erro ao iniciar reprodução:', e); }
    }
    startStreamingMonitor();
    if (state.progressInterval) clearInterval(state.progressInterval);
    state.progressInterval = setInterval(updatePlayerProgress, 1000);
    if (state.currentTrackIndex >= 0 && state.currentTrackIndex < state.playlist.length) {
        state.streamingTrackId = state.playlist[state.currentTrackIndex].id;
    }
    showToast('Player pronto!', 'success');
}

function onPlayerStateChange(event) {
    const loadingEl = document.getElementById('playerLoadingExpanded');
    state.isBuffering = (event.data === YT.PlayerState.BUFFERING);
    const stateNames = {
        [-1]: '🔵 Não iniciado', 0: '✅ Finalizado', 1: '▶️ Reproduzindo',
        2: '⏸️ Pausado', 3: '⏳ Buffering', 5: '🎬 Video selecionado'
    };
    console.log(`🎬 YouTube State: ${stateNames[event.data] || event.data}`);
    switch(event.data) {
        case YT.PlayerState.PLAYING:
            state.isPlaying = true;
            state.isBuffering = false;
            if (loadingEl) loadingEl.style.display = 'none';
            state.streamingProgress = 0;
            if (!state.streamingTimer) startStreamingMonitor();
            if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
            break;
        case YT.PlayerState.PAUSED:
            state.isPlaying = false;
            state.isBuffering = false;
            if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
            break;
        case YT.PlayerState.BUFFERING:
            state.isBuffering = true;
            if (loadingEl) loadingEl.style.display = 'flex';
            break;
        case YT.PlayerState.ENDED:
            state.isPlaying = false;
            state.isBuffering = false;
            state.streamingProgress = 0;
            if (loadingEl) loadingEl.style.display = 'none';
            if (state.isRepeat) { event.target.playVideo(); } else { playNext(); }
            break;
        case YT.PlayerState.CUED:
            state.playerReady = true;
            state.isBuffering = false;
            if (loadingEl) loadingEl.style.display = 'none';
            break;
    }
    updatePlayerIcons();
    updateExpandedPlayer();
}

function onPlayerError(event) {
    console.error('❌ Erro no player YouTube:', event.data);
    state.playerReady = false;
    const loadingEl = document.getElementById('playerLoadingExpanded');
    if (loadingEl) loadingEl.style.display = 'none';
    const errorMessages = {
        2: 'ID do vídeo inválido', 5: 'Erro no player HTML5',
        100: 'Vídeo não encontrado ou removido', 101: 'Embedding não permitido pelo proprietário',
        150: 'Embedding não permitido'
    };
    const errorMsg = errorMessages[event.data] || 'Erro ao carregar vídeo';
    showToast(errorMsg, 'error');
    if (loadingEl) {
        loadingEl.innerHTML = `
            <i class="bi bi-exclamation-triangle text-danger fs-1 mb-3"></i>
            <span class="text-danger">${errorMsg}</span>
            <button class="btn btn-sm btn-outline-success mt-3" onclick="window.location.reload()">
                <i class="bi bi-arrow-clockwise me-2"></i>Recarregar
            </button>
        `;
        loadingEl.style.display = 'flex';
    }
}

// ===== PLAYER EXPANDIDO =====
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

function togglePlayerExpansion() {
    const playerSection = document.getElementById('playerExpandedSection');
    if (playerSection?.classList.contains('active')) {
        closePlayerExpanded();
    } else {
        openPlayerExpanded();
    }
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
    } else if (state.currentTrackIndex >= 0 && state.currentTrackIndex < state.playlist.length) {
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
    const expandedFavoriteBtn = document.getElementById('expandedFavoriteBtn');
    const expandedFavoriteIcon = document.getElementById('expandedFavoriteIcon');
    if (expandedTitle) expandedTitle.textContent = track.titulo || 'Título desconhecido';
    if (expandedArtist) expandedArtist.textContent = track.artista || 'Artista desconhecido';
    if (expandedAlbumArt) {
        let coverUrl = isExternal ? PLACEHOLDERS.EXT_300 : PLACEHOLDERS.MIV_300;
        if (isExternal) {
            if (track.link_youtube) {
                let videoId = '';
                const url = track.link_youtube;
                if (url.includes('youtu.be/')) {
                    videoId = url.split('youtu.be/')[1].split('?')[0].split('&')[0];
                } else if (url.includes('watch?v=')) {
                    videoId = url.split('watch?v=')[1].split('&')[0];
                } else if (url.includes('embed/')) {
                    videoId = url.split('embed/')[1].split('?')[0];
                }
                if (videoId && videoId.length === 11) {
                    coverUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
                }
            }
        } else {
            if (track.link_capa && typeof track.link_capa === 'string' && track.link_capa.trim() !== '') {
                coverUrl = track.link_capa.trim();
            }
        }
        expandedAlbumArt.src = coverUrl;
        expandedAlbumArt.onerror = function() {
            this.src = isExternal ? PLACEHOLDERS.EXT_300 : PLACEHOLDERS.MIV_300;
        };
    }
    if (expandedPrice) expandedPrice.textContent = formatCurrency(track.valor_acao || 0);
    const percentAvailable = track.percentual_disponivel || 0;
    const sharesSold = track.acoes_vendidas || 0;
    const totalShares = (percentAvailable / 0.01) + sharesSold;
    const percentSold = totalShares > 0 ? ((sharesSold / totalShares) * 100).toFixed(1) : 0;
    if (expandedAvailable) expandedAvailable.textContent = `${percentSold}%`;
    if (expandedReturn) expandedReturn.textContent = `${track.rentabilidade_media || 0}%`;
    if (expandedInvestors) expandedInvestors.textContent = track.total_investidores || 0;
    if (expandedGenre) expandedGenre.textContent = track.genero || 'Música';
    const isFavorite = state.favoriteMusicIds?.includes(track.id?.toString()) || false;
    if (expandedFavoriteBtn && expandedFavoriteIcon) {
        expandedFavoriteBtn.classList.toggle('active', isFavorite);
        expandedFavoriteIcon.className = isFavorite ? 'bi bi-star-fill' : 'bi bi-star';
    }
}

// ===== CONTROLES =====
function togglePlay() {
    if (!state.youtubePlayer) {
        if (state.currentTrackIndex >= 0) {
            if (state.currentTrackIndex >= 1000) {
                playExternalTrack(state.currentTrackIndex - 1000);
            } else {
                playTrack(state.currentTrackIndex);
            }
        }
        return;
    }
    if (state.isPlaying) { state.youtubePlayer.pauseVideo(); } else { state.youtubePlayer.playVideo(); }
}

function playTrack(index) {
    if (index < 0 || index >= state.playlist.length) {
        showToast('Música não encontrada', 'error');
        return;
    }
    const track = state.playlist[index];
    if (track.status === 'paused') {
        showToast('Esta música está pausada pelo artista', 'warning');
        return;
    }
    if (track.status === 'deleted') {
        showToast('Esta música não está mais disponível', 'error');
        return;
    }
    if (track) {
        playQueue.items = [];
        playQueue.items.push({ type: 'internal', index: index, track: track, trackId: track.id });
        playQueue.currentIndex = 0;
    }
    state.streamingProgress = 0;
    state.streamingLastReward = 0;
    state.streamingTrackId = null;
    state.playerReady = false;
    state.currentTrackIndex = index;
    const player = document.getElementById('playerSpotify');
    if (player) player.style.display = 'flex';
    const playerTitle = document.getElementById('playerTitle');
    const playerArtist = document.getElementById('playerArtist');
    const playerAlbumArt = document.getElementById('playerAlbumArt');
    if (playerTitle) playerTitle.textContent = track.titulo || 'Título desconhecido';
    if (playerArtist) playerArtist.textContent = track.artista || 'Artista desconhecido';
    if (playerAlbumArt) {
        let coverUrl = PLACEHOLDERS.MIV_56;
        if (track.link_capa && typeof track.link_capa === 'string' && track.link_capa.trim() !== '') {
            coverUrl = track.link_capa.trim();
        }
        playerAlbumArt.src = coverUrl;
        playerAlbumArt.onerror = function() { this.src = PLACEHOLDERS.MIV_56; };
    }
    const isFavorite = state.favoriteMusicIds?.includes(track.id?.toString()) || false;
    updateFavoriteButton(isFavorite);
    if (track.link_youtube) {
        const videoId = extractYouTubeId(track.link_youtube);
        if (videoId) {
            if (state.youtubeAPILoaded && window.YT) {
                initializeYouTubePlayer(videoId);
            } else {
                loadYouTubeAPI();
                setTimeout(() => initializeYouTubePlayer(videoId), 1000);
            }
        }
    }
    state.isPlaying = true;
    updatePlayerIcons();
    setupMediaSession(track, false);
    if (document.getElementById('playerExpandedSection')?.classList.contains('active')) {
        updateExpandedPlayer();
    }
    if (state.currentUser && track) {
        registerMusicPlayed(track.id, track.titulo, track.artista, 30);
    }
}

function playExternalTrack(index) {
    if (index < 0 || index >= state.externalPlaylist.length) {
        showToast('Música não encontrada', 'error');
        return;
    }
    const track = state.externalPlaylist[index];
    if (track) {
        playQueue.items = [];
        playQueue.items.push({ type: 'external', index: index, track: track, trackId: track.id });
        playQueue.currentIndex = 0;
        setTimeout(() => { playQueue.findAndAddSimilar(track); }, 2000);
    }
    const externalIndex = 1000 + index;
    state.currentTrackIndex = externalIndex;
    const player = document.getElementById('playerSpotify');
    if (player) player.style.display = 'flex';
    const playerTitle = document.getElementById('playerTitle');
    const playerArtist = document.getElementById('playerArtist');
    const playerAlbumArt = document.getElementById('playerAlbumArt');
    if (playerTitle) playerTitle.textContent = track.titulo || 'Título desconhecido';
    if (playerArtist) playerArtist.textContent = track.artista || 'Artista desconhecido';
    if (playerAlbumArt) {
        let coverUrl = PLACEHOLDERS.EXT_56;
        if (track.link_youtube) {
            const videoId = extractYouTubeId(track.link_youtube);
            if (videoId) { coverUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`; }
        }
        if (track.link_capa && typeof track.link_capa === 'string' && track.link_capa.trim() !== '') {
            coverUrl = track.link_capa.trim();
        }
        playerAlbumArt.src = coverUrl;
        playerAlbumArt.onerror = function() { this.src = PLACEHOLDERS.EXT_56; };
    }
    const isFavorite = state.favoriteMusicIds?.includes(track.id?.toString()) || false;
    updateFavoriteButton(isFavorite);
    if (track.link_youtube) {
        const videoId = extractYouTubeId(track.link_youtube);
        if (videoId) {
            if (state.youtubeAPILoaded && window.YT) {
                initializeYouTubePlayer(videoId);
            } else {
                loadYouTubeAPI();
                setTimeout(() => initializeYouTubePlayer(videoId), 1000);
            }
        }
    }
    state.isPlaying = true;
    updatePlayerIcons();
    setupMediaSession(track, true);
    if (document.getElementById('playerExpandedSection')?.classList.contains('active')) {
        updateExpandedPlayer();
    }
    showToast(`🎵 Tocando: ${track.titulo} (Bolsa Externa)`, 'info');
}

function playNext() {
    playQueue.playNext();
}

function playPrevious() {
    playQueue.playPrevious();
}

function toggleShuffle() { 
    state.isShuffle = !state.isShuffle; 
    if (state.isShuffle) { playQueue.shuffle(); }
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
    const volumeBar = document.getElementById('volumeSliderBar');
    if (volumeBar) volumeBar.style.width = `${state.currentVolume}%`;
    const icon = document.getElementById('volumeIcon');
    if (icon) {
        if (state.currentVolume === 0) icon.className = 'bi bi-volume-mute';
        else if (state.currentVolume < 50) icon.className = 'bi bi-volume-down';
        else icon.className = 'bi bi-volume-up';
    }
    if (state.youtubePlayer && typeof state.youtubePlayer.setVolume === 'function') {
        try { state.youtubePlayer.setVolume(state.currentVolume); } catch (error) { console.error('Erro ao definir volume:', error); }
    }
}

function handleVolumeClick(event) {
    event.stopPropagation();
    const volumeSlider = document.getElementById('volumeSlider');
    if (!volumeSlider) return;
    const rect = volumeSlider.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    setVolume(Math.round(percent * 100));
}

function handleProgressClick(e) {
    if (!state.youtubePlayer?.seekTo) return;
    e.stopPropagation();
    const rect = document.getElementById('progressContainer').getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    state.youtubePlayer.seekTo(state.youtubePlayer.getDuration() * percent, true);
    document.getElementById('playerProgressBar').style.width = `${percent * 100}%`;
}

function handleExpandedProgressClick(e) {
    if (!state.youtubePlayer?.seekTo) return;
    const rect = document.getElementById('expandedProgressContainer').getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    state.youtubePlayer.seekTo(state.youtubePlayer.getDuration() * percent, true);
    document.getElementById('expandedProgressBar').style.width = `${percent * 100}%`;
}

function updatePlayerProgress() {
    if (!state.youtubePlayer?.getCurrentTime) return;
    try {
        const current = state.youtubePlayer.getCurrentTime();
        const duration = state.youtubePlayer.getDuration();
        if (duration > 0) {
            const percent = (current / duration) * 100;
            document.getElementById('playerProgressBar').style.width = `${percent}%`;
            document.getElementById('currentTimeDisplay').textContent = formatTime(current);
            document.getElementById('totalTimeDisplay').textContent = formatTime(duration);
            const expandedBar = document.getElementById('expandedProgressBar');
            if (expandedBar) expandedBar.style.width = `${percent}%`;
            document.getElementById('expandedCurrentTime').textContent = formatTime(current);
            document.getElementById('expandedTotalTime').textContent = formatTime(duration);
        }
    } catch (e) { console.error('Erro ao atualizar progresso:', e); }
}

function updatePlayerIcons() {
    const playPauseIcon = document.getElementById('playPauseIcon');
    const trackOverlayIcon = document.getElementById('trackOverlayIcon');
    const expandedPlayPauseIcon = document.getElementById('expandedPlayPauseIcon');
    const isPlaying = state.isPlaying;
    if (playPauseIcon) playPauseIcon.className = isPlaying ? 'bi bi-pause-fill' : 'bi bi-play-fill';
    if (trackOverlayIcon) trackOverlayIcon.className = isPlaying ? 'bi bi-pause-fill' : 'bi bi-play-fill';
    if (expandedPlayPauseIcon) expandedPlayPauseIcon.className = isPlaying ? 'bi bi-pause-fill' : 'bi bi-play-fill';
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
    let track = state.currentTrackIndex >= 1000 ? 
        state.externalPlaylist[state.currentTrackIndex - 1000] : 
        state.playlist[state.currentTrackIndex];
    if (track) toggleFavoriteMusic(track.id, state.currentTrackIndex);
}

function toggleQueue() { showToast('Fila de reprodução em desenvolvimento', 'info'); }

// ===== MEDIA SESSION =====
function setupMediaSession(track, isExternal) {
    if (!('mediaSession' in navigator) || !track) return;
    try {
        let artwork = isExternal ? PLACEHOLDERS.EXT_300 : PLACEHOLDERS.MIV_300;
        if (track.link_capa && track.link_capa.trim() !== '') {
            artwork = track.link_capa.trim();
        }
        navigator.mediaSession.metadata = new MediaMetadata({
            title: track.titulo || 'PLAY MY',
            artist: track.artista || 'SELO MIV',
            album: 'PLAY MY - Selo MIV',
            artwork: [{ src: artwork, sizes: '300x300', type: 'image/jpeg' }]
        });
        navigator.mediaSession.setActionHandler('play', () => { if (state.youtubePlayer) state.youtubePlayer.playVideo(); });
        navigator.mediaSession.setActionHandler('pause', () => { if (state.youtubePlayer) state.youtubePlayer.pauseVideo(); });
        navigator.mediaSession.setActionHandler('previoustrack', () => playPrevious());
        navigator.mediaSession.setActionHandler('nexttrack', () => playNext());
        navigator.mediaSession.playbackState = state.isPlaying ? 'playing' : 'paused';
    } catch (e) { console.log('Media Session API indisponível:', e); }
}

// ===== MONITORAMENTO DE STREAMING =====
function startStreamingMonitor() {
    if (state.streamingTimer) clearInterval(state.streamingTimer);
    console.log('🎵 Iniciando monitoramento de streaming...');
    state.streamingTimer = setInterval(checkStreamingProgress, 1000);
}

function stopStreamingMonitor() {
    if (state.streamingTimer) { clearInterval(state.streamingTimer); state.streamingTimer = null; }
    console.log('⏹️ Monitoramento de streaming parado');
}

function checkStreamingProgress() {
    if (!state.youtubePlayer || !state.playerReady) return;
    try {
        if (typeof state.youtubePlayer.getPlayerState !== 'function' ||
            typeof state.youtubePlayer.getCurrentTime !== 'function' ||
            typeof state.youtubePlayer.getDuration !== 'function') { return; }
        const playerState = state.youtubePlayer.getPlayerState();
        const currentTime = state.youtubePlayer.getCurrentTime() || 0;
        const duration = state.youtubePlayer.getDuration() || 0;
        if (duration > 0) {
            const percent = (currentTime / duration) * 100;
            if (!document.hidden) {
                const progressBar = document.getElementById('playerProgressBar');
                const expandedBar = document.getElementById('expandedProgressBar');
                const currentDisplay = document.getElementById('currentTimeDisplay');
                const expandedCurrent = document.getElementById('expandedCurrentTime');
                const totalDisplay = document.getElementById('totalTimeDisplay');
                const expandedTotal = document.getElementById('expandedTotalTime');
                if (progressBar) progressBar.style.width = percent + '%';
                if (expandedBar) expandedBar.style.width = percent + '%';
                if (currentDisplay) currentDisplay.textContent = formatTime(currentTime);
                if (expandedCurrent) expandedCurrent.textContent = formatTime(currentTime);
                if (totalDisplay) totalDisplay.textContent = formatTime(duration);
                if (expandedTotal) expandedTotal.textContent = formatTime(duration);
            }
        }
        if (playerState === 1 && duration > 0 && currentTime >= 30) {
            const now = Date.now();
            if (now - state.streamingLastReward > 29000) {
                if (state.currentTrackIndex >= 0) {
                    let currentTrack;
                    if (state.currentTrackIndex >= 1000) {
                        const externalIndex = state.currentTrackIndex - 1000;
                        if (externalIndex >= 0 && externalIndex < state.externalPlaylist.length) {
                            currentTrack = state.externalPlaylist[externalIndex];
                        }
                    } else if (state.currentTrackIndex < state.playlist.length) {
                        currentTrack = state.playlist[state.currentTrackIndex];
                    }
                    if (currentTrack && currentTrack.id !== state.streamingTrackId) {
                        state.streamingTrackId = currentTrack.id;
                        state.streamingLastReward = 0;
                    }
                    if (state.streamingLastReward === 0 || now - state.streamingLastReward > 29000) {
                        registerRealStreamingReward(currentTrack, currentTime, duration);
                        state.streamingLastReward = now;
                        if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
                            new Notification('PLAY MY', {
                                body: `🎵 +1 SELO COIN por streaming de "${currentTrack.titulo}"`,
                                icon: 'https://github.com/ISRCselomivbeta/selomivplay/raw/main/images/logo.png',
                                silent: true
                            });
                        }
                    }
                }
            }
        }
    } catch (error) { console.error('Erro no monitoramento de streaming:', error); }
}

async function registerRealStreamingReward(track, currentTime, duration) {
    if (!track || !track.id || !state.currentUser) {
        console.log('❌ Não foi possível registrar recompensa: dados incompletos');
        return;
    }
    if (duration < 30) {
        console.log('⏳ Vídeo muito curto para recompensa:', duration);
        return;
    }
    if (currentTime < 30) {
        console.log('⏳ Ainda não atingiu 30 segundos:', currentTime);
        return;
    }
    const musicRewardKey = `reward_${track.id}_${state.currentUser.id}`;
    const hasReceivedReward = localStorage.getItem(musicRewardKey);
    if (hasReceivedReward) {
        console.log('⏭️ Recompensa já foi paga para esta música:', track.titulo);
        return;
    }
    console.log(`🎵 STREAMING REAL: 30s completos em "${track.titulo}"! Registrando...`);
    showToast(`⏱️ 30 segundos de "${track.titulo}"!`, 'info');
    try {
        const result = await callAPI('register_streaming', {
            music_id: track.id,
            user_id: state.currentUser.id,
            duration: Math.floor(currentTime),
            total_duration: Math.floor(duration),
            timestamp: new Date().toISOString(),
            youtube_time: currentTime,
            player_state: state.isPlaying ? 'playing' : 'paused',
            verification: 'real'
        });
        console.log('📦 Resposta da API de streaming:', result);
        if (result?.success) {
            const rewardAmount = result.data?.reward || 1;
            localStorage.setItem(musicRewardKey, 'true');
            showStreamingReward(rewardAmount, track.titulo);
            setTimeout(() => { updateBalanceDisplay(true); loadLedger(true); loadStreamingStats(true); }, 2000);
        } else {
            console.log('⚠️ API não registrou streaming:', result?.message);
            showToast('❌ Erro ao registrar streaming', 'error');
        }
    } catch (error) {
        console.error('❌ Erro ao registrar streaming REAL:', error);
        showToast('❌ Falha na conexão', 'error');
    }
}

function showStreamingReward(amount, musicTitle) {
    const indicator = document.getElementById('streamingRewardIndicator');
    const amountEl = document.getElementById('streamingRewardAmount');
    const musicEl = document.getElementById('streamingMusicName');
    if (indicator && amountEl && musicEl) {
        amountEl.textContent = `+${amount} SELO COIN`;
        musicEl.textContent = musicTitle.length > 30 ? musicTitle.substring(0, 27) + '...' : musicTitle;
        indicator.style.display = 'block';
        setTimeout(() => { indicator.style.display = 'none'; }, 5000);
    }
}

// ===== EXPORT =====
if (typeof window !== 'undefined') {
    window.loadYouTubeAPI = loadYouTubeAPI;
    window.initializeYouTubePlayer = initializeYouTubePlayer;
    window.playTrack = playTrack;
    window.playExternalTrack = playExternalTrack;
    window.togglePlay = togglePlay;
    window.playNext = playNext;
    window.playPrevious = playPrevious;
    window.toggleShuffle = toggleShuffle;
    window.toggleRepeat = toggleRepeat;
    window.toggleMute = toggleMute;
    window.setVolume = setVolume;
    window.handleVolumeClick = handleVolumeClick;
    window.handleProgressClick = handleProgressClick;
    window.handleExpandedProgressClick = handleExpandedProgressClick;
    window.openPlayerExpanded = openPlayerExpanded;
    window.closePlayerExpanded = closePlayerExpanded;
    window.togglePlayerExpansion = togglePlayerExpansion;
    window.updatePlayerIcons = updatePlayerIcons;
    window.updateFavoriteButton = updateFavoriteButton;
    window.toggleFavorite = toggleFavorite;
    window.setupMediaSession = setupMediaSession;
    window.checkStreamingProgress = checkStreamingProgress;
    window.startStreamingMonitor = startStreamingMonitor;
    window.stopStreamingMonitor = stopStreamingMonitor;
}
