// ============================================================
// js/portfolio.js — PLAY MY v9.0.0
// Portfólio, extrato, dividendos, dados do artista, dados do admin.
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
// 🆕 CARREGAR DIVIDENDOS (ROYALTIES RECEBIDOS)
// ============================================================
window.loadDividends = async function () {
  const c = document.getElementById('dividendsContent');
  if (!c) return;

  if (!state.currentUser) {
    c.innerHTML = '<div class="empty-state-actionable" style="grid-column:1/-1">' +
      '<i class="bi bi-coin empty-icon" style="color:var(--apple-yellow)"></i>' +
      '<h5 class="text-muted">Faça login para ver seus dividendos</h5>' +
    '</div>';
    return;
  }

  c.innerHTML = '<div class="text-center p-4">' +
    '<div class="spinner-border text-success"></div>' +
    '<p class="text-muted mt-2">Carregando dividendos...</p>' +
  '</div>';

  try {
    // Tenta endpoint novo (royalties) primeiro
    let r = await callAPI('extrato_usuario', { user_id: state.currentUser.id });

    // Se não existir, cai no extrato normal
    if (!r || !r.success) {
      r = await callAPI('get_extrato');
    }

    // Extrai a lista de royalties
    let royalties = [];
    if (r && r.success && r.data) {
      if (Array.isArray(r.data)) {
        royalties = r.data;
      } else if (Array.isArray(r.data.ultimos)) {
        royalties = r.data.ultimos;
      } else if (Array.isArray(r.data.royalties)) {
        royalties = r.data.royalties;
      }
    }

    // Filtra só o que for royalty/dividendo
    const apenasRoyalties = royalties.filter(x => {
      const tipo = String(x.tipo || '').toLowerCase();
      return tipo === 'royalty' || tipo === 'royalties' || tipo === 'dividendo';
    });

    if (!apenasRoyalties.length) {
      c.innerHTML = '<div class="empty-state-actionable" style="grid-column:1/-1">' +
        '<i class="bi bi-coin empty-icon" style="color:var(--apple-yellow)"></i>' +
        '<h5 class="text-muted">Nenhum dividendo recebido ainda</h5>' +
        '<p class="text-muted small">Quando as músicas que você investiu gerarem royalties, eles aparecerão aqui.</p>' +
      '</div>';
      return;
    }

    const total = apenasRoyalties.reduce((s, x) => s + (parseFloat(x.valor) || 0), 0);
    const ultimos = apenasRoyalties.slice(-20).reverse();

    c.innerHTML =
      // Resumo
      '<div class="portfolio-summary" style="grid-column:1/-1;margin-bottom:24px">' +
        '<h6 class="text-muted" style="text-transform:uppercase;font-size:11px;font-weight:600">TOTAL RECEBIDO EM ROYALTIES</h6>' +
        '<div class="portfolio-value" style="color:var(--apple-green)">' + formatCurrency(total) + '</div>' +
        '<small class="text-muted">' + apenasRoyalties.length + ' pagamento' + (apenasRoyalties.length !== 1 ? 's' : '') + '</small>' +
      '</div>' +

      // Tabela
      '<div class="table-responsive" style="grid-column:1/-1">' +
        '<table class="ledger-table">' +
          '<thead><tr>' +
            '<th>Data</th>' +
            '<th>Música</th>' +
            '<th>Período</th>' +
            '<th class="text-end">Valor</th>' +
          '</tr></thead>' +
          '<tbody>' +
            ultimos.map(x => {
              return '<tr>' +
                '<td class="text-muted small">' + formatDate(x.data || x.timestamp) + '</td>' +
                '<td>' + (x.musica_titulo || x.musica || '—') + '</td>' +
                '<td class="text-muted small">' + (x.periodo || '—') + '</td>' +
                '<td class="text-end text-success fw-bold">+' + formatCurrency(x.valor || 0) + '</td>' +
              '</tr>';
            }).join('') +
          '</tbody>' +
        '</table>' +
      '</div>';

  } catch (e) {
    console.warn('⚠️ loadDividends:', e.message);
    c.innerHTML = '<div class="text-center p-4 text-muted" style="grid-column:1/-1">Erro ao carregar dividendos.</div>';
  }
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
console.log('✅ [portfolio.js] v9.0.0 carregado — portfólio, extrato, dividendos, artista e admin');
