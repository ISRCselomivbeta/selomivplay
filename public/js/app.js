// ============================================================
// js/portfolio.js — PLAY MY v9.2.0
// Portfólio, extrato, dividendos, dados do artista, dados do admin.
// Depende de: config.js, utils.js, state.js, api.js
// DEVE carregar DEPOIS de marketplace.js e ANTES de trades.js.
//
// MUDANÇAS v9.2.0:
//   - ADICIONADA função loadLedger (estava faltando!)
//   - Mostra ELO + valuation em cada ativo
//   - Mostra faixa de ELO (Lendário, Excelente, etc)
//   - Mostra projeção de receita por ativo
//   - Mostra multiplier aplicado
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

  // Carrega ELOs e valuations para enriquecer o portfólio
  await carregarELOsEValuations();

  renderPortfolio();
  updatePortfolioValue();
  updatePortfolioMetrics();
};

// ============================================================
// CARREGAR EXTRATO (ESTAVA FALTANDO!)
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
// CARREGAR ELOs E VALUATIONS DAS MÚSICAS DO PORTFÓLIO
// ============================================================
window.carregarELOsEValuations = async function () {
  const ativos = state.portfolioAssets || [];
  if (!ativos.length) return;

  // Mapa de ELOs (vem do ranking global)
  try {
    const r = await callAPI('get_elo_ranking');
    if (r && r.success && r.data && r.data.ranking) {
      const mapa = {};
      r.data.ranking.forEach(x => {
        mapa[String(x.music_id)] = {
          elo: x.elo || 1000,
          faixa: x.faixa || 'neutro',
          faixa_label: x.faixa_label || 'Neutro',
          cor: x.cor || '#8E8E93'
        };
      });
      state.eloMap = mapa;
    }
  } catch (e) {
    console.warn('⚠️ carregarELOs (portfolio):', e.message);
  }

  // Valuations por música (busca individual)
  state.valuationMap = state.valuationMap || {};
  for (const ativo of ativos.slice(0, 10)) {
    const mid = String(ativo.music_id);
    if (state.valuationMap[mid]) continue;

    try {
      const r = await callAPI('ver_valuation', { music_id: mid });
      if (r && r.success && r.data) {
        state.valuationMap[mid] = {
          valuation: r.data.valuation || 0,
          receita_anual_projetada: r.data.receita_anual_projetada || 0,
          multiplo_final: r.data.multiplo_final || 10,
          ajuste_elo: r.data.ajuste_elo || 0
        };
      }
    } catch (e) {}
  }
};

