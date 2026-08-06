// ============================================================
// MARKETPLACE.JS - Renderização do Marketplace
// ============================================================

// ===== CARREGAR MARKETPLACE =====
async function loadMarketplace(forceRefresh = false) {
    if (!state.playlist || state.playlist.length === 0 || forceRefresh) {
        try {
            const result = await callAPI('get_musicas');
            if (result?.success && result?.data && result.data.length > 0) {
                state.playlist = result.data;
                state.playlist = ELO.applyRatingDecay(state.playlist);
                state.playlist = ELO.updateCompleteRanking(state.playlist);
            }
        } catch (error) {
            console.log('Usando dados de exemplo (API indisponível)');
            // Dados de exemplo
            state.playlist = [
                {
                    id: '1',
                    titulo: 'RIO DE JANEIRO',
                    artista: 'Elzo Henschell',
                    link_capa: 'https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=400',
                    link_youtube: 'https://www.youtube.com/watch?v=fJ9rUzIMcZQ',
                    valor_acao: 25.50,
                    percentual_disponivel: 38,
                    acoes_vendidas: 150,
                    total_investidores: 45,
                    rentabilidade_media: 12.5,
                    status: 'ativo',
                    genero: 'URBAN',
                    elo_rating: 1850
                },
                {
                    id: '2',
                    titulo: 'Blinding Lights',
                    artista: 'The Weeknd',
                    link_capa: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400',
                    link_youtube: 'https://www.youtube.com/watch?v=4NRXx6U8ABQ',
                    valor_acao: 32.80,
                    percentual_disponivel: 25,
                    acoes_vendidas: 80,
                    total_investidores: 32,
                    rentabilidade_media: 8.3,
                    status: 'ativo',
                    genero: 'POP',
                    elo_rating: 1720
                },
                {
                    id: '3',
                    titulo: 'Bohemian Rhapsody',
                    artista: 'Queen',
                    link_capa: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400',
                    link_youtube: 'https://www.youtube.com/watch?v=fJ9rUzIMcZQ',
                    valor_acao: 45.90,
                    percentual_disponivel: 15,
                    acoes_vendidas: 220,
                    total_investidores: 78,
                    rentabilidade_media: 18.2,
                    status: 'ativo',
                    genero: 'ROCK',
                    elo_rating: 2100
                }
            ];
        }
    }
    
    renderMarketplace();
}

