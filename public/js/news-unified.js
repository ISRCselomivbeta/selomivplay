// ============================================================
// js/news-unified.js — PLAY MY v10.1.0
// Feed de notícias unificado: backend + fallback RSS direto
// + imagens reais (RSS) + SVG fallback (inline)
// + link sempre para Google News
// ============================================================

(function () {
  'use strict';

  // ============================================================
  // CONFIGURAÇÃO
  // ============================================================
  var BACKEND_URL = '/api/backend';
  var PAGE_SIZE = 8;
  var CACHE_KEY = 'pm_news_cache_v10';
  var SEEN_KEY = 'pm_news_seen_v10';
  var SEEN_DATE_KEY = 'pm_news_seen_date_v10';
  var CACHE_TTL = 10 * 60 * 1000; // 10 min

  // Fontes RSS reais (fallback se backend falhar)
  var RSS_SOURCES = [
    { url: 'https://news.google.com/rss/search?q=m%C3%BAsica+brasileira&hl=pt-BR&gl=BR&ceid=BR:pt-419', cat: 'musica', fonte: 'Google News' },
    { url: 'https://news.google.com/rss/search?q=lan%C3%A7amento+musical&hl=pt-BR&gl=BR&ceid=BR:pt-419', cat: 'lancamentos', fonte: 'Google News' },
    { url: 'https://news.google.com/rss/search?q=shows+turn%C3%AA+Brasil&hl=pt-BR&gl=BR&ceid=BR:pt-419', cat: 'shows', fonte: 'Google News' },
    { url: 'https://news.google.com/rss/search?q=ind%C3%BAstria+musical&hl=pt-BR&gl=BR&ceid=BR:pt-419', cat: 'negocios', fonte: 'Google News' },
    { url: 'https://news.google.com/rss/search?q=artista+m%C3%BAsica&hl=pt-BR&gl=BR&ceid=BR:pt-419', cat: 'artistas', fonte: 'Google News' },
    { url: 'https://news.google.com/rss/search?q=edital+cultural+m%C3%BAsica&hl=pt-BR&gl=BR&ceid=BR:pt-419', cat: 'editais', fonte: 'Google News' },
    { url: 'https://g1.globo.com/rss/g1/pop-arte/musica/', cat: 'musica', fonte: 'G1' },
    { url: 'https://rss.uol.com.br/feed/musica.xml', cat: 'musica', fonte: 'UOL' },
    { url: 'https://rollingstone.uol.com.br/rss/', cat: 'musica', fonte: 'Rolling Stone' },
    { url: 'https://tenhomaisdiscosqueamigos.com/feed/', cat: 'musica', fonte: 'Tenho Mais Discos' }
  ];

  // Proxies CORS em cascata
  var PROXIES = [
    function (u) { return 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u); },
    function (u) { return 'https://corsproxy.io/?' + encodeURIComponent(u); },
    function (u) { return 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(u); }
  ];

  // ============================================================
  // PLACEHOLDERS SVG INLINE (sem dependência externa)
  // ============================================================
  var PLACEHOLDER_META = {
    musica:      { emoji: '🎵', cor1: '#ff2d55', cor2: '#ff6b35' },
    lancamentos: { emoji: '🚀', cor1: '#5ac8fa', cor2: '#007aff' },
    shows:       { emoji: '🎤', cor1: '#af52de', cor2: '#5856d6' },
    negocios:    { emoji: '💰', cor1: '#34c759', cor2: '#00c7be' },
    artistas:    { emoji: '⭐', cor1: '#ffcc00', cor2: '#ff9500' },
    editais:     { emoji: '📜', cor1: '#8e8e93', cor2: '#48484a' }
  };

  function gerarPlaceholder(cat) {
    var meta = PLACEHOLDER_META[cat] || PLACEHOLDER_META.musica;
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300">' +
        '<defs>' +
          '<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
            '<stop offset="0%" stop-color="' + meta.cor1 + '"/>' +
            '<stop offset="100%" stop-color="' + meta.cor2 + '"/>' +
          '</linearGradient>' +
        '</defs>' +
        '<rect width="400" height="300" fill="url(#g)"/>' +
        '<text x="200" y="175" font-size="90" text-anchor="middle" fill="rgba(255,255,255,0.95)">' + meta.emoji + '</text>' +
      '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  // ============================================================
  // FORÇA O LINK A SER DO GOOGLE NEWS
  // ============================================================
  function toGoogleNewsLink(titulo, linkOriginal) {
    // Se já é do Google News, mantém
    if (linkOriginal && linkOriginal.indexOf('news.google.com') !== -1) {
      return linkOriginal;
    }
    // Caso contrário, cria busca do Google News
    var query = encodeURIComponent((titulo || '').substring(0, 100));
    return 'https://news.google.com/search?q=' + query + '&hl=pt-BR&gl=BR&ceid=BR:pt-419';
  }

  // ============================================================
  // ESTADO
  // ============================================================
  var state = {
    items: [],
    seen: {},
    filter: 'all',
    page: 1,
    loading: false,
    hasMore: true,
    source: null
  };

  // ============================================================
  // RESET DIÁRIO
  // ============================================================
  function resetDailySeen() {
    try {
      var today = new Date().toISOString().slice(0, 10);
      var saved = localStorage.getItem(SEEN_DATE_KEY);
      if (saved !== today) {
        localStorage.setItem(SEEN_KEY, '{}');
        localStorage.setItem(SEEN_DATE_KEY, today);
        state.seen = {};
      } else {
        state.seen = JSON.parse(localStorage.getItem(SEEN_KEY) || '{}');
      }
    } catch (e) {
      state.seen = {};
    }
  }

  function saveSeen() {
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(state.seen)); } catch (e) {}
  }

  function loadCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (!obj || !obj.ts || !obj.items) return null;
      if (Date.now() - obj.ts > CACHE_TTL) return null;
      return obj.items;
    } catch (e) { return null; }
  }

  function saveCache(items) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), items: items })); } catch (e) {}
  }

  // ============================================================
  // FONTE 1 — BACKEND
  // ============================================================
  function tryBackend() {
    return new Promise(function (resolve) {
      var ctrl = new AbortController();
      var timer = setTimeout(function () { ctrl.abort(); }, 8000);

      var url = BACKEND_URL + '?action=get_news&page=1&limit=50&user_id=anon';

      fetch(url, { signal: ctrl.signal })
        .then(function (r) { clearTimeout(timer); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function (json) {
          if (json && json.success && Array.isArray(json.data) && json.data.length > 0) {
            console.log('[news] ✅ backend OK: ' + json.data.length + ' notícias');
            state.source = 'backend';
            resolve(json.data);
          } else {
            console.log('[news] ⚠️ backend vazio, usando RSS direto');
            resolve(null);
          }
        })
        .catch(function (e) {
          clearTimeout(timer);
          console.log('[news] ⚠️ backend falhou:', e.message);
          resolve(null);
        });
    });
  }

  // ============================================================
  // FONTE 2 — RSS DIRETO (fallback)
  // ============================================================
  function fetchWithProxy(url, timeoutMs) {
    timeoutMs = timeoutMs || 8000;
    return new Promise(function (resolve) {
      var idx = 0;
      function tryNext() {
        if (idx >= PROXIES.length) { resolve(null); return; }
        var proxyUrl = PROXIES[idx](url);
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

  function parseRSS(xml, cat, fonte) {
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
      if (!t) continue;

      var title = t[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim();
      var src = s ? s[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : fonte;
      if (src && title.endsWith(' - ' + src)) title = title.slice(0, -(src.length + 3));

      var texto = '';
      if (ds) {
        texto = ds[1].replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, '').trim().substring(0, 220);
        if (texto) texto += '...';
      }

      var id = 'news_' + hashStr(title);

      // 🆕 Tenta extrair imagem real do RSS
      var enc = x.match(/<enclosure[^>]*url="([^"]+)"/);
      var media = x.match(/<media:content[^>]*url="([^"]+)"/);
      var imgInDesc = x.match(/<img[^>]*src="([^"]+)"/);
      var imagemReal = (enc && enc[1]) || (media && media[1]) || (imgInDesc && imgInDesc[1]) || null;

      var linkOriginal = l ? l[1].trim() : '#';

      items.push({
        id: id,
        categoria: cat,
        fonte: src || fonte,
        autor: src || fonte,
        fonte_logo: null,
        titulo: title,
        texto: texto || 'Clique para ler a notícia completa.',
        imagem: imagemReal || gerarPlaceholder(cat),  // 🆕 imagem real ou SVG
        link: toGoogleNewsLink(title, linkOriginal),
        timestamp: d ? new Date(d[1]).toISOString() : new Date().toISOString(),
        tema: cat,
        prazo: null,
        investidores_hoje: 0,
        em_alta: false
      });
      count++;
    }
    return items;
  }

  function tryRSS() {
    console.log('[news] 🔄 buscando RSS direto...');
    state.source = 'rss';

    var promises = RSS_SOURCES.map(function (s) {
      return fetchWithProxy(s.url, 8000).then(function (xml) {
        return xml ? parseRSS(xml, s.cat, s.fonte) : [];
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

      console.log('[news] ✅ RSS direto OK: ' + unique.length + ' notícias');
      return unique;
    });
  }

  // ============================================================
  // CARREGAMENTO PRINCIPAL
  // ============================================================
  function loadAllNews(force) {
    if (state.loading) return;
    state.loading = true;
    resetDailySeen();

    var feed = document.getElementById('pm-feed');
    if (!feed) { state.loading = false; return; }

    if (force) {
      try { localStorage.removeItem(CACHE_KEY); } catch (e) {}
    }

    if (!force) {
      var cached = loadCache();
      if (cached && cached.length) {
        console.log('[news] 📦 cache local: ' + cached.length + ' notícias');
        state.items = cached;
        state.page = 1;
        state.hasMore = cached.length > PAGE_SIZE;
        state.loading = false;
        renderFresh();
        return;
      }
    }

    if (state.page === 1) {
      feed.innerHTML =
        '<div style="text-align:center;padding:40px;color:#8e8e93">' +
          '<div style="display:inline-block;width:32px;height:32px;border:3px solid rgba(255,204,0,0.2);border-top-color:#ffcc00;border-radius:50%;animation:pmSpin 0.8s linear infinite"></div>' +
          '<p style="margin-top:12px">Buscando notícias reais...</p>' +
        '</div>';
    }

    tryBackend().then(function (backendItems) {
      if (backendItems && backendItems.length) {
        return backendItems;
      }
      return tryRSS();
    }).then(function (items) {
      state.loading = false;
      state.items = items || [];
      state.page = 1;
      state.hasMore = state.items.length > PAGE_SIZE;

      if (!state.items.length) {
        feed.innerHTML =
          '<div style="text-align:center;padding:40px;color:#8e8e93">' +
            '<div style="font-size:48px;opacity:0.5;margin-bottom:12px">📰</div>' +
            '<p>Nenhuma notícia disponível no momento.</p>' +
            '<p style="font-size:12px;margin-top:8px">Tente novamente em alguns minutos.</p>' +
          '</div>';
        return;
      }

      saveCache(state.items);
      renderFresh();
    }).catch(function (e) {
      state.loading = false;
      console.error('[news] erro geral:', e);
      feed.innerHTML = '<div style="text-align:center;padding:40px;color:#8e8e93">Erro ao carregar notícias.</div>';
    });
  }

  // ============================================================
  // RENDERIZAÇÃO
  // ============================================================
  function renderFresh() {
    var feed = document.getElementById('pm-feed');
    if (!feed) return;
    feed.innerHTML = '';
    state.page = 1;
    state.hasMore = state.items.length > PAGE_SIZE;
    renderPage();
  }

  function renderPage() {
    var feed = document.getElementById('pm-feed');
    var start = (state.page - 1) * PAGE_SIZE;
    var slice = state.items.slice(start, start + PAGE_SIZE);
    if (!slice.length) { state.hasMore = false; return; }

    if (state.filter !== 'all') {
      slice = slice.filter(function (n) { return n.categoria === state.filter; });
      if (!slice.length) {
        state.page++;
        if ((state.page - 1) * PAGE_SIZE < state.items.length) {
          renderPage();
        } else {
          state.hasMore = false;
        }
        return;
      }
    }

    var html = '';
    for (var i = 0; i < slice.length; i++) {
      html += renderCard(slice[i]);
    }
    feed.insertAdjacentHTML('beforeend', html);

    for (var j = 0; j < slice.length; j++) {
      state.seen[slice[j].id] = Date.now();
    }
    saveSeen();

    state.page++;
    state.hasMore = (start + PAGE_SIZE) < state.items.length;
  }

  function renderCard(n) {
    var catLabel = {
      musica: '🎵 Música',
      lancamentos: '🚀 Lançamento',
      shows: '🎤 Shows',
      negocios: '💰 Negócios',
      artistas: '⭐ Artistas',
      editais: '📜 Edital'
    }[n.categoria] || '📰';

    var inicial = (n.fonte || n.autor || 'N').charAt(0).toUpperCase();
    var tempo = formatRelativeTime(n.timestamp);

    // 🆕 imagem (real ou SVG fallback)
    var imgUrl = n.imagem || gerarPlaceholder(n.categoria);
    var fallback = gerarPlaceholder(n.categoria);
    var imgHtml = '<img src="' + imgUrl + '" ' +
      'style="width:100%;height:180px;object-fit:cover;display:block;background:#2c2c2e" ' +
      'loading="lazy" ' +
      'onerror="this.src=\'' + fallback + '\';this.onerror=null">';

    return '<article style="background:#1c1c1e;border:0.5px solid #38383a;border-radius:16px;margin-bottom:16px;overflow:hidden;animation:pmFadeIn 0.4s ease">' +
      imgHtml +
      '<div style="display:flex;align-items:center;gap:10px;padding:12px 14px">' +
        '<div style="width:28px;height:28px;border-radius:50%;background:#ffcc00;color:#000;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex-shrink:0">' + esc(inicial) + '</div>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="color:#fff;font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(n.fonte || n.autor || 'PLAY MY') + '</div>' +
          '<div style="color:#8e8e93;font-size:12px">' + tempo + '</div>' +
        '</div>' +
        '<span style="font-size:11px;padding:3px 8px;border-radius:10px;background:rgba(255,204,0,0.15);color:#ffcc00;white-space:nowrap;flex-shrink:0">' + catLabel + '</span>' +
      '</div>' +
      '<div style="padding:12px 14px">' +
        '<div style="color:#fff;font-weight:700;font-size:16px;margin-bottom:6px;line-height:1.3">' + esc(n.titulo) + '</div>' +
        '<div style="color:#8e8e93;font-size:14px;line-height:1.5">' + esc(n.texto) + '</div>' +
      '</div>' +
      '<div style="padding:10px 14px 14px;border-top:0.5px solid #38383a">' +
        '<a href="' + esc(n.link) + '" target="_blank" rel="noopener" style="display:inline-block;background:#ffcc00;color:#000;padding:10px 18px;border-radius:10px;font-size:13px;font-weight:600;text-decoration:none">' +
          'Ler no Google News →' +
        '</a>' +
      '</div>' +
    '</article>';
  }

  // ============================================================
  // HELPERS
  // ============================================================
  function esc(s) {
    if (!s) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function hashStr(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) {
      h = ((h << 5) - h) + s.charCodeAt(i);
      h = h & h;
    }
    return Math.abs(h).toString(36);
  }

  function formatRelativeTime(iso) {
    try {
      var d = new Date(iso);
      var diff = Math.floor((Date.now() - d.getTime()) / 1000);
      if (diff < 60) return 'agora';
      if (diff < 3600) return Math.floor(diff / 60) + 'min';
      if (diff < 86400) return Math.floor(diff / 3600) + 'h';
      if (diff < 604800) return Math.floor(diff / 86400) + 'd';
      return d.toLocaleDateString('pt-BR');
    } catch (e) { return ''; }
  }

  // ============================================================
  // FILTROS
  // ============================================================
  function initFilters() {
    var btns = document.querySelectorAll('#pm-filters .pm-filter-btn');
    if (!btns.length) return;
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        btns.forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        state.filter = b.getAttribute('data-cat');
        renderFresh();
      });
    });
  }

  // ============================================================
  // SCROLL INFINITO
  // ============================================================
  function initInfinite() {
    var sentinel = document.getElementById('pm-sentinel');
    if (!sentinel) return;
    if (window.__pmNewsObserver) window.__pmNewsObserver.disconnect();
    window.__pmNewsObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting && state.hasMore && !state.loading) {
          renderPage();
        }
      });
    }, { rootMargin: '400px' });
    window.__pmNewsObserver.observe(sentinel);
  }

  // ============================================================
  // ESTILO GLOBAL
  // ============================================================
  function injectStyles() {
    if (document.getElementById('pm-news-styles')) return;
    var style = document.createElement('style');
    style.id = 'pm-news-styles';
    style.textContent =
      '#pm-news-root .pm-filters{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px}' +
      '#pm-news-root .pm-filter-btn{background:transparent;border:1px solid #ffcc00;color:#ffcc00;padding:6px 14px;border-radius:20px;font-size:13px;cursor:pointer;transition:all 0.2s}' +
      '#pm-news-root .pm-filter-btn:hover{background:rgba(255,204,0,0.15)}' +
      '#pm-news-root .pm-filter-btn.active{background:#ffcc00;color:#000;font-weight:600}' +
      '@keyframes pmSpin{to{transform:rotate(360deg)}}' +
      '@keyframes pmFadeIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}';
    document.head.appendChild(style);
  }

  // ============================================================
  // API PÚBLICA
  // ============================================================
  window.pmNewsReload = function () {
    loadAllNews(true);
  };

  window.pmNewsLoadMore = function () {
    if (state.hasMore && !state.loading) renderPage();
  };

  // ============================================================
  // INICIALIZAÇÃO
  // ============================================================
  function init() {
    if (!document.getElementById('pm-news-root')) return;

    injectStyles();
    initFilters();
    initInfinite();
    loadAllNews(false);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  console.log('✅ [news-unified.js] v10.1.0 carregado');
})();
