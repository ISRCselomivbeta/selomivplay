// ============================================================
// js/discovery.js — PLAY MY v2.2.0
// Feed Vertical de Descoberta (estilo TikTok/Resso) + Personalização
// + Load More Infinito (Bolsa Externa + YouTube)
// + Ações Robustas (favoritar, compartilhar, seguir)
// + 🆕 Feed PERSONALIZADO via get_history (plays + favorites + follows)
//
// MUDANÇAS v2.2.0:
//   - 🆕 buildPersonalizedFeed(): lê get_history e monta feed personalizado
//   - 🆕 stats.artistas7d/generos7d/musicasTop são usadas para ranquear
//   - 🆕 Card ganha label "✨ Porque você ouve X" quando vem do histórico
//   - 🆕 Fallback automático para o feed v2.1.1 se histórico estiver vazio
//   - 🆕 Histórico é cacheado por 60s (_historyCache)
//   - ✅ NADA MAIS MUDOU — todas as ações v2.1.1 continuam idênticas
//
// MUDANÇAS v2.1.1:
//   - 🐛 FIX: discoveryFav — 3 fallbacks (toggleFavoriteMusic → toggleFavorite → API)
//   - 🐛 FIX: discoveryShare — 3 fallbacks (shareMusic → openShareModal → Web Share)
//   - 🐛 FIX: discoveryFollow — 3 fallbacks (nome exato → case-insensitive → API)
//   - 🆕 showToast de feedback em cada ação (sucesso/erro)
//
// MUDANÇAS v2.1.0:
//   - 🆕 Feed INFINITO: quando chega perto do fim, carrega mais
//   - 🆕 PASSO 1: Bolsa Externa | PASSO 2: YouTube Search
//   - 🆕 Botões adaptados: interna vs YouTube
// ============================================================

