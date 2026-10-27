// ============================================================
// js/marketplace.js — PLAY MY v9.8.0
// Catálogo, busca, renderização, investimentos, playlists, follow, tickets.
// Depende de: config, utils, state, api, auth, youtube, player
// DEVE carregar DEPOIS de player.js e ANTES de portfolio.js.
//
// MUDANÇAS v9.8.0:
//   - 🆕 [RECOMMENDER v3] — feed infinito agora alimentado por News + YouTube
//   - 🆕 injectNewsToMarketplace() — extrai artistas das notícias e busca no YT
//   - 🆕 _newsCandidates[] — pool de cards "📰 NOVO" com boost temporal
//   - 🆕 _ytCandidates[] — pool de YouTube (patch v9.6.0 mantido)
//   - 🆕 scoreTrack() com boost por idade da notícia (24h/48h/7d)
//   - 🆕 _buildCardsHtml() renderiza 3 tipos: interno, ▶YT, 📰 NOVO
//   - 🆕 trackInteraction('discover_from_news') registrado ao tocar card News
//   - ✅ NADA MAIS MUDOU — todo o resto é idêntico ao v9.5.0
//
// MUDANÇAS v9.5.0:
//   - 🆕 [RECOMMENDER v2] — motor "infinito" orientado a engajamento
//   - 🆕 Captura de buscas (trackSearch) e interações (trackInteraction)
//   - 🆕 getInfiniteRecommendations(page) — lotes infinitos com novidade
//   - 🆕 renderRecommendedRow com "Carregar mais" + scroll infinito
// ============================================================

// ============================================================
// CACHE MANUAL — ELO e Streams (30s)
// ============================================================
const _cacheMark = { elo: 0, streams: 0 };
const CACHE_MS = 30000;

// 🆕 v9.3.7 — filtro da aba Artistas: 'todos' | 'seguindo'
let _filtroArtistas = 'todos';

function _cacheFresh(chave) {
  return (Date.now() - _cacheMark[chave]) < CACHE_MS;
}

function _cacheTouch(chave) {
  _cacheMark[chave] = Date.now();
}

function _cacheInvalidate(chave) {
  _cacheMark[chave] = 0;
}

// ============================================================
// 🔒 SEGURANÇA — ESCAPE HTML (anti-XSS)
// ============================================================
function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ============================================================
// NORMALIZADOR UNIVERSAL DE ARRAYS
// ============================================================
function ensureArray(data) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return [];
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.artists)) return data.artists;
  if (Array.isArray(data.musicas)) return data.musicas;
  if (Array.isArray(data.playlists)) return data.playlists;
  if (Array.isArray(data.tickets)) return data.tickets;
  if (Array.isArray(data.investimentos)) return data.investimentos;
  if (Array.isArray(data.ranking)) return data.ranking;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.list)) return data.list;
  if (Array.isArray(data.result)) return data.result;
  return [];
}

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
  if (section === 'admin') {
    if (typeof loadValuationPanel === 'function') loadValuationPanel();
    if (typeof loadEloPanel === 'function') loadEloPanel();
    if (typeof loadStreamsPanel === 'function') loadStreamsPanel();
    if (typeof loadRoyaltiesPanel === 'function') loadRoyaltiesPanel();
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
    if (r && r.success) {
      state.playlist = ensureArray(r.data);
    }
  } catch (e) {
    console.warn('⚠️ loadMarketplace:', e.message);
    state.playlist = [];
  }
  renderMarketplace();
  renderRecommended();
  carregarStreamsDasMusicas();
  carregarELOsDasMusicas();

  // 🆕 v9.4.0 — [RECOMMENDER] dispara recomendações (não bloqueia)
  if (typeof window.loadRecommendations === 'function') {
    try { window.loadRecommendations(); } catch (e) {}
  }
};

window.loadExternalMarketplace = async function () {
  try {
    const r = await callAPI('get_external_musicas');
    if (r && r.success) {
      state.externalPlaylist = ensureArray(r.data);
    }
  } catch (e) {
    state.externalPlaylist = [];
  }
  renderExternalMarketplace();
};

window.loadTopInvestments = async function () {
  try {
    const r = await callAPI('get_top_investments');
    if (r && r.success) {
      state.topInvestments = ensureArray(r.data);
    }
  } catch (e) {
    state.topInvestments = [];
  }
  renderTopInvestments();
};

window.loadUserPlaylists = async function () {
  if (!state.currentUser) return;
  try {
    const r = await callAPI('get_playlists');
    if (r && r.success) {
      state.userPlaylists = ensureArray(r.data);
    }
  } catch (e) {
    state.userPlaylists = [];
  }
  renderPlaylists();
  renderFavorites();
};

window.loadGlobalPlaylists = async function () {
  try {
    const r = await callAPI('get_global_playlists');
    if (r && r.success) {
      state.globalPlaylists = ensureArray(r.data);
    }
  } catch (e) {
    state.globalPlaylists = [];
  }
  renderGlobalPlaylists();
  if (state.currentUser && state.currentUser.tipo === 'admin') {
    renderAdminGlobalPlaylists();
  }
};

window.loadArtists = async function () {
  try {
    const r = await callAPI('get_artists');
    if (r && r.success) {
      state.artists = ensureArray(r.data);
    }
  } catch (e) {
    state.artists = [];
  }
  if (!Array.isArray(state.artists)) state.artists = [];

  if (state.currentUser && state.currentUser.id && typeof loadFollowing === 'function') {
    await loadFollowing();
  }

  renderArtists();
  renderFeaturedArtists();
};

window.loadFollowing = async function () {
  if (!state.currentUser || !state.currentUser.id) {
    state.followingArtists = [];
    if (typeof renderArtists === 'function') renderArtists();
    if (typeof renderFeaturedArtists === 'function') renderFeaturedArtists();
    console.log('⏭️ [loadFollowing] sem user — following zerado');
    return;
  }

  try {
    const r = await callAPI('get_following');
    if (r && r.success) {
      state.followingArtists = ensureArray(r.data).map(String);
    } else {
      state.followingArtists = [];
    }
  } catch (e) {
    console.warn('⚠️ loadFollowing:', e.message);
    state.followingArtists = [];
  }

  if (typeof renderArtists === 'function') renderArtists();
  if (typeof renderFeaturedArtists === 'function') renderFeaturedArtists();

  console.log('✅ [loadFollowing] state atualizado:', state.followingArtists);
};

window.loadTickets = async function () {
  try {
    const r = await callAPI('get_tickets');
    if (r && r.success) {
      state.tickets = ensureArray(r.data);
    }
  } catch (e) {
    state.tickets = [];
  }
  renderTickets();
};

// ============================================================
// CARREGAR STREAMS DAS MÚSICAS
// ============================================================
window.carregarStreamsDasMusicas = async function () {
  if (!state.playlist || !state.playlist.length) return;

  if (state.streamsMap && _cacheFresh('streams')) {
    console.log('📦 [marketplace] streams do cache (30s)');
    return;
  }
  _cacheTouch('streams');

  try {
    let r = await callAPI('streams_ranking');
    if (!r || !r.success) {
      r = await callAPI('get_streaming_ranking', { limit: 50 });
    }
    if (r && r.success) {
      const lista = ensureArray(r.data);
      const mapa = {};
      lista.forEach(x => {
        mapa[String(x.music_id)] = x.streams_total || 0;
      });
      state.streamsMap = mapa;
      renderMarketplace();
      renderRecommended();
    }
  } catch (e) {
    console.warn('⚠️ carregarStreamsDasMusicas:', e.message);
  }
};

// ============================================================
// CARREGAR ELOs DAS MÚSICAS
// ============================================================
window.carregarELOsDasMusicas = async function () {
  if (!state.playlist || !state.playlist.length) return;

  if (state.eloMap && _cacheFresh('elo')) {
    console.log('📦 [marketplace] ELO do cache (30s)');
    return;
  }
  _cacheTouch('elo');

  try {
    const r = await callAPI('get_elo_ranking');
    if (r && r.success) {
      const ranking = ensureArray(
        (r.data && r.data.ranking) ? r.data.ranking : r.data
      );
      const mapa = {};
      ranking.forEach(x => {
        mapa[String(x.music_id)] = {
          elo: x.elo || 1000,
          faixa: x.faixa || 'neutro',
          faixa_label: x.faixa_label || 'Neutro',
          cor: x.cor || '#8E8E93'
        };
      });
      state.eloMap = mapa;
      renderMarketplace();
      renderRecommended();
    }
  } catch (e) {
    console.warn('⚠️ carregarELOsDasMusicas:', e.message);
  }
};

function getEloMusica(musicId) {
  if (!state.eloMap) return null;
  return state.eloMap[String(musicId)] || null;
}

// ============================================================
// VERIFICAR SE O USUÁRIO PODE EDITAR A MÚSICA
// ============================================================
function podeEditarMusica(musica) {
  if (!state.currentUser) return false;
  if (state.currentUser.tipo === 'admin') return true;
  if (String(musica.user_id) === String(state.currentUser.id)) return true;
  return false;
}

