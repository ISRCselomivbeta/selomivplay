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
// FONTES RSS (com imagens reais garantidas quando possível)
// ------------------------------------------------------------
var NEWS_RSS_SOURCES = [
  // Google News (sem imagem — enriquecido via og:image)
  { url: 'https://news.google.com/rss/search?q=m%C3%BAsica+brasileira&hl=pt-BR&gl=BR&ceid=BR:pt-419', cat: 'musica', fonte: 'Google News' },
  { url: 'https://news.google.com/rss/search?q=lan%C3%A7amento+musical&hl=pt-BR&gl=BR&ceid=BR:pt-419', cat: 'lancamentos', fonte: 'Google News' },
  { url: 'https://news.google.com/rss/search?q=shows+turn%C3%AA+Brasil&hl=pt-BR&gl=BR&ceid=BR:pt-419', cat: 'shows', fonte: 'Google News' },
  { url: 'https://news.google.com/rss/search?q=ind%C3%BAstria+musical&hl=pt-BR&gl=BR&ceid=BR:pt-419', cat: 'negocios', fonte: 'Google News' },
  { url: 'https://news.google.com/rss/search?q=artista+m%C3%BAsica&hl=pt-BR&gl=BR&ceid=BR:pt-419', cat: 'artistas', fonte: 'Google News' },
  { url: 'https://news.google.com/rss/search?q=edital+cultural+m%C3%BAsica&hl=pt-BR&gl=BR&ceid=BR:pt-419', cat: 'editais', fonte: 'Google News' },

  // 🆕 Feeds que SEMPRE trazem imagem (enclosure / media:content)
  { url: 'https://g1.globo.com/rss/g1/pop-arte/musica/', cat: 'musica', fonte: 'G1' },
  { url: 'https://g1.globo.com/rss/g1/pop-arte/', cat: 'musica', fonte: 'G1' },
  { url: 'https://rss.uol.com.br/feed/musica.xml', cat: 'musica', fonte: 'UOL' },
  { url: 'https://rollingstone.uol.com.br/rss/', cat: 'musica', fonte: 'Rolling Stone' },
  { url: 'https://tenhomaisdiscosqueamigos.com/feed/', cat: 'musica', fonte: 'Tenho Mais Discos' },
  { url: 'https://www.omelete.com.br/feed', cat: 'musica', fonte: 'Omelete' },
  { url: 'https://www.papelpop.com/feed/', cat: 'musica', fonte: 'Papelpop' },
  { url: 'https://portalpopline.com.br/feed/', cat: 'musica', fonte: 'Popline' }
];

var NEWS_PROXIES = [
  function (u) { return 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u); },
  function (u) { return 'https://corsproxy.io/?' + encodeURIComponent(u); },
  function (u) { return 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(u); }
];

var NEWS_PLACEHOLDER_META = {
  musica:      { emoji: '🎵', cor1: '#ff2d55', cor2: '#ff6b35' },
  lancamentos: { emoji: '🚀', cor1: '#5ac8fa', cor2: '#007aff' },
  shows:       { emoji: '🎤', cor1: '#af52de', cor2: '#5856d6' },
  negocios:    { emoji: '💰', cor1: '#34c759', cor2: '#00c7be' },
  artistas:    { emoji: '⭐', cor1: '#ffcc00', cor2: '#ff9500' },
  editais:     { emoji: '📜', cor1: '#8e8e93', cor2: '#48484a' }
};

