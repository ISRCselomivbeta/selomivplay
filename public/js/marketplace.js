// ============================================================
// MARKETPLACE.JS - Marketplace e Bolsa Externa PLAY MY
// ============================================================

async function loadMarketplace(forceRefresh = false) {
    if (!state.playlist || state.playlist.length === 0) {
        state.playlist = (await getFallbackData('get_musicas')).data || [];
        renderMarketplace();
    }
    try {
        const result = await callAPI('get_musicas');
        if (result?.success && result?.data && result.data.length > 0) {
            state.playlist = result.data;
            state.playlist = ELO.applyRatingDecay(state.playlist);
            state.playlist = ELO.updateCompleteRanking(state.playlist);
        }
    } catch (error) { console.log('Usando dados de exemplo'); }
    renderMarketplace();
}

async function loadExternalMarketplace(forceRefresh = false) {
    if (!forceRefresh) {
        const cached = localStorage.getItem('miv_external_playlist');
        const cachedTime = localStorage.getItem('miv_external_timestamp');
        if (cached && cachedTime) {
            const age = Date.now() - parseInt(cachedTime);
            if (age < 600000) {
                try {
                    state.externalPlaylist = JSON.parse(cached);
                    renderExternalMarketplace();
                    return;
                } catch (e) {}
            }
        }
    }
    const result = await callAPI('get_external_musicas');
    if (result?.success && result?.data) {
        state.externalPlaylist = result.data;
        localStorage.setItem('miv_external_playlist', JSON.stringify(result.data));
        localStorage.setItem('miv_external_timestamp', Date.now().toString());
    }
    renderExternalMarketplace();
}

async function loadTopInvestments(forceRefresh = false) {
    const result = await callAPI('get_top_investments');
    if (result?.success && result?.data) {
        state.topInvestments = result.data;
        state.topInvestments = ELO.updateCompleteRanking(state.topInvestments);
    }
    renderTopInvestments();
}

async function loadArtistData(forceRefresh = false) {
    if (!state.currentUser || state.currentUser.tipo !== 'artista') return;
    const result = await callAPI('get_artist_data', { user_id: state.currentUser.id });
    if (result?.success && result?.data) {
        document.getElementById('artistMusicCount').textContent = result.data.total_musicas || 0;
        document.getElementById('artistRoyalties').textContent = formatCurrency(result.data.total_royalties || 0);
        document.getElementById('artistSharesSold').textContent = result.data.total_shares_sold || 0;
        document.getElementById('artistMonthlyEarnings').textContent = formatCurrency(result.data.monthly_earnings || 0);
        renderArtistMusic(result.data.musics || []);
    }
}

