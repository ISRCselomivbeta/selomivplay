// ============================================================
// PORTFOLIO.JS - Portfólio, Extrato, Playlists, Minhas Músicas
// ============================================================

async function loadPortfolio(silent = false) {
    if (!state.currentUser) return;
    const result = await callAPI('get_carteira', { user_id: state.currentUser.id });
    if (result?.success && result?.data) {
        if (Array.isArray(result.data)) state.portfolioAssets = result.data;
        else if (typeof result.data === 'object') state.portfolioAssets = result.data.investimentos || [];
        else state.portfolioAssets = [];
    } else state.portfolioAssets = [];
    renderPortfolio();
    updatePortfolioValue();
}

async function loadLedger(forceRefresh = false) {
    if (!state.currentUser) return;
    const result = await callAPI('get_extrato', { user_id: state.currentUser.id });
    if (result?.success && result?.data) state.ledgerData = result.data;
    renderLedger();
}

async function loadUserPlaylists() {
    if (!state.currentUser) { state.userPlaylists = []; renderPlaylists(); return; }
    const result = await callAPI('get_playlists', { user_id: state.currentUser.id });
    if (result?.success && result?.data) state.userPlaylists = result.data;
    renderPlaylists();
}

async function loadUserStreamingHistory(forceRefresh = false) {
    if (!state.currentUser) return;
    try {
        const result = await callAPI('get_streaming_history', { user_id: state.currentUser.id, limit: 50 });
        if (result.success && result.data) state.streamingHistory = result.data;
    } catch (e) { console.error('Erro histórico:', e); }
}

async function loadStreamingStats(force = false) {
    if (!state.currentUser) return;
    if (!force && !canMakeRequest('Streaming')) return;
    registerRequest('Streaming');
    try {
        const result = await callAPI('get_streaming_stats', { user_id: state.currentUser.id });
        if (result?.success && result.data) {
            const e = document.getElementById('totalStreamingEarnings');
            const s = document.getElementById('streamingSongsCount');
            const m = document.getElementById('streamingMinutesCount');
            const r = document.getElementById('streamingRank');
            if (e) e.textContent = formatCurrency(result.data.total_earnings || 0);
            if (s) s.textContent = result.data.songs_count || 0;
            if (m) m.textContent = Math.floor((result.data.total_seconds || 0) / 60);
            if (r) r.textContent = `#${result.data.rank || 0}`;
            state.streamingStats = result.data;
        }
    } catch (e) { console.error(e); }
}