// ------------------------------------------------------------
// HELPERS DE IMAGEM
// ------------------------------------------------------------
function newsGerarPlaceholder(cat) {
  var meta = NEWS_PLACEHOLDER_META[cat] || NEWS_PLACEHOLDER_META.musica;
  var svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
        '<stop offset="0%" stop-color="' + meta.cor1 + '"/>' +
        '<stop offset="100%" stop-color="' + meta.cor2 + '"/>' +
      '</linearGradient></defs>' +
      '<rect width="400" height="300" fill="url(#g)"/>' +
      '<text x="200" y="175" font-size="90" text-anchor="middle" fill="rgba(255,255,255,0.95)">' + meta.emoji + '</text>' +
    '</svg>';
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

function newsHashStr(s) {
  var h = 0;
  for (var i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h = h & h;
  }
  return Math.abs(h).toString(36);
}

function newsToGoogleNewsLink(titulo, linkOriginal) {
  if (linkOriginal && linkOriginal.indexOf('news.google.com') !== -1) {
    return linkOriginal;
  }
  var query = encodeURIComponent((titulo || '').substring(0, 100));
  return 'https://news.google.com/search?q=' + query + '&hl=pt-BR&gl=BR&ceid=BR:pt-419';
}

// ------------------------------------------------------------
// FETCH COM PROXY (tenta cada um até um funcionar)
// ------------------------------------------------------------
function newsFetchWithProxy(url, timeoutMs) {
  timeoutMs = timeoutMs || 8000;
  return new Promise(function (resolve) {
    var idx = 0;
    function tryNext() {
      if (idx >= NEWS_PROXIES.length) { resolve(null); return; }
      var proxyUrl = NEWS_PROXIES[idx](url);
      idx++;
      var ctrl = new AbortController();
      var timer = setTimeout(function () { ctrl.abort(); }, timeoutMs);

      fetch(proxyUrl, { signal: ctrl.signal })
        .then(function (r) { clearTimeout(timer); if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
        .then(function (text) {
          if (text && text.indexOf('<item>') !== -1) resolve(text);
          else tryNext();
        })
        .catch(function () { clearTimeout(timer); tryNext(); });
    }
    tryNext();
  });
}

// ------------------------------------------------------------
// PARSE RSS (extração agressiva de imagem — 8 formatos)
// ------------------------------------------------------------
function newsParseRSS(xml, cat, fonte) {
  var items = [];
  var re = /<item>([\s\S]*?)<\/item>/g;
  var m, count = 0;
  while ((m = re.exec(xml)) !== null && count < 12) {
    var x = m[1];
    var t = x.match(/<title>(.*?)<\/title>/);
    var l = x.match(/<link>(.*?)<\/link>/);
    var d = x.match(/<pubDate>(.*?)<\/pubDate>/);
    var s = x.match(/<source[^>]*>(.*?)<\/source>/);
    var ds = x.match(/<description>(.*?)<\/description>/);
    var ce = x.match(/<content:encoded>([\s\S]*?)<\/content:encoded>/);
    if (!t) continue;

    var title = t[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim();
    var src = s ? s[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : fonte;
    if (src && title.endsWith(' - ' + src)) title = title.slice(0, -(src.length + 3));

    var texto = '';
    if (ds) {
      texto = ds[1].replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, '').trim().substring(0, 220);
      if (texto) texto += '...';
    }

    // 🔥 Extração agressiva de imagem
    var imagemReal = null;
    var candidates = [
      x.match(/<enclosure[^>]*url=["']([^"']+)["']/i),
      x.match(/<media:content[^>]*url=["']([^"']+)["']/i),
      x.match(/<media:thumbnail[^>]*url=["']([^"']+)["']/i),
      x.match(/<media:group>[\s\S]*?<media:content[^>]*url=["']([^"']+)["']/i),
      x.match(/<img[^>]*src=["']([^"']+)["']/i),
      (ce && ce[1] && ce[1].match(/<img[^>]*src=["']([^"']+)["']/i)),
      (ds && ds[1] && ds[1].match(/<img[^>]*src=["']([^"']+)["']/i)),
      (ce && ce[1] && ce[1].match(/property=["']og:image["'][^>]*content=["']([^"']+)["']/i))
    ];
    for (var k = 0; k < candidates.length; k++) {
      if (candidates[k] && candidates[k][1]) {
        var url = candidates[k][1];
        if (url && url.indexOf('http') === 0 &&
            url.indexOf('feedburner') === -1 &&
            url.indexOf('pixel') === -1 &&
            !/\.(gif|svg)$/i.test(url.split('?')[0])) {
          imagemReal = url;
          break;
        }
      }
    }

    var linkOriginal = l ? l[1].trim() : '#';

    items.push({
      id: 'news_' + newsHashStr(title),
      categoria: cat,
      fonte: src || fonte,
      autor: src || fonte,
      fonte_logo: null,
      titulo: title,
      texto: texto || 'Clique para ler a notícia completa.',
      imagem: imagemReal || newsGerarPlaceholder(cat),
      link: newsToGoogleNewsLink(title, linkOriginal),
      timestamp: d ? new Date(d[1]).toISOString() : new Date().toISOString(),
      tema: cat,
      prazo: null,
      investidores_hoje: 0,
      em_alta: false,
      _linkOriginal: linkOriginal
    });
    count++;
  }
  return items;
}

// ------------------------------------------------------------
// ENRIQUECER COM og:image (para notícias sem imagem)
// ------------------------------------------------------------
function newsEnrichWithOgImage(items) {
  var semImagem = items.filter(function (n) {
    return n.imagem && n.imagem.indexOf('data:image/svg') === 0 && n._linkOriginal && n._linkOriginal !== '#';
  }).slice(0, 8);

  if (!semImagem.length) return Promise.resolve(items);

  var promises = semImagem.map(function (n) {
    return new Promise(function (resolve) {
      var ctrl = new AbortController();
      var timer = setTimeout(function () { ctrl.abort(); }, 6000);
      var proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(n._linkOriginal);
      fetch(proxyUrl, { signal: ctrl.signal })
        .then(function (r) { clearTimeout(timer); return r.text(); })
        .then(function (html) {
          var m = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                  html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i) ||
                  html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i);
          if (m && m[1] && m[1].indexOf('http') === 0) {
            n.imagem = m[1];
          }
          resolve(n);
        })
        .catch(function () { clearTimeout(timer); resolve(n); });
    });
  });

  return Promise.all(promises).then(function () { return items; });
}

// ------------------------------------------------------------
// BUSCAR RSS COMPLETO
// ------------------------------------------------------------
function newsFetchAllRSS() {
  console.log('[news] 🔄 buscando RSS...');

  var promises = NEWS_RSS_SOURCES.map(function (s) {
    return newsFetchWithProxy(s.url, 8000).then(function (xml) {
      return xml ? newsParseRSS(xml, s.cat, s.fonte) : [];
    });
  });

  return Promise.all(promises).then(function (results) {
    var all = [];
    for (var i = 0; i < results.length; i++) {
      all = all.concat(results[i]);
    }

    var seenT = {};
    var unique = all.filter(function (n) {
      var k = n.titulo.toLowerCase().substring(0, 60);
      if (seenT[k]) return false;
      seenT[k] = true;
      return true;
    });

    unique.sort(function (a, b) {
      return new Date(b.timestamp) - new Date(a.timestamp);
    });

    console.log('[news] ✅ RSS OK: ' + unique.length + ' notícias (enriquecendo og:image...)');
    return newsEnrichWithOgImage(unique);
  });
}

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
// CARREGAR FEED (backend primeiro, RSS fallback)
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
    // 1️⃣ Tenta backend primeiro
    var news = [];
    var hasMore = true;

    try {
      const r = await callAPI('get_news', {
        page: state.news.page,
        limit: NEWS_PAGE_SIZE,
        preferences: Object.keys(state.news.preferences || {}).join(','),
        seen_ids: state.news.seenIds.join(','),
        user_id: (state.currentUser && state.currentUser.id) || ''
      });

      if (r && r.success && Array.isArray(r.data) && r.data.length) {
        news = r.data;
        hasMore = (r.has_more !== false);
        console.log('[news] ✅ backend OK: ' + news.length);
      }
    } catch (e) {
      console.log('[news] ⚠️ backend falhou, usando RSS');
    }

    // 2️⃣ Fallback: RSS (só na primeira página)
    if (!news.length && state.news.page === 1) {
      var rssItems = await newsFetchAllRSS();

      // Aplica filtro de já visto
      rssItems = rssItems.filter(function (n) {
        return state.news.seenIds.indexOf(n.id) === -1;
      });

      // Pagina localmente
      news = rssItems.slice(0, NEWS_PAGE_SIZE);
      hasMore = rssItems.length > NEWS_PAGE_SIZE;

      // Guarda o restante pra próximas páginas
      state.news._rssPool = rssItems.slice(NEWS_PAGE_SIZE);
    } else if (!news.length && state.news._rssPool && state.news._rssPool.length) {
      // Continua paginando o pool de RSS
      news = state.news._rssPool.slice(0, NEWS_PAGE_SIZE);
      state.news._rssPool = state.news._rssPool.slice(NEWS_PAGE_SIZE);
      hasMore = state.news._rssPool.length > 0;
    }

    // Remove loading
    if (state.news.page === 1) {
      c.innerHTML = '';
    } else {
      var l = document.getElementById('newsLoadingMore');
      if (l) l.remove();
    }

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
    state.news.hasMore = hasMore;

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
// RENDERIZAR CARD (com imagem real + fallback SVG)
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

  var fallback = newsGerarPlaceholder(n.categoria);
  var imgUrl = n.imagem || fallback;

  var img = '<img src="' + imgUrl + '" class="news-image" loading="lazy" ' +
            'onerror="this.onerror=null;this.src=\'' + fallback + '\'">';

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
console.log('✅ [news.js] v9.0.0 carregado — feed infinito pronto com imagens reais');