function renderMarketplace() {
    const container = document.getElementById('marketplaceContent');
    const artistsGrid = document.getElementById('artistsPlaylistsGrid');
    const externalGrid = document.getElementById('externalMarketplaceGrid');
    const recommendedCard = document.getElementById('recommendedCard');

    if (!container) return;

    if (!state.playlist || state.playlist.length === 0) {
        container.innerHTML = `<div class="empty-state-spotify" style="grid-column: 1/-1;"><i class="bi bi-music-note-beamed" style="font-size: 2.5rem; color: #1DB954;"></i><h5 style="color: white; margin-top: 0.5rem; font-size: 16px;">Nenhuma música disponível</h5></div>`;
    } else {
        const mixes = state.playlist.slice(0, 7);
        container.innerHTML = mixes.map((track, index) => {
            const videoId = extractYouTubeId(track.link_youtube);
            const stats = track.youtube_stats || {};
            const revenue = calculateEstimatedRevenue(stats.views || 100000);
            return `
            <div class="spotify-card" data-track-id="${track.id}" data-video-id="${videoId || ''}">
                <div class="spotify-cover">
                    <img src="${track.link_capa || PLACEHOLDERS.MIV_300}" alt="${track.titulo}" loading="lazy" onerror="this.src='${PLACEHOLDERS.MIV_300}'">
                    <div class="play-overlay" onclick="event.stopPropagation(); playTrack(${index})"><i class="bi bi-play-fill"></i></div>
                </div>
                <h3 class="spotify-title">${track.titulo || 'Sem título'}</h3>
                <p class="spotify-artist">${track.artista || 'Artista'}</p>
                <div class="youtube-stats mt-2">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <span class="youtube-views text-muted"><i class="bi bi-eye-fill me-1"></i> ${stats.views ? formatNumber(stats.views) : 'Carregando...'}</span>
                        <span class="estimated-earnings text-success"><i class="bi bi-cash-stack me-1"></i> ${revenue.formatted}</span>
                    </div>
                </div>
                <div class="spotify-stats mt-2">
                    <span class="spotify-elo">${track.percentual_disponivel || 0}% disponível</span>
                    <span class="spotify-price">${formatCurrency(track.valor_acao || 0)}</span>
                </div>
                <button class="btn-invest" onclick="event.stopPropagation(); openInvestModal(${index})">
                    <i class="bi bi-currency-dollar me-1"></i> INVESTIR
                </button>
            </div>`;
        }).join('');
        mixes.forEach((track, index) => {
            const card = container.children[index];
            if (card && track.link_youtube) updateCardWithRealData(track, card);
        });
    }

    if (artistsGrid && state.playlist && state.playlist.length > 3) {
        const artistItems = state.playlist.slice(3, 7);
        artistsGrid.innerHTML = artistItems.map((track, idx) => {
            const originalIndex = idx + 3;
            let coverImage = track.link_capa?.trim() || PLACEHOLDERS.MIV_300;
            const categories = ['Álbum', 'Playlist', 'Podcast', 'Rádio'];
            return `
            <div class="spotify-card" onclick="playTrack(${originalIndex})">
                <div class="spotify-cover">
                    <img src="${coverImage}" alt="${track.titulo}" loading="lazy" onerror="this.src='${PLACEHOLDERS.MIV_300}'">
                    <div class="play-overlay" onclick="event.stopPropagation(); playTrack(${originalIndex})"><i class="bi bi-play-fill"></i></div>
                </div>
                <h3 class="spotify-title">${track.titulo || 'Sem título'}</h3>
                <p class="spotify-artist">${categories[idx % categories.length]} • ${track.artista?.substring(0, 15) || 'Artista'}</p>
            </div>`;
        }).join('');
    }

    if (externalGrid) {
        if (!state.externalPlaylist || state.externalPlaylist.length === 0) {
            externalGrid.innerHTML = `<div class="suggest-card" onclick="openAddExternalMusicModal()"><i class="bi bi-plus-circle"></i><h3>Sugerir Música</h3><p>Seja o primeiro a sugerir</p></div>`;
        } else {
            const externas = state.externalPlaylist.slice(0, 4);
            externalGrid.innerHTML = externas.map((track, index) => {
                const videoId = extractYouTubeId(track.link_youtube);
                const stats = track.youtube_stats || {};
                const revenue = calculateEstimatedRevenue(stats.views || 50000);
                let coverImage = PLACEHOLDERS.EXT_300;
                if (track.link_capa?.trim()) coverImage = track.link_capa.trim();
                else if (videoId) coverImage = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
                const vendasAtuais = track.vendas_atuais || 0;
                const metaVendas = track.meta_vendas || 1000000;
                const progressPercent = Math.min(100, (vendasAtuais / metaVendas * 100)).toFixed(1);
                return `
                <div class="spotify-card external-card">
                    <div class="external-badge"><i class="bi bi-globe"></i> BOLSA EXTERNA</div>
                    <div class="spotify-cover">
                        <img src="${coverImage}" alt="${track.titulo}" loading="lazy" onerror="this.src='${PLACEHOLDERS.EXT_300}'">
                        <div class="play-overlay" onclick="event.stopPropagation(); playExternalTrack(${index})"><i class="bi bi-play-fill"></i></div>
                    </div>
                    <h3 class="spotify-title">${track.titulo || 'Sem título'}</h3>
                    <p class="spotify-artist">${track.artista || 'Artista'}</p>
                    <div class="spotify-stats mt-2">
                        <span class="spotify-elo" style="background: rgba(255,107,107,0.2); color: #ff6b6b;">🚀 Pré-lançamento</span>
                        <span class="spotify-price">${formatCurrency(track.valor_acao || 0)}</span>
                    </div>
                    <button class="btn-invest" onclick="event.stopPropagation(); openInvestExternalModal(${index})" style="border-color: #ff6b6b; color: #ff6b6b;">
                        <i class="bi bi-coin me-1"></i> INVESTIR ANTECIPADO
                    </button>
                </div>`;
            }).join('');
            externas.forEach((track, index) => {
                const card = externalGrid.children[index];
                if (card && track.link_youtube) updateExternalCardWithRealData(track, card);
            });
        }
    }

    if (recommendedCard && state.playlist && state.playlist.length > 0) {
        const primeira = state.playlist[0];
        let coverImage = primeira.link_capa?.trim() || PLACEHOLDERS.MIV_300;
        recommendedCard.innerHTML = `
            <img src="${coverImage}" alt="${primeira.titulo}" class="recommended-cover" onerror="this.src='${PLACEHOLDERS.MIV_300}'">
            <div class="recommended-info">
                <h4>${primeira.titulo} • ${primeira.artista}</h4>
                <p>Conexão com fio • ${formatCurrency(primeira.valor_acao || 0)} por ação</p>
            </div>
            <button class="btn-play" onclick="playTrack(0)"><i class="bi bi-play-fill"></i></button>
        `;
    }
}

