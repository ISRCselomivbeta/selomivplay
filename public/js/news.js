// ============================================================
// js/news.js — PLAY MY v9.0.0
// Feed infinito de notícias musicais com personalização.
// Depende de: config.js, utils.js, state.js, api.js
// DEVE carregar DEPOIS de blockchain.js e ANTES de modals.js.
// ============================================================

// ------------------------------------------------------------
// CONSTANTES
// ------------------------------------------------------------
var NEWS_PAGE_SIZE = 10;
var NEWS_SEEN_KEY = 'pm_news_seen';
var NEWS_SEEN_DATE_KEY = 'pm_news_seen_date';
var NEWS_PREFS_KEY = 'pm_news_prefs';

// ------------------------------------------------------------
// RESET DIÁRIO DO "JÁ VISTO"
// ------------------------------------------------------------
window.newsResetDailySeen = function () {
  var today = new Date().toISOString().slice(0, 10);
  var savedDate = localStorage.getItem(NEWS_SEEN_DATE_KEY);

  if (savedDate !== today) {
    localStorage.setItem(NEWS_SEEN_KEY, '[]');
    localStorage.setItem(NEWS_SEEN_DATE_KEY, today);
    state.news.seenIds = [];
    state.news.seenDate = today;
    console.log('[news] reset diário do "já visto"');
  } else {
    try {
      state.news.seenIds = JSON.parse(localStorage.getItem(NEWS_SEEN_KEY) || '[]');
    } catch (e) {
      state.news.seenIds = [];
    }
    state.news.seenDate = today;
  }
};

// ------------------------------------------------------------
// CARREGAR PREFERÊNCIAS SALVAS
// ------------------------------------------------------------
window.newsLoadPreferences = function () {
  try {
    state.news.preferences = JSON.parse(localStorage.getItem(NEWS_PREFS_KEY) || '{}');
  } catch (e) {
    state.news.preferences = {};
  }
};

// ------------------------------------------------------------
// CARREGAR FEED (primeira página ou forçar reload)
// ------------------------------------------------------------
window.loadNewsFeed = async function (force) {
  const c = document.getElementById('newsFeed');
  if (!c) return;

  newsResetDailySeen();
  newsLoadPreferences();

  if (force) {
    state.news.page = 1;
    state.news.hasMore = true;
    state.news.items = [];
    c.innerHTML = '';
  }

  if (state.news.loading || !state.news.hasMore) return;
  state.news.loading = true;

  // Loading só na primeira página
  if (state.news.page === 1) {
    c.innerHTML =
      '<div class="text-center p-4">' +
        '<div class="spinner-border text-warning"></div>' +
        '<p class="text-muted mt-2">Carregando notícias...</p>' +
      '</div>';
  } else {
    c.insertAdjacentHTML('beforeend',
      '<div class="text-center p-3" id="newsLoadingMore">' +
        '<div class="spinner-border spinner-border-sm text-warning"></div>' +
      '</div>'
    );
  }

  try {
    const r = await callAPI('get_news', {
      page: state.news.page,
      limit: NEWS_PAGE_SIZE,
      preferences: Object.keys(state.news.preferences || {}).join(','),
      seen_ids: state.news.seenIds.join(','),
      user_id: (state.currentUser && state.currentUser.id) || ''
    });

    // Remove loading
    if (state.news.page === 1) {
      c.innerHTML = '';
    } else {
      var l = document.getElementById('newsLoadingMore');
      if (l) l.remove();
    }

    var news = (r && r.success && r.data) ? r.data : [];

    // Filtra duplicadas e já vistas
    news = news.filter(function (n) {
      return n && n.id && state.news.seenIds.indexOf(n.id) === -1;
    });

    // Filtro de categoria
    if (state.news.filter !== 'all') {
      news = news.filter(function (n) { return n.categoria === state.news.filter; });
    }

    if (!news.length) {
      state.news.hasMore = false;
      if (state.news.page === 1) {
        c.innerHTML =
          '<div class="empty-state-actionable">' +
            '<i class="bi bi-newspaper empty-icon"></i>' +
            '<h5 class="text-muted">Nenhuma notícia disponível</h5>' +
          '</div>';
      }
      return;
    }

    // Renderiza
    var html = '';
    for (var i = 0; i < news.length; i++) {
      html += renderNewsCard(news[i]);
      state.news.seenIds.push(news[i].id);
      state.news.items.push(news[i]);
    }
    c.insertAdjacentHTML('beforeend', html);

    // Persiste
    localStorage.setItem(NEWS_SEEN_KEY, JSON.stringify(state.news.seenIds));

    state.news.page++;
    state.news.hasMore = (r && r.has_more !== false);

    // Avisa backend (silencioso)
    if (news.length && state.currentUser && state.currentUser.id) {
      callAPI('mark_news_seen', {
        news_ids: news.map(function (n) { return n.id; }).join(','),
        data: new Date().toISOString().slice(0, 10)
      }).catch(function () {});
    }

  } catch (e) {
    console.error('[news] erro ao carregar:', e);
    if (state.news.page === 1) {
      c.innerHTML = '<div class="text-center p-4 text-muted">Erro ao carregar notícias</div>';
    } else {
      var lm = document.getElementById('newsLoadingMore');
      if (lm) lm.remove();
    }
  } finally {
    state.news.loading = false;
  }
};

// ------------------------------------------------------------
// CARREGAR MAIS (scroll infinito)
// ------------------------------------------------------------
window.loadMoreNews = function () {
  if (state.news.loading || !state.news.hasMore) return;
  loadNewsFeed(false);
};

