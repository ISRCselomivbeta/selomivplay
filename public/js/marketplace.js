// ============================================================
// js/marketplace.js — PLAY MY v9.0.0
// Catálogo, busca, renderização, investimentos, playlists, follow, tickets.
// Depende de: config, utils, state, api, auth, youtube, player
// DEVE carregar DEPOIS de player.js e ANTES de portfolio.js.
//
// MUDANÇAS v9.0.0:
//   - Badge "🔥 Em alta" baseado em streams
//   - Botão "▶ Ouvir" nos cards (YouTube oficial)
//   - Contador de streams no card
//   - Mantém YouTube em playlists (v8.6.0)
// ============================================================

// ============================================================
// NAVEGAÇÃO ENTRE SEÇÕES
// ============================================================

window.changeSection = function (section) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(section + 'Section');
  if (el) el.classList.add('active');

  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.remove('open');

  window.scrollTo(0, 0);

  if (section === 'news' && typeof pmNewsReload === 'function') pmNewsReload();
  if (section === 'trades' && typeof loadTradeOffers === 'function') loadTradeOffers();
  if (section === 'blockchain' && typeof loadBlockchainData === 'function') loadBlockchainData();
  if (section === 'portfolio') {
    if (typeof loadPortfolio === 'function') loadPortfolio();
    if (typeof loadLedger === 'function') loadLedger();
    if (typeof loadDividends === 'function') loadDividends();
  }
};

window.toggleSidebar = function () {
  const s = document.getElementById('sidebar');
  if (s) s.classList.toggle('open');
};

// ============================================================
// LOADERS DE DADOS
// ============================================================
window.loadMarketplace = async function () {
  try {
    const r = await callAPI('get_musicas');
    if (r && r.success && r.data && r.data.length) {
      state.playlist = r.data;
    }
  } catch (e) {
    console.warn('⚠️ loadMarketplace:', e.message);
  }
  renderMarketplace();
  renderRecommended();
  carregarStreamsDasMusicas(); // 🆕
};

window.loadExternalMarketplace = async function () {
  try {
    const r = await callAPI('get_external_musicas');
    if (r && r.success && r.data) {
      state.externalPlaylist = r.data;
    }
  } catch (e) {
    console.warn('⚠️ loadExternalMarketplace:', e.message);
  }
  renderExternalMarketplace();
};

window.loadTopInvestments = async function () {
  try {
    const r = await callAPI('get_top_investments');
    if (r && r.success && r.data) {
      state.topInvestments = r.data;
    }
  } catch (e) {}
  renderTopInvestments();
};

window.loadUserPlaylists = async function () {
  if (!state.currentUser) return;
  try {
    const r = await callAPI('get_playlists');
    if (r && r.success && r.data) {
      state.userPlaylists = r.data;
    }
  } catch (e) {}
  renderPlaylists();
  renderFavorites();
};

window.loadGlobalPlaylists = async function () {
  try {
    const r = await callAPI('get_global_playlists');
    if (r && r.success && r.data) {
      state.globalPlaylists = r.data;
    }
  } catch (e) {}
  renderGlobalPlaylists();
  if (state.currentUser && state.currentUser.tipo === 'admin') {
    renderAdminGlobalPlaylists();
  }
};

window.loadArtists = async function () {
  try {
    const r = await callAPI('get_artists');
    if (r && r.success && r.data) {
      state.artists = r.data;
    }
  } catch (e) {}
  renderArtists();
  renderFeaturedArtists();
};

window.loadFollowing = async function () {
  if (!state.currentUser) return;
  try {
    const r = await callAPI('get_following');
    if (r && r.success && r.data) {
      state.followingArtists = Array.isArray(r.data) ? r.data.map(String) : [];
    }
  } catch (e) {}
};

window.loadTickets = async function () {
  try {
    const r = await callAPI('get_tickets');
    if (r && r.success && r.data) {
      state.tickets = r.data;
    }
  } catch (e) {}
  renderTickets();
};

// ============================================================
// 🆕 CARREGAR STREAMS DAS MÚSICAS
// ============================================================
window.carregarStreamsDasMusicas = async function () {
  if (!state.playlist || !state.playlist.length) return;

  // Carrega em lote (só as 20 primeiras pra não pesar)
  const limite = Math.min(state.playlist.length, 20);

  try {
    const r = await callAPI('get_streaming_ranking', { limit: 50 });
    if (r && r.success && r.data) {
      const mapa = {};
      r.data.forEach(x => {
        mapa[String(x.music_id)] = x.streams_total || 0;
      });
      state.streamsMap = mapa;

      // Re-renderiza o marketplace com os streams
      renderMarketplace();
    }
  } catch (e) {
    console.warn('⚠️ carregarStreamsDasMusicas:', e.message);
  }
};

// ============================================================
// RENDERIZAÇÃO — MERCADO
// ============================================================
window.renderMarketplace = function () {
  const c = document.getElementById('marketplaceContent');
  if (!c) return;

  if (!state.playlist.length) {
    c.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--apple-label-2);padding:40px">Nenhuma música disponível</div>';
    return;
  }

  c.innerHTML = state.playlist.slice(0, 14).map((t, i) => {
    const cover = getCoverUrl(t, false);
    const streams = (state.streamsMap && state.streamsMap[String(t.id)]) || 0;
    const emAlta = streams > 100; // limiar

    return '<div class="spotify-card">' +
      '<div class="spotify-cover">' +
        '<img src="' + cover + '" loading="lazy" onerror="this.onerror=null;this.src=\'' + PLACEHOLDERS.MIV_300 + '\'">' +
        '<div class="play-overlay" onclick="playTrack(' + i + ')"><i class="bi bi-play-fill"></i></div>' +
        (emAlta ? '<div class="em-alta-badge" title="Em alta">🔥</div>' : '') +
      '</div>' +
      '<h3 class="spotify-title">' + (t.titulo || '') + '</h3>' +
      '<p class="spotify-artist">' + (t.artista || '') + '</p>' +
      '<div class="spotify-stats">' +
        '<span class="spotify-elo">' + (t.percentual_disponivel || 0) + '%</span>' +
        '<span class="spotify-price">' + formatCurrency(t.valor_acao || 0) + '</span>' +
      '</div>' +
      (streams > 0
        ? '<div style="font-size:11px;color:var(--apple-label-2);margin-top:4px"><i class="bi bi-play-circle"></i> ' + formatNumber(streams) + ' streams</div>'
        : '') +
      '<div style="display:flex;gap:6px;margin-top:8px">' +
        '<button class="btn-invest" style="flex:1" onclick="openInvestModal(' + i + ')">' +
          '<i class="bi bi-currency-dollar"></i> INVESTIR' +
        '</button>' +
        (t.link_youtube
          ? '<button class="btn-ouvir" title="Ouvir no YouTube" onclick="window.open(\'' + t.link_youtube + '\', \'_blank\')">' +
              '<i class="bi bi-play-fill"></i>' +
            '</button>'
          : '') +
      '</div>' +
    '</div>';
  }).join('');
};

