// ============================================================
// js/news.js — PLAY MY v8.5.0
// Feed de notícias: carregamento, filtros, renderização.
// Depende de: config.js, utils.js, state.js, api.js
// DEVE carregar DEPOIS de blockchain.js e ANTES de modals.js.
// ============================================================

// ============================================================
// CARREGAR FEED DE NOTÍCIAS
// ============================================================
window.loadNewsFeed = async function (force) {
  const c = document.getElementById('newsFeed');
  if (!c) return;

  // Estado de loading
  c.innerHTML =
    '<div class="text-center p-4">' +
      '<div class="spinner-border text-warning"></div>' +
      '<p class="text-muted mt-2">Carregando notícias...</p>' +
    '</div>';

  try {
    const r = await callAPI('get_news', { limit: 50 });

    if (r && r.success && r.data && r.data.length) {
      let news = r.data;

      // Filtra por categoria se necessário
      if (state.news.filter !== 'all') {
        news = news.filter(n => n.categoria === state.news.filter);
      }

      if (!news.length) {
        c.innerHTML =
          '<div class="empty-state-actionable">' +
            '<i class="bi bi-newspaper empty-icon"></i>' +
            '<h5 class="text-muted">Nenhuma notícia nesta categoria</h5>' +
          '</div>';
        return;
      }

      // Renderiza cards
      c.innerHTML = news.map(n => {
        const catClass = 'news-cat-' + (n.categoria || 'musica');
        const catLabel = {
          musica:   '🎵 Música',
          shows:    '🎤 Shows',
          negocios: '💰 Negócios',
          artistas: '⭐ Artistas'
        }[n.categoria] || '📰';

        return '<div class="news-card">' +
          '<div class="news-header">' +
            '<img src="/images/logo.png" class="news-avatar" onerror="this.style.display=\'none\'">' +
            '<div class="news-author-info">' +
              '<div class="news-author">' + (n.autor || n.fonte || 'PLAY MY') + '</div>' +
              '<div class="news-time">' + formatRelativeTime(n.timestamp) + '</div>' +
            '</div>' +
            '<span class="news-category ' + catClass + '">' + catLabel + '</span>' +
          '</div>' +
          '<div class="news-body">' +
            '<div class="news-title">' + (n.titulo || '') + '</div>' +
            '<div class="news-text">' + (n.texto || '') + '</div>' +
          '</div>' +
          '<div class="news-actions">' +
            '<a class="news-action-btn" href="' + (n.link || '#') + '" target="_blank" rel="noopener">' +
              '<i class="bi bi-box-arrow-up-right"></i> Ler mais' +
            '</a>' +
          '</div>' +
        '</div>';
      }).join('');
    } else {
      c.innerHTML =
        '<div class="empty-state-actionable">' +
          '<i class="bi bi-newspaper empty-icon"></i>' +
          '<h5 class="text-muted">Nenhuma notícia disponível</h5>' +
        '</div>';
    }
  } catch (e) {
    console.error('Erro ao carregar notícias:', e);
    c.innerHTML =
      '<div class="text-center p-4 text-muted">Erro ao carregar notícias</div>';
  }
};

// ============================================================
// FILTRAR NOTÍCIAS POR CATEGORIA
// ============================================================
window.filterNews = function (cat, btn) {
  state.news.filter = cat;

  // Atualiza botões visuais
  document.querySelectorAll('#newsFilters .btn').forEach(b => {
    b.classList.remove('btn-warning');
    b.classList.add('btn-outline-warning');
  });

  if (btn) {
    btn.classList.remove('btn-outline-warning');
    btn.classList.add('btn-warning');
  }

  // Recarrega feed
  loadNewsFeed(true);
};

// ============================================================
// LOG DE CARREGAMENTO
// ============================================================
console.log('✅ [news.js] carregado — feed de notícias pronto');