// ------------------------------------------------------------
// RENDERIZAR CARD
// ------------------------------------------------------------
window.renderNewsCard = function (n) {
  var catLabel = {
    musica:      '🎵 Música',
    lancamentos: '🚀 Lançamento',
    shows:       '🎤 Shows',
    negocios:    '💰 Negócios',
    artistas:    '⭐ Artistas',
    editais:     '📜 Edital'
  }[n.categoria] || '📰';

  var img = n.imagem
    ? '<img src="' + n.imagem + '" class="news-image" loading="lazy" onerror="this.style.display=\'none\'">'
    : '';

  var fonteLogo = n.fonte_logo
    ? '<img src="' + n.fonte_logo + '" class="news-fonte-logo" onerror="this.style.display=\'none\'">'
    : '<i class="bi bi-newspaper news-fonte-icon"></i>';

  var prazo = n.prazo
    ? '<span class="news-prazo"><i class="bi bi-clock"></i> Fecha em ' + n.prazo + '</span>'
    : '';

  var social = n.investidores_hoje
    ? '<span class="news-social"><i class="bi bi-fire"></i> ' + n.investidores_hoje + ' investiram hoje</span>'
    : '';

  var emAlta = n.em_alta
    ? '<span class="news-em-alta">🔥 Em alta</span>'
    : '';

  var titulo = (n.titulo || '').replace(/'/g, '&#39;');
  var tema = (n.tema || '').replace(/'/g, '&#39;');
  var cat = (n.categoria || '').replace(/'/g, '&#39;');

  return '' +
    '<article class="news-card" data-id="' + n.id + '" data-tema="' + tema + '">' +
      '<div class="news-header">' +
        fonteLogo +
        '<div class="news-author-info">' +
          '<div class="news-author">' + (n.fonte || n.autor || 'PLAY MY') + '</div>' +
          '<div class="news-time">' + formatRelativeTime(n.timestamp) + '</div>' +
        '</div>' +
        '<span class="news-category">' + catLabel + '</span>' +
      '</div>' +

      img +

      '<div class="news-body">' +
        '<div class="news-title">' + (n.titulo || '') + '</div>' +
        '<div class="news-text">' + (n.texto || '') + '</div>' +
        prazo + social + emAlta +
      '</div>' +

      '<div class="news-actions">' +
        '<a class="news-action-btn" href="' + (n.link || '#') + '" target="_blank" rel="noopener" ' +
          'onclick="trackNewsInteraction(' + n.id + ', \'click\', \'' + tema + '\', \'' + cat + '\')">' +
          '<i class="bi bi-box-arrow-up-right"></i> Ler mais' +
        '</a>' +
        '<button class="news-action-btn" onclick="trackNewsInteraction(' + n.id + ', \'save\', \'' + tema + '\', \'' + cat + '\')">' +
          '<i class="bi bi-star"></i> Salvar' +
        '</button>' +
        '<button class="news-action-btn news-action-invest" onclick="trackNewsInteraction(' + n.id + ', \'invest\', \'' + tema + '\', \'' + cat + '\')">' +
          '<i class="bi bi-cash-coin"></i> Investir' +
        '</button>' +
      '</div>' +
    '</article>';
};

// ------------------------------------------------------------
// REGISTRAR INTERAÇÃO (personalização)
// ------------------------------------------------------------
window.trackNewsInteraction = function (newsId, tipo, tema, categoria) {
  var prefs = state.news.preferences || {};
  if (tema) prefs[tema] = (prefs[tema] || 0) + 1;
  if (categoria) prefs[categoria] = (prefs[categoria] || 0) + 1;
  state.news.preferences = prefs;
  localStorage.setItem(NEWS_PREFS_KEY, JSON.stringify(prefs));

  if (typeof showToast === 'function') {
    var msgs = {
      click:  '👀 Interesse registrado',
      save:   '⭐ Salvo! Vamos te mostrar mais assim',
      invest: '💰 Boa! Mais lançamentos vindo'
    };
    showToast(msgs[tipo] || 'Interação registrada', 'success', 2000);
  }

  if (state.currentUser && state.currentUser.id) {
    callAPI('track_news_interaction', {
      news_id: newsId,
      tipo: tipo,
      tema: tema,
      categoria: categoria
    }).catch(function () {});
  }
};

// ------------------------------------------------------------
// FILTRAR NOTÍCIAS
// ------------------------------------------------------------
window.filterNews = function (cat, btn) {
  state.news.filter = cat;

  document.querySelectorAll('#newsFilters .btn').forEach(function (b) {
    b.classList.remove('btn-warning');
    b.classList.add('btn-outline-warning');
  });
  if (btn) {
    btn.classList.remove('btn-outline-warning');
    btn.classList.add('btn-warning');
  }

  loadNewsFeed(true);
};

// ------------------------------------------------------------
// SCROLL INFINITO
// ------------------------------------------------------------
window.initNewsInfiniteScroll = function () {
  var sentinel = document.getElementById('newsSentinel');
  if (!sentinel) return;

  if (window.__newsObserver) {
    window.__newsObserver.disconnect();
  }

  window.__newsObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        loadMoreNews();
      }
    });
  }, { rootMargin: '400px' });

  window.__newsObserver.observe(sentinel);
};

// ------------------------------------------------------------
// LOG
// ------------------------------------------------------------
console.log('✅ [news.js] v9.0.0 carregado — feed infinito pronto');