window.renderRecommended = function () {
  const rec = document.getElementById('recommendedCard');
  if (!rec) return;

  if (!state.playlist[0]) {
    rec.innerHTML = '';
    return;
  }

  const p = state.playlist[0];
  const streams = (state.streamsMap && state.streamsMap[String(p.id)]) || 0;

  rec.innerHTML =
    '<img src="' + getCoverUrl(p, false) + '" class="recommended-cover" onerror="this.onerror=null;this.src=\'' + PLACEHOLDERS.MIV_300 + '\'">' +
    '<div class="recommended-info">' +
      '<h4>' + (p.titulo || '') + ' • ' + (p.artista || '') + '</h4>' +
      '<p>' + formatCurrency(p.valor_acao || 0) + ' por ação' +
        (streams > 0 ? ' • ' + formatNumber(streams) + ' streams' : '') +
      '</p>' +
    '</div>' +
    '<button class="btn-play" onclick="playTrack(0)"><i class="bi bi-play-fill"></i></button>';
};

window.renderExternalMarketplace = function () {
  const c = document.getElementById('externalContent');
  if (!c) return;

  if (!state.externalPlaylist.length) {
    c.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--apple-label-2)">' +
      '<i class="bi bi-globe" style="font-size:48px;color:var(--apple-orange)"></i>' +
      '<h3>Nenhuma música externa</h3>' +
      '<p class="text-muted">Sugira uma música para investimento externo</p>' +
    '</div>';
    return;
  }

  c.innerHTML = state.externalPlaylist.map((t, i) =>
    '<div class="spotify-card external-card">' +
      '<div class="external-badge">EXT</div>' +
      '<div class="spotify-cover">' +
        '<img src="' + getCoverUrl(t, true) + '" onerror="this.onerror=null;this.src=\'' + PLACEHOLDERS.EXT_300 + '\'">' +
        '<div class="play-overlay" onclick="playExternalTrack(' + i + ')"><i class="bi bi-play-fill"></i></div>' +
      '</div>' +
      '<h3 class="spotify-title">' + (t.titulo || '') + '</h3>' +
      '<p class="spotify-artist">' + (t.artista || '') + '</p>' +
      '<div class="spotify-stats">' +
        '<span class="spotify-elo">' + (t.percentual_disponivel || 0) + '%</span>' +
        '<span class="spotify-price">' + formatCurrency(t.valor_acao || 0) + '</span>' +
      '</div>' +
      '<button class="btn-invest" onclick="openInvestExternalModal(' + i + ')">INVESTIR EXT</button>' +
    '</div>'
  ).join('');
};

window.renderTopInvestments = function () {
  const c = document.getElementById('investmentsContent');
  if (!c) return;

  if (!state.topInvestments.length) {
    c.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--apple-label-2);padding:40px">Nenhuma recomendação</div>';
    return;
  }

  c.innerHTML = state.topInvestments.map(t =>
    '<div class="spotify-card">' +
      '<div class="spotify-cover">' +
        '<img src="' + getCoverUrl(t, false) + '" onerror="this.onerror=null;this.src=\'' + PLACEHOLDERS.MIV_300 + '\'">' +
      '</div>' +
      '<h3 class="spotify-title">' + (t.titulo || '') + '</h3>' +
      '<p class="spotify-artist">' + (t.artista || '') + '</p>' +
      '<div class="spotify-stats">' +
        '<span class="spotify-elo">' + (t.investment_score || 0) + '</span>' +
        '<span class="spotify-price">' + formatCurrency(t.valor_acao || 0) + '</span>' +
      '</div>' +
    '</div>'
  ).join('');
};

// ============================================================
// RENDERIZAÇÃO — ARTISTAS
// ============================================================
window.renderArtists = function () {
  const c = document.getElementById('artistsContent');
  if (!c) return;

  if (!state.artists.length) {
    c.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--apple-label-2)">Nenhum artista</div>';
    return;
  }

  c.innerHTML = state.artists.map(a => {
    const isFollowing = (state.followingArtists || []).map(String).includes(String(a.id));
    const avatar = a.avatar && a.avatar.startsWith('http') ? a.avatar : PLACEHOLDERS.ARTIST;
    return '<div class="artist-card">' +
      '<img src="' + avatar + '" class="artist-avatar" onerror="this.onerror=null;this.src=\'' + PLACEHOLDERS.ARTIST + '\'">' +
      '<h4 class="artist-name">' + (a.nome || '') + '</h4>' +
      '<p class="artist-followers">' + formatNumber(a.followers || 0) + ' seguidores</p>' +
      '<button class="btn-follow ' + (isFollowing ? 'following' : '') + '" onclick="toggleFollow(\'' + a.id + '\')">' +
        (isFollowing ? 'Seguindo' : 'Seguir') +
      '</button>' +
    '</div>';
  }).join('');
};

window.renderFeaturedArtists = function () {
  const c = document.getElementById('featuredArtistsGrid');
  if (!c) return;

  const items = (state.artists || []).slice(0, 6);
  if (!items.length) { c.innerHTML = ''; return; }

  c.innerHTML = items.map(a => {
    const isFollowing = (state.followingArtists || []).map(String).includes(String(a.id));
    const avatar = a.avatar && a.avatar.startsWith('http') ? a.avatar : PLACEHOLDERS.ARTIST;
    return '<div class="artist-card">' +
      '<img src="' + avatar + '" class="artist-avatar" onerror="this.onerror=null;this.src=\'' + PLACEHOLDERS.ARTIST + '\'">' +
      '<h4 class="artist-name">' + (a.nome || '') + '</h4>' +
      '<button class="btn-follow ' + (isFollowing ? 'following' : '') + '" onclick="toggleFollow(\'' + a.id + '\')">' +
        (isFollowing ? 'Seguindo' : 'Seguir') +
      '</button>' +
    '</div>';
  }).join('');
};