function renderPortfolio() {
    const container = document.getElementById('portfolioContent');
    if (!container) return;
    const assets = Array.isArray(state.portfolioAssets) ? state.portfolioAssets : [];
    const countEl = document.getElementById('assetsCount');
    if (countEl) countEl.textContent = `${assets.length} ativo${assets.length !== 1 ? 's' : ''}`;
    if (!assets.length) {
        container.innerHTML = `<div class="empty-state-actionable" style="grid-column: 1/-1;"><i class="bi bi-briefcase empty-icon"></i><h5 class="text-muted">Nenhum investimento</h5><button class="btn-miv mt-3" onclick="changeSection('marketplace')"><i class="bi bi-shop me-2"></i> Explorar Marketplace</button></div>`;
        return;
    }
    let totalInvestido = 0, valorAtualTotal = 0;
    assets.forEach(a => {
        const vi = a.valor_total || 0;
        totalInvestido += vi;
        const m = state.playlist.find(x => x.id === a.music_id);
        if (m && m.valor_acao) valorAtualTotal += (a.quantidade || 0) * m.valor_acao;
        else valorAtualTotal += vi;
    });
    const profit = valorAtualTotal - totalInvestido;
    const profitPercent = totalInvestido > 0 ? (profit / totalInvestido * 100) : 0;
    container.innerHTML = `
        <div class="artist-stats mb-4" style="grid-column: 1/-1;">
            <div class="stat-card"><div class="stat-icon"><i class="bi bi-cash-stack"></i></div><div class="stat-value">${formatCurrency(totalInvestido)}</div><div class="stat-label">Total Investido</div></div>
            <div class="stat-card"><div class="stat-icon"><i class="bi bi-graph-up-arrow"></i></div><div class="stat-value">${formatCurrency(valorAtualTotal)}</div><div class="stat-label">Valor Atual</div></div>
            <div class="stat-card"><div class="stat-icon"><i class="bi bi-arrow-up-right ${profit >= 0 ? 'text-success' : 'text-danger'}"></i></div><div class="stat-value ${profit >= 0 ? 'text-success' : 'text-danger'}">${formatCurrency(profit)} (${profitPercent.toFixed(1)}%)</div><div class="stat-label">Lucro/Prejuízo</div></div>
        </div>
    ` + assets.map((asset) => {
        const music = state.playlist.find(m => m.id === asset.music_id) || {};
        const valorInvestido = asset.valor_total || 0;
        const quantidade = asset.quantidade || 0;
        let valorAtual = valorInvestido, profitVal = 0, profitPerc = 0;
        if (music.valor_acao) {
            valorAtual = quantidade * music.valor_acao;
            profitVal = valorAtual - valorInvestido;
            profitPerc = valorInvestido > 0 ? (profitVal / valorInvestido * 100) : 0;
        }
        let coverImage = PLACEHOLDERS.MIV_300;
        if (music.link_capa?.trim()) coverImage = music.link_capa.trim();
        else if (music.link_youtube) {
            const videoId = extractYouTubeId(music.link_youtube);
            if (videoId) coverImage = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        }
        const musicIndex = state.playlist.findIndex(m => m.id === music.id);
        return `
        <div class="spotify-card" onclick="playTrack(${musicIndex})">
            <div class="spotify-cover">
                <img src="${coverImage}" alt="${music.titulo}" onerror="this.src='${PLACEHOLDERS.MIV_300}'">
                <div class="play-overlay" onclick="event.stopPropagation(); playTrack(${musicIndex})"><i class="bi bi-play-fill"></i></div>
            </div>
            <h3 class="spotify-title">${music.titulo || 'Sem título'}</h3>
            <p class="spotify-artist">${music.artista || 'Artista'}</p>
            <div class="spotify-stats">
                <span class="spotify-elo">${quantidade} ações</span>
                <span class="spotify-price">${formatCurrency(valorAtual)}</span>
            </div>
            <div style="margin-top: 8px;">
                <span class="badge ${profitVal >= 0 ? 'badge-success' : 'badge-danger'}">${profitVal >= 0 ? '+' : ''}${profitPerc.toFixed(1)}%</span>
            </div>
            <button class="btn-invest" onclick="event.stopPropagation(); openTradeModal({music_id:'${asset.music_id}',music_title:'${music.titulo || ''}',artist:'${music.artista || ''}',quantidade:${quantidade},valor_acao:${music.valor_acao || 0},valor_investido:${valorInvestido}})">
                <i class="bi bi-arrow-left-right me-1"></i> NEGOCIAR
            </button>
        </div>`;
    }).join('');
}

