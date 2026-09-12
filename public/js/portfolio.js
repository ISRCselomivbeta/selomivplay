// ============================================================
// js/portfolio.js — PLAY MY v8.5.0
// Portfólio, extrato, dados do artista, dados do admin.
// Depende de: config.js, utils.js, state.js, api.js
// DEVE carregar DEPOIS de marketplace.js e ANTES de trades.js.
// ============================================================

// ============================================================
// CARREGAR PORTFÓLIO
// ============================================================
window.loadPortfolio = async function () {
  if (!state.currentUser) return;

  try {
    const r = await callAPI('get_carteira');
    if (r && r.success && r.data) {
      state.portfolioAssets = Array.isArray(r.data)
        ? r.data
        : (r.data.investimentos || []);
    }
  } catch (e) {
    console.warn('⚠️ loadPortfolio:', e.message);
  }

  renderPortfolio();
  updatePortfolioValue();
};

// ============================================================
// CARREGAR EXTRATO
// ============================================================
window.loadLedger = async function () {
  if (!state.currentUser) return;

  try {
    const r = await callAPI('get_extrato');
    if (r && r.success && r.data) {
      state.ledgerData = r.data;
    }
  } catch (e) {
    console.warn('⚠️ loadLedger:', e.message);
  }

  renderLedger();
};

// ============================================================
// RENDERIZAR PORTFÓLIO
// ============================================================
window.renderPortfolio = function () {
  const c = document.getElementById('portfolioContent');
  if (!c) return;

  const a = state.portfolioAssets || [];

  const cnt = document.getElementById('assetsCount');
  if (cnt) cnt.textContent = a.length + ' ativo' + (a.length !== 1 ? 's' : '');

  if (!a.length) {
    c.innerHTML = '<div class="empty-state-actionable" style="grid-column:1/-1">' +
      '<i class="bi bi-briefcase empty-icon"></i>' +
      '<h5 class="text-muted">Nenhum investimento</h5>' +
    '</div>';
    return;
  }

  c.innerHTML = a.map(x => {
    const m = state.playlist.find(y => String(y.id) === String(x.music_id)) || {};
    return '<div class="spotify-card">' +
      '<div class="spotify-cover">' +
        '<img src="' + getCoverUrl(m, false) + '" onerror="this.onerror=null;this.src=\'' + PLACEHOLDERS.MIV_300 + '\'">' +
      '</div>' +
      '<h3 class="spotify-title">' + (m.titulo || x.music_id || 'Música') + '</h3>' +
      '<p class="spotify-artist">' + (m.artista || '') + '</p>' +
      '<div class="spotify-stats">' +
        '<span class="spotify-elo">' + (x.quantidade || 0) + ' ações</span>' +
        '<span class="spotify-price">' + formatCurrency(x.valor_total || 0) + '</span>' +
      '</div>' +
    '</div>';
  }).join('');
};

// ============================================================
// VALOR TOTAL DO PORTFÓLIO
// ============================================================
window.updatePortfolioValue = function () {
  const el = document.getElementById('portfolioValue');
  if (!el) return;

  let t = 0;
  (state.portfolioAssets || []).forEach(a => {
    t += a.valor_total || 0;
  });

  el.textContent = formatCurrency(t);
};

// ============================================================
// RENDERIZAR EXTRATO
// ============================================================
window.renderLedger = function () {
  const c = document.getElementById('ledgerContent');
  if (!c) return;

  if (!state.ledgerData.length) {
    c.innerHTML = '<tr><td colspan="4" class="text-center py-5 text-muted">Nenhuma transação</td></tr>';
    return;
  }

  c.innerHTML = state.ledgerData.map(t => {
    const isNeg = t.valor < 0;
    return '<tr>' +
      '<td>' + formatDate(t.data) + '</td>' +
      '<td>' + (t.descricao || t.tipo) + '</td>' +
      '<td class="text-end ' + (isNeg ? 'text-danger' : 'text-success') + '">' +
        '<strong>' + (isNeg ? '-' : '+') + formatCurrency(Math.abs(t.valor || 0)) + '</strong>' +
      '</td>' +
      '<td>' + (t.blockchain_hash ? '⛓️' : '-') + '</td>' +
    '</tr>';
  }).join('');
};

// ============================================================
// DADOS DO ARTISTA
// ============================================================
window.loadArtistData = async function () {
  if (!state.currentUser || state.currentUser.tipo !== 'artista') return;

  try {
    const r = await callAPI('get_artist_data');

    if (r && r.success && r.data) {
      const elMusicCount = document.getElementById('artistMusicCount');
      if (elMusicCount) elMusicCount.textContent = r.data.total_musicas || 0;

      const elSelo = document.getElementById('artistSeloBalance');
      if (elSelo) elSelo.textContent = new Intl.NumberFormat('pt-BR').format(r.data.selo_coin || 0);

      const elFollowers = document.getElementById('artistFollowersCount');
      if (elFollowers) elFollowers.textContent = r.data.followers || 0;

      const elTickets = document.getElementById('artistTicketsCount');
      if (elTickets) elTickets.textContent = (r.data.tickets || []).length;

      renderArtistMusic(r.data.musics || []);
    }
  } catch (e) {
    console.warn('⚠️ loadArtistData:', e.message);
  }
};

// ============================================================
// RENDERIZAR MÚSICAS DO ARTISTA
// ============================================================
window.renderArtistMusic = function (musics) {
  const c = document.getElementById('artistMusicContent');
  if (!c) return;

  if (!musics.length) {
    c.innerHTML = '<div class="empty-state-actionable" style="grid-column:1/-1">' +
      '<i class="bi bi-music-note-beamed empty-icon"></i>' +
      '<h5 class="text-muted">Nenhuma música</h5>' +
    '</div>';
    return;
  }

  c.innerHTML = musics.map(t =>
    '<div class="spotify-card">' +
      '<div class="spotify-cover">' +
        '<img src="' + getCoverUrl(t, false) + '">' +
      '</div>' +
      '<h3 class="spotify-title">' + (t.titulo || '') + '</h3>' +
      '<p class="spotify-artist">' + formatCurrency(t.valor_acao || 0) + '</p>' +
    '</div>'
  ).join('');
};

// ============================================================
// DADOS DO ADMIN
// ============================================================
window.loadAdminData = async function () {
  if (!state.currentUser || state.currentUser.tipo !== 'admin') return;

  try {
    const r = await callAPI('get_stats');

    if (r && r.success && r.data) {
      const elUsers = document.getElementById('adminUsersCount');
      if (elUsers) elUsers.textContent = r.data.total_usuarios || 0;

      const elMusics = document.getElementById('adminMusicsCount');
      if (elMusics) elMusics.textContent = r.data.total_musicas || 0;

      const elPlaylists = document.getElementById('adminGlobalPlaylistsCount');
      if (elPlaylists) elPlaylists.textContent = (state.globalPlaylists || []).length;

      const elSelo = document.getElementById('adminSeloCirculation');
      if (elSelo) elSelo.textContent = new Intl.NumberFormat('pt-BR').format(r.data.total_investido || 0);
    }
  } catch (e) {
    console.warn('⚠️ loadAdminData:', e.message);
  }
};

// ============================================================
// LOG DE CARREGAMENTO
// ============================================================
console.log('✅ [portfolio.js] carregado — portfólio, extrato, artista e admin prontos');