// ===== RENDERIZAR MARKETPLACE =====
function renderMarketplace() {
    const container = document.getElementById('marketplaceContent');
    const artistsGrid = document.getElementById('artistsPlaylistsGrid');
    const externalGrid = document.getElementById('externalMarketplaceGrid');
    const recommendedCard = document.getElementById('recommendedCard');
    
    if (!container) return;
    
    // Renderizar músicas
    if (!state.playlist || state.playlist.length === 0) {
        container.innerHTML = `
            <div class="empty-state-spotify" style="grid-column: 1/-1;">
                <i class="bi bi-music-note-beamed" style="font-size: 2.5rem; color: #1DB954;"></i>
                <h5 style="color: white; margin-top: 0.5rem; font-size: 16px;">Nenhuma música disponível</h5>
            </div>
        `;
    } else {
        const mixes = state.playlist.slice(0, 7);
        container.innerHTML = mixes.map((track, index) => {
            const videoId = extractYouTubeId(track.link_youtube);
            const stats = track.youtube_stats || {};
            const revenue = calculateEstimatedRevenue(stats.views || 100000);
            
            let coverImage = track.link_capa?.trim() || CONFIG.PLACEHOLDERS.MIV_300;
            
            return `
            <div class="spotify-card" data-track-id="${track.id}" data-video-id="${videoId || ''}">
                <div class="spotify-cover">
                    <img src="${coverImage}" alt="${track.titulo}" loading="lazy"
                         onerror="this.src='${CONFIG.PLACEHOLDERS.MIV_300}'">
                    <div class="play-overlay" onclick="event.stopPropagation(); playTrack(${index})">
                        <i class="bi bi-play-fill"></i>
                    </div>
                </div>
                
                <h3 class="spotify-title">${track.titulo || 'Sem título'}</h3>
                <p class="spotify-artist">${track.artista || 'Artista'}</p>
                
                <div class="youtube-stats mt-2">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <span class="youtube-views text-muted">
                            <i class="bi bi-eye-fill me-1"></i>
                            ${stats.views ? formatNumber(stats.views) : 'Carregando...'}
                        </span>
                        <span class="estimated-earnings text-success">
                            <i class="bi bi-cash-stack me-1"></i>
                            ${revenue.formatted}
                        </span>
                    </div>
                    <div class="progress" style="height: 3px;">
                        <div class="progress-bar bg-success" 
                             style="width: ${Math.min(100, ((track.acoes_vendidas || 0) / ((track.percentual_disponivel || 1) * 100)) * 100)}%">
                        </div>
                    </div>
                </div>
                
                <div class="spotify-stats mt-2">
                    <span class="spotify-elo">${track.percentual_disponivel || 0}% disponível</span>
                    <span class="spotify-price">${formatCurrency(track.valor_acao || 0)}</span>
                </div>
                
                <button class="btn-invest" onclick="event.stopPropagation(); openInvestModal(${index})">
                    <i class="bi bi-currency-dollar me-1"></i> INVESTIR
                </button>
            </div>
            `;
        }).join('');
        
        // Buscar dados reais para cada card
        mixes.forEach((track, index) => {
            const card = container.children[index];
            if (card && track.link_youtube) {
                updateCardWithRealData(track, card);
            }
        });
    }
    
    // Artistas e Playlists
    if (artistsGrid && state.playlist && state.playlist.length > 3) {
        const artistItems = state.playlist.slice(3, 7);
        artistsGrid.innerHTML = artistItems.map((track, idx) => {
            const originalIndex = idx + 3;
            const categories = ['Álbum', 'Playlist', 'Podcast', 'Rádio'];
            let coverImage = track.link_capa?.trim() || CONFIG.PLACEHOLDERS.MIV_300;
            
            return `
            <div class="spotify-card" onclick="playTrack(${originalIndex})">
                <div class="spotify-cover">
                    <img src="${coverImage}" alt="${track.titulo}" loading="lazy"
                         onerror="this.src='${CONFIG.PLACEHOLDERS.MIV_300}'">
                    <div class="play-overlay" onclick="event.stopPropagation(); playTrack(${originalIndex})">
                        <i class="bi bi-play-fill"></i>
                    </div>
                </div>
                <h3 class="spotify-title">${track.titulo || 'Sem título'}</h3>
                <p class="spotify-artist">${categories[idx % categories.length]} • ${track.artista?.substring(0, 15) || 'Artista'}</p>
            </div>
            `;
        }).join('');
    }
    
    // Bolsa Externa
    if (externalGrid) {
        if (!state.externalPlaylist || state.externalPlaylist.length === 0) {
            externalGrid.innerHTML = `
                <div class="suggest-card" onclick="openAddExternalMusicModal()">
                    <i class="bi bi-plus-circle"></i>
                    <h3>Sugerir Música</h3>
                    <p>Seja o primeiro a sugerir</p>
                </div>
            `;
        } else {
            const externas = state.externalPlaylist.slice(0, 4);
            externalGrid.innerHTML = externas.map((track, index) => {
                const videoId = extractYouTubeId(track.link_youtube);
                const stats = track.youtube_stats || {};
                const revenue = calculateEstimatedRevenue(stats.views || 50000);
                
                let coverImage = CONFIG.PLACEHOLDERS.EXT_300;
                
                if (track.link_capa?.trim()) {
                    coverImage = track.link_capa.trim();
                } else if (track.link_youtube) {
                    const videoId = extractYouTubeId(track.link_youtube);
                    if (videoId) coverImage = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
                }
                
                const vendasAtuais = track.vendas_atuais || 0;
                const metaVendas = track.meta_vendas || 1000000;
                const progressPercent = Math.min(100, (vendasAtuais / metaVendas * 100)).toFixed(1);
                
                return `
                <div class="spotify-card external-card" data-track-id="${track.id}" data-video-id="${videoId || ''}">
                    <div class="external-badge">
                        <i class="bi bi-globe"></i> BOLSA EXTERNA
                    </div>
                    
                    <div class="spotify-cover">
                        <img src="${coverImage}" alt="${track.titulo}" loading="lazy"
                             onerror="this.src='${CONFIG.PLACEHOLDERS.EXT_300}'">
                        <div class="play-overlay" onclick="event.stopPropagation(); playExternalTrack(${index})">
                            <i class="bi bi-play-fill"></i>
                        </div>
                    </div>
                    
                    <h3 class="spotify-title">${track.titulo || 'Sem título'}</h3>
                    <p class="spotify-artist">${track.artista || 'Artista'}</p>
                    
                    <div class="youtube-stats mt-2">
                        <div class="d-flex justify-content-between align-items-center mb-1">
                            <span class="youtube-views text-muted">
                                <i class="bi bi-eye-fill me-1"></i>
                                ${stats.views ? formatNumber(stats.views) : 'Carregando...'}
                            </span>
                            <span class="estimated-earnings text-warning">
                                <i class="bi bi-cash-stack me-1"></i>
                                ${revenue.formatted}
                            </span>
                        </div>
                        <div class="progress" style="height: 3px;">
                            <div class="progress-bar bg-warning" 
                                 style="width: ${Math.min(100, (vendasAtuais / metaVendas) * 100)}%">
                            </div>
                        </div>
                    </div>
                    
                    <div class="spotify-stats mt-2">
                        <span class="spotify-elo" style="background: rgba(255,107,107,0.2); color: #ff6b6b;">
                            🚀 Pré-lançamento
                        </span>
                        <span class="spotify-price">${formatCurrency(track.valor_acao || 0)}</span>
                    </div>
                    
                    <div class="d-flex justify-content-between small text-muted mt-1">
                        <span>Progresso: ${progressPercent}%</span>
                        <span>Meta: ${formatCurrency(metaVendas)}</span>
                    </div>
                    
                    <button class="btn-invest" onclick="event.stopPropagation(); openInvestExternalModal(${index})" 
                            style="border-color: #ff6b6b; color: #ff6b6b;">
                        <i class="bi bi-coin me-1"></i> INVESTIR ANTECIPADO
                    </button>
                </div>
                `;
            }).join('');
            
            externas.forEach((track, index) => {
                const card = externalGrid.children[index];
                if (card && track.link_youtube) {
                    updateCardWithRealData(track, card);
                }
            });
        }
    }
    
    // Recomendado
    if (recommendedCard && state.playlist && state.playlist.length > 0) {
        const primeira = state.playlist[0];
        let coverImage = primeira.link_capa?.trim() || CONFIG.PLACEHOLDERS.MIV_300;
        
        recommendedCard.innerHTML = `
            <img src="${coverImage}" alt="${primeira.titulo}" class="recommended-cover"
                 onerror="this.src='${CONFIG.PLACEHOLDERS.MIV_300}'">
            <div class="recommended-info">
                <h4>${primeira.titulo} • ${primeira.artista}</h4>
                <p>Conexão com fio • ${formatCurrency(primeira.valor_acao || 0)} por ação</p>
            </div>
            <button class="btn-play" onclick="playTrack(0)">
                <i class="bi bi-play-fill"></i>
            </button>
        `;
    }
}