// ============================================================
// RENDERIZAÇÃO — PLAYLISTS (USUÁRIO)
// ============================================================
window.renderPlaylists = function () {
  const pc = document.getElementById('playlistsContent');
  if (!pc) return;

  if (state.userPlaylists.length) {
    pc.innerHTML = state.userPlaylists.map(p =>
      '<div class="playlist-item" onclick="playUserPlaylist(\'' + p.id + '\')">' +
        '<div class="playlist-cover"><i class="bi bi-music-note-list"></i></div>' +
        '<div class="flex-grow-1">' +
          '<h6 class="mb-0">' + (p.nome || '') + '</h6>' +
          '<small class="text-muted">' + ((p.musicas || []).length) + ' músicas</small>' +
        '</div>' +
        '<button class="btn btn-sm btn-success" onclick="event.stopPropagation(); playUserPlaylist(\'' + p.id + '\')">' +
          '<i class="bi bi-play-fill"></i>' +
        '</button>' +
      '</div>'
    ).join('');
  } else {
    pc.innerHTML = '<div class="empty-state-actionable"><i class="bi bi-music-note-list empty-icon"></i><h5 class="text-muted">Nenhuma playlist</h5></div>';
  }
};

window.renderFavorites = function () {
  const fc = document.getElementById('favoritesContent');
  if (!fc) return;

  const favs = [
    ...(state.playlist || []).filter(t => state.favoriteMusicIds && state.favoriteMusicIds.map(String).includes(String(t.id))),
    ...(state.externalPlaylist || []).filter(t => state.favoriteMusicIds && state.favoriteMusicIds.map(String).includes(String(t.id)))
  ];

  if (favs.length) {
    fc.innerHTML = favs.map(t =>
      '<div class="spotify-card">' +
        '<div class="spotify-cover">' +
          '<img src="' + getCoverUrl(t, false) + '">' +
        '</div>' +
        '<h3 class="spotify-title">' + (t.titulo || '') + '</h3>' +
        '<p class="spotify-artist">' + (t.artista || '') + '</p>' +
      '</div>'
    ).join('');
  } else {
    fc.innerHTML = '<div class="empty-state-actionable" style="grid-column:1/-1"><i class="bi bi-star empty-icon"></i><h5 class="text-muted">Sem favoritas</h5></div>';
  }
};

// ============================================================
// RENDERIZAÇÃO — PLAYLISTS GLOBAIS
// ============================================================
window.renderGlobalPlaylists = function () {
  const c1 = document.getElementById('globalPlaylistsGrid');
  const c2 = document.getElementById('globalPlaylistsContent');
  const items = state.globalPlaylists || [];
  const isAdmin = state.currentUser && state.currentUser.tipo === 'admin';

  const html = items.length ? items.map(p =>
    '<div class="playlist-item">' +
      '<div class="playlist-cover" style="background:linear-gradient(135deg,var(--apple-blue),var(--apple-purple))">' +
        '<i class="bi bi-globe"></i>' +
      '</div>' +
      '<div class="flex-grow-1">' +
        '<h6 class="mb-0">' + (p.nome || '') + '</h6>' +
        '<small class="text-muted">' + (p.descricao || 'Playlist global') + ' • ' + ((p.musicas || []).length) + ' músicas</small>' +
      '</div>' +
      '<button class="btn btn-sm btn-success me-2" onclick="event.stopPropagation(); playGlobalPlaylist(\'' + p.id + '\')">' +
        '<i class="bi bi-play-fill"></i> Tocar' +
      '</button>' +
      (isAdmin ? '<button class="btn btn-sm btn-info" onclick="event.stopPropagation(); openManageGlobalPlaylist(\'' + p.id + '\')"><i class="bi bi-pencil-square me-1"></i>Gerenciar</button>' : '') +
    '</div>'
  ).join('') : '<div class="empty-state-actionable"><i class="bi bi-globe empty-icon"></i><h5 class="text-muted">Nenhuma playlist global ainda</h5></div>';

  const gridHtml = items.length ? items.map(p =>
    '<div class="spotify-card" onclick="playGlobalPlaylist(\'' + p.id + '\')">' +
      '<div class="spotify-cover" style="background:linear-gradient(135deg,var(--apple-blue),var(--apple-purple));display:flex;align-items:center;justify-content:center;position:relative">' +
        '<i class="bi bi-globe" style="font-size:64px;color:#fff"></i>' +
        '<div class="global-badge" style="position:absolute"><i class="bi bi-globe"></i> Global</div>' +
      '</div>' +
      '<h3 class="spotify-title">' + (p.nome || '') + '</h3>' +
      '<p class="spotify-artist">' + ((p.musicas || []).length) + ' músicas</p>' +
    '</div>'
  ).join('') : '';

  if (c1) c1.innerHTML = gridHtml;
  if (c2) c2.innerHTML = html;
};

window.renderAdminGlobalPlaylists = function () {
  const c = document.getElementById('adminGlobalPlaylistsContent');
  if (!c) return;

  const items = state.globalPlaylists || [];
  if (!items.length) {
    c.innerHTML = '<div class="empty-state-actionable"><i class="bi bi-globe empty-icon"></i><h5 class="text-muted">Nenhuma playlist global</h5></div>';
    return;
  }

  c.innerHTML = items.map(p =>
    '<div class="playlist-item">' +
      '<div class="playlist-cover" style="background:linear-gradient(135deg,var(--apple-blue),var(--apple-purple))">' +
        '<i class="bi bi-globe"></i>' +
      '</div>' +
      '<div class="flex-grow-1">' +
        '<h6 class="mb-0">' + (p.nome || '') + '</h6>' +
        '<small class="text-muted">' + ((p.musicas || []).length) + ' músicas</small>' +
      '</div>' +
      '<button class="btn btn-sm btn-info me-2" onclick="openManageGlobalPlaylist(\'' + p.id + '\')">' +
        '<i class="bi bi-list-music me-1"></i>Músicas' +
      '</button>' +
    '</div>'
  ).join('');
};