// ============================================================
// RENDERIZAÇÃO — MERCADO
// ============================================================
window.renderMarketplace = function () {
  const c = document.getElementById('marketplaceContent');
  if (!c) return;

  const playlist = Array.isArray(state.playlist) ? state.playlist : [];

  if (!playlist.length) {
    c.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--apple-label-2);padding:40px">Nenhuma música disponível</div>';
    return;
  }

  let lista = playlist.slice(0, 14);
  if (state.ordenarPor === 'elo' && state.eloMap) {
    lista = playlist.slice().sort((a, b) => {
      const eloA = getEloMusica(a.id)?.elo || 0;
      const eloB = getEloMusica(b.id)?.elo || 0;
      return eloB - eloA;
    }).slice(0, 14);
  }

  c.innerHTML = lista.map((t) => {
    const cover = getCoverUrl(t, false);
    const streams = (state.streamsMap && state.streamsMap[String(t.id)]) || 0;
    const emAlta = streams > 100;
    const eloInfo = getEloMusica(t.id);
    const idx = playlist.findIndex(x => String(x.id) === String(t.id));
    const podeEditar = podeEditarMusica(t);
    const isPausada = t.status === 'paused';
    const isDeleted = t.status === 'deleted';

    if (isDeleted) return '';

    return '<div class="spotify-card" style="' + (isPausada ? 'opacity:0.5;' : '') + '">' +
      '<div class="spotify-cover">' +
        '<img src="' + cover + '" loading="lazy" onerror="this.onerror=null;this.src=\'' + PLACEHOLDERS.MIV_300 + '\'">' +
        (isPausada ? '<div style="position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:5"><i class="bi bi-pause-circle" style="font-size:48px;color:#fff"></i></div>' : '') +
        '<div class="play-overlay" onclick="playTrack(' + idx + ')"><i class="bi bi-play-fill"></i></div>' +
        (emAlta ? '<div class="em-alta-badge" title="Em alta">🔥</div>' : '') +
        (eloInfo && eloInfo.elo >= 1400
          ? '<div class="elo-badge" title="ELO ' + eloInfo.elo + ' — ' + escapeHtml(eloInfo.faixa_label) + '" ' +
              'style="position:absolute;top:8px;left:8px;background:' + eloInfo.cor + ';color:#000;' +
              'font-size:10px;font-weight:800;padding:3px 7px;border-radius:8px">' +
              '⚡ ' + eloInfo.elo +
            '</div>'
          : '') +
      '</div>' +
      '<h3 class="spotify-title">' + escapeHtml(t.titulo || '') + '</h3>' +
      '<p class="spotify-artist">' + escapeHtml(t.artista || '') + '</p>' +
      '<div class="spotify-stats">' +
        '<span class="spotify-elo">' + (t.percentual_disponivel || 0) + '%</span>' +
        '<span class="spotify-price">' + formatCurrency(t.valor_acao || 0) + '</span>' +
      '</div>' +
      (eloInfo
        ? '<div style="font-size:11px;margin-top:4px">' +
            '<span style="color:' + eloInfo.cor + ';font-weight:700">⚡ ' + eloInfo.elo + '</span>' +
            '<span style="color:var(--apple-label-2);margin-left:6px">' + escapeHtml(eloInfo.faixa_label) + '</span>' +
            (streams > 0
              ? '<span style="color:var(--apple-label-2);margin-left:6px"><i class="bi bi-play-circle"></i> ' + formatNumber(streams) + '</span>'
              : '') +
          '</div>'
        : (streams > 0
            ? '<div style="font-size:11px;color:var(--apple-label-2);margin-top:4px"><i class="bi bi-play-circle"></i> ' + formatNumber(streams) + ' streams</div>'
            : '')) +
      (isPausada
        ? '<div style="font-size:11px;color:var(--apple-yellow);margin-top:4px"><i class="bi bi-pause-circle"></i> PAUSADA</div>'
        : '') +
      '<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">' +
        (podeEditar
          ? '<button class="btn btn-sm btn-outline-warning" style="flex:1;font-size:11px" onclick="event.stopPropagation(); openEditMusicModal(\'' + t.id + '\')" title="Editar">' +
              '<i class="bi bi-pencil"></i>' +
            '</button>' +
            (isPausada
              ? '<button class="btn btn-sm btn-outline-success" style="flex:1;font-size:11px" onclick="event.stopPropagation(); resumeMusic(\'' + t.id + '\')" title="Reativar">' +
                  '<i class="bi bi-play-circle"></i>' +
                '</button>'
              : '<button class="btn btn-sm btn-outline-warning" style="flex:1;font-size:11px" onclick="event.stopPropagation(); pauseMusic(\'' + t.id + '\')" title="Pausar">' +
                  '<i class="bi bi-pause-circle"></i>' +
                '</button>') +
            '<button class="btn btn-sm btn-outline-danger" style="flex:1;font-size:11px" onclick="event.stopPropagation(); deleteMusic(\'' + t.id + '\')" title="Excluir">' +
              '<i class="bi bi-trash"></i>' +
            '</button>'
          : '') +
      '</div>' +
      '<div style="display:flex;gap:6px;margin-top:8px">' +
        '<button class="btn-invest" style="flex:1" onclick="openInvestModal(' + idx + ')">' +
          '<i class="bi bi-currency-dollar"></i> INVESTIR' +
        '</button>' +
        (t.link_youtube
          ? '<button class="btn-ouvir" title="Ouvir no YouTube" onclick="window.open(\'' + t.link_youtube + '\', \'_blank\')">' +
              '<i class="bi bi-play-fill"></i>' +
            '</button>'
          : '') +
        '<button class="btn-ouvir" title="Compartilhar" onclick="event.stopPropagation(); shareMusic(\'' + t.id + '\')" style="background:var(--apple-gray-5)">' +
          '<i class="bi bi-share-fill"></i>' +
        '</button>' +
      '</div>' +
    '</div>';
  }).join('');

  if (typeof window.renderRecommendedRow === 'function') {
    try { window.renderRecommendedRow(); } catch (e) {}
  }
};

// ============================================================
// EDITAR MÚSICA
// ============================================================
window.openEditMusicModal = function (musicId) {
  const musica = (state.playlist || []).find(m => String(m.id) === String(musicId));
  if (!musica) {
    showToast('Música não encontrada', 'error');
    return;
  }
  if (!podeEditarMusica(musica)) {
    showToast('Você não tem permissão para editar esta música', 'error');
    return;
  }
  const elId = document.getElementById('editMusicId');
  const elTitulo = document.getElementById('editMusicTitle');
  const elArtista = document.getElementById('editMusicArtist');
  const elGenero = document.getElementById('editMusicGenre');
  const elPreco = document.getElementById('editMusicPrice');
  const elPercentual = document.getElementById('editMusicPercent');
  const elCapa = document.getElementById('editMusicCover');

  if (elId) elId.value = musicId;
  if (elTitulo) elTitulo.value = musica.titulo || '';
  if (elArtista) elArtista.value = musica.artista || '';
  if (elGenero) elGenero.value = musica.genero || '';
  if (elPreco) elPreco.value = musica.valor_acao || 0;
  if (elPercentual) elPercentual.value = musica.percentual_disponivel || 0;
  if (elCapa) elCapa.value = musica.link_capa || '';

  showModal('editMusicModal');
};

window.saveMusicEdit = async function () {
  const musicId = document.getElementById('editMusicId').value;
  const titulo = document.getElementById('editMusicTitle').value.trim();
  const artista = document.getElementById('editMusicArtist').value.trim();
  const genero = document.getElementById('editMusicGenre').value;
  const preco = parseFloat(document.getElementById('editMusicPrice').value);
  const percentual = parseFloat(document.getElementById('editMusicPercent').value);
  const capa = document.getElementById('editMusicCover')?.value || '';

  if (!titulo || !artista) { showToast('Preencha título e artista', 'error'); return; }
  if (preco < 1) { showToast('Preço mínimo R$ 1,00', 'error'); return; }

  const btn = document.getElementById('saveEditMusicBtn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Salvando...'; }

  try {
    const r = await callAPI('update_music', {
      music_id: musicId, titulo, artista, genero,
      valor_acao: preco, percentual_disponivel: percentual, link_capa: capa
    });
    if (r && r.success) {
      showToast('✅ Música atualizada!', 'success');
      closeModal('editMusicModal');
      _cacheInvalidate('elo');
      _cacheInvalidate('streams');
      await loadMarketplace();
      if (typeof loadArtistData === 'function') await loadArtistData();
    } else {
      showToast(r.message || 'Erro ao atualizar', 'error');
    }
  } catch (e) {
    console.error('Erro:', e);
    showToast('Erro ao atualizar', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-check-circle"></i> Salvar'; }
  }
};

// ============================================================
// PAUSAR MÚSICA
// ============================================================
window.pauseMusic = async function (musicId) {
  const musica = (state.playlist || []).find(m => String(m.id) === String(musicId));
  if (!musica) return;
  if (!podeEditarMusica(musica)) { showToast('Sem permissão', 'error'); return; }
  if (!confirm('⏸️ Pausar "' + musica.titulo + '"?\n\nEla não aparecerá mais no marketplace, mas continuará no seu painel.')) return;
  try {
    const r = await callAPI('pause_music', { music_id: musicId, action_type: 'pause' });
    if (r && r.success) {
      showToast('⏸️ Música pausada', 'success');
      _cacheInvalidate('elo');
      _cacheInvalidate('streams');
      await loadMarketplace();
    } else {
      showToast(r.message || 'Erro ao pausar', 'error');
    }
  } catch (e) { showToast('Erro ao pausar', 'error'); }
};

// ============================================================
// REATIVAR MÚSICA
// ============================================================
window.resumeMusic = async function (musicId) {
  const musica = (state.playlist || []).find(m => String(m.id) === String(musicId));
  if (!musica) return;
  if (!podeEditarMusica(musica)) { showToast('Sem permissão', 'error'); return; }
  try {
    const r = await callAPI('pause_music', { music_id: musicId, action_type: 'resume' });
    if (r && r.success) {
      showToast('▶️ Música reativada', 'success');
      _cacheInvalidate('elo');
      _cacheInvalidate('streams');
      await loadMarketplace();
    } else {
      showToast(r.message || 'Erro ao reativar', 'error');
    }
  } catch (e) { showToast('Erro ao reativar', 'error'); }
};

// ============================================================
// EXCLUIR MÚSICA
// ============================================================
window.deleteMusic = async function (musicId) {
  const musica = (state.playlist || []).find(m => String(m.id) === String(musicId));
  if (!musica) return;
  if (!podeEditarMusica(musica)) { showToast('Sem permissão', 'error'); return; }
  if (!confirm('⚠️ EXCLUIR "' + musica.titulo + '"?\n\nEsta ação NÃO pode ser desfeita.\n\nTodos os investidores perderão acesso à música.')) return;
  if (!confirm('🚨 TEM CERTEZA? Esta é a última confirmação.')) return;
  try {
    const r = await callAPI('delete_music', { music_id: musicId });
    if (r && r.success) {
      showToast('🗑️ Música excluída', 'success');
      _cacheInvalidate('elo');
      _cacheInvalidate('streams');
      await loadMarketplace();
      if (typeof loadArtistData === 'function') await loadArtistData();
    } else {
      showToast(r.message || 'Erro ao excluir', 'error');
    }
  } catch (e) { showToast('Erro ao excluir', 'error'); }
};

// ============================================================
// COMPARTILHAR MÚSICA PELO CARD
// ============================================================
window.shareMusic = function (musicId) {
  const musica = (state.playlist || []).find(m => String(m.id) === String(musicId));
  if (!musica) return;
  window.currentShareTrack = {
    id: musica.id,
    titulo: musica.titulo,
    artista: musica.artista || 'Artista',
    capa: musica.link_capa || '/images/logo.png',
    link: window.location.origin + '/?music=' + musica.id
  };
  if (typeof openShareModal === 'function') {
    const cover = document.getElementById('sharePreviewCover');
    const title = document.getElementById('sharePreviewTitle');
    const artist = document.getElementById('sharePreviewArtist');
    if (cover) cover.src = window.currentShareTrack.capa;
    if (title) title.textContent = window.currentShareTrack.titulo;
    if (artist) artist.textContent = window.currentShareTrack.artista;
    const nativeBtn = document.getElementById('shareNativeBtn');
    if (nativeBtn) nativeBtn.style.display = navigator.share ? 'flex' : 'none';
    if (typeof showModal === 'function') showModal('shareModal');
  }
};

// ============================================================
// ALTERNAR ORDENAÇÃO (ELO vs PADRÃO)
// ============================================================
window.alternarOrdenacao = function () {
  state.ordenarPor = state.ordenarPor === 'elo' ? 'padrao' : 'elo';
  renderMarketplace();
  if (typeof showToast === 'function') {
    showToast(state.ordenarPor === 'elo' ? '⚡ Ordenado por ELO' : '📋 Ordem padrão', 'info');
  }
};

window.renderRecommended = function () {
  const rec = document.getElementById('recommendedCard');
  if (!rec) return;
  const playlist = Array.isArray(state.playlist) ? state.playlist : [];
  if (!playlist[0]) { rec.innerHTML = ''; return; }

  let destaque = playlist[0];
  if (state.eloMap) {
    let maiorElo = 0;
    playlist.forEach(t => {
      const eloInfo = getEloMusica(t.id);
      if (eloInfo && eloInfo.elo > maiorElo) { maiorElo = eloInfo.elo; destaque = t; }
    });
  }
  const p = destaque;
  const streams = (state.streamsMap && state.streamsMap[String(p.id)]) || 0;
  const eloInfo = getEloMusica(p.id);
  const realIndex = playlist.findIndex(x => String(x.id) === String(p.id));
  const playIdx = realIndex >= 0 ? realIndex : 0;

  rec.innerHTML =
    '<img src="' + getCoverUrl(p, false) + '" class="recommended-cover" onerror="this.onerror=null;this.src=\'' + PLACEHOLDERS.MIV_300 + '\'">' +
    '<div class="recommended-info">' +
      '<h4>' + escapeHtml(p.titulo || '') + ' • ' + escapeHtml(p.artista || '') + '</h4>' +
      '<p>' + formatCurrency(p.valor_acao || 0) + ' por ação' +
        (eloInfo ? ' • ⚡ ' + eloInfo.elo : '') +
        (streams > 0 ? ' • ' + formatNumber(streams) + ' streams' : '') +
      '</p>' +
    '</div>' +
    '<button class="btn-play" onclick="playTrack(' + playIdx + ')"><i class="bi bi-play-fill"></i></button>';
};

window.renderExternalMarketplace = function () {
  const c = document.getElementById('externalContent');
  if (!c) return;
  const externalPlaylist = Array.isArray(state.externalPlaylist) ? state.externalPlaylist : [];
  if (!externalPlaylist.length) {
    c.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--apple-label-2)">' +
      '<i class="bi bi-globe" style="font-size:48px;color:var(--apple-orange)"></i>' +
      '<h3>Nenhuma música externa</h3>' +
      '<p class="text-muted">Sugira uma música para investimento externo</p>' +
    '</div>';
    return;
  }
  c.innerHTML = externalPlaylist.map((t, i) =>
    '<div class="spotify-card external-card">' +
      '<div class="external-badge">EXT</div>' +
      '<div class="spotify-cover">' +
        '<img src="' + getCoverUrl(t, true) + '" onerror="this.onerror=null;this.src=\'' + PLACEHOLDERS.EXT_300 + '\'">' +
        '<div class="play-overlay" onclick="playExternalTrack(' + i + ')"><i class="bi bi-play-fill"></i></div>' +
      '</div>' +
      '<h3 class="spotify-title">' + escapeHtml(t.titulo || '') + '</h3>' +
      '<p class="spotify-artist">' + escapeHtml(t.artista || '') + '</p>' +
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
  const topInvestments = Array.isArray(state.topInvestments) ? state.topInvestments : [];
  if (!topInvestments.length) {
    c.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--apple-label-2);padding:40px">Nenhuma recomendação</div>';
    return;
  }
  let lista = topInvestments.slice();
  if (state.eloMap) {
    lista.sort((a, b) => {
      const eloA = getEloMusica(a.id)?.elo || 0;
      const eloB = getEloMusica(b.id)?.elo || 0;
      return eloB - eloA;
    });
  }
  c.innerHTML = lista.map(t => {
    const eloInfo = getEloMusica(t.id);
    return '<div class="spotify-card">' +
      '<div class="spotify-cover">' +
        '<img src="' + getCoverUrl(t, false) + '" onerror="this.onerror=null;this.src=\'' + PLACEHOLDERS.MIV_300 + '\'">' +
        (eloInfo && eloInfo.elo >= 1400
          ? '<div style="position:absolute;top:8px;left:8px;background:' + eloInfo.cor + ';color:#000;' +
              'font-size:10px;font-weight:800;padding:3px 7px;border-radius:8px">⚡ ' + eloInfo.elo + '</div>'
          : '') +
      '</div>' +
      '<h3 class="spotify-title">' + escapeHtml(t.titulo || '') + '</h3>' +
      '<p class="spotify-artist">' + escapeHtml(t.artista || '') + '</p>' +
      '<div class="spotify-stats">' +
        '<span class="spotify-elo">' + (t.investment_score || 0) + '</span>' +
        '<span class="spotify-price">' + formatCurrency(t.valor_acao || 0) + '</span>' +
      '</div>' +
    '</div>';
  }).join('');
};