// ===== FILTER MARKETPLACE =====
function filterMarketplace(type) {
    let filtered = [...state.playlist];
    
    switch(type) {
        case 'trending':
            filtered = filtered.sort((a, b) => (b.elo_rating || 1400) - (a.elo_rating || 1400));
            break;
        case 'new':
            filtered = filtered.sort((a, b) => {
                const dateA = a.created_at ? new Date(a.created_at) : new Date(0);
                const dateB = b.created_at ? new Date(b.created_at) : new Date(0);
                return dateB - dateA;
            });
            break;
        case 'invest':
            filtered = filtered.sort((a, b) => {
                const scoreA = (a.acoes_vendidas || 0) * 0.3 + 
                              (a.total_investidores || 0) * 0.3 + 
                              (a.rentabilidade_media || 0) * 0.4;
                const scoreB = (b.acoes_vendidas || 0) * 0.3 + 
                              (b.total_investidores || 0) * 0.3 + 
                              (b.rentabilidade_media || 0) * 0.4;
                return scoreB - scoreA;
            });
            break;
        default:
            filtered = [...state.playlist];
    }
    
    renderFilteredMarketplace(filtered);
}

function renderFilteredMarketplace(filteredTracks) {
    const container = document.getElementById('marketplaceContent');
    if (!container) return;
    
    if (!filteredTracks || filteredTracks.length === 0) {
        container.innerHTML = `
            <div class="empty-state-spotify">
                <i class="bi bi-filter" style="font-size: 4rem; color: #1DB954;"></i>
                <h3 style="color: white; margin-top: 1rem;">Nenhum resultado</h3>
                <p style="color: #b3b3b3;">Tente outro filtro</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = filteredTracks.map((track, index) => {
        const originalIndex = state.playlist.findIndex(m => m.id === track.id);
        const playIndex = originalIndex >= 0 ? originalIndex : index;
        
        const eloRating = track.elo_rating || 1400;
        const eloLevel = eloRating >= 2000 ? '🔥 Top' : 
                        eloRating >= 1700 ? '📈 Trending' : '🎵 Nova';
        
        let coverImage = track.link_capa?.trim() || CONFIG.PLACEHOLDERS.MIV_300;
        const percentSold = track.percentual_disponivel ? 
            ((track.acoes_vendidas || 0) / (track.percentual_disponivel / 0.01) * 100).toFixed(0) : 0;
        
        const isFavorite = state.favoriteMusicIds?.includes(track.id?.toString()) || false;
        
        return `
        <div class="spotify-card" onclick="playTrack(${playIndex})">
            <div class="spotify-cover">
                <img src="${coverImage}" alt="${track.titulo}" loading="lazy"
                     onerror="this.onerror=null; this.src='${CONFIG.PLACEHOLDERS.MIV_300}'">
                <div class="play-overlay" onclick="event.stopPropagation(); playTrack(${playIndex})">
                    <i class="bi bi-play-fill"></i>
                </div>
                <div class="position-absolute top-0 start-0 m-2" style="z-index: 5;">
                    <button class="favorite-btn ${isFavorite ? 'active' : ''}" 
                            onclick="event.stopPropagation(); toggleFavoriteMusic('${track.id}', ${playIndex})"
                            style="background: rgba(0,0,0,0.5); border-radius: 50%; width: 32px; height: 32px;">
                        <i class="bi ${isFavorite ? 'bi-star-fill' : 'bi-star'}" style="color: #ffc107;"></i>
                    </button>
                </div>
            </div>
            
            <div class="spotify-title">${track.titulo || 'Sem título'}</div>
            <div class="spotify-artist">${track.artista || 'Artista'}</div>
            
            <div class="spotify-stats">
                <span class="spotify-elo">${eloLevel}</span>
                <span class="spotify-price">${formatCurrency(track.valor_acao || 0)}</span>
            </div>
            
            <div style="margin-top: 8px; position: relative;">
                <div style="height: 4px; background: #282828; border-radius: 2px; overflow: hidden;">
                    <div style="width: ${percentSold}%; height: 100%; background: #1DB954;"></div>
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 4px;">
                    <small style="color: #b3b3b3;">${percentSold}% vendido</small>
                    <small style="color: #1DB954;">${track.acoes_disponiveis || 0} ações</small>
                </div>
            </div>
            
            <button class="btn-invest" onclick="event.stopPropagation(); openInvestModal(${playIndex})">
                <i class="bi bi-currency-dollar me-1"></i> INVESTIR
            </button>
        </div>
        `;
    }).join('');
}

// ===== EXPORT =====
if (typeof window !== 'undefined') {
    window.loadMarketplace = loadMarketplace;
    window.renderMarketplace = renderMarketplace;
    window.filterMarketplace = filterMarketplace;
    window.renderFilteredMarketplace = renderFilteredMarketplace;
}