function updatePortfolioValue() {
    const el = document.getElementById('portfolioValue');
    if (!el) return;
    let totalValue = 0;
    const assets = Array.isArray(state.portfolioAssets) ? state.portfolioAssets : [];
    assets.forEach(asset => {
        const music = state.playlist.find(m => m.id === asset.music_id);
        if (music && music.valor_acao) totalValue += (asset.quantidade || 0) * music.valor_acao;
        else totalValue += asset.valor_total || 0;
    });
    el.textContent = formatCurrency(totalValue);
    const updateEl = document.getElementById('portfolioUpdateTime');
    if (updateEl) updateEl.textContent = `Atualizado: ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

function renderLedger() {
    const container = document.getElementById('ledgerContent');
    if (!container) return;
    if (!state.ledgerData?.length) {
        container.innerHTML = '<tr><td colspan="5" class="text-center py-5"><i class="bi bi-receipt display-6 text-muted mb-3"></i><h5 class="text-muted">Nenhuma transação</h5></td></tr>';
        return;
    }
    const sorted = [...state.ledgerData].sort((a, b) => new Date(b.data) - new Date(a.data));
    container.innerHTML = sorted.map(t => {
        const isNegative = t.valor < 0;
        const icons = { INVESTIMENTO: 'bi-currency-dollar', DEPOSITO: 'bi-plus-circle', SAQUE: 'bi-dash-circle', ROYALTY: 'bi-cash-coin' };
        const classes = { INVESTIMENTO: 'text-info', DEPOSITO: 'text-success', SAQUE: 'text-danger', ROYALTY: 'text-success' };
        return `<tr><td>${formatDate(t.data)}</td><td><div class="d-flex align-items-center gap-2"><i class="bi ${icons[t.tipo] || 'bi-receipt'} ${classes[t.tipo] || 'text-muted'}"></i><div><div>${t.descricao || t.tipo}</div></div></div></td><td class="text-end ${isNegative ? 'text-danger' : 'text-success'}"><strong>${isNegative ? '-' : '+'}${formatCurrency(Math.abs(t.valor || 0))}</strong></td><td><button class="btn btn-sm btn-outline-info" onclick="viewContract('${t.referencia || ''}')"><i class="bi bi-file-earmark-text"></i></button></td><td>${t.blockchain_hash ? '<span class="blockchain-verified"><i class="bi bi-shield-check"></i></span>' : '-'}</td></tr>`;
    }).join('');
}

function renderPlaylists() {
    const playlistsContainer = document.getElementById('playlistsContent');
    const favoritesContainer = document.getElementById('favoritesContent');
    if (playlistsContainer) {
        if (state.userPlaylists?.length) {
            playlistsContainer.innerHTML = state.userPlaylists.map(p => `
                <div class="playlist-item">
                    <div class="playlist-cover"><img src="${PLACEHOLDERS.PLAYLIST}" width="60" height="60" alt="Playlist"></div>
                    <div class="flex-grow-1"><h6 class="mb-0">${p.nome}</h6><small class="text-muted">${p.publica ? 'Pública' : 'Privada'}</small></div>
                    <button class="btn btn-sm btn-outline-success"><i class="bi bi-play-fill"></i></button>
                </div>`).join('');
        } else {
            playlistsContainer.innerHTML = `<div class="empty-state-actionable"><i class="bi bi-music-note-list empty-icon"></i><h5 class="text-muted">Nenhuma playlist</h5><button class="btn-miv mt-3" onclick="openCreatePlaylistModal()"><i class="bi bi-plus-circle me-2"></i> Criar Playlist</button></div>`;
        }
    }
    if (favoritesContainer) {
        const favoriteTracks = [
            ...state.playlist.filter(t => state.favoriteMusicIds?.includes(t.id.toString())),
            ...state.externalPlaylist.filter(t => state.favoriteMusicIds?.includes(t.id.toString()))
        ];
        if (favoriteTracks.length) {
            favoritesContainer.innerHTML = favoriteTracks.map((t) => {
                const isExternal = t.id?.toString().startsWith('ext_') || t.is_external;
                const trackIndex = isExternal
                    ? 1000 + state.externalPlaylist.findIndex(p => p.id === t.id)
                    : state.playlist.findIndex(p => p.id === t.id);
                let coverImage = isExternal ? PLACEHOLDERS.EXT_300 : PLACEHOLDERS.MIV_300;
                if (t.link_capa && t.link_capa.trim() !== '') coverImage = t.link_capa.trim();
                else if (t.link_youtube) {
                    const videoId = extractYouTubeId(t.link_youtube);
                    if (videoId) coverImage = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
                }
                const eloRating = t.elo_rating || 1400;
                const eloLevel = eloRating >= 2000 ? '🔥 Top' : eloRating >= 1700 ? '📈 Trending' : '🎵 Nova';
                return `
                <div class="spotify-card ${isExternal ? 'external-card' : ''}" onclick="${isExternal ? `playExternalTrack(${trackIndex - 1000})` : `playTrack(${trackIndex})`}">
                    <div class="spotify-cover">
                        <img src="${coverImage}" alt="${t.titulo}" onerror="this.src='${isExternal ? PLACEHOLDERS.EXT_300 : PLACEHOLDERS.MIV_300}'">
                        <div class="play-overlay"><i class="bi bi-play-fill"></i></div>
                    </div>
                    <h3 class="spotify-title">${t.titulo || 'Sem título'}</h3>
                    <p class="spotify-artist">${t.artista || 'Artista'}</p>
                    <div class="spotify-stats"><span class="spotify-elo">${eloLevel}</span><span class="spotify-price">${formatCurrency(t.valor_acao || 0)}</span></div>
                    <button class="btn-invest" onclick="event.stopPropagation(); ${isExternal ? `openInvestExternalModal(${trackIndex - 1000})` : `openInvestModal(${trackIndex})`}"><i class="bi bi-currency-dollar me-1"></i> INVESTIR</button>
                </div>`;
            }).join('');
        } else {
            favoritesContainer.innerHTML = `<div class="empty-state-actionable" style="grid-column: 1/-1;"><i class="bi bi-star empty-icon"></i><h5 class="text-muted">Nenhuma música favoritada</h5></div>`;
        }
    }
}

async function createPlaylist() {
    const name = document.getElementById('playlistNameField').value.trim();
    if (!name) { showToast('Digite um nome para a playlist', 'error'); return; }
    if (!state.currentUser) { showToast('Faça login para criar playlists', 'error'); return; }
    const btn = document.getElementById('createPlaylistBtn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="bi bi-arrow-clockwise spin"></i> Criando...';
    try {
        const result = await callAPI('create_playlist', {
            nome: name,
            publica: document.getElementById('playlistPublicField').checked,
            user_id: state.currentUser.id
        });
        if (result?.success) {
            showToast('Playlist criada!', 'success');
            closeModal('createPlaylistModal');
            document.getElementById('playlistNameField').value = '';
            document.getElementById('playlistPublicField').checked = false;
            await loadUserPlaylists();
        } else showToast(result?.message || 'Erro ao criar playlist', 'error');
    } catch (error) {
        showToast('Erro ao criar playlist', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

function renderMyMusic(tab = 'recent') {
    const container = document.getElementById('myMusicContent');
    if (!container) return;
    let tracks = [];
    if (tab === 'recent' && state.streamingHistory) {
        const unique = new Map();
        state.streamingHistory.forEach(item => { if (!unique.has(item.music_id)) unique.set(item.music_id, item); });
        tracks = Array.from(unique.values()).slice(0, 20);
    } else if (tab === 'favorites') {
        tracks = [
            ...state.playlist.filter(t => state.favoriteMusicIds?.includes(t.id.toString())),
            ...state.externalPlaylist.filter(t => state.favoriteMusicIds?.includes(t.id.toString()))
        ];
    } else if (tab === 'playlists') { renderPlaylists(); return; }
    if (tracks.length === 0) {
        container.innerHTML = `<div class="empty-state-actionable" style="grid-column: 1/-1;"><i class="bi bi-music-note-beamed empty-icon"></i><h5 class="text-muted">Nenhuma música encontrada</h5><button class="btn btn-outline-info mt-3" onclick="changeSection('marketplace')"><i class="bi bi-shop me-2"></i> Explorar músicas</button></div>`;
        return;
    }
    container.innerHTML = tracks.map(track => {
        const isExternal = track.is_external || track.id?.toString().startsWith('ext_') || track.id?.toString().startsWith('yt_');
        const playIndex = isExternal
            ? 1000 + state.externalPlaylist.findIndex(e => e.id === track.id)
            : state.playlist.findIndex(p => p.id === track.id);
        let coverImage = track.link_capa || (isExternal ? PLACEHOLDERS.EXT_300 : PLACEHOLDERS.MIV_300);
        return `
        <div class="spotify-card ${isExternal ? 'external-card' : ''}" onclick="${isExternal ? `playExternalTrack(${playIndex - 1000})` : `playTrack(${playIndex})`}">
            <div class="spotify-cover">
                <img src="${coverImage}" alt="${track.titulo}" onerror="this.src='${isExternal ? PLACEHOLDERS.EXT_300 : PLACEHOLDERS.MIV_300}'">
                <div class="play-overlay"><i class="bi bi-play-fill"></i></div>
            </div>
            <h3 class="spotify-title">${track.titulo || 'Sem título'}</h3>
            <p class="spotify-artist">${track.artista || 'Artista'}</p>
            <button class="btn-invest" onclick="event.stopPropagation(); ${isExternal ? `openInvestExternalModal(${playIndex - 1000})` : `openInvestModal(${playIndex})`}"><i class="bi bi-currency-dollar me-1"></i> INVESTIR</button>
        </div>`;
    }).join('');
}

function switchMyMusicTab(tab) {
    document.querySelectorAll('#myMusicTabs .nav-link').forEach(link => link.classList.remove('active'));
    if (event?.target) event.target.classList.add('active');
    renderMyMusic(tab);
}