function filterMarketplace(type) {
    let filtered = [...state.playlist];
    switch(type) {
        case 'trending': filtered.sort((a, b) => (b.elo_rating || 1400) - (a.elo_rating || 1400)); break;
        case 'new': filtered.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)); break;
        case 'invest': filtered.sort((a, b) => ((b.acoes_vendidas || 0) + (b.rentabilidade_media || 0)) - ((a.acoes_vendidas || 0) + (a.rentabilidade_media || 0))); break;
    }
    renderFilteredMarketplace(filtered);
}

function renderFilteredMarketplace(filteredTracks) {
    const container = document.getElementById('marketplaceContent');
    if (!container) return;
    if (!filteredTracks || filteredTracks.length === 0) {
        container.innerHTML = `<div class="empty-state-spotify"><i class="bi bi-filter" style="font-size: 4rem; color: #1DB954;"></i><h3 style="color: white;">Nenhum resultado</h3></div>`;
        return;
    }
    container.innerHTML = filteredTracks.map((track, index) => {
        const originalIndex = state.playlist.findIndex(m => m.id === track.id);
        const playIndex = originalIndex >= 0 ? originalIndex : index;
        const eloRating = track.elo_rating || 1400;
        const eloLevel = eloRating >= 2000 ? '🔥 Top' : eloRating >= 1700 ? '📈 Trending' : '🎵 Nova';
        let coverImage = track.link_capa?.trim() || PLACEHOLDERS.MIV_300;
        return `
        <div class="spotify-card" onclick="playTrack(${playIndex})">
            <div class="spotify-cover">
                <img src="${coverImage}" alt="${track.titulo}" loading="lazy" onerror="this.src='${PLACEHOLDERS.MIV_300}'">
                <div class="play-overlay" onclick="event.stopPropagation(); playTrack(${playIndex})"><i class="bi bi-play-fill"></i></div>
            </div>
            <div class="spotify-title">${track.titulo || 'Sem título'}</div>
            <div class="spotify-artist">${track.artista || 'Artista'}</div>
            <div class="spotify-stats">
                <span class="spotify-elo">${eloLevel}</span>
                <span class="spotify-price">${formatCurrency(track.valor_acao || 0)}</span>
            </div>
            <button class="btn-invest" onclick="event.stopPropagation(); openInvestModal(${playIndex})"><i class="bi bi-currency-dollar me-1"></i> INVESTIR</button>
        </div>`;
    }).join('');
}