// ============================================================
// RENDERIZAÇÃO — TICKETS
// ============================================================
window.renderTickets = function () {
  const c = document.getElementById('ticketsContent');
  if (!c) return;

  if (!state.tickets.length) {
    c.innerHTML = '<div class="empty-state-actionable"><i class="bi bi-ticket-perforated empty-icon"></i><h5 class="text-muted">Nenhum ingresso disponível</h5></div>';
    return;
  }

  c.innerHTML = state.tickets.map(t =>
    '<div class="ticket-card">' +
      '<div class="d-flex justify-content-between">' +
        '<div class="ticket-title">' + (t.titulo || 'Ingresso') + '</div>' +
        '<span class="badge" style="background:linear-gradient(135deg,var(--selo-coin),var(--selo-coin-dark));color:#000">' + (t.quantidade_disponivel || 0) + ' restantes</span>' +
      '</div>' +
      '<p class="text-muted small mt-2">' + (t.descricao || '') + '</p>' +
      '<div class="d-flex justify-content-between align-items-center">' +
        '<div class="ticket-price">' + (t.preco_selo || 0) + ' SELO</div>' +
        '<button class="btn-redeem" onclick="redeemTicket(\'' + t.id + '\')" ' + ((state.seloCoinBalance || 0) < (t.preco_selo || 0) ? 'disabled' : '') + '>Resgatar</button>' +
      '</div>' +
    '</div>'
  ).join('');
};

// ============================================================
// BUSCA (UNIFICADA)
// ============================================================
window.performSearch = async function () {
  const q = document.getElementById('searchInput').value.trim();
  if (!q) {
    showToast('Digite uma busca', 'warning');
    return;
  }

  const c = document.getElementById('searchResults');
  c.style.display = 'block';
  c.innerHTML = '<div class="p-4 text-center text-muted"><div class="spinner-border spinner-border-sm text-success me-2"></div>Buscando...</div>';

  try {
    const ql = String(q).toLowerCase();
    const safeStr = (v) => String(v == null ? '' : v).toLowerCase();

    const internal = (state.playlist || []).filter(i => {
      if (!i) return false;
      return safeStr(i.titulo).includes(ql) || safeStr(i.artista).includes(ql);
    });

    const external = (state.externalPlaylist || []).filter(i => {
      if (!i) return false;
      return safeStr(i.titulo).includes(ql) || safeStr(i.artista).includes(ql);
    });

    const ytResults = await searchYouTubeDirect(q);

    const all = [
      ...internal.map(x => ({ ...x, _type: 'internal' })),
      ...external.map(x => ({ ...x, _type: 'external' })),
      ...(ytResults || []).map(x => ({ ...x, _type: 'youtube' }))
    ];

    displaySearchResults(all);
  } catch (e) {
    console.error('Erro na busca:', e);
    c.innerHTML = '<div class="p-4 text-center text-danger">Erro ao buscar</div>';
  }
};

