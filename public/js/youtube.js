// ============================================================
// YOUTUBE.JS - Busca e recomendações PLAY MY
// ============================================================

let searchTimeout = null;
const YOUTUBE_API_KEY = CONFIG.YOUTUBE_API_KEY;

async function performSearch() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) { showToast('Digite uma música ou artista', 'warning'); return; }

    showLoading(`Buscando "${query}"...`);
    const resultsContainer = document.getElementById('searchResults');
    resultsContainer.style.display = 'none';
    resultsContainer.innerHTML = '<div class="p-4 text-center text-muted"><div class="spinner-border text-success mb-2"></div><p>Buscando...</p></div>';
    resultsContainer.style.display = 'block';

    try {
        if (state.currentUser) await saveSearchToUserProfile(query);
        const q = query.toLowerCase();
        const internalResults = (state.playlist || []).filter(item => {
            const t = (item.titulo || '').toLowerCase();
            const a = (item.artista || '').toLowerCase();
            return t.includes(q) || a.includes(q);
        });
        const externalResults = (state.externalPlaylist || []).filter(item => {
            const t = (item.titulo || '').toLowerCase();
            const a = (item.artista || '').toLowerCase();
            return t.includes(q) || a.includes(q);
        });
        let youtubeResults = [];
        if (YOUTUBE_API_KEY) youtubeResults = await searchYouTube(query);
        displaySearchResults(internalResults, externalResults, youtubeResults, query);
    } catch (error) {
        console.error(error);
        resultsContainer.innerHTML = `<div class="p-4 text-center text-danger"><i class="bi bi-exclamation-triangle fs-1 d-block mb-3"></i><p>Erro na busca</p></div>`;
    } finally { hideLoading(); }
}

async function searchYouTube(query) {
    const cacheKey = `youtube_search_${query.toLowerCase().replace(/\s+/g, '_')}`;
    const cached = localStorage.getItem(cacheKey);
    const cachedTime = localStorage.getItem(`${cacheKey}_time`);
    if (cached && cachedTime && (Date.now() - parseInt(cachedTime)) < 21600000) {
        return JSON.parse(cached);
    }
    try {
        const API_KEY = YOUTUBE_API_KEY;
        if (API_KEY && API_KEY !== 'AIzaSyA_xxxxx_SEU_TOKEN_AQUI') {
            const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=8&q=${encodeURIComponent(query)}&key=${API_KEY}`;
            const response = await fetch(url);
            const data = await response.json();
            if (!data.error && data.items && data.items.length > 0) {
                const results = data.items.map(item => ({
                    id: 'yt_' + item.id.videoId,
                    titulo: item.snippet.title,
                    artista: item.snippet.channelTitle,
                    link_capa: item.snippet.thumbnails.high.url,
                    link_youtube: `https://www.youtube.com/watch?v=${item.id.videoId}`,
                    is_external: true,
                    is_youtube: true,
                    published_at: item.snippet.publishedAt
                }));
                localStorage.setItem(cacheKey, JSON.stringify(results));
                localStorage.setItem(`${cacheKey}_time`, Date.now().toString());
                return results;
            }
        }
    } catch (error) { console.warn('API YouTube falhou:', error); }
    return [];
}

function displaySearchResults(internal, external, youtube, query) {
    const container = document.getElementById('searchResults');
    const allResults = [...(internal || []), ...(external || []), ...(youtube || [])];
    if (allResults.length === 0) {
        container.innerHTML = `<div class="p-4 text-center text-muted"><i class="bi bi-music-note-beamed fs-1 d-block mb-3"></i><p>Nenhum resultado para "${query}"</p></div>`;
        return;
    }
    let html = '<div class="p-2"><small class="text-muted d-block p-2">Resultados:</small>';
    allResults.forEach((item, index) => {
        if (!item || typeof item !== 'object') return;
        const isExternal = item.is_external || item.is_youtube || false;
        const titulo = String(item.titulo || 'Sem título');
        const artista = String(item.artista || 'Artista');
        const coverImg = item.link_capa || (isExternal ? PLACEHOLDERS.EXT_56 : PLACEHOLDERS.MIV_56);
        const safeItem = { id: item.id, titulo, artista, link_capa: coverImg, link_youtube: item.link_youtube || '', is_external: isExternal, is_youtube: item.is_youtube || false };
        const itemJSON = JSON.stringify(safeItem).replace(/"/g, '&quot;');
        html += `
        <div class="search-result-item" onclick='playSearchResult(${index}, ${itemJSON})'>
            <img src="${coverImg}" class="search-result-cover" onerror="this.src='${isExternal ? PLACEHOLDERS.EXT_56 : PLACEHOLDERS.MIV_56}'">
            <div class="search-result-info">
                <div class="search-result-title">${titulo.substring(0, 50)}</div>
                <div class="search-result-artist">${artista.substring(0, 30)}</div>
            </div>
            <div><span class="search-result-badge ${!isExternal ? 'normal' : ''}">${item.is_youtube ? '🎬 YT' : (isExternal ? '🌐 Ext' : '🔷 MIV')}</span></div>
        </div>`;
    });
    html += '</div>';
    container.innerHTML = html;
    container.style.display = 'block';
    setTimeout(() => {
        document.addEventListener('click', function close(e) {
            if (!container.contains(e.target) && !document.getElementById('searchForm').contains(e.target)) {
                container.style.display = 'none';
                document.removeEventListener('click', close);
            }
        });
    }, 100);
}

async function playSearchResult(index, item) {
    document.getElementById('searchResults').style.display = 'none';
    document.getElementById('searchInput').value = '';
    if (item.is_youtube) {
        showToast(`Adicionando "${item.titulo}"...`, 'info');
        await addYouTubeToExternalAndPlay(item);
    } else {
        const idx = state.playlist.findIndex(t => t.id === item.id);
        if (idx !== -1) playTrack(idx);
        else {
            const extIdx = state.externalPlaylist.findIndex(t => t.id === item.id);
            if (extIdx !== -1) playExternalTrack(extIdx);
            else showToast('Música não encontrada', 'error');
        }
    }
}

async function addYouTubeToExternalAndPlay(youtubeItem) {
    const newItem = {
        id: 'yt_temp_' + Date.now(),
        titulo: youtubeItem.titulo,
        artista: youtubeItem.artista,
        link_capa: youtubeItem.link_capa,
        link_youtube: youtubeItem.link_youtube,
        valor_acao: 5.00,
        percentual_disponivel: 10,
        acoes_vendidas: 0,
        total_investidores: 0,
        vendas_atuais: 0,
        meta_vendas: 1000000,
        status: 'aprovado',
        is_temporary: true,
        data_sugestao: new Date().toISOString()
    };
    state.externalPlaylist.unshift(newItem);
    renderExternalMarketplace();
    playExternalTrack(0);
    showToast(`🎵 "${youtubeItem.titulo}" adicionado`, 'success');
}

async function saveSearchToUserProfile(query) {
    if (!state.currentUser || !query) return;
    try {
        await callAPI('update_profile', {
            user_id: state.currentUser.id,
            last_search: query
        });
    } catch (error) { console.error(error); }
}