// ============================================================
// RENDERIZAÇÃO — ARTISTAS
// ============================================================
window.renderArtists = function () {
  const c = document.getElementById('artistsContent');
  if (!c) return;
  const todos = Array.isArray(state.artists) ? state.artists : [];
  const seguindoIds = (state.followingArtists || []).map(String);
  const totalSeguindo = todos.filter(a => seguindoIds.includes(String(a.id))).length;

  if (!todos.length) {
    c.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--apple-label-2)">Nenhum artista</div>';
    return;
  }

  const filtro = (typeof _filtroArtistas !== 'undefined') ? _filtroArtistas : 'todos';
  const artists = filtro === 'seguindo'
    ? todos.filter(a => seguindoIds.includes(String(a.id)))
    : todos;

  const filtrosHtml =
    '<div style="grid-column:1/-1;display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">' +
      '<button onclick="window.filtrarArtistas(\'todos\')" ' +
        'style="padding:8px 16px;border-radius:20px;border:1px solid ' + (filtro === 'todos' ? '#ffcc00' : '#38383a') + ';' +
        'background:' + (filtro === 'todos' ? '#ffcc00' : 'transparent') + ';' +
        'color:' + (filtro === 'todos' ? '#000' : '#fff') + ';font-weight:600;font-size:13px;cursor:pointer">' +
        '🎵 Todos (' + todos.length + ')' +
      '</button>' +
      '<button onclick="window.filtrarArtistas(\'seguindo\')" ' +
        'style="padding:8px 16px;border-radius:20px;border:1px solid ' + (filtro === 'seguindo' ? '#ffcc00' : '#38383a') + ';' +
        'background:' + (filtro === 'seguindo' ? '#ffcc00' : 'transparent') + ';' +
        'color:' + (filtro === 'seguindo' ? '#000' : '#fff') + ';font-weight:600;font-size:13px;cursor:pointer">' +
        '⭐ Seguindo (' + totalSeguindo + ')' +
      '</button>' +
    '</div>';

  if (!artists.length) {
    c.innerHTML = filtrosHtml +
      '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--apple-label-2)">' +
        '<i class="bi bi-star" style="font-size:48px;opacity:0.4"></i>' +
        '<p style="margin-top:12px">Você ainda não segue nenhum artista</p>' +
      '</div>';
    return;
  }

  c.innerHTML = filtrosHtml + artists.map(a => {
    const isFollowing = seguindoIds.includes(String(a.id));
    const avatar = a.avatar && a.avatar.startsWith('http') ? a.avatar : PLACEHOLDERS.ARTIST;
    return '<div class="artist-card">' +
      '<img src="' + avatar + '" class="artist-avatar" onerror="this.onerror=null;this.src=\'' + PLACEHOLDERS.ARTIST + '\'">' +
      '<h4 class="artist-name">' + escapeHtml(a.nome || '') + '</h4>' +
      '<p class="artist-followers">' + formatNumber(a.followers || 0) + ' seguidores</p>' +
      '<button class="btn-follow ' + (isFollowing ? 'following' : '') + '" onclick="toggleFollow(\'' + a.id + '\')">' +
        (isFollowing ? 'Seguindo' : 'Seguir') +
      '</button>' +
    '</div>';
  }).join('');
};

window.filtrarArtistas = function (modo) {
  _filtroArtistas = (modo === 'seguindo') ? 'seguindo' : 'todos';
  renderArtists();
};