window.displaySearchResults = function (all) {
  const c = document.getElementById('searchResults');
  if (!all || !all.length) {
    c.innerHTML = '<div class="p-4 text-center text-muted">Nenhum resultado</div>';
    return;
  }

  const safeStr = (v) => String(v == null ? '' : v);

  c.innerHTML = '<div class="p-2">' + all.slice(0, 40).map(item => {
    if (!item) return '';
    const isYT = item._type === 'youtube';
    const isExt = item._type === 'external';
    const cover = getCoverUrlSmall(item, isExt);

    const badge = isYT
      ? '<span class="search-result-badge" style="background:rgba(255,59,48,.18);color:var(--apple-red)">▶ YT</span>'
      : (isExt
        ? '<span class="search-result-badge">🌐</span>'
        : '<span class="search-result-badge normal">🔷</span>');

    const title = safeStr(item.titulo);
    const sub = safeStr(item.artista);

    let clickAction;
    if (isYT) {
      const vid = String(item.id || '').replace('yt_', '');
      state._lastYouTubeTrack = {
        id: 'yt_' + vid,
        titulo: title,
        artista: sub,
        link_youtube: 'https://www.youtube.com/watch?v=' + vid,
        is_youtube: true
      };
      clickAction = 'playSearchResult(\'youtube\', \'' + vid + '\')';
    } else {
      clickAction = 'playSearchResult(\'' + item._type + '\', \'' + item.id + '\')';
    }

    const addBtn = isYT
      ? '<button class="search-result-add" title="Adicionar à playlist" onclick="event.stopPropagation(); addYouTubeToPlaylistUI(\'' + String(item.id || '').replace('yt_', '') + '\', \'' + title.replace(/'/g, "\\'") + '\', \'' + sub.replace(/'/g, "\\'") + '\')"><i class="bi bi-plus-square"></i></button>'
      : '';

    return '<div class="search-result-item" onclick="' + clickAction + '">' +
      '<img src="' + cover + '" class="search-result-cover" onerror="this.src=\'' + PLACEHOLDERS.MIV_56 + '\'">' +
      '<div class="search-result-info">' +
        '<div class="search-result-title">' + title + '</div>' +
        '<div class="search-result-artist">' + sub + '</div>' +
      '</div>' +
      addBtn +
      badge +
    '</div>';
  }).join('') + '</div>';
};

// ============================================================
// ADICIONAR YOUTUBE À PLAYLIST
// ============================================================
window.addYouTubeToPlaylistUI = function (videoId, titulo, artista) {
  const track = {
    id: 'yt_' + videoId,
    titulo: titulo,
    artista: artista,
    link_youtube: 'https://www.youtube.com/watch?v=' + videoId,
    is_youtube: true,
    from_youtube: true
  };

  openPlaylistSelector(track);
};

window.openPlaylistSelector = function (track) {
  if (!state.currentUser) {
    showToast('Faça login para adicionar músicas', 'error');
    return;
  }

  state._pendingYouTubeTrack = track;

  if (!document.getElementById('playlistSelectorModal')) {
    createPlaylistSelectorModal();
  }

  const list = document.getElementById('playlistSelectorList');
  if (!list) return;

  const playlists = state.userPlaylists || [];
  const globalPlaylists = state.currentUser.tipo === 'admin' ? (state.globalPlaylists || []) : [];

  let html = '';

  if (playlists.length) {
    html += '<div style="margin-bottom:12px;font-weight:600">Minhas Playlists</div>';
    html += playlists.map(p =>
      '<div class="playlist-selector-item" onclick="selectPlaylistForYouTube(\'' + p.id + '\', false)">' +
        '<div style="display:flex;align-items:center;gap:12px">' +
          '<div class="playlist-cover"><i class="bi bi-music-note-list"></i></div>' +
          '<div>' +
            '<div style="font-weight:600">' + (p.nome || '') + '</div>' +
            '<div style="font-size:12px;color:var(--apple-label-2)">' + ((p.musicas || []).length) + ' músicas</div>' +
          '</div>' +
        '</div>' +
      '</div>'
    ).join('');
  }

  if (globalPlaylists.length) {
    html += '<div style="margin:16px 0 12px;font-weight:600">Playlists Globais (admin)</div>';
    html += globalPlaylists.map(p =>
      '<div class="playlist-selector-item" onclick="selectPlaylistForYouTube(\'' + p.id + '\', true)">' +
        '<div style="display:flex;align-items:center;gap:12px">' +
          '<div class="playlist-cover" style="background:linear-gradient(135deg,var(--apple-blue),var(--apple-purple))"><i class="bi bi-globe"></i></div>' +
          '<div>' +
            '<div style="font-weight:600">' + (p.nome || '') + '</div>' +
            '<div style="font-size:12px;color:var(--apple-label-2)">' + ((p.musicas || []).length) + ' músicas</div>' +
          '</div>' +
        '</div>' +
      '</div>'
    ).join('');
  }

  if (!html) {
    html = '<div style="text-align:center;padding:20px;color:var(--apple-label-2)">' +
      '<p>Você não tem playlists ainda.</p>' +
      '<button class="btn-miv mt-3" style="width:auto" onclick="closeModal(\'playlistSelectorModal\'); openCreatePlaylistModal();">Criar Playlist</button>' +
      '</div>';
  }

  list.innerHTML = html;

  const info = document.getElementById('playlistSelectorTrackInfo');
  if (info) {
    info.innerHTML = '🎵 <strong>' + (track.titulo || 'Sem título') + '</strong><br><small style="color:var(--apple-label-2)">' + (track.artista || '') + '</small>';
  }

  showModal('playlistSelectorModal');
};

window.createPlaylistSelectorModal = function () {
  const modal = document.createElement('div');
  modal.id = 'playlistSelectorModal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title">Adicionar à Playlist</h5>
        <button class="modal-close" onclick="closeModal('playlistSelectorModal')">
          <i class="bi bi-x"></i>
        </button>
      </div>
      <div class="modal-body">
        <div id="playlistSelectorTrackInfo" style="margin-bottom:16px;padding:12px;background:var(--apple-gray-6);border-radius:var(--radius-md)"></div>
        <div id="playlistSelectorList" style="max-height:400px;overflow-y:auto"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('playlistSelectorModal')">Fechar</button>
      </div>
    </div>
  `;

  const style = document.createElement('style');
  style.textContent = `
    .playlist-selector-item {
      padding: 12px;
      border-radius: var(--radius-md);
      cursor: pointer;
      margin-bottom: 8px;
      background: var(--apple-gray-6);
      transition: background 0.2s;
    }
    .playlist-selector-item:hover { background: var(--apple-gray-5); }
    .search-result-add {
      background: transparent;
      border: none;
      color: var(--apple-green);
      font-size: 20px;
      cursor: pointer;
      padding: 6px 10px;
      border-radius: 8px;
    }
    .search-result-add:hover { background: rgba(52,199,89,0.15); }
  `;
  document.head.appendChild(style);
  document.body.appendChild(modal);
};

window.selectPlaylistForYouTube = async function (playlistId, isGlobal) {
  const track = state._pendingYouTubeTrack;
  if (!track) {
    showToast('Erro: música não encontrada', 'error');
    return;
  }

  showToast('Adicionando...', 'info');

  try {
    const action = isGlobal ? 'add_music_to_global_playlist' : 'add_music_to_playlist';
    const params = {
      playlist_id: playlistId,
      music_id: track.id,
      music_data: JSON.stringify(track)
    };

    const r = await callAPI(action, params);

    if (r && r.success) {
      showToast('✅ Música adicionada!', 'success');
      closeModal('playlistSelectorModal');
      if (isGlobal) {
        await loadGlobalPlaylists();
      } else {
        await loadUserPlaylists();
      }
      state._pendingYouTubeTrack = null;
    } else {
      showToast(r.message || 'Erro ao adicionar', 'error');
    }
  } catch (e) {
    console.error('Erro:', e);
    showToast('Erro ao adicionar', 'error');
  }
};

// ============================================================
// INVESTIMENTO INTERNO
// ============================================================
window.openInvestModal = function (i) {
  if (i < 0 || i >= state.playlist.length) return;
  const t = state.playlist[i];
  state.currentInvestTrack = t;

  document.getElementById('investTrackTitle').textContent = t.titulo || '';
  document.getElementById('investTrackArtist').textContent = t.artista || '';
  document.getElementById('investUnitPriceDisplay').textContent = formatCurrency(t.valor_acao || 0);
  document.getElementById('investAvailableBalanceDisplay').textContent = formatCurrency(state.userBalance);
  document.getElementById('investQuantityField').value = 1;

  updateInvestmentTotal();
  showModal('investModal');
};

window.updateInvestmentTotal = function () {
  if (!state.currentInvestTrack) return;
  const q = parseInt(document.getElementById('investQuantityField').value) || 1;
  const t = q * (state.currentInvestTrack.valor_acao || 0);

  document.getElementById('investTotalPriceDisplay').textContent = formatCurrency(t);
  document.getElementById('confirmInvestBtn').disabled = t > state.userBalance;
};

window.adjustQuantity = function (a) {
  const i = document.getElementById('investQuantityField');
  i.value = Math.max(1, parseInt(i.value) + a);
  updateInvestmentTotal();
};

window.confirmInvestment = async function () {
  if (!state.currentUser || !state.currentInvestTrack) return;

  const q = parseInt(document.getElementById('investQuantityField').value) || 1;
  const t = q * (state.currentInvestTrack.valor_acao || 0);

  if (t > state.userBalance) {
    showToast('Saldo insuficiente', 'error');
    return;
  }

  const btn = document.getElementById('confirmInvestBtn');
  btn.disabled = true;
  btn.innerHTML = 'Processando...';

  try {
    const r = await callAPI('buy', {
      music_id: state.currentInvestTrack.id,
      quantidade: q,
      valor_total: t,
      valor_unitario: state.currentInvestTrack.valor_acao
    });

    if (r && r.success) {
      if (r.data && r.data.novo_saldo !== undefined) {
        state.userBalance = r.data.novo_saldo;
      } else {
        state.userBalance -= t;
      }
      updateBalanceDisplay();
      if (typeof loadPortfolio === 'function') await loadPortfolio();
      if (typeof loadLedger === 'function') await loadLedger();

      showToast('✅ Investimento realizado!', 'success');
      closeModal('investModal');
    } else {
      showToast((r && r.message) || 'Erro', 'error');
    }
  } catch (e) {
    console.error(e);
    showToast('Erro', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Confirmar';
  }
};

// ============================================================
// INVESTIMENTO EXTERNO
// ============================================================
window.openInvestExternalModal = function (i) {
  if (i < 0 || i >= state.externalPlaylist.length) return;
  const t = state.externalPlaylist[i];
  state.currentExternalTrack = t;

  document.getElementById('investExternalTitleDisplay').textContent = t.titulo || '';
  document.getElementById('investExternalArtistDisplay').textContent = t.artista || '';
  document.getElementById('investExternalUnitPriceDisplay').textContent = formatCurrency(t.valor_acao || 0);
  document.getElementById('investExternalQuantityField').value = 1;

  updateExternalInvestmentTotal();
  showModal('investExternalModal');
};

window.updateExternalInvestmentTotal = function () {
  if (!state.currentExternalTrack) return;
  const q = parseInt(document.getElementById('investExternalQuantityField').value) || 1;
  document.getElementById('investExternalTotalPriceDisplay').textContent =
    formatCurrency(q * (state.currentExternalTrack.valor_acao || 0));
};

window.adjustExternalQuantity = function (a) {
  const i = document.getElementById('investExternalQuantityField');
  i.value = Math.max(1, parseInt(i.value) + a);
  updateExternalInvestmentTotal();
};

window.confirmExternalInvestment = async function () {
  if (!state.currentUser || !state.currentExternalTrack) return;

  const q = parseInt(document.getElementById('investExternalQuantityField').value) || 1;
  const t = q * (state.currentExternalTrack.valor_acao || 0);

  if (t > state.userBalance) {
    showToast('Saldo insuficiente', 'error');
    return;
  }

  try {
    const r = await callAPI('buy_external', {
      external_id: state.currentExternalTrack.id,
      quantidade: q,
      valor_total: t,
      valor_unitario: state.currentExternalTrack.valor_acao
    });

    if (r && r.success) {
      state.userBalance -= t;
      updateBalanceDisplay();
      closeModal('investExternalModal');
      showToast('Investimento externo realizado!', 'success');
    } else {
      showToast((r && r.message) || 'Erro', 'error');
    }
  } catch (e) {
    showToast('Erro', 'error');
  }
};

// ============================================================
// SUGERIR MÚSICA EXTERNA
// ============================================================
window.openAddExternalMusicModal = function () {
  if (!state.currentUser) { showToast('Faça login', 'error'); return; }
  showModal('addExternalMusicModal');
};

window.submitExternalMusic = async function () {
  const y = document.getElementById('externalYoutubeLinkField').value.trim();
  const t = document.getElementById('externalTitleField').value.trim();
  const a = document.getElementById('externalArtistField').value.trim();
  const p = parseFloat(document.getElementById('externalPriceField').value);
  const pct = parseFloat(document.getElementById('externalPercentField').value);
  const msg = document.getElementById('externalMessageField').value.trim();

  if (!y || !t || !a || !p) {
    showToast('Preencha os campos', 'error');
    return;
  }

  try {
    const r = await callAPI('suggest_external_music', {
      link_youtube: y,
      titulo: t,
      artista: a,
      valor_acao: p,
      percentual_disponivel: pct,
      mensagem: msg
    });

    if (r && r.success) {
      showToast('✅ Música sugerida!', 'success');
      closeModal('addExternalMusicModal');
      await loadExternalMarketplace();
    } else {
      showToast((r && r.message) || 'Erro', 'error');
    }
  } catch (e) {
    showToast('Erro', 'error');
  }
};

// ============================================================
// UPLOAD DE MÚSICA (ARTISTA)
// ============================================================
window.openAddMusicModal = function () {
  if (!state.currentUser || (state.currentUser.tipo !== 'artista' && state.currentUser.tipo !== 'admin')) {
    showToast('Apenas artistas', 'error');
    return;
  }
  showModal('addMusicModal');
};

let dadosVideoAnalisado = null;
let videoIdAtual = null;

window.analisarVideoYouTube = async function () {
  const link = document.getElementById('musicYoutubeField').value.trim();
  videoIdAtual = extractYouTubeId(link);

  if (!videoIdAtual) {
    showToast('Link inválido', 'error');
    return;
  }

  const btn = document.getElementById('btnAnalisarVideo');
  btn.disabled = true;
  btn.innerHTML = 'Analisando...';

  try {
    const r = await callAPI('search_isrc', { youtube_url: link });

    if (r && r.success && r.data) {
      dadosVideoAnalisado = { views: 0, titulo: r.data.title || 'Música' };
      document.getElementById('musicTitleField').value = r.data.title || '';
      document.getElementById('musicCoverField').value = 'https://img.youtube.com/vi/' + videoIdAtual + '/maxresdefault.jpg';

      const res = document.getElementById('musicAnalysisResult');
      if (res) {
        res.style.display = 'block';
        res.innerHTML = '<strong>✅ Vídeo analisado</strong><br>' +
          '<small>Artista: ' + (r.data.artist || 'N/A') + '</small><br>' +
          '<small>Vídeo ID: ' + videoIdAtual + '</small>';
      }
      showToast('✅ Dados carregados!', 'success');
    } else {
      showToast('Erro ao analisar', 'error');
    }
  } catch (e) {
    showToast('Erro ao analisar', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-search"></i> Analisar';
  }
};

window.finalizarCadastroComYouTube = async function () {
  if (!dadosVideoAnalisado || !videoIdAtual) {
    showToast('Analise um vídeo primeiro', 'error');
    return;
  }

  const genero = document.getElementById('musicGenreField').value;
  const preco = parseFloat(document.getElementById('musicPriceField').value);
  const percentual = parseFloat(document.getElementById('musicPercentField').value);

  if (!genero || !preco || !percentual) {
    showToast('Preencha os campos', 'error');
    return;
  }

  const btn = document.getElementById('btnFinalizarCadastro');
  btn.disabled = true;

  try {
    const r = await callAPI('upload_music', {
      titulo: dadosVideoAnalisado.titulo,
      artista: state.currentUser.nome,
      genero,
      link_youtube: 'https://youtube.com/watch?v=' + videoIdAtual,
      link_capa: document.getElementById('musicCoverField').value,
      valor_acao: preco,
      percentual_disponivel: percentual
    });

    if (r && r.success) {
      showToast('✅ Música cadastrada!', 'success');
      closeModal('addMusicModal');
      await loadMarketplace();
      if (typeof loadArtistData === 'function') await loadArtistData();
    } else {
      showToast((r && r.message) || 'Erro', 'error');
    }
  } catch (e) {
    showToast('Erro', 'error');
  } finally {
    btn.disabled = false;
  }
};

// ============================================================
// PLAYLISTS DO USUÁRIO
// ============================================================
window.openCreatePlaylistModal = function () { showModal('createPlaylistModal'); };

window.createPlaylist = async function () {
  const name = document.getElementById('playlistNameField').value.trim();
  if (!name || !state.currentUser) return;

  try {
    const r = await callAPI('create_playlist', {
      nome: name,
      publica: document.getElementById('playlistPublicField').checked
    });

    if (r && r.success) {
      showToast('✅ Playlist criada!', 'success');
      closeModal('createPlaylistModal');
      await loadUserPlaylists();
    } else {
      showToast((r && r.message) || 'Erro', 'error');
    }
  } catch (e) {
    showToast('Erro', 'error');
  }
};

window.playUserPlaylist = function (id) {
  const pl = (state.userPlaylists || []).find(p => String(p.id) === String(id));
  if (!pl || !pl.musicas || !pl.musicas.length) {
    showToast('Playlist vazia', 'warning');
    return;
  }

  const queueItems = [];
  (pl.musicas || []).forEach(mid => {
    const sid = String(mid);
    const idx = state.playlist.findIndex(m => String(m.id) === sid);
    if (idx !== -1) {
      queueItems.push({ type: 'internal', index: idx });
    } else if (sid.startsWith('yt_')) {
      const vid = sid.replace('yt_', '');
      queueItems.push({
        type: 'youtube',
        videoId: vid,
        titulo: 'YouTube',
        artista: ''
      });
    }
  });

  if (!queueItems.length) {
    showToast('Nenhuma música disponível', 'warning');
    return;
  }

  playQueue.items = queueItems.map(item => {
    if (item.type === 'youtube') {
      return { type: 'internal', index: -1, youtubeData: item };
    }
    return item;
  });
  playQueue.currentIndex = 0;
  playQueue.playCurrent();
  showToast('▶️ Tocando: ' + (pl.nome || ''), 'success');
};

// ============================================================
// PLAYLISTS GLOBAIS (ADMIN)
// ============================================================
window.openCreateGlobalPlaylistModal = function () {
  if (!state.currentUser || state.currentUser.tipo !== 'admin') {
    showToast('Apenas admin', 'error');
    return;
  }
  showModal('createGlobalPlaylistModal');
};

window.createGlobalPlaylist = async function () {
  const nome = document.getElementById('globalPlaylistNameField').value.trim();
  const desc = document.getElementById('globalPlaylistDescField').value.trim();

  if (!nome) { showToast('Digite um nome', 'error'); return; }

  const btn = document.getElementById('createGlobalPlaylistBtn');
  btn.disabled = true;

  try {
    const r = await callAPI('create_global_playlist', { nome, descricao: desc });

    if (r && r.success) {
      showToast('✅ Playlist global criada!', 'success');
      closeModal('createGlobalPlaylistModal');
      document.getElementById('globalPlaylistNameField').value = '';
      document.getElementById('globalPlaylistDescField').value = '';
      await loadGlobalPlaylists();
    } else {
      showToast((r && r.message) || 'Erro', 'error');
    }
  } catch (e) {
    showToast('Erro', 'error');
  } finally {
    btn.disabled = false;
  }
};

window.openManageGlobalPlaylist = function (playlistId) {
  if (!state.currentUser || state.currentUser.tipo !== 'admin') {
    showToast('Apenas admin', 'error');
    return;
  }

  const pl = (state.globalPlaylists || []).find(p => String(p.id) === String(playlistId));
  if (!pl) { showToast('Playlist não encontrada', 'error'); return; }

  state.currentManagingPlaylistId = playlistId;
  document.getElementById('manageGlobalPlaylistName').value = pl.nome || '';

  const sel = document.getElementById('manageGlobalMusicSelect');
  sel.innerHTML = '<option value="">Selecione uma música...</option>' +
    (state.playlist || []).map(m =>
      '<option value="' + m.id + '">' + (m.titulo || '') + ' — ' + (m.artista || '') + '</option>'
    ).join('');

  renderManageGlobalMusicList();
  showModal('manageGlobalPlaylistModal');
};

window.renderManageGlobalMusicList = function () {
  const list = document.getElementById('manageGlobalMusicList');
  if (!list) return;

  const pl = (state.globalPlaylists || []).find(p => String(p.id) === String(state.currentManagingPlaylistId));
  if (!pl) { list.innerHTML = ''; return; }

  const musicIds = pl.musicas || [];
  document.getElementById('manageGlobalMusicCount').textContent = musicIds.length;

  if (!musicIds.length) {
    list.innerHTML = '<div class="text-muted text-center p-3">Nenhuma música ainda</div>';
    return;
  }

  list.innerHTML = musicIds.map(id => {
    const m = (state.playlist || []).find(x => String(x.id) === String(id));
    if (!m) {
      if (String(id).startsWith('yt_')) {
        return '<div class="d-flex align-items-center justify-content-between p-2 mb-1" style="background:var(--apple-gray-5);border-radius:var(--radius-sm)">' +
          '<div style="font-size:13px;color:var(--apple-label-2)">🎥 Vídeo do YouTube (' + String(id).substring(0, 15) + ')</div>' +
          '<button class="btn btn-sm btn-outline-danger" onclick="removeMusicFromGlobalPlaylist(\'' + id + '\')">' +
            '<i class="bi bi-trash"></i>' +
          '</button>' +
        '</div>';
      }
      return '';
    }
    return '<div class="d-flex align-items-center justify-content-between p-2 mb-1" style="background:var(--apple-gray-5);border-radius:var(--radius-sm)">' +
      '<div class="d-flex align-items-center gap-2">' +
        '<img src="' + getCoverUrl(m, false) + '" style="width:36px;height:36px;border-radius:6px;object-fit:cover">' +
        '<div>' +
          '<div class="text-white" style="font-size:13px;font-weight:600">' + (m.titulo || '') + '</div>' +
          '<div class="text-muted" style="font-size:11px">' + (m.artista || '') + '</div>' +
        '</div>' +
      '</div>' +
      '<button class="btn btn-sm btn-outline-danger" onclick="removeMusicFromGlobalPlaylist(\'' + id + '\')">' +
        '<i class="bi bi-trash"></i>' +
      '</button>' +
    '</div>';
  }).join('');
};

window.addMusicToGlobalPlaylist = async function () {
  const musicId = document.getElementById('manageGlobalMusicSelect').value;
  if (!musicId) { showToast('Selecione uma música', 'warning'); return; }

  try {
    const r = await callAPI('add_music_to_global_playlist', {
      playlist_id: state.currentManagingPlaylistId,
      music_id: musicId
    });

    if (r && r.success) {
      const pl = (state.globalPlaylists || []).find(p => String(p.id) === String(state.currentManagingPlaylistId));
      if (pl) pl.musicas = r.data.musicas || pl.musicas || [];
      renderManageGlobalMusicList();
      renderGlobalPlaylists();
      renderAdminGlobalPlaylists();
      showToast('✅ Música adicionada!', 'success');
    } else {
      showToast((r && r.message) || 'Erro', 'error');
    }
  } catch (e) {
    showToast('Erro', 'error');
  }
};

window.removeMusicFromGlobalPlaylist = async function (musicId) {
  try {
    const r = await callAPI('remove_music_from_global_playlist', {
      playlist_id: state.currentManagingPlaylistId,
      music_id: musicId
    });

    if (r && r.success) {
      const pl = (state.globalPlaylists || []).find(p => String(p.id) === String(state.currentManagingPlaylistId));
      if (pl) pl.musicas = r.data.musicas || (pl.musicas || []).filter(id => String(id) !== String(musicId));
      renderManageGlobalMusicList();
      renderGlobalPlaylists();
      renderAdminGlobalPlaylists();
      showToast('🗑️ Removida', 'success');
    }
  } catch (e) {
    showToast('Erro', 'error');
  }
};

window.playGlobalPlaylist = function (playlistId) {
  const pl = (state.globalPlaylists || []).find(p => String(p.id) === String(playlistId));
  if (!pl) { showToast('Playlist não encontrada', 'error'); return; }

  const ids = (pl.musicas || []).map(String);
  if (!ids.length) { showToast('Playlist vazia', 'warning'); return; }

  const queueItems = [];
  ids.forEach(id => {
    const idx = state.playlist.findIndex(m => String(m.id) === String(id));
    if (idx !== -1) queueItems.push({ type: 'internal', index: idx });
  });

  if (!queueItems.length) {
    showToast('Nenhuma música disponível', 'warning');
    return;
  }

  playQueue.setQueue(queueItems);
  showToast('▶️ Tocando: ' + (pl.nome || ''), 'success');
};

// ============================================================
// TICKETS
// ============================================================
window.openCreateTicketModal = function () {
  if (!state.currentUser || (state.currentUser.tipo !== 'artista' && state.currentUser.tipo !== 'admin')) {
    showToast('Apenas artistas', 'error');
    return;
  }
  showModal('createTicketModal');
};

window.createTicket = async function () {
  const titulo = document.getElementById('ticketTitleField').value.trim();
  const desc = document.getElementById('ticketDescField').value.trim();
  const preco = parseFloat(document.getElementById('ticketPriceField').value) || 0;
  const qtd = parseInt(document.getElementById('ticketQuantityField').value) || 0;
  const data = document.getElementById('ticketDateField').value;

  if (!titulo || preco <= 0 || qtd <= 0) {
    showToast('Preencha os campos', 'error');
    return;
  }

  try {
    const r = await callAPI('create_ticket', {
      titulo, descricao: desc,
      preco_selo: preco,
      quantidade_total: qtd,
      data_evento: data,
      artista_nome: state.currentUser.nome
    });

    if (r && r.success) {
      showToast('✅ Ingresso criado!', 'success');
      closeModal('createTicketModal');
      await loadTickets();
    } else {
      showToast((r && r.message) || 'Erro', 'error');
    }
  } catch (e) {
    showToast('Erro', 'error');
  }
};

window.redeemTicket = async function (id) {
  if (!state.currentUser) return;

  const ticket = state.tickets.find(t => String(t.id) === String(id));
  if (!ticket) return;

  if (state.seloCoinBalance < ticket.preco_selo) {
    showToast('SELO insuficiente', 'error');
    return;
  }

  if (!confirm('Resgatar por ' + ticket.preco_selo + ' SELO?')) return;

  try {
    const r = await callAPI('redeem_ticket', { ticket_id: id });

    if (r && r.success) {
      state.seloCoinBalance -= ticket.preco_selo;
      ticket.quantidade_disponivel = Math.max(0, ticket.quantidade_disponivel - 1);
      updateBalanceDisplay();
      renderTickets();
      showToast('🎟️ Ingresso resgatado!', 'success');
    } else {
      showToast((r && r.message) || 'Erro', 'error');
    }
  } catch (e) {
    showToast('Erro', 'error');
  }
};

// ============================================================
// FOLLOW DE ARTISTAS
// ============================================================
window.toggleFollow = async function (artistId) {
  if (!state.currentUser) {
    showToast('Faça login', 'error');
    return;
  }

  const sid = String(artistId);
  const isFollowing = (state.followingArtists || []).map(String).includes(sid);

  if (isFollowing) {
    state.followingArtists = state.followingArtists.filter(x => String(x) !== sid);
    showToast('Deixou de seguir', 'info');
  } else {
    state.followingArtists.push(sid);
    showToast('❤️ Seguindo!', 'success');
  }

  renderArtists();
  renderFeaturedArtists();

  try {
    await callAPI('toggle_follow', {
      artist_id: artistId,
      action: isFollowing ? 'unfollow' : 'follow'
    });
  } catch (e) {}
};

// ============================================================
// FAVORITOS (toggle)
// ============================================================
window.toggleFavoriteMusic = async function (musicId) {
  if (!state.currentUser) {
    showToast('Faça login', 'error');
    return;
  }

  const sid = String(musicId);
  const wasFav = (state.favoriteMusicIds || []).map(String).includes(sid);

  if (wasFav) {
    state.favoriteMusicIds = state.favoriteMusicIds.filter(x => String(x) !== sid);
  } else {
    state.favoriteMusicIds.push(sid);
  }

  renderFavorites();

  try {
    await callAPI('toggle_favorite', {
      music_id: musicId,
      action: wasFav ? 'remove' : 'add'
    });
  } catch (e) {}
};

// ============================================================
// LOG DE CARREGAMENTO
// ============================================================
console.log('✅ [marketplace.js] v9.0.0 carregado — badges "Em alta" + streams + botão Ouvir');
