// ============================================================
// js/artist-news.js — PLAY MY v1.0.0
// Notícias do artista atualmente tocando.
// Busca no Google News RSS, enriquece com og:image e renderiza
// num painel abaixo do feed principal de notícias.
//
// Depende de: state.js, player.js (playTrack)
// Carrega DEPOIS de news-unified.js e ANTES de app.js
// ============================================================

(function () {
  'use strict';

  // ============================================================
  // PROXIES CORS (mesma ordem do news-unified.js)
  // ============================================================
  var PROXIES = [
    function (u) { return 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u); },
    function (u) { return 'https://corsproxy.io/?' + encodeURIComponent(u); },
    function (u) { return 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(u); }
  ];

  // ============================================================
  // PLACEHOLDER SVG (fallback quando não tem og:image)
  // ============================================================
  function gerarPlaceholder() {
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300">' +
        '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
          '<stop offset="0%" stop-color="#ff2d55"/>' +
          '<stop offset="100%" stop-color="#ff6b35"/>' +
        '</linearGradient></defs>' +
        '<rect width="400" height="300" fill="url(#g)"/>' +
        '<text x="200" y="175" font-size="90" text-anchor="middle" fill="rgba(255,255,255,0.95)">🎵</text>' +
      '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
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
  // FETCH COM PROXY (tenta cada um até um funcionar)
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

  // ============================================================
  // PARSE RSS (mesma lógica do news-unified.js)
  // ============================================================
  function parseRSS(xml) {
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
      var src = s ? s[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : 'Google News';
      if (src && title.endsWith(' - ' + src)) title = title.slice(0, -(src.length + 3));

      var texto = '';
      if (ds) {
        texto = ds[1].replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, '').trim().substring(0, 220);
        if (texto) texto += '...';
      }

      // Extração agressiva de imagem
      var imagemReal = null;
      var candidates = [
        x.match(/<enclosure[^>]*url=["']([^"']+)["']/i),
        x.match(/<media:content[^>]*url=["']([^"']+)["']/i),
        x.match(/<media:thumbnail[^>]*url=["']([^"']+)["']/i),
        x.match(/<img[^>]*src=["']([^"']+)["']/i),
        (ce && ce[1] && ce[1].match(/<img[^>]*src=["']([^"']+)["']/i)),
        (ds && ds[1] && ds[1].match(/<img[^>]*src=["']([^"']+)["']/i))
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

      items.push({
        id: 'artist_' + hashStr(title),
        categoria: 'musica',
        fonte: src || 'Google News',
        autor: src || 'Google News',
        titulo: title,
        texto: texto || 'Clique para ler a notícia completa.',
        imagem: imagemReal || gerarPlaceholder(),
        link: l ? l[1].trim() : '#',
        timestamp: d ? new Date(d[1]).toISOString() : new Date().toISOString(),
        _linkOriginal: l ? l[1].trim() : '#'
      });
      count++;
    }
    return items;
  }

  // ============================================================
  // ENRIQUECER COM og:image (só nas que ficaram sem imagem)
  // ============================================================
  function enrichWithOgImage(items) {
    var semImagem = items.filter(function (n) {
      var semImg = (!n.imagem || n.imagem.indexOf('data:image/svg') === 0);
      var link = n._linkOriginal || n.link;
      return semImg && link && link.indexOf('http') === 0 &&
             link.indexOf('news.google.com/search') === -1;
    }).slice(0, 5);

    if (!semImagem.length) return Promise.resolve(items);

    var promises = semImagem.map(function (n) {
      return new Promise(function (resolve) {
        var link = n._linkOriginal || n.link;
        var ctrl = new AbortController();
        var timer = setTimeout(function () { ctrl.abort(); }, 6000);
        var proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(link);
        fetch(proxyUrl, { signal: ctrl.signal })
          .then(function (r) { clearTimeout(timer); return r.text(); })
          .then(function (html) {
            var patterns = [
              /<meta[^>]*property=["']og:image:secure_url["'][^>]*content=["']([^"']+)["']/i,
              /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i,
              /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i,
              /<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i
            ];
            for (var i = 0; i < patterns.length; i++) {
              var m = html.match(patterns[i]);
              if (m && m[1] && m[1].indexOf('http') === 0) {
                n.imagem = m[1];
                break;
              }
            }
            resolve(n);
          })
          .catch(function () { clearTimeout(timer); resolve(n); });
      });
    });

    return Promise.all(promises).then(function () { return items; });
  }

  // ============================================================
  // RENDER DO CARD
  // ============================================================
  function renderCard(n) {
    var inicial = (n.fonte || 'N').charAt(0).toUpperCase();
    var tempo = formatRelativeTime(n.timestamp);
    var imgUrl = n.imagem || gerarPlaceholder();
    var fallback = gerarPlaceholder();

    var imgHtml = '<img src="' + imgUrl + '" ' +
      'style="width:100%;height:180px;object-fit:cover;display:block;background:#2c2c2e" ' +
      'loading="lazy" ' +
      'onerror="this.onerror=null;this.src=\'' + fallback + '\'">';

    return '<article style="background:#1c1c1e;border:0.5px solid #38383a;border-radius:16px;margin-bottom:16px;overflow:hidden">' +
      imgHtml +
      '<div style="display:flex;align-items:center;gap:10px;padding:12px 14px">' +
        '<div style="width:28px;height:28px;border-radius:50%;background:#ffcc00;color:#000;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex-shrink:0">' + esc(inicial) + '</div>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="color:#fff;font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(n.fonte || 'Google News') + '</div>' +
          '<div style="color:#8e8e93;font-size:12px">' + tempo + '</div>' +
        '</div>' +
        '<span style="font-size:11px;padding:3px 8px;border-radius:10px;background:rgba(255,204,0,0.15);color:#ffcc00;white-space:nowrap;flex-shrink:0">🎵 Artista</span>' +
      '</div>' +
      '<div style="padding:12px 14px">' +
        '<div style="color:#fff;font-weight:700;font-size:16px;margin-bottom:6px;line-height:1.3">' + esc(n.titulo) + '</div>' +
        '<div style="color:#8e8e93;font-size:14px;line-height:1.5">' + esc(n.texto) + '</div>' +
      '</div>' +
      '<div style="padding:10px 14px 14px;border-top:0.5px solid #38383a">' +
        '<a href="' + esc(n.link) + '" target="_blank" rel="noopener" style="display:inline-block;background:#ffcc00;color:#000;padding:10px 18px;border-radius:10px;font-size:13px;font-weight:600;text-decoration:none">' +
          'Ler notícia →' +
        '</a>' +
      '</div>' +
    '</article>';
  }

  // ============================================================
  // ESTADO INTERNO
  // ============================================================
  var _lastArtist = null;
  var _loading = false;

  // ============================================================
  // CARREGAR NOTÍCIAS PARA UM ARTISTA
  // ============================================================
  function loadForArtist(artista) {
    if (!artista || typeof artista !== 'string') return;
    artista = artista.trim();
    if (artista.length < 2) return;

    // Evita recarregar o mesmo artista
    var feedEl = document.getElementById('pm-artist-news-feed');
    if (_lastArtist === artista.toLowerCase() && feedEl && feedEl.children.length > 0) {
      console.log('[artist-news] ⏳ mesmo artista, ignorando');
      return;
    }
    if (_loading) {
      console.log('[artist-news] ⏳ já carregando, ignorando');
      return;
    }

    _lastArtist = artista.toLowerCase();
    _loading = true;

    var container = document.getElementById('pm-artist-news-container');
    var feed = document.getElementById('pm-artist-news-feed');
    var title = document.getElementById('pm-artist-news-title');
    if (!container || !feed || !title) {
      console.warn('[artist-news] ⚠️ container não encontrado no DOM');
      _loading = false;
      return;
    }

    container.style.display = 'block';
    title.textContent = 'Notícias sobre ' + artista;

    feed.innerHTML =
      '<div style="text-align:center;padding:24px;color:#8e8e93">' +
        '<div style="display:inline-block;width:28px;height:28px;border:3px solid rgba(255,204,0,0.2);border-top-color:#ffcc00;border-radius:50%;animation:pmSpin 0.8s linear infinite"></div>' +
        '<p style="margin-top:10px;font-size:13px">Buscando notícias sobre ' + esc(artista) + '...</p>' +
      '</div>';

    console.log('[artist-news] 🔍 buscando notícias para:', artista);

    var url = 'https://news.google.com/rss/search?q=' +
              encodeURIComponent('"' + artista + '"') +
              '&hl=pt-BR&gl=BR&ceid=BR:pt-419';

    fetchWithProxy(url, 8000).then(function (xml) {
      if (!xml) {
        feed.innerHTML = '<div style="text-align:center;padding:24px;color:#8e8e93;font-size:13px">' +
          'Nenhuma notícia encontrada para <strong>' + esc(artista) + '</strong>.</div>';
        _loading = false;
        return;
      }

      var items = parseRSS(xml);
      if (!items.length) {
        feed.innerHTML = '<div style="text-align:center;padding:24px;color:#8e8e93;font-size:13px">' +
          'Nenhuma notícia recente sobre <strong>' + esc(artista) + '</strong>.</div>';
        _loading = false;
        return;
      }

      console.log('[artist-news] ✅ ' + items.length + ' notícias, enriquecendo...');

      return enrichWithOgImage(items).then(function (enriched) {
        var html = '';
        for (var i = 0; i < enriched.length && i < 6; i++) {
          html += renderCard(enriched[i]);
        }
        feed.innerHTML = html;
        _loading = false;
        console.log('[artist-news] ✅ renderizado: ' + Math.min(enriched.length, 6) + ' cards');
      });
    }).catch(function (e) {
      console.warn('[artist-news] ⚠️ erro:', e.message);
      feed.innerHTML = '<div style="text-align:center;padding:24px;color:#8e8e93;font-size:13px">' +
        'Não foi possível carregar as notícias do artista.</div>';
      _loading = false;
    });
  }

  // ============================================================
  // API PÚBLICA
  // ============================================================
  window.pmNewsLoadForArtist = loadForArtist;

  window.pmArtistNewsReload = function () {
    _lastArtist = null;
    _loading = false;
    var currentTrack = null;
    if (window.state && window.state.playlist && typeof window.state.currentTrackIndex === 'number') {
      currentTrack = window.state.playlist[window.state.currentTrackIndex];
    }
    if (currentTrack && currentTrack.artista) {
      loadForArtist(currentTrack.artista);
    }
  };

  // ============================================================
  // HOOK EM playTrack — dispara quando toca música
  // ============================================================
  function hookPlayTrack() {
    if (typeof window.playTrack !== 'function') {
      setTimeout(hookPlayTrack, 500);
      return;
    }
    if (window.__pmArtistNewsHooked) return;
    window.__pmArtistNewsHooked = true;

    var original = window.playTrack;
    window.playTrack = function (idx) {
      var result = original.apply(this, arguments);
      try {
        var track = (window.state && window.state.playlist) ? window.state.playlist[idx] : null;
        if (track && track.artista) {
          setTimeout(function () { loadForArtist(track.artista); }, 800);
        }
      } catch (e) {
        console.warn('[artist-news] hook falhou:', e.message);
      }
      return result;
    };
    console.log('[artist-news] 🎣 hook instalado em playTrack');
  }

  hookPlayTrack();

  console.log('✅ [artist-news.js] v1.0.0 carregado');
})();