function renderExternalMarketplace() {
    const container = document.getElementById('externalContent');
    if (!container) return;
    if (!state.externalPlaylist || state.externalPlaylist.length === 0) {
        container.innerHTML = `<div class="empty-state-spotify" style="grid-column: 1/-1; text-align: center; padding: 40px 20px;"><i class="bi bi-globe" style="font-size: 4rem; color: #ff6b6b;"></i><h3 style="color: white;">Nenhuma música externa</h3><button class="btn-invest" style="background: #ff6b6b; color: white;" onclick="openAddExternalMusicModal()"><i class="bi bi-plus-circle me-1"></i> SUGERIR MÚSICA</button></div>`;
        return;
    }
    container.innerHTML = state.externalPlaylist.map((track, index) => {
        const vendasAtuais = track.vendas_atuais || 0;
        const metaVendas = track.meta_vendas || 1000000;
        const progressPercent = Math.min(100, (vendasAtuais / metaVendas * 100)).toFixed(1);
        let coverImage = PLACEHOLDERS.EXT_300;
        if (track.link_capa && track.link_capa.trim() !== '') coverImage = track.link_capa.trim();
        else if (track.link_youtube) {
            const videoId = extractYouTubeId(track.link_youtube);
            if (videoId) coverImage = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        }
        return `
        <div class="spotify-card external-card" onclick="playExternalTrack(${index})">
            <div class="external-badge"><i class="bi bi-globe"></i> BOLSA EXTERNA</div>
            <div class="spotify-cover">
                <img src="${coverImage}" alt="${track.titulo}" onerror="this.src='${PLACEHOLDERS.EXT_300}'">
                <div class="play-overlay" onclick="event.stopPropagation(); playExternalTrack(${index})"><i class="bi bi-play-fill"></i></div>
            </div>
            <h3 class="spotify-title">${track.titulo || 'Sem título'}</h3>
            <p class="spotify-artist">${track.artista || 'Artista'}</p>
            <div class="spotify-stats">
                <span class="spotify-elo" style="background: rgba(255,107,107,0.2); color: #ff6b6b;">🚀 Pré-lançamento</span>
                <span class="spotify-price">${formatCurrency(track.valor_acao || 0)}</span>
            </div>
            <div style="margin: 8px 0;">
                <div style="height: 3px; background: #282828; border-radius: 2px; overflow: hidden;">
                    <div style="width: ${progressPercent}%; height: 100%; background: linear-gradient(90deg, #ff6b6b, #ff8e8e);"></div>
                </div>
            </div>
            <button class="btn-invest" onclick="event.stopPropagation(); openInvestExternalModal(${index})" style="border-color: rgba(255,107,107,0.5); color: #ff6b6b;">
                <i class="bi bi-coin me-1"></i> INVESTIR ANTECIPADO
            </button>
        </div>`;
    }).join('');
}

function renderTopInvestments() {
    const container = document.getElementById('investmentsContent');
    if (!container) return;
    if (!state.topInvestments?.length) {
        container.innerHTML = `<div class="empty-state-actionable" style="grid-column: 1/-1;"><i class="bi bi-graph-up-arrow empty-icon"></i><h5 class="text-muted">Nenhuma recomendação</h5></div>`;
        return;
    }
    container.innerHTML = state.topInvestments.map(i => {
        const coverImage = i.link_capa?.trim() ? i.link_capa : PLACEHOLDERS.MIV_300;
        const eloRating = i.elo_rating || 1400;
        const eloLevel = eloRating >= 2000 ? '🔥 Top' : eloRating >= 1700 ? '📈 Trending' : '🎵 Nova';
        const musicIndex = state.playlist.findIndex(m => m.id === i.id);
        return `
        <div class="spotify-card top-investment-card" onclick="playTrack(${musicIndex})">
            <div class="spotify-cover">
                <img src="${coverImage}" alt="${i.titulo}" onerror="this.src='${PLACEHOLDERS.MIV_300}'">
                <div class="play-overlay" onclick="event.stopPropagation(); playTrack(${musicIndex})"><i class="bi bi-play-fill"></i></div>
            </div>
            <h3 class="spotify-title">${i.titulo || 'Sem título'}</h3>
            <p class="spotify-artist">${i.artista || 'Artista'}</p>
            <div class="spotify-stats">
                <span class="spotify-elo">${eloLevel}</span>
                <span class="spotify-price">${formatCurrency(i.valor_acao || 0)}</span>
            </div>
            <div style="margin-top: 8px;">
                <span class="badge badge-success">Score: ${i.investment_score || 0}</span>
                <span class="badge badge-info">+${i.rentabilidade_media || 0}%</span>
            </div>
            <button class="btn-invest" onclick="event.stopPropagation(); openInvestModal(${musicIndex})"><i class="bi bi-currency-dollar me-1"></i> INVESTIR</button>
        </div>`;
    }).join('');
}