(function () {
  'use strict';

  var DISCOVERY_VERSION = '2.2.0';

  var _discoveryState = {
    active: false,
    currentIndex: 0,
    cards: [],
    container: null,
    touchStartY: 0,
    touchStartX: 0,
    animating: false,
    cardsIdsUsados: {},
    loadingMore: false,
    cacheYouTube: {},
    queriesUsadas: [],
    // 🆕 v2.2.0 — cache do histórico (60s)
    historyStats: null,
    historyCacheAt: 0
  };

  var HISTORY_CACHE_MS = 60000;

  function log() {
    try {
      var args = Array.prototype.slice.call(arguments);
      args.unshift('[Discovery v' + DISCOVERY_VERSION + ']');
      console.log.apply(console, args);
    } catch (e) {}
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function extrairYoutubeId(url) {
    if (!url) return null;
    try {
      if (typeof extractYouTubeId === 'function') return extractYouTubeId(url);
      var m = String(url).match(/[?&]v=([^&]+)/);
      if (m) return m[1];
      m = String(url).match(/youtu\.be\/([^?]+)/);
      if (m) return m[1];
    } catch (e) {}
    return null;
  }

  function getCoverMusica(musica) {
    if (!musica) return '/images/logo.png';
    if (musica.link_capa && musica.link_capa.startsWith('http')) return musica.link_capa;
    if (musica.link_capa) return musica.link_capa;
    if (musica.link_youtube) {
      var vid = extrairYoutubeId(musica.link_youtube);
      if (vid) return 'https://img.youtube.com/vi/' + vid + '/hqdefault.jpg';
    }
    return '/images/logo.png';
  }

  function formatarMoeda(v) {
    try {
      if (typeof formatCurrency === 'function') return formatCurrency(v);
    } catch (e) {}
    return 'R$ ' + (Number(v) || 0).toFixed(2).replace('.', ',');
  }

  function formatarNumero(v) {
    try {
      if (typeof formatNumber === 'function') return formatNumber(v);
    } catch (e) {}
    var n = Number(v) || 0;
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // ============================================================
  // 🆕 v2.2.0 — HISTÓRICO
  // ============================================================
  function getHistoryStats() {
    var agora = Date.now();
    if (_discoveryState.historyStats &&
        agora - _discoveryState.historyCacheAt < HISTORY_CACHE_MS) {
      return Promise.resolve(_discoveryState.historyStats);
    }

    if (typeof callAPI !== 'function') {
      return Promise.resolve(null);
    }

    return callAPI('get_history')
      .then(function (r) {
        if (r && r.success && r.data && r.data.stats) {
          _discoveryState.historyStats = r.data.stats;
          _discoveryState.historyCacheAt = agora;
          log('Histórico carregado:', {
            artistas: Object.keys(r.data.stats.artistas7d || {}).length,
            generos: Object.keys(r.data.stats.generos7d || {}).length,
            total: r.data.total || 0
          });
          return r.data.stats;
        }
        return null;
      })
      .catch(function (e) {
        console.warn('[Discovery] Erro get_history:', e && e.message);
        return null;
      });
  }

  // Extrai top N de um objeto { chave: contagem } ordenado desc
  function topN(obj, n) {
    if (!obj || typeof obj !== 'object') return [];
    return Object.keys(obj)
      .map(function (k) { return { chave: k, count: obj[k] }; })
      .sort(function (a, b) { return b.count - a.count; })
      .slice(0, n);
  }

  // ============================================================
  // PERFIL (v2.1.1) — usado como fallback
  // ============================================================
  function coletarPerfilUsuario() {
    var perfil = {
      following: [],
      favoritos: [],
      portfolio: [],
      generosPrediletos: {},
      artistasInteragidos: {}
    };

    try {
      if (window.state && Array.isArray(window.state.followingArtists)) {
        perfil.following = window.state.followingArtists.map(String);
      }
      if (window.state && Array.isArray(window.state.favoriteMusicIds)) {
        perfil.favoritos = window.state.favoriteMusicIds.map(String);
      }
      if (window.state && Array.isArray(window.state.portfolioAssets)) {
        perfil.portfolio = window.state.portfolioAssets;
      }

      var playlist = (window.state && window.state.playlist) || [];

      function analisarMusica(musica) {
        if (!musica) return;
        if (musica.genero) {
          perfil.generosPrediletos[musica.genero] =
            (perfil.generosPrediletos[musica.genero] || 0) + 1;
        }
        if (musica.artista) {
          perfil.artistasInteragidos[musica.artista] =
            (perfil.artistasInteragidos[musica.artista] || 0) + 1;
        }
      }

      perfil.favoritos.forEach(function (id) {
        var m = playlist.find(function (x) { return String(x.id) === String(id); });
        if (m) analisarMusica(m);
      });
      perfil.portfolio.forEach(function (a) {
        if (a && a.music_id) {
          var m = playlist.find(function (x) { return String(x.id) === String(a.music_id); });
          if (m) analisarMusica(m);
        }
      });
    } catch (e) {
      console.warn('[Discovery] Erro perfil:', e.message);
    }

    return perfil;
  }

  // ============================================================
  // RANKING DE ARTISTAS (v2.1.1) — agora aceita histórico como bônus
  // ============================================================
  function ranquearArtistas(perfil, historyStats) {
    var playlist = (window.state && window.state.playlist) || [];
    var eloMap = (window.state && window.state.eloMap) || {};
    var streamsMap = (window.state && window.state.streamsMap) || {};

    // 🆕 v2.2.0 — bônus do histórico
    var historicoArtistas = (historyStats && historyStats.artistas7d) || {};
    var historicoGeneros = (historyStats && historyStats.generos7d) || {};

    var artistas = {};
    playlist.forEach(function (m) {
      if (!m || !m.artista) return;
      if (m.status === 'deleted' || m.status === 'paused') return;

      var nome = m.artista;
      if (!artistas[nome]) {
        artistas[nome] = {
          nome: nome, musicas: [], eloMedio: 0, streams: 0, score: 0
        };
      }
      artistas[nome].musicas.push(m);

      var eloInfo = eloMap[String(m.id)];
      if (eloInfo && eloInfo.elo) artistas[nome].eloMedio += eloInfo.elo;
      artistas[nome].streams += streamsMap[String(m.id)] || 0;
    });

    Object.keys(artistas).forEach(function (nome) {
      var a = artistas[nome];
      a.eloMedio = a.musicas.length ? Math.round(a.eloMedio / a.musicas.length) : 1000;

      var score = 0;
      // Fallbacks v2.1.1
      if (perfil.following.indexOf(nome) !== -1) score += 100;
      if (perfil.artistasInteragidos[nome]) score += perfil.artistasInteragidos[nome] * 20;

      a.musicas.forEach(function (m) {
        if (m.genero && perfil.generosPrediletos[m.genero]) {
          score += perfil.generosPrediletos[m.genero] * 2;
        }
      });

      score += Math.floor(a.eloMedio / 100);
      score += Math.floor(a.streams / 100);

      // 🆕 v2.2.0 — bônus do histórico (peso alto)
      if (historicoArtistas[nome]) {
        score += historicoArtistas[nome] * 50;
      }
      // 🆕 v2.2.0 — gênero do artista no histórico
      a.musicas.forEach(function (m) {
        if (m.genero && historicoGeneros[m.genero]) {
          score += historicoGeneros[m.genero] * 5;
        }
      });

      a.score = score;
    });

    return Object.values(artistas).sort(function (a, b) { return b.score - a.score; });
  }

  // ============================================================
  // 🆕 v2.2.0 — CONSTRUIR CARDS PERSONALIZADOS
  // ============================================================
  function construirCardsComHistorico(historyStats) {
    var perfil = coletarPerfilUsuario();
    var playlist = (window.state && window.state.playlist) || [];
    var artistasRankeados = ranquearArtistas(perfil, historyStats);

    var historicoArtistas = (historyStats && historyStats.artistas7d) || {};
    var historicoGeneros = (historyStats && historyStats.generos7d) || {};
    var historicoMusicas = (historyStats && historyStats.musicasTop) || {};

    var topArtistas = topN(historicoArtistas, 5).map(function (x) { return x.chave; });
    var topGeneros = topN(historicoGeneros, 3).map(function (x) { return x.chave; });

    log('Personalização: top artistas =', topArtistas, '| top gêneros =', topGeneros);

    var musicasValidas = playlist.filter(function (m) {
      return m && m.status !== 'deleted' && m.status !== 'paused';
    });

    // Classifica músicas em tiers
    var musicasHistoricoArtista = [];   // tier 1: artista no histórico
    var musicasHistoricoGenero = [];    // tier 2: gênero no histórico
    var musicasPrioritarias = [];       // tier 3: favoritas/portfolio (v2.1.1)
    var musicasNormais = [];            // tier 4: resto

    musicasValidas.forEach(function (m) {
      var sid = String(m.id);
      var artista = m.artista || '';
      var genero = m.genero || '';

      var isFav = perfil.favoritos.indexOf(sid) !== -1;
      var isPortfolio = perfil.portfolio.some(function (a) { return String(a.music_id) === sid; });
      var noHistoricoArtista = historicoArtistas[artista] > 0;
      var noHistoricoGenero = historicoGeneros[genero] > 0;
      var musicaJaOuvida = historicoMusicas[sid] > 0;

      m._personalizado = {
        artista: noHistoricoArtista,
        genero: noHistoricoGenero,
        jaOuvida: musicaJaOuvida
      };

      if (noHistoricoArtista) {
        musicasHistoricoArtista.push(m);
      } else if (noHistoricoGenero) {
        musicasHistoricoGenero.push(m);
      } else if (isFav || isPortfolio) {
        musicasPrioritarias.push(m);
      } else {
        musicasNormais.push(m);
      }
    });

    // Ordena cada tier por "força" (mais plays/favorites primeiro)
    musicasHistoricoArtista.sort(function (a, b) {
      return (historicoArtistas[b.artista] || 0) - (historicoArtistas[a.artista] || 0);
    });
    musicasHistoricoGenero.sort(function (a, b) {
      return (historicoGeneros[b.genero] || 0) - (historicoGeneros[a.genero] || 0);
    });

    var musicasOrdenadas = []
      .concat(musicasHistoricoArtista)
      .concat(musicasHistoricoGenero)
      .concat(shuffle(musicasPrioritarias))
      .concat(shuffle(musicasNormais));

    var userPlaylists = (window.state && window.state.userPlaylists) || [];
    var globalPlaylists = (window.state && window.state.globalPlaylists) || [];
    var playlistsMisturadas = shuffle(userPlaylists.concat(globalPlaylists));

    var cards = [];
    var musicasIdx = 0, artistasIdx = 0, playlistsIdx = 0;

    while (musicasIdx < musicasOrdenadas.length ||
           artistasIdx < artistasRankeados.length ||
           playlistsIdx < playlistsMisturadas.length) {

      if (musicasIdx < musicasOrdenadas.length) {
        cards.push({ tipo: 'musica', dados: musicasOrdenadas[musicasIdx++] });
      }
      if (cards.length % 3 === 0 && artistasIdx < artistasRankeados.length) {
        cards.push({ tipo: 'artista', dados: artistasRankeados[artistasIdx++] });
      }
      if (cards.length % 5 === 0 && playlistsIdx < playlistsMisturadas.length) {
        cards.push({ tipo: 'playlist', dados: playlistsMisturadas[playlistsIdx++] });
      }
    }

    log('Cards PERSONALIZADOS montados:', cards.length,
        '| hist-artista:', musicasHistoricoArtista.length,
        '| hist-genero:', musicasHistoricoGenero.length,
        '| fav/portfolio:', musicasPrioritarias.length,
        '| normais:', musicasNormais.length,
        '| artistas:', artistasRankeados.length,
        '| playlists:', playlistsMisturadas.length);

    return cards;
  }

  // ============================================================
  // CONSTRUIR CARDS (v2.1.1) — fallback
  // ============================================================
  function construirCards() {
    var perfil = coletarPerfilUsuario();
    var playlist = (window.state && window.state.playlist) || [];
    var artistasRankeados = ranquearArtistas(perfil, null);
    var cards = [];

    var musicasValidas = playlist.filter(function (m) {
      return m && m.status !== 'deleted' && m.status !== 'paused';
    });

    var musicasPrioritarias = [];
    var musicasNormais = [];

    musicasValidas.forEach(function (m) {
      var sid = String(m.id);
      var isFav = perfil.favoritos.indexOf(sid) !== -1;
      var isPortfolio = perfil.portfolio.some(function (a) { return String(a.music_id) === sid; });
      if (isFav || isPortfolio) musicasPrioritarias.push(m);
      else musicasNormais.push(m);
    });

    var musicasOrdenadas = shuffle(musicasPrioritarias).concat(shuffle(musicasNormais));

    var userPlaylists = (window.state && window.state.userPlaylists) || [];
    var globalPlaylists = (window.state && window.state.globalPlaylists) || [];
    var playlistsMisturadas = shuffle(userPlaylists.concat(globalPlaylists));

    var musicasIdx = 0, artistasIdx = 0, playlistsIdx = 0;

    while (musicasIdx < musicasOrdenadas.length ||
           artistasIdx < artistasRankeados.length ||
           playlistsIdx < playlistsMisturadas.length) {

      if (musicasIdx < musicasOrdenadas.length) {
        cards.push({ tipo: 'musica', dados: musicasOrdenadas[musicasIdx++] });
      }
      if (cards.length % 3 === 0 && artistasIdx < artistasRankeados.length) {
        cards.push({ tipo: 'artista', dados: artistasRankeados[artistasIdx++] });
      }
      if (cards.length % 5 === 0 && playlistsIdx < playlistsMisturadas.length) {
        cards.push({ tipo: 'playlist', dados: playlistsMisturadas[playlistsIdx++] });
      }
    }

    log('Cards montados (fallback v2.1.1):', cards.length,
        '| músicas:', musicasOrdenadas.length,
        '| artistas:', artistasRankeados.length,
        '| playlists:', playlistsMisturadas.length);

    return cards;
  }

  // ============================================================
  // CONTAINER
  // ============================================================
  function garantirContainer() {
    var existing = document.getElementById('discoveryFeed');
    if (existing) {
      _discoveryState.container = existing;
      return existing;
    }

    var el = document.createElement('div');
    el.id = 'discoveryFeed';
    el.className = 'discovery-feed';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Feed de descoberta');

    el.innerHTML = '' +
      '<div class="discovery-header">' +
        '<button class="discovery-close" onclick="closeDiscoveryFeed()" aria-label="Fechar">' +
          '<i class="bi bi-x-lg"></i>' +
        '</button>' +
        '<div class="discovery-title">' +
          '<i class="bi bi-compass"></i> Descobrir' +
        '</div>' +
        '<div class="discovery-counter" id="discoveryCounter">0 / 0</div>' +
      '</div>' +
      '<div class="discovery-cards" id="discoveryCards"></div>' +
      '<div class="discovery-hint" id="discoveryHint">' +
        '<i class="bi bi-arrow-down"></i> Deslize ou use ↑ ↓' +
      '</div>';

    document.documentElement.appendChild(el);
    _discoveryState.container = el;

    bindKeyboard();
    bindTouch(el);
    bindWheel(el);

    return el;
  }

  // ============================================================
  // KEYBOARD
  // ============================================================
  function bindKeyboard() {
    if (window._discoveryKeyboardBound) return;
    window._discoveryKeyboardBound = true;

    document.addEventListener('keydown', function (e) {
      if (!_discoveryState.active) return;

      if (e.key === 'Escape' || e.key === 'Esc' || e.keyCode === 27) {
        e.preventDefault();
        e.stopPropagation();
        closeDiscoveryFeed();
        return;
      }

      if (e.key === 'ArrowDown') { e.preventDefault(); discoveryNext(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); discoveryPrev(); }
    }, true);
  }

  // ============================================================
  // TOUCH
  // ============================================================
  function bindTouch(el) {
    if (el._discoveryTouchBound) return;
    el._discoveryTouchBound = true;

    el.addEventListener('touchstart', function (e) {
      if (!e.touches || !e.touches.length) return;
      _discoveryState.touchStartY = e.touches[0].clientY;
      _discoveryState.touchStartX = e.touches[0].clientX;
    }, { passive: true });

    el.addEventListener('touchend', function (e) {
      if (!e.changedTouches || !e.changedTouches.length) return;
      var dy = e.changedTouches[0].clientY - _discoveryState.touchStartY;
      var dx = e.changedTouches[0].clientX - _discoveryState.touchStartX;
      if (Math.abs(dy) < 60) return;
      if (Math.abs(dx) > Math.abs(dy)) return;
      if (dy < 0) discoveryNext();
      else discoveryPrev();
    }, { passive: true });
  }

  // ============================================================
  // WHEEL
  // ============================================================
  function bindWheel(el) {
    if (el._discoveryWheelBound) return;
    el._discoveryWheelBound = true;

    var _lastWheel = 0;
    el.addEventListener('wheel', function (e) {
      if (!_discoveryState.active) return;
      if (_discoveryState.animating) return;
      var now = Date.now();
      if (now - _lastWheel < 600) return;
      if (Math.abs(e.deltaY) < 40) return;
      _lastWheel = now;
      if (e.deltaY > 0) discoveryNext();
      else discoveryPrev();
    }, { passive: true });
  }

  // ============================================================
  // RENDER — CARD DE MÚSICA
  // ============================================================
  function renderCardMusica(musica, idx, total) {
    var cover = getCoverMusica(musica);
    var titulo = escapeHtml(musica.titulo || 'Sem título');
    var artista = escapeHtml(musica.artista || 'Artista desconhecido');
    var genero = escapeHtml(musica.genero || '');
    var valor = formatarMoeda(musica.valor_acao || 0);
    var disponivel = Number(musica.percentual_disponivel) || 0;
    var investidores = formatarNumero(musica.total_investidores || 0);
    var views = formatarNumero(musica.visualizacoes || 0);
    var curtidas = formatarNumero(musica.curtidas || 0);

    var isYouTube = musica.youtube === true || musica.externa === true;
    var isInterna = !isYouTube;

    var idxReal = isInterna
      ? window.state.playlist.findIndex(function (m) {
          return String(m.id) === String(musica.id);
        })
      : -1;

    var badgeOrigem = isYouTube
      ? '<div class="discovery-card-badge tipo-youtube"><i class="bi bi-youtube"></i> YouTube</div>'
      : '<div class="discovery-card-badge tipo-musica"><i class="bi bi-music-note-beamed"></i> Música</div>';

    // 🆕 v2.2.0 — badge de personalização
    var badgePersonalizado = '';
    if (isInterna && musica._personalizado) {
      if (musica._personalizado.artista) {
        badgePersonalizado = '<div class="discovery-personalizado-badge">✨ Porque você ouve ' + escapeHtml(musica.artista) + '</div>';
      } else if (musica._personalizado.genero) {
        badgePersonalizado = '<div class="discovery-personalizado-badge">✨ Mais de ' + escapeHtml(musica.genero) + '</div>';
      }
    }

    var statsHtml = isInterna
      ? '<div class="discovery-stats">' +
          '<span><i class="bi bi-eye"></i> ' + views + '</span>' +
          '<span><i class="bi bi-heart"></i> ' + curtidas + '</span>' +
          '<span><i class="bi bi-people"></i> ' + investidores + '</span>' +
        '</div>'
      : '<div class="discovery-stats">' +
          '<span><i class="bi bi-youtube"></i> Descoberta</span>' +
        '</div>';

    var botoesHtml = '';

    if (isInterna) {
      botoesHtml =
        '<button class="discovery-action invest" onclick="discoveryInvest(' + idxReal + ')">' +
          '<i class="bi bi-currency-dollar"></i>' +
          '<span>' + valor + '</span>' +
          '<small>' + disponivel + '% disp.</small>' +
        '</button>' +
        '<button class="discovery-action play" onclick="discoveryPlay(' + idxReal + ')">' +
          '<i class="bi bi-play-fill"></i>' +
          '<span>Ouvir</span>' +
        '</button>' +
        '<button class="discovery-action fav" onclick="discoveryFav(\'' + musica.id + '\')">' +
          '<i class="bi bi-heart"></i>' +
          '<span>Favoritar</span>' +
        '</button>' +
        '<button class="discovery-action share" onclick="discoveryShare(\'' + musica.id + '\')">' +
          '<i class="bi bi-share"></i>' +
          '<span>Compartilhar</span>' +
        '</button>';
    } else {
      botoesHtml =
        '<button class="discovery-action play big" onclick="discoveryPlayYouTube(\'' + musica.id + '\')">' +
          '<i class="bi bi-play-fill"></i>' +
          '<span>Ouvir no YouTube</span>' +
        '</button>' +
        '<button class="discovery-action fav" onclick="discoveryFavYouTube(\'' + musica.id + '\')">' +
          '<i class="bi bi-heart"></i>' +
          '<span>Salvar</span>' +
        '</button>' +
        '<button class="discovery-action share" onclick="discoveryShareYouTube(\'' + musica.id + '\')">' +
          '<i class="bi bi-share"></i>' +
          '<span>Compartilhar</span>' +
        '</button>';
    }

    var actionsClass = isYouTube ? 'discovery-actions youtube' : 'discovery-actions';

    return '' +
      '<div class="discovery-card discovery-card-musica" data-index="' + idx + '">' +
        '<div class="discovery-cover" style="background-image:url(\'' + cover + '\')">' +
          '<div class="discovery-cover-overlay"></div>' +
        '</div>' +
        badgeOrigem +
        badgePersonalizado +
        '<div class="discovery-info">' +
          '<div class="discovery-genero">' + genero + '</div>' +
          '<h1 class="discovery-track-title">' + titulo + '</h1>' +
          '<p class="discovery-track-artist">' + artista + '</p>' +
          statsHtml +
        '</div>' +
        '<div class="' + actionsClass + '">' +
          botoesHtml +
        '</div>' +
        '<div class="discovery-progress">' +
          '<div class="discovery-progress-bar" style="width:' + (((idx + 1) / total) * 100) + '%"></div>' +
        '</div>' +
      '</div>';
  }

  // ============================================================
  // RENDER — CARD DE ARTISTA
  // ============================================================
  function renderCardArtista(artista, idx, total, perfil, historyStats) {
    var nome = escapeHtml(artista.nome);
    var totalMusicas = artista.musicas.length;
    var elo = artista.eloMedio;
    var streams = formatarNumero(artista.streams);
    var jaSegue = perfil.following.indexOf(artista.nome) !== -1;

    var historicoArtistas = (historyStats && historyStats.artistas7d) || {};
    var playsDoArtista = historicoArtistas[artista.nome] || 0;

    var primeiraMusica = artista.musicas[0];
    var cover = primeiraMusica ? getCoverMusica(primeiraMusica) : '/images/logo.png';

    var idxPrimeiraMusica = window.state.playlist.findIndex(function (m) {
      return String(m.id) === String(primeiraMusica && primeiraMusica.id);
    });

    var badgePersonalizado = playsDoArtista > 0
      ? '<div class="discovery-personalizado-badge">✨ Você ouviu ' + playsDoArtista + 'x</div>'
      : '';

    return '' +
      '<div class="discovery-card discovery-card-artista" data-index="' + idx + '">' +
        '<div class="discovery-cover" style="background-image:url(\'' + cover + '\')">' +
          '<div class="discovery-cover-overlay artista"></div>' +
        '</div>' +
        '<div class="discovery-card-badge tipo-artista">' +
          '<i class="bi bi-mic-fill"></i> Artista' +
        '</div>' +
        badgePersonalizado +
        '<div class="discovery-info">' +
          '<div class="discovery-genero">Artista</div>' +
          '<h1 class="discovery-track-title">' + nome + '</h1>' +
          '<p class="discovery-track-artist">' +
            totalMusicas + ' música' + (totalMusicas > 1 ? 's' : '') +
            (elo ? ' • ⚡ ' + elo : '') +
          '</p>' +
          '<div class="discovery-stats">' +
            '<span><i class="bi bi-play-circle"></i> ' + streams + ' streams</span>' +
            (jaSegue ? '<span><i class="bi bi-check-circle-fill" style="color:#34c759"></i> Seguindo</span>' : '') +
          '</div>' +
        '</div>' +
        '<div class="discovery-actions artista">' +
          '<button class="discovery-action play big" onclick="discoveryPlay(' + idxPrimeiraMusica + ')">' +
            '<i class="bi bi-play-fill"></i>' +
            '<span>Ouvir top</span>' +
          '</button>' +
          '<button class="discovery-action follow" onclick="discoveryFollow(\'' + escapeHtml(artista.nome) + '\')">' +
            '<i class="bi bi-' + (jaSegue ? 'check-circle-fill' : 'person-plus') + '"></i>' +
            '<span>' + (jaSegue ? 'Seguindo' : 'Seguir') + '</span>' +
          '</button>' +
        '</div>' +
        '<div class="discovery-progress">' +
          '<div class="discovery-progress-bar" style="width:' + (((idx + 1) / total) * 100) + '%"></div>' +
        '</div>' +
      '</div>';
  }

  // ============================================================
  // RENDER — CARD DE PLAYLIST
  // ============================================================
  function renderCardPlaylist(playlist, idx, total, isGlobal) {
    var nome = escapeHtml(playlist.nome || 'Playlist');
    var desc = escapeHtml(playlist.descricao || (isGlobal ? 'Playlist global' : 'Minha playlist'));
    var totalMusicas = (playlist.musicas || []).length;

    return '' +
      '<div class="discovery-card discovery-card-playlist" data-index="' + idx + '">' +
        '<div class="discovery-cover playlist-cover">' +
          '<div class="discovery-cover-overlay playlist"></div>' +
          '<div class="playlist-icon-wrap">' +
            '<i class="bi bi-' + (isGlobal ? 'globe' : 'music-note-list') + '"></i>' +
          '</div>' +
        '</div>' +
        '<div class="discovery-card-badge tipo-playlist">' +
          '<i class="bi bi-' + (isGlobal ? 'globe' : 'person') + '"></i> ' +
          (isGlobal ? 'Global' : 'Minha playlist') +
        '</div>' +
        '<div class="discovery-info">' +
          '<div class="discovery-genero">Playlist</div>' +
          '<h1 class="discovery-track-title">' + nome + '</h1>' +
          '<p class="discovery-track-artist">' + desc + '</p>' +
          '<div class="discovery-stats">' +
            '<span><i class="bi bi-music-note-list"></i> ' + totalMusicas + ' músicas</span>' +
          '</div>' +
        '</div>' +
        '<div class="discovery-actions playlist">' +
          '<button class="discovery-action play big" onclick="discoveryPlayPlaylist(\'' + playlist.id + '\',' + isGlobal + ')">' +
            '<i class="bi bi-play-fill"></i>' +
            '<span>Tocar playlist</span>' +
          '</button>' +
        '</div>' +
        '<div class="discovery-progress">' +
          '<div class="discovery-progress-bar" style="width:' + (((idx + 1) / total) * 100) + '%"></div>' +
        '</div>' +
      '</div>';
  }

  // ============================================================
  // RENDER
  // ============================================================
  function render() {
    var cards = document.getElementById('discoveryCards');
    if (!cards) return;

    if (!_discoveryState.cards.length) {
      cards.innerHTML =
        '<div class="discovery-empty">' +
          '<i class="bi bi-music-note-list"></i>' +
          '<h2>Nenhum conteúdo para descobrir</h2>' +
          '<p>Volte ao Marketplace e tente de novo</p>' +
        '</div>';
      return;
    }

    var perfil = coletarPerfilUsuario();
    var total = _discoveryState.cards.length;
    var html = '';

    for (var i = 0; i < total; i++) {
      var c = _discoveryState.cards[i];
      if (c.tipo === 'musica') {
        html += renderCardMusica(c.dados, i, total);
      } else if (c.tipo === 'artista') {
        html += renderCardArtista(c.dados, i, total, perfil, _discoveryState.historyStats);
      } else if (c.tipo === 'playlist') {
        html += renderCardPlaylist(c.dados, i, total, c.dados.isGlobal === true);
      }
    }
    cards.innerHTML = html;

    atualizarCounter();
    atualizarVisibilidade();
  }

  function atualizarCounter() {
    var el = document.getElementById('discoveryCounter');
    if (!el) return;
    var total = _discoveryState.cards.length;
    var cur = _discoveryState.currentIndex + 1;
    el.textContent = cur + ' / ' + total;
  }

  function atualizarVisibilidade() {
    var cards = document.querySelectorAll('.discovery-card');
    for (var i = 0; i < cards.length; i++) {
      cards[i].classList.toggle('active', i === _discoveryState.currentIndex);
    }
  }

  // ============================================================
  // NAVEGAÇÃO
  // ============================================================
  function irPara(index) {
    var total = _discoveryState.cards.length;
    if (total === 0) return;
    if (index < 0) index = 0;
    if (index >= total) index = total - 1;
    if (index === _discoveryState.currentIndex) return;

    _discoveryState.animating = true;
    _discoveryState.currentIndex = index;

    atualizarVisibilidade();
    atualizarCounter();

    if (index >= total - 5) {
      carregarMaisCards();
    }

    setTimeout(function () {
      _discoveryState.animating = false;
    }, 500);
  }

  function discoveryNext() {
    if (_discoveryState.animating) return;
    irPara(_discoveryState.currentIndex + 1);
  }

  function discoveryPrev() {
    if (_discoveryState.animating) return;
    irPara(_discoveryState.currentIndex - 1);
  }

  // ============================================================
  // LOAD MORE
  // ============================================================
  function carregarMaisCards() {
    if (_discoveryState.loadingMore) return;
    _discoveryState.loadingMore = true;

    log('Carregando mais cards...');

    var externas = (window.state && window.state.externalPlaylist) || [];
    var usados = _discoveryState.cardsIdsUsados;

    var externasNaoUsadas = externas.filter(function (m) {
      if (!m) return false;
      var id = String(m.id || m.external_id || '');
      return id && !usados[id];
    });

    if (externasNaoUsadas.length >= 2) {
      externasNaoUsadas.slice(0, 3).forEach(function (m) {
        var id = String(m.id || m.external_id);
        usados[id] = true;
        _discoveryState.cards.push({
          tipo: 'musica',
          dados: m,
          externa: true
        });
      });

      render();
      log('Bolsa Externa: +' + Math.min(3, externasNaoUsadas.length) +
          ' cards (total:', _discoveryState.cards.length, ')');

      atualizarVisibilidade();
      atualizarCounter();

      _discoveryState.loadingMore = false;
      return;
    }

    buscarMaisNoYouTube();
  }

  function buscarMaisNoYouTube() {
    var perfil = coletarPerfilUsuario();
    var generos = Object.keys(perfil.generosPrediletos);

    generos.sort(function (a, b) {
      return perfil.generosPrediletos[b] - perfil.generosPrediletos[a];
    });

    var queries = [];

    generos.slice(0, 3).forEach(function (g) {
      queries.push(g + ' brasileiro 2026');
      queries.push(g + ' nacional');
    });

    perfil.following.slice(0, 2).forEach(function (a) {
      queries.push(a + ' música');
    });

    ['ROCK', 'POP', 'HIPHOP', 'MPB', 'FUNK', 'ELETRONICA', 'SERTANEJO'].forEach(function (g) {
      queries.push(g + ' brasileiro');
    });

    var queriesNovas = queries.filter(function (q) {
      return _discoveryState.queriesUsadas.indexOf(q) === -1;
    });

    if (queriesNovas.length === 0) {
      _discoveryState.queriesUsadas = [];
      queriesNovas = queries;
    }

    var query = queriesNovas[0];
    _discoveryState.queriesUsadas.push(query);

    log('Buscando no YouTube:', query);

    var agora = Date.now();
    if (_discoveryState.cacheYouTube[query] &&
        agora - _discoveryState.cacheYouTube[query].at < 5 * 60 * 1000) {
      adicionarCardsYouTube(_discoveryState.cacheYouTube[query].resultados);
      _discoveryState.loadingMore = false;
      return;
    }

    if (typeof searchYouTubeDirect !== 'function') {
      console.warn('[Discovery] searchYouTubeDirect não disponível');
      _discoveryState.loadingMore = false;
      return;
    }

    searchYouTubeDirect(query).then(function (resultados) {
      _discoveryState.cacheYouTube[query] = {
        at: agora,
        resultados: resultados || []
      };
      adicionarCardsYouTube(resultados);
      _discoveryState.loadingMore = false;
    }).catch(function (e) {
      console.warn('[Discovery] Erro YouTube:', e.message);
      _discoveryState.loadingMore = false;
    });
  }

  function adicionarCardsYouTube(resultados) {
    if (!resultados || !resultados.length) {
      log('YouTube: 0 resultados');
      return;
    }

    var usados = _discoveryState.cardsIdsUsados;
    var add = 0;

    resultados.forEach(function (r) {
      if (add >= 5) return;

      var vid = String(r.id || '').replace('yt_', '');
      if (!vid) return;
      if (usados[vid]) return;

      usados[vid] = true;
      add++;

      _discoveryState.cards.push({
        tipo: 'musica',
        dados: {
          id: 'yt_' + vid,
          titulo: r.titulo || 'Vídeo do YouTube',
          artista: r.artista || '',
          link_youtube: 'https://www.youtube.com/watch?v=' + vid,
          link_capa: 'https://img.youtube.com/vi/' + vid + '/hqdefault.jpg',
          youtube: true,
          externa: true,
          genero: 'YouTube'
        },
        externa: true
      });
    });

    if (add > 0) {
      render();
      atualizarVisibilidade();
      atualizarCounter();
    }

    log('YouTube: +' + add + ' cards (total:', _discoveryState.cards.length, ')');
  }

  // ============================================================
  // AÇÕES — v2.1.1 (robustas com fallbacks)
  // ============================================================
  window.discoveryPlay = function (idx) {
    if (typeof playTrack !== 'function') return;
    if (idx < 0 || idx >= window.state.playlist.length) return;
    log('Play →', idx);
    playTrack(idx);
    setTimeout(closeDiscoveryFeed, 400);
  };

  window.discoveryInvest = function (idx) {
    if (typeof openInvestModal !== 'function') return;
    if (idx < 0) return;
    log('Invest →', idx);
    openInvestModal(idx);
  };

  // ----- FAVORITAR (3 fallbacks) -----
  window.discoveryFav = function (musicId) {
    try {
      log('Favoritar →', musicId);

      if (typeof toggleFavoriteMusic === 'function') {
        toggleFavoriteMusic(musicId);
        if (typeof showToast === 'function') showToast('❤️ Favorito atualizado', 'success');
        return;
      }

      if (typeof toggleFavorite === 'function') {
        toggleFavorite(musicId);
        if (typeof showToast === 'function') showToast('❤️ Favorito atualizado', 'success');
        return;
      }

      if (typeof callAPI === 'function' && state.currentUser && state.currentUser.id) {
        var isFav = (state.favoriteMusicIds || []).map(String).indexOf(String(musicId)) !== -1;
        callAPI('toggle_favorite', {
          music_id: musicId,
          user_id: state.currentUser.id,
          action: isFav ? 'remove' : 'add'
        }).then(function (r) {
          if (r && r.success) {
            if (isFav) {
              state.favoriteMusicIds = state.favoriteMusicIds.filter(function (x) {
                return String(x) !== String(musicId);
              });
            } else {
              state.favoriteMusicIds.push(musicId);
            }
            if (typeof showToast === 'function') showToast('❤️ Favorito atualizado', 'success');
          } else {
            if (typeof showToast === 'function') showToast('Erro ao favoritar', 'error');
          }
        }).catch(function () {
          if (typeof showToast === 'function') showToast('Erro ao favoritar', 'error');
        });
        return;
      }

      if (typeof showToast === 'function') showToast('Faça login para favoritar', 'warning');
    } catch (e) {
      console.error('[Discovery] Erro favoritar:', e);
    }
  };

  // ----- COMPARTILHAR (3 fallbacks) -----
  window.discoveryShare = function (musicId) {
    try {
      log('Compartilhar →', musicId);

      if (typeof shareMusic === 'function') {
        shareMusic(musicId);
        return;
      }

      if (typeof openShareModal === 'function') {
        var musica = (state.playlist || []).find(function (m) {
          return String(m.id) === String(musicId);
        });
        if (musica) {
          window.currentShareTrack = {
            id: musica.id,
            titulo: musica.titulo,
            artista: musica.artista || 'Artista',
            capa: musica.link_capa || '/images/logo.png',
            link: window.location.origin + '/?music=' + musica.id
          };

          var cover = document.getElementById('sharePreviewCover');
          var title = document.getElementById('sharePreviewTitle');
          var artist = document.getElementById('sharePreviewArtist');
          if (cover) cover.src = window.currentShareTrack.capa;
          if (title) title.textContent = window.currentShareTrack.titulo;
          if (artist) artist.textContent = window.currentShareTrack.artista;
        }
        openShareModal();
        return;
      }

      var track = (state.playlist || []).find(function (m) {
        return String(m.id) === String(musicId);
      });
      if (!track) {
        if (typeof showToast === 'function') showToast('Música não encontrada', 'error');
        return;
      }

      var url = window.location.origin + '/?music=' + track.id;

      if (navigator.share) {
        navigator.share({
          title: track.titulo,
          text: 'Ouça no PLAY MY',
          url: url
        }).catch(function () {});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(function () {
          if (typeof showToast === 'function') showToast('Link copiado!', 'success');
        });
      } else {
        if (typeof showToast === 'function') showToast('Compartilhamento indisponível', 'warning');
      }
    } catch (e) {
      console.error('[Discovery] Erro compartilhar:', e);
    }
  };

  // ----- SEGUIR (3 fallbacks) -----
  window.discoveryFollow = function (artistName) {
    try {
      log('Follow →', artistName);

      var artists = (window.state && window.state.artists) || [];

      var artista = artists.find(function (a) {
        return String(a.nome) === String(artistName);
      });

      if (!artista) {
        var nomeLower = String(artistName).toLowerCase();
        artista = artists.find(function (a) {
          return String(a.nome || '').toLowerCase() === nomeLower;
        });
      }

      if (artista) {
        if (typeof toggleFollow === 'function') {
          toggleFollow(artista.id || artista.nome);
          log('Follow OK →', artista.nome);
          setTimeout(render, 300);
          return;
        }

        if (typeof callAPI === 'function' && state.currentUser) {
          var isFollowing = (state.followingArtists || []).map(String).indexOf(String(artista.id)) !== -1;
          callAPI('toggle_follow', {
            artist_id: artista.id,
            user_id: state.currentUser.id,
            action: isFollowing ? 'unfollow' : 'follow'
          }).then(function (r) {
            if (r && r.success) {
              if (isFollowing) {
                state.followingArtists = state.followingArtists.filter(function (x) {
                  return String(x) !== String(artista.id);
                });
                if (typeof showToast === 'function') showToast('Deixou de seguir', 'info');
              } else {
                state.followingArtists.push(artista.id);
                if (typeof showToast === 'function') showToast('❤️ Seguindo!', 'success');
              }
              setTimeout(render, 300);
            }
          });
          return;
        }
      }

      if (typeof callAPI === 'function' && state.currentUser) {
        var isFollowing2 = (state.followingArtists || []).map(String).indexOf(String(artistName)) !== -1;
        callAPI('toggle_follow', {
          artist_id: artistName,
          user_id: state.currentUser.id,
          action: isFollowing2 ? 'unfollow' : 'follow'
        }).then(function (r) {
          if (r && r.success) {
            if (isFollowing2) {
              state.followingArtists = state.followingArtists.filter(function (x) {
                return String(x) !== String(artistName);
              });
              if (typeof showToast === 'function') showToast('Deixou de seguir', 'info');
            } else {
              state.followingArtists.push(artistName);
              if (typeof showToast === 'function') showToast('❤️ Seguindo!', 'success');
            }
            setTimeout(render, 300);
          }
        });
        return;
      }

      if (typeof showToast === 'function') {
        showToast('Faça login para seguir', 'warning');
      }
    } catch (e) {
      console.error('[Discovery] Erro follow:', e);
    }
  };

  window.discoveryPlayPlaylist = function (playlistId, isGlobal) {
    if (isGlobal && typeof playGlobalPlaylist === 'function') {
      log('Play playlist global →', playlistId);
      playGlobalPlaylist(playlistId);
      setTimeout(closeDiscoveryFeed, 400);
      return;
    }
    if (!isGlobal && typeof playUserPlaylist === 'function') {
      log('Play playlist usuário →', playlistId);
      playUserPlaylist(playlistId);
      setTimeout(closeDiscoveryFeed, 400);
      return;
    }
    if (typeof showToast === 'function') {
      showToast('Playlist indisponível', 'warning');
    }
  };

  // ============================================================
  // AÇÕES YOUTUBE
  // ============================================================
  window.discoveryPlayYouTube = function (videoId) {
    var vid = String(videoId).replace('yt_', '');
    log('Play YouTube →', vid);

    var ps = document.getElementById('playerSpotify');
    if (ps) ps.style.display = 'flex';

    var pt = document.getElementById('playerTitle');
    if (pt) pt.textContent = 'YouTube';

    var pa = document.getElementById('playerArtist');
    if (pa) pa.textContent = 'Vídeo do YouTube';

    var pai = document.getElementById('playerAlbumArt');
    if (pai) pai.src = 'https://img.youtube.com/vi/' + vid + '/hqdefault.jpg';

    if (typeof loadYouTubeAPI === 'function' &&
        typeof initializeYouTubePlayer === 'function') {
      loadYouTubeAPI(function () {
        initializeYouTubePlayer(vid);
      });
      state.currentTrackIndex = 2000;
      state.isPlaying = true;
      if (typeof updatePlayerIcons === 'function') updatePlayerIcons();
    } else if (typeof showToast === 'function') {
      showToast('Player do YouTube indisponível', 'warning');
    }

    setTimeout(closeDiscoveryFeed, 400);
  };

  window.discoveryShareYouTube = function (videoId) {
    var vid = String(videoId).replace('yt_', '');
    var url = 'https://www.youtube.com/watch?v=' + vid;

    if (navigator.share) {
      navigator.share({
        title: 'PLAY MY',
        text: 'Descobri esta música no PLAY MY',
        url: url
      }).catch(function () {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(function () {
        if (typeof showToast === 'function') {
          showToast('Link copiado!', 'success');
        }
      });
    }
  };

  window.discoveryFavYouTube = function (videoId) {
    try {
      var vid = String(videoId).replace('yt_', '');
      log('Fav YouTube →', vid);

      if (!Array.isArray(state.favoriteMusicIds)) state.favoriteMusicIds = [];
      var sid = 'yt_' + vid;
      var isFav = state.favoriteMusicIds.map(String).indexOf(sid) !== -1;

      if (isFav) {
        state.favoriteMusicIds = state.favoriteMusicIds.filter(function (x) {
          return String(x) !== sid;
        });
        if (typeof showToast === 'function') showToast('Removido dos salvos', 'info');
      } else {
        state.favoriteMusicIds.push(sid);
        if (typeof showToast === 'function') showToast('⭐ Salvo!', 'success');
      }
    } catch (e) {
      console.error('[Discovery] Erro favoritar YouTube:', e);
    }
  };

  // ============================================================
  // 🆕 v2.2.0 — ABRIR (com histórico)
  // ============================================================
  window.openDiscoveryFeed = function () {
    _discoveryState.cardsIdsUsados = {};
    _discoveryState.loadingMore = false;
    _discoveryState.queriesUsadas = [];

    // 🆕 v2.2.0 — tenta carregar o histórico primeiro
    getHistoryStats().then(function (stats) {
      if (stats && (
          Object.keys(stats.artistas7d || {}).length > 0 ||
          Object.keys(stats.generos7d || {}).length > 0
      )) {
        log('Usando feed PERSONALIZADO (histórico disponível)');
        _discoveryState.cards = construirCardsComHistorico(stats);
      } else {
        log('Histórico vazio — usando feed padrão v2.1.1');
        _discoveryState.cards = construirCards();
      }

      _abrirFeed();
    }).catch(function () {
      log('Erro ao carregar histórico — usando feed padrão');
      _discoveryState.cards = construirCards();
      _abrirFeed();
    });
  };

  function _abrirFeed() {
    _discoveryState.cards.forEach(function (c) {
      if (c.tipo === 'musica' && c.dados && c.dados.id) {
        _discoveryState.cardsIdsUsados[String(c.dados.id)] = true;
      }
    });

    if (!_discoveryState.cards.length) {
      if (typeof showToast === 'function') {
        showToast('Nenhum conteúdo para descobrir ainda', 'warning');
      }
      return;
    }

    var el = garantirContainer();

    el.style.display = 'flex';
    el.style.opacity = '1';
    el.style.transform = '';
    el.style.pointerEvents = 'auto';
    el.classList.add('visible');

    document.body.classList.add('discovery-open');
    document.body.style.overflow = 'hidden';
    document.body.style.pointerEvents = '';
    document.documentElement.style.pointerEvents = '';

    _discoveryState.active = true;
    _discoveryState.currentIndex = 0;

    render();

    log('Feed aberto com', _discoveryState.cards.length, 'cards');
  }

  window.closeDiscoveryFeed = function () {
    try {
      var el = document.getElementById('discoveryFeed');

      if (el) {
        el.classList.remove('visible');
        el.style.pointerEvents = 'none';
        el.style.display = 'none';
        el.style.opacity = '0';
        el.style.transform = 'translateX(-9999px)';
      }

      document.body.classList.remove('discovery-open');
      document.body.style.overflow = '';
      document.body.style.pointerEvents = '';
      document.documentElement.style.pointerEvents = '';

      _discoveryState.active = false;

      log('Feed fechado');
    } catch (e) {
      console.error('[Discovery] Erro ao fechar:', e);
    }
  };

  window.discoveryNext = discoveryNext;
  window.discoveryPrev = discoveryPrev;

  // 🆕 v2.2.0 — utilidade pra forçar refresh do histórico
  window.discoveryClearHistoryCache = function () {
    _discoveryState.historyStats = null;
    _discoveryState.historyCacheAt = 0;
    log('Cache de histórico limpo');
  };

  log('v' + DISCOVERY_VERSION + ' carregado');

})();