// ============================================================
// RENDERIZAR PORTFÓLIO (com ELO + valuation)
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
      '<p class="text-muted small">Explore o Marketplace para começar.</p>' +
    '</div>';
    return;
  }

  c.innerHTML = a.map(x => {
    const m = (state.playlist || []).find(y => String(y.id) === String(x.music_id)) || {};
    const eloInfo = (state.eloMap && state.eloMap[String(x.music_id)]) || null;
    const valuationInfo = (state.valuationMap && state.valuationMap[String(x.music_id)]) || null;

    // Calcula valor atual com base na valuation
    let valorAtual = x.valor_total || 0;
    if (valuationInfo && valuationInfo.valuation > 0) {
      valorAtual = (x.valor_total || 0) * (1 + (valuationInfo.ajuste_elo || 0) / 100);
    }

    const ganho = valorAtual - (x.valor_total || 0);
    const ganhoPct = x.valor_total > 0 ? (ganho / x.valor_total) * 100 : 0;

    return '<div class="spotify-card">' +
      '<div class="spotify-cover">' +
        '<img src="' + getCoverUrl(m, false) + '" onerror="this.onerror=null;this.src=\'' + PLACEHOLDERS.MIV_300 + '\'">' +
        (eloInfo && eloInfo.elo >= 1400
          ? '<div style="position:absolute;top:8px;left:8px;background:' + eloInfo.cor + ';color:#000;' +
              'font-size:10px;font-weight:800;padding:3px 7px;border-radius:8px">⚡ ' + eloInfo.elo + '</div>'
          : '') +
      '</div>' +
      '<h3 class="spotify-title">' + (m.titulo || x.music_id || 'Música') + '</h3>' +
      '<p class="spotify-artist">' + (m.artista || '') + '</p>' +

      // ELO + faixa
      (eloInfo
        ? '<div style="font-size:11px;margin-top:4px">' +
            '<span style="color:' + eloInfo.cor + ';font-weight:700">⚡ ' + eloInfo.elo + '</span>' +
            '<span style="color:var(--apple-label-2);margin-left:6px">' + eloInfo.faixa_label + '</span>' +
          '</div>'
        : '') +

      // Stats: ações + valor investido
      '<div class="spotify-stats">' +
        '<span class="spotify-elo">' + (x.quantidade || 0) + ' ações</span>' +
        '<span class="spotify-price">' + formatCurrency(x.valor_total || 0) + '</span>' +
      '</div>' +

      // Valor atual + ganho
      (valuationInfo && valuationInfo.valuation > 0
        ? '<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--apple-separator)">' +
            '<div style="display:flex;justify-content:space-between;font-size:11px">' +
              '<span style="color:var(--apple-label-2)">Valor atual</span>' +
              '<span style="color:#fff;font-weight:700">' + formatCurrency(valorAtual) + '</span>' +
            '</div>' +
            '<div style="display:flex;justify-content:space-between;font-size:11px;margin-top:2px">' +
              '<span style="color:var(--apple-label-2)">Ganho</span>' +
              '<span style="color:' + (ganho >= 0 ? 'var(--apple-green)' : 'var(--apple-red)') + ';font-weight:700">' +
                (ganho >= 0 ? '+' : '') + formatCurrency(ganho) +
                ' (' + (ganhoPct >= 0 ? '+' : '') + ganhoPct.toFixed(1) + '%)' +
              '</span>' +
            '</div>' +
            (valuationInfo.multiplo_final
              ? '<div style="display:flex;justify-content:space-between;font-size:10px;margin-top:2px">' +
                  '<span style="color:var(--apple-label-2)">Múltiplo</span>' +
                  '<span style="color:var(--apple-label-2)">' + valuationInfo.multiplo_final + 'x</span>' +
                '</div>'
              : '') +
          '</div>'
        : '') +
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
// MÉTRICAS DO PORTFÓLIO (ELO médio, valuation, ganho)
// ============================================================
window.updatePortfolioMetrics = function () {
  const c = document.getElementById('portfolioMetrics');
  if (!c) return;

  const ativos = state.portfolioAssets || [];
  if (!ativos.length) { c.innerHTML = ''; return; }

  let totalInvestido = 0;
  let valorAtualTotal = 0;
  let eloTotal = 0;
  let eloCount = 0;
  let valuationTotal = 0;

  ativos.forEach(x => {
    const investido = x.valor_total || 0;
    totalInvestido += investido;

    const eloInfo = (state.eloMap && state.eloMap[String(x.music_id)]) || null;
    if (eloInfo) {
      eloTotal += eloInfo.elo;
      eloCount++;
    }

    const valInfo = (state.valuationMap && state.valuationMap[String(x.music_id)]) || null;
    if (valInfo && valInfo.valuation > 0) {
      const ajuste = 1 + (valInfo.ajuste_elo || 0) / 100;
      valorAtualTotal += investido * ajuste;
      valuationTotal += valInfo.valuation;
    } else {
      valorAtualTotal += investido;
    }
  });

  const eloMedio = eloCount > 0 ? Math.round(eloTotal / eloCount) : 0;
  const ganho = valorAtualTotal - totalInvestido;
  const ganhoPct = totalInvestido > 0 ? (ganho / totalInvestido) * 100 : 0;

  c.innerHTML =
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:24px">' +

      '<div class="stat-card">' +
        '<div class="stat-icon" style="color:var(--apple-green)"><i class="bi bi-cash-stack"></i></div>' +
        '<div class="stat-value">' + formatCurrency(totalInvestido) + '</div>' +
        '<div class="stat-label">Total Investido</div>' +
      '</div>' +

      '<div class="stat-card">' +
        '<div class="stat-icon" style="color:#FFD700"><i class="bi bi-lightning-charge-fill"></i></div>' +
        '<div class="stat-value">⚡ ' + eloMedio + '</div>' +
        '<div class="stat-label">ELO Médio</div>' +
      '</div>' +

      '<div class="stat-card">' +
        '<div class="stat-icon" style="color:' + (ganho >= 0 ? 'var(--apple-green)' : 'var(--apple-red)') + '">' +
          '<i class="bi bi-' + (ganho >= 0 ? 'graph-up-arrow' : 'graph-down-arrow') + '"></i>' +
        '</div>' +
        '<div class="stat-value" style="color:' + (ganho >= 0 ? 'var(--apple-green)' : 'var(--apple-red)') + '">' +
          (ganho >= 0 ? '+' : '') + formatCurrency(ganho) +
        '</div>' +
        '<div class="stat-label">Ganho (' + (ganhoPct >= 0 ? '+' : '') + ganhoPct.toFixed(1) + '%)</div>' +
      '</div>' +

      (valuationTotal > 0
        ? '<div class="stat-card">' +
            '<div class="stat-icon" style="color:var(--apple-blue)"><i class="bi bi-graph-up"></i></div>' +
            '<div class="stat-value">' + formatCurrency(valuationTotal) + '</div>' +
            '<div class="stat-label">Valuation do Catálogo</div>' +
          '</div>'
        : '') +

    '</div>';
};

// ============================================================
// RENDERIZAR EXTRATO
// ============================================================
window.renderLedger = function () {
  const c = document.getElementById('ledgerContent');
  if (!c) return;

  if (!state.ledgerData || !state.ledgerData.length) {
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
// CARREGAR DIVIDENDOS (ROYALTIES RECEBIDOS)
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
    let r = await callAPI('extrato_usuario', { user_id: state.currentUser.id });
    if (!r || !r.success) r = await callAPI('get_extrato');

    let royalties = [];
    if (r && r.success && r.data) {
      if (Array.isArray(r.data)) royalties = r.data;
      else if (Array.isArray(r.data.ultimos)) royalties = r.data.ultimos;
      else if (Array.isArray(r.data.royalties)) royalties = r.data.royalties;
    }

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
      '<div class="portfolio-summary" style="grid-column:1/-1;margin-bottom:24px">' +
        '<h6 class="text-muted" style="text-transform:uppercase;font-size:11px;font-weight:600">TOTAL RECEBIDO EM ROYALTIES</h6>' +
        '<div class="portfolio-value" style="color:var(--apple-green)">' + formatCurrency(total) + '</div>' +
        '<small class="text-muted">' + apenasRoyalties.length + ' pagamento' + (apenasRoyalties.length !== 1 ? 's' : '') + '</small>' +
      '</div>' +

      '<div class="table-responsive" style="grid-column:1/-1">' +
        '<table class="ledger-table">' +
          '<thead><tr>' +
            '<th>Data</th><th>Música</th><th>Período</th><th class="text-end">Valor</th>' +
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

  c.innerHTML = musics.map(t => {
    const eloInfo = (state.eloMap && state.eloMap[String(t.id)]) || null;
    const valInfo = (state.valuationMap && state.valuationMap[String(t.id)]) || null;

    return '<div class="spotify-card">' +
      '<div class="spotify-cover">' +
        '<img src="' + getCoverUrl(t, false) + '">' +
        (eloInfo && eloInfo.elo >= 1400
          ? '<div style="position:absolute;top:8px;left:8px;background:' + eloInfo.cor + ';color:#000;' +
              'font-size:10px;font-weight:800;padding:3px 7px;border-radius:8px">⚡ ' + eloInfo.elo + '</div>'
          : '') +
      '</div>' +
      '<h3 class="spotify-title">' + (t.titulo || '') + '</h3>' +
      '<p class="spotify-artist">' + formatCurrency(t.valor_acao || 0) + '</p>' +
      (eloInfo
        ? '<div style="font-size:11px;color:' + eloInfo.cor + ';margin-top:4px;font-weight:700">⚡ ' + eloInfo.elo + ' ' + eloInfo.faixa_label + '</div>'
        : '') +
      (valInfo && valInfo.valuation > 0
        ? '<div style="font-size:11px;color:var(--apple-blue);margin-top:2px">💰 ' + formatCurrency(valInfo.valuation) + '</div>'
        : '') +
    '</div>';
  }).join('');
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

      // ELO count
      if (r.data.elo_count !== undefined) {
        const elElo = document.getElementById('adminEloCount');
        if (elElo) elElo.textContent = r.data.elo_count;
      }
    }
  } catch (e) {
    console.warn('⚠️ loadAdminData:', e.message);
  }
};

// ============================================================
// LOG DE CARREGAMENTO
// ============================================================
console.log('✅ [portfolio.js] v9.2.0 carregado — portfólio, extrato, dividendos, ELO, valuation, artista e admin');