function renderArtistMusic(musics) {
    const container = document.getElementById('artistMusicContent');
    if (!container) return;
    if (!musics?.length) {
        container.innerHTML = `<div class="empty-state-actionable" style="grid-column: 1/-1;"><i class="bi bi-music-note-beamed empty-icon"></i><h5 class="text-muted">Nenhuma música cadastrada</h5><button class="btn-miv mt-3" onclick="openAddMusicModal()"><i class="bi bi-plus-circle me-2"></i> Cadastrar Música</button></div>`;
        return;
    }
    container.innerHTML = musics.map(m => {
        const percentSold = m.percentual_disponivel ? ((m.acoes_vendidas || 0) / (m.percentual_disponivel / 0.01) * 100).toFixed(1) : 0;
        let coverImage = m.link_capa?.trim() || PLACEHOLDERS.MIV_300;
        if (m.link_youtube) {
            const videoId = extractYouTubeId(m.link_youtube);
            if (videoId) coverImage = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        }
        return `
        <div class="spotify-card">
            <div class="spotify-cover">
                <img src="${coverImage}" alt="${m.titulo}" onerror="this.src='${PLACEHOLDERS.MIV_300}'">
                <div class="play-overlay" onclick="playTrack(${state.playlist.findIndex(p => p.id === m.id)})"><i class="bi bi-play-fill"></i></div>
            </div>
            <h3 class="spotify-title">${m.titulo || 'Sem título'}</h3>
            <p class="spotify-artist">${m.artista || 'Artista'}</p>
            <div class="spotify-stats">
                <span class="spotify-elo">${percentSold}% vendido</span>
                <span class="spotify-price">${formatCurrency(m.valor_acao || 0)}</span>
            </div>
            <div class="music-actions" style="margin-top: 12px;">
                <button class="music-action-btn edit" onclick="event.stopPropagation(); openEditMusicModal('${m.id}')"><i class="bi bi-pencil"></i> Editar</button>
                <button class="music-action-btn delete" onclick="event.stopPropagation(); requestDeleteMusic('${m.id}')"><i class="bi bi-trash"></i> Excluir</button>
            </div>
        </div>`;
    }).join('');
}

function playExternalTrack(index) {
    if (index < 0 || index >= state.externalPlaylist.length) { showToast('Música não encontrada', 'error'); return; }
    const track = state.externalPlaylist[index];
    if (track) {
        playQueue.items = [];
        playQueue.items.push({ type: 'external', index, track, trackId: track.id });
        playQueue.currentIndex = 0;
    }
    state.currentTrackIndex = 1000 + index;
    const player = document.getElementById('playerSpotify');
    if (player) player.style.display = 'flex';
    document.getElementById('playerTitle').textContent = track.titulo || 'Título desconhecido';
    document.getElementById('playerArtist').textContent = track.artista || 'Artista desconhecido';
    const playerAlbumArt = document.getElementById('playerAlbumArt');
    if (playerAlbumArt) {
        let coverUrl = PLACEHOLDERS.EXT_56;
        if (track.link_youtube) {
            const videoId = extractYouTubeId(track.link_youtube);
            if (videoId) coverUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        }
        if (track.link_capa && track.link_capa.trim() !== '') coverUrl = track.link_capa.trim();
        playerAlbumArt.src = coverUrl;
        playerAlbumArt.onerror = function() { this.src = PLACEHOLDERS.EXT_56; };
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
    showToast(`🎵 Tocando: ${track.titulo} (Bolsa Externa)`, 'info');
}

// Aliases usados pelo player
function openEditMusicModal(musicId) {
    const music = state.playlist.find(m => m.id === musicId) || state.externalPlaylist.find(m => m.id === musicId);
    if (!music) { showToast('Música não encontrada', 'error'); return; }
    document.getElementById('editMusicId').value = music.id;
    document.getElementById('editMusicTitleField').value = music.titulo || '';
    document.getElementById('editMusicGenreField').value = music.genero || 'POP';
    document.getElementById('editMusicYoutubeField').value = music.link_youtube || '';
    document.getElementById('editMusicCoverField').value = music.link_capa || '';
    document.getElementById('editMusicPriceField').value = music.valor_acao || 10;
    document.getElementById('editMusicPercentField').value = music.percentual_disponivel || 20;
    document.getElementById('editMusicStatusField').value = music.status || 'active';
    showModal('editMusicModal');
}

async function updateMusic() { showToast('Função em desenvolvimento', 'info'); }
async function pauseMusic(id) { showToast('Música pausada', 'success'); }
async function unpauseMusic(id) { showToast('Música reativada', 'success'); }
async function requestDeleteMusic(id) { if (confirm('Solicitar exclusão?')) showToast('Solicitação enviada', 'success'); }