window.renderFeaturedArtists = function () {
  const c = document.getElementById('featuredArtistsGrid');
  if (!c) return;
  const artists = Array.isArray(state.artists) ? state.artists : [];
  const items = artists.slice(0, 6);
  if (!items.length) { c.innerHTML = ''; return; }
  c.innerHTML = items.map(a => {
    const isFollowing = (state.followingArtists || []).map(String).includes(String(a.id));
    const avatar = a.avatar && a.avatar.startsWith('http') ? a.avatar : PLACEHOLDERS.ARTIST;
    return '<div class="artist-card">' +
      '<img src="' + avatar + '" class="artist-avatar" onerror="this.onerror=null;this.src=\'' + PLACEHOLDERS.ARTIST + '\'">' +
      '<h4 class="artist-name">' + escapeHtml(a.nome || '') + '</h4>' +
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
  const userPlaylists = Array.isArray(state.userPlaylists) ? state.userPlaylists : [];
  if (userPlaylists.length) {
    pc.innerHTML = userPlaylists.map(p =>
      '<div class="playlist-item" onclick="playUserPlaylist(\'' + p.id + '\')">' +
        '<div class="playlist-cover"><i class="bi bi-music-note-list"></i></div>' +
        '<div class="flex-grow-1">' +
          '<h6 class="mb-0">' + escapeHtml(p.nome || '') + '</h6>' +
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
  const playlist = Array.isArray(state.playlist) ? state.playlist : [];
  const externalPlaylist = Array.isArray(state.externalPlaylist) ? state.externalPlaylist : [];
  const favs = [
    ...playlist.filter(t => state.favoriteMusicIds && state.favoriteMusicIds.map(String).includes(String(t.id))),
    ...externalPlaylist.filter(t => state.favoriteMusicIds && state.favoriteMusicIds.map(String).includes(String(t.id)))
  ];
  if (favs.length) {
    fc.innerHTML = favs.map(t => {
      const eloInfo = getEloMusica(t.id);
      return '<div class="spotify-card">' +
        '<div class="spotify-cover">' +
          '<img src="' + getCoverUrl(t, false) + '" onerror="this.onerror=null;this.src=\'' + PLACEHOLDERS.MIV_300 + '\'">' +
          (eloInfo && eloInfo.elo >= 1400
            ? '<div style="position:absolute;top:8px;left:8px;background:' + eloInfo.cor + ';color:#000;' +
                'font-size:10px;font-weight:800;padding:3px 7px;border-radius:8px">⚡ ' + eloInfo.elo + '</div>'
            : '') +
        '</div>' +
        '<h3 class="spotify-title">' + escapeHtml(t.titulo || '') + '</h3>' +
        '<p class="spotify-artist">' + escapeHtml(t.artista || '') + '</p>' +
      '</div>';
    }).join('');
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
  const items = Array.isArray(state.globalPlaylists) ? state.globalPlaylists : [];
  const isAdmin = state.currentUser && state.currentUser.tipo === 'admin';

  const html = items.length ? items.map(p =>
    '<div class="playlist-item">' +
      '<div class="playlist-cover" style="background:linear-gradient(135deg,var(--apple-blue),var(--apple-purple))">' +
        '<i class="bi bi-globe"></i>' +
      '</div>' +
      '<div class="flex-grow-1">' +
        '<h6 class="mb-0">' + escapeHtml(p.nome || '') + '</h6>' +
        '<small class="text-muted">' + escapeHtml(p.descricao || 'Playlist global') + ' • ' + ((p.musicas || []).length) + ' músicas</small>' +
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
      '<h3 class="spotify-title">' + escapeHtml(p.nome || '') + '</h3>' +
      '<p class="spotify-artist">' + ((p.musicas || []).length) + ' músicas</p>' +
    '</div>'
  ).join('') : '';

  if (c1) c1.innerHTML = gridHtml;
  if (c2) c2.innerHTML = html;
};

window.renderAdminGlobalPlaylists = function () {
  const c = document.getElementById('adminGlobalPlaylistsContent');
  if (!c) return;
  const items = Array.isArray(state.globalPlaylists) ? state.globalPlaylists : [];
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
        '<h6 class="mb-0">' + escapeHtml(p.nome || '') + '</h6>' +
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
  const tickets = Array.isArray(state.tickets) ? state.tickets : [];
  if (!tickets.length) {
    c.innerHTML = '<div class="empty-state-actionable"><i class="bi bi-ticket-perforated empty-icon"></i><h5 class="text-muted">Nenhum ingresso disponível</h5></div>';
    return;
  }
  c.innerHTML = tickets.map(t =>
    '<div class="ticket-card">' +
      '<div class="d-flex justify-content-between">' +
        '<div class="ticket-title">' + escapeHtml(t.titulo || 'Ingresso') + '</div>' +
        '<span class="badge" style="background:linear-gradient(135deg,var(--selo-coin),var(--selo-coin-dark));color:#000">' + (t.quantidade_disponivel || 0) + ' restantes</span>' +
      '</div>' +
      '<p class="text-muted small mt-2">' + escapeHtml(t.descricao || '') + '</p>' +
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
  if (!q) { showToast('Digite uma busca', 'warning'); return; }

  // 🆕 v9.5.0 — registra busca no perfil (fire-and-forget)
  if (typeof window.trackSearch === 'function') {
    try { window.trackSearch(q); } catch (e) {}
  }

  const c = document.getElementById('searchResults');
  c.style.display = 'block';
  c.innerHTML = '<div class="p-4 text-center text-muted"><div class="spinner-border spinner-border-sm text-success me-2"></div>Buscando...</div>';
  try {
    const ql = String(q).toLowerCase();
    const safeStr = (v) => String(v == null ? '' : v).toLowerCase();
    const playlist = Array.isArray(state.playlist) ? state.playlist : [];
    const externalPlaylist = Array.isArray(state.externalPlaylist) ? state.externalPlaylist : [];
    const internal = playlist.filter(i => {
      if (!i) return false;
      return safeStr(i.titulo).includes(ql) || safeStr(i.artista).includes(ql);
    });
    const external = externalPlaylist.filter(i => {
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
    const eloInfo = !isYT ? getEloMusica(item.id) : null;
    const badge = isYT
      ? '<span class="search-result-badge" style="background:rgba(255,59,48,.18);color:var(--apple-red)">▶ YT</span>'
      : (isExt
        ? '<span class="search-result-badge">🌐</span>'
        : '<span class="search-result-badge normal">🔷</span>');
    const title = escapeHtml(safeStr(item.titulo));
    const sub = escapeHtml(safeStr(item.artista));
    let clickAction;
    if (isYT) {
      const vid = String(item.id || '').replace('yt_', '');
      state._lastYouTubeTrack = {
        id: 'yt_' + vid,
        titulo: safeStr(item.titulo),
        artista: safeStr(item.artista),
        link_youtube: 'https://www.youtube.com/watch?v=' + vid,
        is_youtube: true
      };
      clickAction = 'playSearchResult(\'youtube\', \'' + vid + '\')';
    } else {
      clickAction = 'playSearchResult(\'' + item._type + '\', \'' + item.id + '\')';
    }

    const addBtn = isYT
      ? '<button class="search-result-add" title="Adicionar à playlist" ' +
          'data-yt-id="' + escapeHtml(String(item.id || '').replace('yt_', '')) + '" ' +
          'data-yt-title="' + escapeHtml(safeStr(item.titulo)) + '" ' +
          'data-yt-artist="' + escapeHtml(safeStr(item.artista)) + '">' +
          '<i class="bi bi-plus-square"></i>' +
        '</button>'
      : '';
    return '<div class="search-result-item" onclick="' + clickAction + '">' +
      '<img src="' + cover + '" class="search-result-cover" onerror="this.onerror=null;this.src=\'' + PLACEHOLDERS.MIV_56 + '\'">' +
      '<div class="search-result-info">' +
        '<div class="search-result-title">' + title +
          (eloInfo ? ' <span style="color:' + eloInfo.cor + ';font-size:11px;margin-left:6px">⚡ ' + eloInfo.elo + '</span>' : '') +
        '</div>' +
        '<div class="search-result-artist">' + sub + '</div>' +
      '</div>' +
      addBtn +
      badge +
    '</div>';
  }).join('') + '</div>';

  setTimeout(function () {
    var addBtns = c.querySelectorAll('.search-result-add');
    for (var i = 0; i < addBtns.length; i++) {
      (function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          e.preventDefault();
          var ytId = btn.getAttribute('data-yt-id');
          var ytTitle = btn.getAttribute('data-yt-title');
          var ytArtist = btn.getAttribute('data-yt-artist');
          if (ytId && typeof window.addYouTubeToPlaylistUI === 'function') {
            window.addYouTubeToPlaylistUI(ytId, ytTitle, ytArtist);
          }
        });
      })(addBtns[i]);
    }
  }, 0);
};

// ============================================================
// YOUTUBE + PLAYLIST SELECTOR
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
  if (!state.currentUser) { showToast('Faça login para adicionar músicas', 'error'); return; }
  state._pendingYouTubeTrack = track;
  if (!document.getElementById('playlistSelectorModal')) createPlaylistSelectorModal();
  const list = document.getElementById('playlistSelectorList');
  if (!list) return;
  const playlists = Array.isArray(state.userPlaylists) ? state.userPlaylists : [];
  const globalPlaylists = state.currentUser.tipo === 'admin' ? (Array.isArray(state.globalPlaylists) ? state.globalPlaylists : []) : [];
  let html = '';
  if (playlists.length) {
    html += '<div style="margin-bottom:12px;font-weight:600">Minhas Playlists</div>';
    html += playlists.map(p =>
      '<div class="playlist-selector-item" onclick="selectPlaylistForYouTube(\'' + p.id + '\', false)">' +
        '<div style="display:flex;align-items:center;gap:12px">' +
          '<div class="playlist-cover"><i class="bi bi-music-note-list"></i></div>' +
          '<div><div style="font-weight:600">' + escapeHtml(p.nome || '') + '</div>' +
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
          '<div><div style="font-weight:600">' + escapeHtml(p.nome || '') + '</div>' +
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
    info.innerHTML = '🎵 <strong>' + escapeHtml(track.titulo || 'Sem título') + '</strong><br><small style="color:var(--apple-label-2)">' + escapeHtml(track.artista || '') + '</small>';
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
        <button class="modal-close" onclick="closeModal('playlistSelectorModal')"><i class="bi bi-x"></i></button>
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
    .playlist-selector-item { padding: 12px; border-radius: var(--radius-md); cursor: pointer; margin-bottom: 8px; background: var(--apple-gray-6); transition: background 0.2s; }
    .playlist-selector-item:hover { background: var(--apple-gray-5); }
    .search-result-add { background: transparent; border: none; color: var(--apple-green); font-size: 20px; cursor: pointer; padding: 6px 10px; border-radius: 8px; }
    .search-result-add:hover { background: rgba(52,199,89,0.15); }
  `;
  document.head.appendChild(style);
  document.body.appendChild(modal);
};

window.selectPlaylistForYouTube = async function (playlistId, isGlobal) {
  const track = state._pendingYouTubeTrack;
  if (!track) { showToast('Erro: música não encontrada', 'error'); return; }
  if (!isGlobal && (!state.currentUser || !state.currentUser.id)) {
    showToast('Faça login para adicionar músicas', 'error');
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
    if (!isGlobal) {
      params.user_id = state.currentUser.id;
    }
    const r = await callAPI(action, params);
    if (r && r.success) {
      showToast('✅ Música adicionada!', 'success');
      closeModal('playlistSelectorModal');
      const listKey = isGlobal ? 'globalPlaylists' : 'userPlaylists';
      const pl = (state[listKey] || []).find(p => String(p.id) === String(playlistId));
      if (pl) {
        pl.musicas = (r.data && r.data.musicas) || pl.musicas || [];
        if (!pl.musicas.map(String).includes(String(track.id))) {
          pl.musicas.push(String(track.id));
        }
      }
      if (isGlobal) {
        renderGlobalPlaylists();
        renderAdminGlobalPlaylists();
        await loadGlobalPlaylists();
      } else {
        renderPlaylists();
        await loadUserPlaylists();
      }
      state._pendingYouTubeTrack = null;
    } else {
      showToast((r && r.message) || 'Erro ao adicionar', 'error');
    }
  } catch (e) {
    console.error('❌ selectPlaylistForYouTube:', e);
    showToast('Erro ao adicionar', 'error');
  }
};

// ============================================================
// INVESTIMENTO INTERNO / EXTERNO
// ============================================================
window.openInvestModal = function (i) {
  const playlist = Array.isArray(state.playlist) ? state.playlist : [];
  if (i < 0 || i >= playlist.length) return;
  const t = playlist[i];
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
  if (t > state.userBalance) { showToast('Saldo insuficiente', 'error'); return; }
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
      if (r.data && r.data.novo_saldo !== undefined) state.userBalance = r.data.novo_saldo;
      else state.userBalance -= t;
      updateBalanceDisplay();
      if (typeof loadPortfolio === 'function') await loadPortfolio();
      if (typeof loadLedger === 'function') await loadLedger();
      showToast('✅ Investimento realizado!', 'success');
      closeModal('investModal');
      if (window.trackInteraction && state.currentInvestTrack && state.currentInvestTrack.id) {
        try { window.trackInteraction('like', state.currentInvestTrack.id); } catch (e) {}
      }
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

window.openInvestExternalModal = function (i) {
  const externalPlaylist = Array.isArray(state.externalPlaylist) ? state.externalPlaylist : [];
  if (i < 0 || i >= externalPlaylist.length) return;
  const t = externalPlaylist[i];
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
  if (t > state.userBalance) { showToast('Saldo insuficiente', 'error'); return; }
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
  } catch (e) { showToast('Erro', 'error'); }
};

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
  if (!y || !t || !a || !p) { showToast('Preencha os campos', 'error'); return; }
  try {
    const r = await callAPI('suggest_external_music', {
      link_youtube: y, titulo: t, artista: a,
      valor_acao: p, percentual_disponivel: pct, mensagem: msg
    });
    if (r && r.success) {
      showToast('✅ Música sugerida!', 'success');
      closeModal('addExternalMusicModal');
      await loadExternalMarketplace();
    } else {
      showToast((r && r.message) || 'Erro', 'error');
    }
  } catch (e) { showToast('Erro', 'error'); }
};

// ============================================================
// UPLOAD DE MÚSICA (ARTISTA)
// ============================================================
window.openAddMusicModal = function () {
  if (!state.currentUser || (state.currentUser.tipo !== 'artista' && state.currentUser.tipo !== 'admin')) {
    showToast('Apenas artistas', 'error'); return;
  }
  showModal('addMusicModal');
};

let dadosVideoAnalisado = null;
let videoIdAtual = null;

window.analisarVideoYouTube = async function () {
  const link = document.getElementById('musicYoutubeField').value.trim();
  videoIdAtual = extractYouTubeId(link);
  if (!videoIdAtual) { showToast('Link inválido', 'error'); return; }
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
          '<small>Artista: ' + escapeHtml(r.data.artist || 'N/A') + '</small><br>' +
          '<small>Vídeo ID: ' + escapeHtml(videoIdAtual) + '</small>';
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
  if (!dadosVideoAnalisado || !videoIdAtual) { showToast('Analise um vídeo primeiro', 'error'); return; }
  const genero = document.getElementById('musicGenreField').value;
  const preco = parseFloat(document.getElementById('musicPriceField').value);
  const percentual = parseFloat(document.getElementById('musicPercentField').value);
  if (!genero || !preco || !percentual) { showToast('Preencha os campos', 'error'); return; }
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
  if (!name || !state.currentUser || !state.currentUser.id) {
    showToast('Faça login para criar playlists', 'error');
    return;
  }
  const btn = document.querySelector('#createPlaylistModal .btn-success');
  if (btn) { btn.disabled = true; btn.innerHTML = 'Criando...'; }
  try {
    const r = await callAPI('create_playlist', {
      user_id: state.currentUser.id,
      nome: name,
      publica: document.getElementById('playlistPublicField').checked
    });
    if (r && r.success) {
      showToast('✅ Playlist criada!', 'success');
      closeModal('createPlaylistModal');
      document.getElementById('playlistNameField').value = '';
      document.getElementById('playlistPublicField').checked = false;
      if (r.data && r.data.id) {
        if (!Array.isArray(state.userPlaylists)) state.userPlaylists = [];
        state.userPlaylists.push(r.data);
        renderPlaylists();
      }
      await loadUserPlaylists();
    } else {
      showToast((r && r.message) || 'Erro ao criar playlist', 'error');
    }
  } catch (e) {
    console.error('❌ createPlaylist:', e);
    showToast('Erro ao criar playlist', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = 'Criar'; }
  }
};

window.playUserPlaylist = function (id) {
  const playlists = Array.isArray(state.userPlaylists) ? state.userPlaylists : [];
  const pl = playlists.find(p => String(p.id) === String(id));
  if (!pl || !pl.musicas || !pl.musicas.length) { showToast('Playlist vazia', 'warning'); return; }
  const playlist = Array.isArray(state.playlist) ? state.playlist : [];
  const queueItems = [];
  (pl.musicas || []).forEach(mid => {
    const sid = String(mid);
    const idx = playlist.findIndex(m => String(m.id) === sid);
    if (idx !== -1) {
      queueItems.push({ type: 'internal', index: idx });
    } else if (sid.startsWith('yt_')) {
      queueItems.push({ type: 'youtube', videoId: sid.replace('yt_', ''), titulo: 'YouTube', artista: '' });
    }
  });
  if (!queueItems.length) { showToast('Nenhuma música disponível', 'warning'); return; }
  playQueue.items = queueItems.map(item => {
    if (item.type === 'youtube') return { type: 'internal', index: -1, youtubeData: item };
    return item;
  });
  playQueue.currentIndex = 0;
  playQueue.playCurrent();
  showToast('▶️ Tocando: ' + (pl.nome || ''), 'success');
};

window.playGlobalPlaylist = function (playlistId) {
  const playlists = Array.isArray(state.globalPlaylists) ? state.globalPlaylists : [];
  const pl = playlists.find(p => String(p.id) === String(playlistId));
  if (!pl) { showToast('Playlist não encontrada', 'error'); return; }

  const ids = (pl.musicas || []).map(String);
  if (!ids.length) { showToast('Playlist vazia', 'warning'); return; }

  const playlist = Array.isArray(state.playlist) ? state.playlist : [];
  const queueItems = [];

  ids.forEach(id => {
    const idx = playlist.findIndex(m => String(m.id) === String(id));
    if (idx !== -1) { queueItems.push({ type: 'internal', index: idx }); return; }
    if (String(id).startsWith('yt_')) {
      const videoId = String(id).replace('yt_', '');
      const externalPlaylist = Array.isArray(state.externalPlaylist) ? state.externalPlaylist : [];
      const extIdx = externalPlaylist.findIndex(m => String(m.link_youtube || '').includes(videoId));
      if (extIdx !== -1) queueItems.push({ type: 'external', index: extIdx });
      else queueItems.push({ type: 'youtube', videoId: videoId, titulo: 'Vídeo do YouTube', artista: pl.nome || '' });
    }
  });

  if (!queueItems.length) {
    showToast('Nenhuma música disponível', 'warning');
    return;
  }

  playQueue.items = queueItems.map(item => {
    if (item.type === 'youtube') return { type: 'internal', index: -1, youtubeData: item };
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
  if (!state.currentUser || state.currentUser.tipo !== 'admin') { showToast('Apenas admin', 'error'); return; }
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
  } catch (e) { showToast('Erro', 'error'); }
  finally { btn.disabled = false; }
};

window.openManageGlobalPlaylist = function (playlistId) {
  if (!state.currentUser || state.currentUser.tipo !== 'admin') { showToast('Apenas admin', 'error'); return; }
  const playlists = Array.isArray(state.globalPlaylists) ? state.globalPlaylists : [];
  const pl = playlists.find(p => String(p.id) === String(playlistId));
  if (!pl) { showToast('Playlist não encontrada', 'error'); return; }
  state.currentManagingPlaylistId = playlistId;
  document.getElementById('manageGlobalPlaylistName').value = pl.nome || '';
  const sel = document.getElementById('manageGlobalMusicSelect');
  const playlist = Array.isArray(state.playlist) ? state.playlist : [];
  sel.innerHTML = '<option value="">Selecione uma música...</option>' +
    playlist.map(m => '<option value="' + m.id + '">' + escapeHtml(m.titulo || '') + ' — ' + escapeHtml(m.artista || '') + '</option>').join('');
  renderManageGlobalMusicList();
  showModal('manageGlobalPlaylistModal');
};

window.renderManageGlobalMusicList = function () {
  const list = document.getElementById('manageGlobalMusicList');
  if (!list) return;
  const playlists = Array.isArray(state.globalPlaylists) ? state.globalPlaylists : [];
  const pl = playlists.find(p => String(p.id) === String(state.currentManagingPlaylistId));
  if (!pl) { list.innerHTML = ''; return; }
  const musicIds = pl.musicas || [];
  document.getElementById('manageGlobalMusicCount').textContent = musicIds.length;
  if (!musicIds.length) {
    list.innerHTML = '<div class="text-muted text-center p-3">Nenhuma música ainda</div>';
    return;
  }
  const playlist = Array.isArray(state.playlist) ? state.playlist : [];
  list.innerHTML = musicIds.map(id => {
    const m = playlist.find(x => String(x.id) === String(id));
    if (!m) {
      if (String(id).startsWith('yt_')) {
        return '<div class="d-flex align-items-center justify-content-between p-2 mb-1" style="background:var(--apple-gray-5);border-radius:var(--radius-sm)">' +
          '<div style="font-size:13px;color:var(--apple-label-2)">🎥 Vídeo do YouTube (' + escapeHtml(String(id).substring(0, 15)) + ')</div>' +
          '<button class="btn btn-sm btn-outline-danger" onclick="removeMusicFromGlobalPlaylist(\'' + id + '\')"><i class="bi bi-trash"></i></button>' +
        '</div>';
      }
      return '';
    }
    return '<div class="d-flex align-items-center justify-content-between p-2 mb-1" style="background:var(--apple-gray-5);border-radius:var(--radius-sm)">' +
      '<div class="d-flex align-items-center gap-2">' +
        '<img src="' + getCoverUrl(m, false) + '" style="width:36px;height:36px;border-radius:6px;object-fit:cover" onerror="this.onerror=null;this.src=\'' + PLACEHOLDERS.MIV_300 + '\'">' +
        '<div><div class="text-white" style="font-size:13px;font-weight:600">' + escapeHtml(m.titulo || '') + '</div>' +
          '<div class="text-muted" style="font-size:11px">' + escapeHtml(m.artista || '') + '</div></div>' +
      '</div>' +
      '<button class="btn btn-sm btn-outline-danger" onclick="removeMusicFromGlobalPlaylist(\'' + id + '\')"><i class="bi bi-trash"></i></button>' +
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
  } catch (e) { showToast('Erro', 'error'); }
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
  } catch (e) { showToast('Erro', 'error'); }
};

// ============================================================
// TICKETS
// ============================================================
window.openCreateTicketModal = function () {
  if (!state.currentUser || (state.currentUser.tipo !== 'artista' && state.currentUser.tipo !== 'admin')) { showToast('Apenas artistas', 'error'); return; }
  showModal('createTicketModal');
};

window.createTicket = async function () {
  const titulo = document.getElementById('ticketTitleField').value.trim();
  const desc = document.getElementById('ticketDescField').value.trim();
  const preco = parseFloat(document.getElementById('ticketPriceField').value) || 0;
  const qtd = parseInt(document.getElementById('ticketQuantityField').value) || 0;
  const data = document.getElementById('ticketDateField').value;
  if (!titulo || preco <= 0 || qtd <= 0) { showToast('Preencha os campos', 'error'); return; }
  try {
    const r = await callAPI('create_ticket', {
      titulo, descricao: desc, preco_selo: preco,
      quantidade_total: qtd, data_evento: data,
      artista_nome: state.currentUser.nome
    });
    if (r && r.success) {
      showToast('✅ Ingresso criado!', 'success');
      closeModal('createTicketModal');
      await loadTickets();
    } else {
      showToast((r && r.message) || 'Erro', 'error');
    }
  } catch (e) { showToast('Erro', 'error'); }
};

window.redeemTicket = async function (id) {
  if (!state.currentUser) return;
  const tickets = Array.isArray(state.tickets) ? state.tickets : [];
  const ticket = tickets.find(t => String(t.id) === String(id));
  if (!ticket) return;
  if (state.seloCoinBalance < ticket.preco_selo) { showToast('SELO insuficiente', 'error'); return; }
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
  } catch (e) { showToast('Erro', 'error'); }
};

// ============================================================
// FOLLOW / FAVORITOS
// ============================================================
window.toggleFollow = async function (artistId) {
  if (!state.currentUser) { showToast('Faça login', 'error'); return; }
  const sid = String(artistId);
  const isFollowing = (state.followingArtists || []).map(String).includes(sid);

  if (isFollowing) {
    state.followingArtists = state.followingArtists.filter(x => String(x) !== sid);
    showToast('Deixou de seguir', 'info');
  } else {
    if (!Array.isArray(state.followingArtists)) state.followingArtists = [];
    state.followingArtists.push(sid);
    showToast('❤️ Seguindo!', 'success');
  }

  renderArtists();
  renderFeaturedArtists();

  if (typeof callAPI.invalidate === 'function') {
    callAPI.invalidate('get_following');
  }

  if (typeof window.invalidateRecommendations === 'function') {
    try { window.invalidateRecommendations(); } catch (e) {}
  }

  try {
    var artista = (state.artists || []).find(function (a) {
      return String(a.id) === String(artistId);
    });
    callAPI('register_event', {
      event_type: isFollowing ? 'unfollow' : 'follow',
      artist: artista ? artista.nome : String(artistId),
      genero: null,
      music_id: null,
      titulo: null
    }).then(function (r) {
      if (r && r.success) {
        console.log('📊 [event] registrado: ' + (isFollowing ? 'unfollow' : 'follow') + ' — ' + (artista ? artista.nome : artistId));
      }
    }).catch(function () {});
  } catch (e) {}

  try {
    const r = await callAPI('toggle_follow', {
      artist_id: artistId,
      action: isFollowing ? 'unfollow' : 'follow'
    });

    if (!r || !r.success) {
      console.warn('⚠️ toggle_follow falhou — revertendo state');
      if (isFollowing) {
        state.followingArtists.push(sid);
      } else {
        state.followingArtists = state.followingArtists.filter(x => String(x) !== sid);
      }
      renderArtists();
      renderFeaturedArtists();
      showToast('Erro ao seguir', 'error');
    } else {
      console.log('✅ [toggle_follow] via API — state atualizado:', state.followingArtists);
    }
  } catch (e) {
    console.error('❌ toggle_follow erro:', e);
    if (isFollowing) {
      state.followingArtists.push(sid);
    } else {
      state.followingArtists = state.followingArtists.filter(x => String(x) !== sid);
    }
    renderArtists();
    renderFeaturedArtists();
  }
};

window.toggleFavoriteMusic = async function (musicId) {
  if (!state.currentUser) { showToast('Faça login', 'error'); return; }
  const sid = String(musicId);
  const wasFav = (state.favoriteMusicIds || []).map(String).includes(sid);

  if (wasFav) {
    state.favoriteMusicIds = state.favoriteMusicIds.filter(x => String(x) !== sid);
  } else {
    if (!Array.isArray(state.favoriteMusicIds)) state.favoriteMusicIds = [];
    state.favoriteMusicIds.push(sid);
  }

  renderFavorites();

  if (typeof callAPI.invalidate === 'function') {
    callAPI.invalidate('get_user_profile');
  }

  if (typeof window.invalidateRecommendations === 'function') {
    try { window.invalidateRecommendations(); } catch (e) {}
  }

  try {
    var musica = (state.playlist || []).find(function (m) {
      return String(m.id) === String(musicId);
    });
    if (musica) {
      callAPI('register_event', {
        event_type: wasFav ? 'unfavorite' : 'favorite',
        music_id: musica.id,
        artist: musica.artista || null,
        genero: musica.genero || null,
        titulo: musica.titulo || null
      }).then(function (r) {
        if (r && r.success) {
          console.log('📊 [event] registrado: ' + (wasFav ? 'unfavorite' : 'favorite') + ' — ' + (musica.titulo || musica.id));
        }
      }).catch(function () {});
    }
  } catch (e) {}

  try {
    const r = await callAPI('toggle_favorite', {
      music_id: musicId,
      action: wasFav ? 'remove' : 'add'
    });

    if (!r || !r.success) {
      console.warn('⚠️ toggle_favorite falhou — revertendo state');
      if (wasFav) {
        state.favoriteMusicIds.push(sid);
      } else {
        state.favoriteMusicIds = state.favoriteMusicIds.filter(x => String(x) !== sid);
      }
      renderFavorites();
      showToast('Erro ao favoritar', 'error');
    } else {
      console.log('✅ [toggle_favorite] via API — state atualizado:', state.favoriteMusicIds.length, 'favoritos');
    }
  } catch (e) {
    console.error('❌ toggle_favorite erro:', e);
    if (wasFav) {
      state.favoriteMusicIds.push(sid);
    } else {
      state.favoriteMusicIds = state.favoriteMusicIds.filter(x => String(x) !== sid);
    }
    renderFavorites();
  }
};

// ============================================================
// 🆕 [RECOMMENDER v3] v9.8.0
//    Camadas:
//      1. SINAIS EXPLÍCITOS: follows, favoritos, buscas, eventos
//      2. SINAIS IMPLÍCITOS: reproduções, recência, skip
//      3. GERAÇÃO INFINITA: internos + YouTube (busca) + News
//    APIs públicas mantidas:
//      getRecommendations, invalidateRecommendations,
//      loadRecommendations, renderRecommendedRow
//    Novas:
//      getInfiniteRecommendations(page), trackSearch(q),
//      trackInteraction(t,id), injectNewsToMarketplace(),
//      fetchYouTubeRelated(videoId)
// ============================================================
(function () {
  'use strict';

  var REC_PAGE_SIZE = 8;
  var REC_CACHE_MS = 60000;
  var _recCache = { at: 0, page: 0, items: [] };
  var _seenIds = {};
  var _searchHistory = [];
  var _interactionLog = [];

  // 🆕 v9.6.0 — cache de YouTube de buscas
  var _ytCandidates = [];
  var YT_CACHE_MAX = 40;
  var YT_WEIGHT = 1.2;

  // 🆕 v9.8.0 — cache de News
  var _newsCandidates = [];
  var _newsArtistSeen = {};
  var NEWS_CACHE_MAX = 30;

  function _esc(s) {
    if (typeof escapeHtml === 'function') return escapeHtml(s);
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function _safeArr(v) { return Array.isArray(v) ? v : []; }

  function _playlistById(id) {
    return _safeArr(state.playlist).find(function (x) { return String(x.id) === String(id); });
  }

  // ----------------------------------------------------------
  // Helper: adicionar candidatos YouTube com dedup
  // ----------------------------------------------------------
  function _addYouTubeCandidates(items) {
    if (!Array.isArray(items)) return;
    items.forEach(function (yt) {
      if (!yt || !yt.id) return;
      var exists = _ytCandidates.some(function (c) { return c.id === yt.id; });
      if (exists) return;
      _ytCandidates.push(yt);
    });
    if (_ytCandidates.length > YT_CACHE_MAX) {
      _ytCandidates = _ytCandidates.slice(-YT_CACHE_MAX);
    }
    if (window.invalidateRecommendations) {
      try { window.invalidateRecommendations(); } catch (e) {}
    }
  }

  // ----------------------------------------------------------
  // Perfil
  // ----------------------------------------------------------
  function buildUserProfile() {
    var p = {
      artistas: {}, generos: {}, musicas: {},
      seedIds: [], searchTerms: []
    };

    _safeArr(state.followingArtists).forEach(function (a) {
      p.artistas[String(a)] = (p.artistas[String(a)] || 0) + 3;
    });

    _safeArr(state.favoriteMusicIds).forEach(function (id) {
      var sid = String(id);
      p.musicas[sid] = (p.musicas[sid] || 0) + 2;
      p.seedIds.push(sid);
      var m = _playlistById(sid);
      if (m) {
        if (m.artista) p.artistas[String(m.artista)] = (p.artistas[String(m.artista)] || 0) + 2;
        if (m.genero)  p.generos[String(m.genero)]   = (p.generos[String(m.genero)]   || 0) + 2;
      }
    });

    _searchHistory.slice(-15).forEach(function (q) {
      var ql = String(q || '').toLowerCase().trim();
      if (!ql) return;
      p.searchTerms.push(ql);
      _safeArr(state.playlist).forEach(function (t) {
        if (!t) return;
        if (t.artista && String(t.artista).toLowerCase().indexOf(ql) !== -1) {
          p.artistas[String(t.artista)] = (p.artistas[String(t.artista)] || 0) + 2.5;
        }
        if (t.genero && String(t.genero).toLowerCase().indexOf(ql) !== -1) {
          p.generos[String(t.genero)] = (p.generos[String(t.genero)] || 0) + 2.5;
        }
      });
    });

    _interactionLog.slice(-40).forEach(function (ev) {
      if (!ev || !ev.type) return;
      var w = ev.type === 'play' ? 1
            : ev.type === 'like' ? 3
            : ev.type === 'skip' ? -2.5
            : ev.type === 'discover_from_news' ? 2
            : 0.5;
      var t = ev.id ? _playlistById(ev.id) : null;
      if (t) {
        if (t.artista) p.artistas[String(t.artista)] = (p.artistas[String(t.artista)] || 0) + w;
        if (t.genero)  p.generos[String(t.genero)]   = (p.generos[String(t.genero)]   || 0) + w;
        if (ev.type === 'play') p.seedIds.push(String(t.id));
        if (ev.type === 'skip') p.musicas[String(t.id)] = (p.musicas[String(t.id)] || 0) - 1;
      }
    });

    var hist = _safeArr(state.userHistory || state.history || state.events);
    hist.slice(-50).forEach(function (ev) {
      if (!ev) return;
      var tipo = String(ev.event_type || ev.type || '');
      var w = (tipo === 'play' || tipo === 'stream') ? 1
            : (tipo === 'favorite' || tipo === 'follow') ? 2
            : (tipo === 'unfavorite' || tipo === 'unfollow') ? -1
            : (tipo === 'discover_from_news') ? 2
            : 0.5;
      if (ev.artist) p.artistas[String(ev.artist)] = (p.artistas[String(ev.artist)] || 0) + w;
      if (ev.genero) p.generos[String(ev.genero)]   = (p.generos[String(ev.genero)]   || 0) + w;
      if (ev.music_id) {
        var mid = String(ev.music_id);
        p.musicas[mid] = (p.musicas[mid] || 0) + w;
        if (tipo === 'play' || tipo === 'stream') p.seedIds.push(mid);
      }
    });

    try {
      var q = (typeof playQueue !== 'undefined' && playQueue && playQueue.items) ? playQueue.items : [];
      q.forEach(function (it) {
        if (it && it.type === 'internal' && it.index >= 0) {
          var m = _safeArr(state.playlist)[it.index];
          if (m && m.id) p.seedIds.push(String(m.id));
        }
      });
    } catch (e) {}

    p.seedIds = Array.from(new Set(p.seedIds)).slice(-40);
    p.searchTerms = Array.from(new Set(p.searchTerms)).slice(-15);
    return p;
  }

  // ----------------------------------------------------------
  // Score
  // ----------------------------------------------------------
  function scoreTrack(track, profile, page) {
    if (!track || !track.id) return -999;
    if (track.status === 'deleted') return -999;

    var sid = String(track.id);
    var score = 0;

    if (profile.musicas[sid]) score -= 6;
    if (_seenIds[sid]) score -= 4;

    if (track.artista && profile.artistas[String(track.artista)]) {
      score += profile.artistas[String(track.artista)] * 2.5;
    }

    if (track.genero && profile.generos[String(track.genero)]) {
      score += profile.generos[String(track.genero)] * 1.5;
    }

    if (profile.searchTerms.length) {
      var tituloLc = String(track.titulo || '').toLowerCase();
      var artistaLc = String(track.artista || '').toLowerCase();
      for (var i = 0; i < profile.searchTerms.length; i++) {
        var term = profile.searchTerms[i];
        if (tituloLc.indexOf(term) !== -1 || artistaLc.indexOf(term) !== -1) {
          score += 3;
          break;
        }
      }
    }

    if (typeof getEloMusica === 'function') {
      var eloInfo = getEloMusica(track.id);
      if (eloInfo && eloInfo.elo) score += (eloInfo.elo - 1000) / 200;
    }

    var streams = (state.streamsMap && state.streamsMap[sid]) || 0;
    if (streams > 0) score += Math.min(2.5, Math.log10(streams + 1));

    if (track.status === 'paused') score -= 3;

    if (page > 0) {
      score += Math.min(2, page * 0.3);
    }

    if (profile.seedIds.length === 0 && !Object.keys(profile.artistas).length && page === 0) {
      score += Math.min(3, (track.percentual_disponivel || 0) / 30);
    }

    // 🆕 v9.8.0 — boost temporal para News
    if (track._from_news) {
      var idadeMs = Date.now() - (track._news_ts || 0);
      var idadeHoras = idadeMs / 3600000;
      if (idadeHoras < 24) {
        score += 8;
      } else if (idadeHoras < 48) {
        score += 4;
      } else if (idadeHoras < 168) {
        score += 1;
      }
      if (track.artista && profile.artistas[String(track.artista)]) {
        score *= 1.5;
      }
    }

    return score;
  }

  // ----------------------------------------------------------
  // Geração de lote
  // ----------------------------------------------------------
  function computeRecommendations(limit, page) {
    limit = limit || REC_PAGE_SIZE;
    page = page || 0;
    var profile = buildUserProfile();
    var playlist = _safeArr(state.playlist).filter(function (t) {
      return t && t.id && t.status !== 'deleted';
    });

    var pool = playlist.slice();

    // YouTube de buscas
    _ytCandidates.forEach(function (yt) {
      if (!yt || !yt.id) return;
      var jaExiste = playlist.some(function (t) { return String(t.id) === String(yt.id); });
      if (jaExiste) return;
      pool.push({
        id: yt.id,
        titulo: yt.titulo,
        artista: yt.artista,
        genero: 'YouTube',
        link_capa: yt.link_capa,
        link_youtube: yt.link_youtube,
        is_youtube: true,
        _from_youtube: true,
        status: 'ativo',
        valor_acao: 0,
        percentual_disponivel: 0
      });
    });

    // 🆕 v9.8.0 — News
    _newsCandidates.forEach(function (nc) {
      if (!nc || !nc.id) return;
      var jaExiste = playlist.some(function (t) { return String(t.id) === String(nc.id); });
      if (jaExiste) return;
      var jaNoPool = pool.some(function (t) { return String(t.id) === String(nc.id); });
      if (jaNoPool) return;
      pool.push({
        id: nc.id,
        titulo: nc.titulo,
        artista: nc.artista,
        genero: 'News',
        link_capa: nc.link_capa,
        link_youtube: nc.link_youtube,
        is_youtube: true,
        _from_news: true,
        _news_source: nc._news_source,
        _news_title: nc._news_title,
        _news_ts: nc._news_ts,
        _news_link: nc._news_link,
        status: 'ativo',
        valor_acao: 0,
        percentual_disponivel: 0
      });
    });

    if (!pool.length) return [];

    var scored = pool.map(function (t) {
      var s = scoreTrack(t, profile, page);
      if (t._from_youtube) s *= YT_WEIGHT;
      return { track: t, score: s };
    }).filter(function (x) { return x.score > -2; });

    if (page > 0) {
      scored = scored.filter(function (x) { return !_seenIds[String(x.track.id)]; });
    }

    scored.sort(function (a, b) { return b.score - a.score; });

    var porArtista = {};
    var out = [];
    for (var i = 0; i < scored.length && out.length < limit; i++) {
      var t = scored[i].track;
      var a = String(t.artista || '');
      porArtista[a] = (porArtista[a] || 0) + 1;
      if (porArtista[a] > 2) continue;
      out.push(t);
    }

    if (out.length < limit) {
      var restantes = pool.filter(function (t) {
        return !out.some(function (o) { return String(o.id) === String(t.id); });
      });
      for (var j = restantes.length - 1; j > 0; j--) {
        var k = Math.floor(Math.random() * (j + 1));
        var tmp = restantes[j]; restantes[j] = restantes[k]; restantes[k] = tmp;
      }
      for (var r = 0; r < restantes.length && out.length < limit; r++) {
        out.push(restantes[r]);
      }
    }

    return out;
  }

  // ----------------------------------------------------------
  // APIs públicas
  // ----------------------------------------------------------
  window.getRecommendations = function (limit) {
    if (Date.now() - _recCache.at < REC_CACHE_MS && _recCache.items.length && !_recCache.page) {
      return _recCache.items.slice(0, limit || _recCache.items.length);
    }
    try {
      var items = computeRecommendations(limit || REC_PAGE_SIZE, 0);
      _recCache = { at: Date.now(), page: 0, items: items };
      items.forEach(function (t) { _seenIds[String(t.id)] = true; });
      return items;
    } catch (e) {
      console.warn('⚠️ [recommender] falha ao computar:', e && e.message);
      return [];
    }
  };

  window.getInfiniteRecommendations = function (page) {
    page = Math.max(0, parseInt(page) || 0);
    try {
      var items = computeRecommendations(REC_PAGE_SIZE, page);
      items.forEach(function (t) { _seenIds[String(t.id)] = true; });
      return items;
    } catch (e) {
      console.warn('⚠️ [recommender] infinite falhou:', e && e.message);
      return [];
    }
  };

  window.invalidateRecommendations = function () {
    _recCache = { at: 0, page: 0, items: [] };
  };

  // 🆕 v9.5.0 + v9.6.0 — busca alimenta _ytCandidates
  window.trackSearch = function (query) {
    var q = String(query || '').trim();
    if (!q) return;
    _searchHistory.push(q);
    if (_searchHistory.length > 30) _searchHistory.shift();
    window.invalidateRecommendations();

    try {
      if (typeof searchYouTubeDirect === 'function') {
        searchYouTubeDirect(q).then(function (results) {
          if (!Array.isArray(results) || !results.length) return;
          var items = results.map(function (r) {
            if (!r || !r.id) return null;
            var sid = String(r.id);
            if (sid.indexOf('yt_') !== 0) return null;
            return {
              id: sid,
              titulo: r.titulo || 'Vídeo do YouTube',
              artista: r.artista || 'YouTube',
              link_capa: r.link_capa || ('https://img.youtube.com/vi/' + sid.replace('yt_', '') + '/hqdefault.jpg'),
              link_youtube: r.link_youtube || ('https://www.youtube.com/watch?v=' + sid.replace('yt_', '')),
              is_youtube: true
            };
          }).filter(Boolean);
          _addYouTubeCandidates(items);
          console.log('🎯 [recommender] cache YT:', _ytCandidates.length, 'candidatos');
        }).catch(function () {});
      }
    } catch (e) {}
  };

  // 🆕 v9.5.0 — interações (play/like/skip/discover_from_news)
  window.trackInteraction = function (type, id) {
    if (!type) return;
    _interactionLog.push({ type: String(type), id: id ? String(id) : null, at: Date.now() });
    if (_interactionLog.length > 100) _interactionLog.shift();
    if (type === 'play' || type === 'like' || type === 'skip' || type === 'discover_from_news') {
      window.invalidateRecommendations();
    }
  };

  // 🆕 v9.8.0 — relacionados via YouTube (proxy backend)
  window.fetchYouTubeRelated = function (videoId) {
    if (!videoId || typeof videoId !== 'string') return;
    if (window._lastRelatedVideoId === videoId) return;
    window._lastRelatedVideoId = videoId;

    var cacheKey = 'yt_related_' + videoId;
    try {
      var cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        var arr = JSON.parse(cached);
        if (Array.isArray(arr) && arr.length) {
          _addYouTubeCandidates(arr);
          return;
        }
      }
    } catch (e) {}

    if (typeof callAPI !== 'function') return;
    callAPI('search_youtube_related', { video_id: videoId, limit: 10 })
      .then(function (r) {
        if (r && r.success && Array.isArray(r.data)) {
          var items = r.data.map(function (item) {
            var vid = item.id || (item.link_youtube ? String(item.link_youtube).split('v=')[1] : null);
            if (!vid) return null;
            return {
              id: 'yt_' + vid,
              titulo: item.titulo || item.title || 'Vídeo do YouTube',
              artista: item.artista || item.channelTitle || 'YouTube',
              link_capa: item.link_capa || ('https://img.youtube.com/vi/' + vid + '/hqdefault.jpg'),
              link_youtube: 'https://www.youtube.com/watch?v=' + vid,
              is_youtube: true
            };
          }).filter(Boolean);
          try { sessionStorage.setItem(cacheKey, JSON.stringify(items)); } catch (e) {}
          _addYouTubeCandidates(items);
          console.log('🎯 [recommender] relacionados YT:', items.length, 'para', videoId);
        }
      })
      .catch(function () {});
  };

  // 🆕 v9.8.0 — injeta artistas das notícias no marketplace
  window.injectNewsToMarketplace = function () {
        var news = [];
    if (window.state && Array.isArray(state.news)) news = state.news;
    else if (window.pmNewsData && Array.isArray(window.pmNewsData)) news = window.pmNewsData;
    else if (window.state && state.pmNewsData && Array.isArray(state.pmNewsData)) news = state.pmNewsData;
    else if (window.__pmNewsItems && Array.isArray(window.__pmNewsItems)) news = window.__pmNewsItems;

    if (!news.length) return;;

    var artistas = [];
    news.slice(0, 20).forEach(function (n) {
      if (!n || !n.titulo) return;
      var titulo = String(n.titulo);
      var m = titulo.match(/^([A-ZÀ-Ú][A-Za-zÀ-ú0-9\s&'.-]{2,40}?)(?:\s+(?:anuncia|lança|fala|revela|comenta|e\s|estreia|apresenta|divulga|libera|volta|surpreende|processa|critica|celebra))/);
      if (m && m[1]) {
        var artista = m[1].trim();
        if (artista.length >= 3 && !_newsArtistSeen[artista]) {
          _newsArtistSeen[artista] = true;
          artistas.push({ nome: artista, noticia: n });
        }
      }
    });

    console.log('📰 [marketplace] artistas detectados na news:', artistas.length);

    // Limita a 5 por ciclo para poupar cota
    artistas.slice(0, 5).forEach(function (a) {
      var jaNoCatalogo = (state.playlist || []).some(function (m) {
        return String(m.artista || '').toLowerCase() === a.nome.toLowerCase();
      });
      if (jaNoCatalogo) return;

      if (typeof searchYouTubeDirect !== 'function') return;
      searchYouTubeDirect(a.nome).then(function (results) {
        if (!Array.isArray(results) || !results.length) return;
        var top2 = results.slice(0, 2);
        top2.forEach(function (r) {
          if (!r || !r.id) return;
          var sid = String(r.id);
          if (sid.indexOf('yt_') !== 0) return;
          if (_newsCandidates.some(function (c) { return c.id === sid; })) return;
          _newsCandidates.push({
            id: sid,
            titulo: r.titulo || 'Música',
            artista: a.nome,
            link_capa: r.link_capa || ('https://img.youtube.com/vi/' + sid.replace('yt_', '') + '/hqdefault.jpg'),
            link_youtube: r.link_youtube || ('https://www.youtube.com/watch?v=' + sid.replace('yt_', '')),
            is_youtube: true,
            _from_news: true,
            _news_source: a.noticia.fonte || 'News',
            _news_title: a.noticia.titulo || '',
            _news_ts: a.noticia.timestamp ? new Date(a.noticia.timestamp).getTime() : Date.now(),
            _news_link: a.noticia.link || ''
          });
        });

        if (_newsCandidates.length > NEWS_CACHE_MAX) {
          _newsCandidates = _newsCandidates.slice(-NEWS_CACHE_MAX);
        }

        if (window.invalidateRecommendations) {
          try { window.invalidateRecommendations(); } catch (e) {}
        }
        console.log('📰 [marketplace] +' + top2.length + ' cards via News para', a.nome);
      }).catch(function () {});
    });
  };

  // ----------------------------------------------------------
  // Load + Render
  // ----------------------------------------------------------
  window.loadRecommendations = function () {
    try {
      window.invalidateRecommendations();
      _seenIds = {};
      window.getRecommendations(REC_PAGE_SIZE);
      if (typeof window.renderRecommendedRow === 'function') {
        window.renderRecommendedRow();
      }
    } catch (e) {
      console.warn('⚠️ [recommender] load:', e && e.message);
    }
  };

  var _currentPage = 0;

  window.renderRecommendedRow = function () {
    var c = document.getElementById('recommendedRow');
    if (!c) return;

    if (!c.getAttribute('data-rec-init')) {
      c.setAttribute('data-rec-init', '1');
      _currentPage = 0;
      var first = window.getInfiniteRecommendations(0);
      if (!first.length) { c.innerHTML = ''; return; }
      c.innerHTML = _buildCardsHtml(first) + _buildLoadMoreHtml();
      _bindLoadMore();
      console.log('🎯 [recommender] página 0:', first.length, 'itens');
      return;
    }

    console.log('🎯 [recommender] re-render mantido');
  };

  function _buildCardsHtml(items) {
    var playlist = _safeArr(state.playlist);
    return items.map(function (t) {
      // 🆕 v9.8.0 — card de News
      if (t && t._from_news) {
        var nCover = t.link_capa || PLACEHOLDERS.MIV_300;
        var nVid = String(t.id).replace('yt_', '');
        var nFonte = t._news_source || 'News';
        var nIdade = '';
        if (t._news_ts) {
          var h = Math.floor((Date.now() - t._news_ts) / 3600000);
          nIdade = h < 1 ? 'agora' : (h < 24 ? h + 'h' : Math.floor(h / 24) + 'd');
        }
        return '<div class="spotify-card" data-news="1">' +
          '<div class="spotify-cover">' +
            '<img src="' + nCover + '" loading="lazy" ' +
              'onerror="this.onerror=null;this.src=\'' + PLACEHOLDERS.MIV_300 + '\'">' +
            '<div class="play-overlay" ' +
              'onclick="playSearchResult(\'youtube\',\'' + nVid + '\'); if(window.trackInteraction){window.trackInteraction(\'play\',\'' + t.id + '\');window.trackInteraction(\'discover_from_news\',\'' + t.id + '\');}">' +
              '<i class="bi bi-play-fill"></i>' +
            '</div>' +
            '<div style="position:absolute;top:8px;left:8px;background:linear-gradient(135deg,#5AC8FA,#007AFF);' +
              'color:#fff;font-size:10px;font-weight:800;padding:3px 7px;border-radius:8px">📰 NOVO</div>' +
          '</div>' +
          '<h3 class="spotify-title">' + _esc(t.titulo || '') + '</h3>' +
          '<p class="spotify-artist">' + _esc(t.artista || '') + '</p>' +
          '<div class="spotify-stats">' +
            '<span class="spotify-elo" style="color:var(--apple-blue)">' + _esc(nFonte) + '</span>' +
            '<span class="spotify-price" style="font-size:11px">' + nIdade + '</span>' +
          '</div>' +
          (t._news_title
            ? '<div style="font-size:10px;color:var(--apple-label-2);margin-top:4px;' +
              'white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' +
              _esc(t._news_title) + '</div>'
            : '') +
        '</div>';
      }

      // YouTube puro (buscas)
      if (t && t.is_youtube) {
        var ytCover = t.link_capa ||
          ('https://img.youtube.com/vi/' + String(t.id).replace('yt_', '') + '/hqdefault.jpg');
        var ytVid = String(t.id).replace('yt_', '');
        return '<div class="spotify-card">' +
          '<div class="spotify-cover">' +
            '<img src="' + ytCover + '" loading="lazy" ' +
              'onerror="this.onerror=null;this.src=\'' + PLACEHOLDERS.MIV_300 + '\'">' +
            '<div class="play-overlay" ' +
              'onclick="playSearchResult(\'youtube\',\'' + ytVid + '\'); if(window.trackInteraction) window.trackInteraction(\'play\',\'' + t.id + '\')">' +
              '<i class="bi bi-play-fill"></i>' +
            '</div>' +
            '<div style="position:absolute;top:8px;left:8px;background:rgba(255,59,48,.9);color:#fff;' +
              'font-size:10px;font-weight:800;padding:3px 7px;border-radius:8px">▶ YT</div>' +
          '</div>' +
          '<h3 class="spotify-title">' + _esc(t.titulo || '') + '</h3>' +
          '<p class="spotify-artist">' + _esc(t.artista || '') + '</p>' +
          '<div class="spotify-stats">' +
            '<span class="spotify-elo" style="color:var(--apple-red)">YouTube</span>' +
            '<span class="spotify-price">▶</span>' +
          '</div>' +
        '</div>';
      }

      // Interna
      var idx = playlist.findIndex(function (x) { return String(x.id) === String(t.id); });
      if (idx < 0) return '';
      var cover = (typeof getCoverUrl === 'function') ? getCoverUrl(t, false) : '/images/logo.png';
      var eloInfo = (typeof getEloMusica === 'function') ? getEloMusica(t.id) : null;
      var streams = (state.streamsMap && state.streamsMap[String(t.id)]) || 0;

      return '<div class="spotify-card">' +
        '<div class="spotify-cover">' +
          '<img src="' + cover + '" loading="lazy" ' +
            'onerror="this.onerror=null;this.src=\'' + PLACEHOLDERS.MIV_300 + '\'">' +
          '<div class="play-overlay" onclick="playTrack(' + idx + '); if(window.trackInteraction) window.trackInteraction(\'play\',\'' + t.id + '\')">' +
            '<i class="bi bi-play-fill"></i>' +
          '</div>' +
          (eloInfo && eloInfo.elo >= 1400
            ? '<div style="position:absolute;top:8px;left:8px;background:' + eloInfo.cor +
              ';color:#000;font-size:10px;font-weight:800;padding:3px 7px;border-radius:8px">' +
              '⚡ ' + eloInfo.elo + '</div>'
            : '') +
        '</div>' +
        '<h3 class="spotify-title">' + _esc(t.titulo || '') + '</h3>' +
        '<p class="spotify-artist">' + _esc(t.artista || '') + '</p>' +
        '<div class="spotify-stats">' +
          '<span class="spotify-elo">' + (t.percentual_disponivel || 0) + '%</span>' +
          '<span class="spotify-price">' + formatCurrency(t.valor_acao || 0) + '</span>' +
        '</div>' +
        (streams > 0
          ? '<div style="font-size:11px;color:var(--apple-label-2);margin-top:4px">' +
            '<i class="bi bi-play-circle"></i> ' + formatNumber(streams) + ' streams</div>'
          : '') +
      '</div>';
    }).join('');
  }

  function _buildLoadMoreHtml() {
    return '<div style="grid-column:1/-1;text-align:center;padding:16px 0">' +
      '<button id="recLoadMoreBtn" class="btn btn-outline-success" style="border-radius:20px;padding:8px 24px">' +
        '<i class="bi bi-arrow-clockwise"></i> Carregar mais' +
      '</button>' +
    '</div>';
  }

  function _bindLoadMore() {
    var btn = document.getElementById('recLoadMoreBtn');
    if (!btn || btn.getAttribute('data-bound')) return;
    btn.setAttribute('data-bound', '1');
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Carregando...';
      _currentPage++;
      setTimeout(function () {
        var c = document.getElementById('recommendedRow');
        if (!c) return;
        var more = window.getInfiniteRecommendations(_currentPage);
        if (!more.length) {
          btn.innerHTML = 'Fim do catálogo';
          return;
        }
        var oldBtn = document.getElementById('recLoadMoreBtn');
        if (oldBtn && oldBtn.parentNode) oldBtn.parentNode.removeChild(oldBtn);
        c.insertAdjacentHTML('beforeend', _buildCardsHtml(more) + _buildLoadMoreHtml());
        _bindLoadMore();
        console.log('🎯 [recommender] página ' + _currentPage + ':', more.length, 'itens');
      }, 120);
    });
  }

  console.log('✅ [recommender v3] v9.8.0 carregado — infinito + engajamento + News + YouTube');
})();

// ============================================================
// LOG DE CARREGAMENTO
// ============================================================
console.log('✅ [marketplace.js] v9.8.0 carregado — RECOMMENDER v3 (News + YouTube + infinito) + filtro "Seguindo"');
