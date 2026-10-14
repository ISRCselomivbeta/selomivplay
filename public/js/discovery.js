// ============================================================
// js/discovery.js — PLAY MY v2.0.0
// Feed Vertical de Descoberta (estilo TikTok/Resso) + Personalização
//
// ADITIVO — não altera player.js, state.js ou qualquer arquivo existente.
//
// MUDANÇAS v2.0.0:
//   - 🆕 Cards de ARTISTA no feed (baseado no perfil do usuário)
//   - 🆕 Cards de PLAYLIST no feed (globais + do usuário)
//   - 🆕 Cards de ESCOLHAS (favoritas, mais tocadas, recomendadas)
//   - 🆕 Feed personalizado: prioriza artistas que o usuário segue/interage
//   - 🐛 FIX: botão X e Esc fecham corretamente (destrava o app)
//   - 🐛 FIX: pointer-events e z-index do header reforçados
//   - 🎨 Animação de entrada do título (slide up)
//   - 🎨 Border dourada + glow no card ativo
//
// API pública:
//   window.openDiscoveryFeed()
//   window.closeDiscoveryFeed()
//   window.discoveryNext()
//   window.discoveryPrev()
// ============================================================

(function () {
  'use strict';

  var DISCOVERY_VERSION = '2.0.0';

  // ============================================================
  // ESTADO INTERNO
  // ============================================================
  var _discoveryState = {
    active: false,
    currentIndex: 0,
    cards: [],          // lista mista: música, artista, playlist, escolha
    container: null,
    touchStartY: 0,
    touchStartX: 0,
    animating: false
  };

  // ============================================================
  // LOG
  // ============================================================
  function log() {
    try {
      var args = Array.prototype.slice.call(arguments);
      args.unshift('[Discovery v' + DISCOVERY_VERSION + ']');
      console.log.apply(console, args);
    } catch (e) {}
  }

  // ============================================================
  // HELPERS
  // ============================================================
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

  function getCoverArtista(nome) {
    // placeholder de artista baseado no nome (iniciais)
    return null;
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

  // ============================================================
  // PERSONALIZAÇÃO — coleta dados do perfil do usuário
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
      // 1. Artistas que o usuário segue
      if (window.state && Array.isArray(window.state.followingArtists)) {
        perfil.following = window.state.followingArtists.map(String);
      }

      // 2. Músicas favoritas
      if (window.state && Array.isArray(window.state.favoriteMusicIds)) {
        perfil.favoritos = window.state.favoriteMusicIds.map(String);
      }

      // 3. Carteira (músicas investidas)
      if (window.state && Array.isArray(window.state.portfolioAssets)) {
        perfil.portfolio = window.state.portfolioAssets;
      }

      // 4. Analisar gêneros e artistas das músicas favoritas + carteira
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
      console.warn('[Discovery] Erro ao coletar perfil:', e.message);
    }

    return perfil;
  }

  // ============================================================
  // RANKING DE ARTISTAS — baseado no perfil do usuário
  // ============================================================
  function ranquearArtistas(perfil) {
    var playlist = (window.state && window.state.playlist) || [];
    var eloMap = (window.state && window.state.eloMap) || {};
    var streamsMap = (window.state && window.state.streamsMap) || {};

    // Agrupa músicas por artista
    var artistas = {};
    playlist.forEach(function (m) {
      if (!m || !m.artista) return;
      if (m.status === 'deleted' || m.status === 'paused') return;

      var nome = m.artista;
      if (!artistas[nome]) {
        artistas[nome] = {
          nome: nome,
          musicas: [],
          eloMedio: 0,
          streams: 0,
          score: 0
        };
      }
      artistas[nome].musicas.push(m);

      var eloInfo = eloMap[String(m.id)];
      if (eloInfo && eloInfo.elo) {
        artistas[nome].eloMedio += eloInfo.elo;
      }
      artistas[nome].streams += streamsMap[String(m.id)] || 0;
    });

    // Calcula score de personalização
    Object.keys(artistas).forEach(function (nome) {
      var a = artistas[nome];
      a.eloMedio = a.musicas.length ? Math.round(a.eloMedio / a.musicas.length) : 1000;

      var score = 0;

      // Prioridade 1: usuário segue este artista
      if (perfil.following.indexOf(nome) !== -1) score += 100;

      // Prioridade 2: usuário interagiu (favoritou/investiu) com este artista
      if (perfil.artistasInteragidos[nome]) score += perfil.artistasInteragidos[nome] * 20;

      // Prioridade 3: gênero predominante das músicas do artista
      a.musicas.forEach(function (m) {
        if (m.genero && perfil.generosPrediletos[m.genero]) {
          score += perfil.generosPrediletos[m.genero] * 2;
        }
      });

      // Prioridade 4: ELO alto
      score += Math.floor(a.eloMedio / 100);

      // Prioridade 5: streams
      score += Math.floor(a.streams / 100);

      a.score = score;
    });

    // Ordena por score desc
    return Object.values(artistas).sort(function (a, b) {
      return b.score - a.score;
    });
  }

  // ============================================================
  // CONSTRUIR A LISTA MISTA DE CARDS
  // ============================================================
  function construirCards() {
    var perfil = coletarPerfilUsuario();
    var playlist = (window.state && window.state.playlist) || [];
    var artistasRankeados = ranquearArtistas(perfil);
    var cards = [];

    // Filtra músicas válidas
    var musicasValidas = playlist.filter(function (m) {
      return m && m.status !== 'deleted' && m.status !== 'paused';
    });

    // Distribui as músicas priorizando as favoritas/investidas
    var musicasPrioritarias = [];
    var musicasNormais = [];

    musicasValidas.forEach(function (m) {
      var sid = String(m.id);
      var isFav = perfil.favoritos.indexOf(sid) !== -1;
      var isPortfolio = perfil.portfolio.some(function (a) { return String(a.music_id) === sid; });
      if (isFav || isPortfolio) musicasPrioritarias.push(m);
      else musicasNormais.push(m);
    });

    // Embaralha levemente para não ficar repetitivo
    function shuffle(arr) {
      var a = arr.slice();
      for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = a[i]; a[i] = a[j]; a[j] = t;
      }
      return a;
    }

    var musicasOrdenadas = shuffle(musicasPrioritarias).concat(shuffle(musicasNormais));

    // Playlists do usuário
    var userPlaylists = (window.state && window.state.userPlaylists) || [];
    var globalPlaylists = (window.state && window.state.globalPlaylists) || [];
    var playlistsMisturadas = shuffle(userPlaylists.concat(globalPlaylists));

    // Intercala: música, artista, música, playlist, música, artista...
    var musicasIdx = 0;
    var artistasIdx = 0;
    var playlistsIdx = 0;

    while (musicasIdx < musicasOrdenadas.length ||
           artistasIdx < artistasRankeados.length ||
           playlistsIdx < playlistsMisturadas.length) {

      // 1 música
      if (musicasIdx < musicasOrdenadas.length) {
        cards.push({ tipo: 'musica', dados: musicasOrdenadas[musicasIdx++] });
      }

      // A cada 3 músicas, 1 artista
      if (cards.length % 3 === 0 && artistasIdx < artistasRankeados.length) {
        cards.push({ tipo: 'artista', dados: artistasRankeados[artistasIdx++] });
      }

      // A cada 5 cards, 1 playlist
      if (cards.length % 5 === 0 && playlistsIdx < playlistsMisturadas.length) {
        cards.push({ tipo: 'playlist', dados: playlistsMisturadas[playlistsIdx++] });
      }
    }

    log('Cards montados:', cards.length,
        '| músicas:', musicasOrdenadas.length,
        '| artistas:', artistasRankeados.length,
        '| playlists:', playlistsMisturadas.length);

    return cards;
  }

  // ============================================================
  // CRIAR CONTAINER (uma única vez)
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

    // Anexa direto no <html> para o fixed se referir à viewport
    document.documentElement.appendChild(el);
    _discoveryState.container = el;

    bindKeyboard();
    bindTouch(el);
    bindWheel(el);

    return el;
  }

  // ============================================================
  // KEYBOARD — setas ↑ ↓ + Escape (em captura, para garantir)
  // ============================================================
  function bindKeyboard() {
    if (window._discoveryKeyboardBound) return;
    window._discoveryKeyboardBound = true;

    document.addEventListener('keydown', function (e) {
      if (!_discoveryState.active) return;

      if (e.key === 'Escape' || e.key === 'Esc' || e.keyCode === 27) {
        e.preventDefault();
        e.stopPropagation();
        console.log('[Discovery] Escape pressionado — fechando');
        closeDiscoveryFeed();
        return;
      }

      if (e.key === 'ArrowDown') { e.preventDefault(); discoveryNext(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); discoveryPrev(); }
    }, true);  // CAPTURA: pega o evento antes de outros handlers
  }

  // ============================================================
  // TOUCH — swipe vertical
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
  // WHEEL — scroll do mouse
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
    var idxReal = window.state.playlist.findIndex(function (m) {
      return String(m.id) === String(musica.id);
    });

    return '' +
      '<div class="discovery-card discovery-card-musica" data-index="' + idx + '">' +
        '<div class="discovery-cover" style="background-image:url(\'' + cover + '\')">' +
          '<div class="discovery-cover-overlay"></div>' +
        '</div>' +
        '<div class="discovery-card-badge tipo-musica">' +
          '<i class="bi bi-music-note-beamed"></i> Música' +
        '</div>' +
        '<div class="discovery-info">' +
          '<div class="discovery-genero">' + genero + '</div>' +
          '<h1 class="discovery-track-title">' + titulo + '</h1>' +
          '<p class="discovery-track-artist">' + artista + '</p>' +
          '<div class="discovery-stats">' +
            '<span><i class="bi bi-eye"></i> ' + views + '</span>' +
            '<span><i class="bi bi-heart"></i> ' + curtidas + '</span>' +
            '<span><i class="bi bi-people"></i> ' + investidores + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="discovery-actions">' +
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
          '</button>' +
        '</div>' +
        '<div class="discovery-progress">' +
          '<div class="discovery-progress-bar" style="width:' + (((idx + 1) / total) * 100) + '%"></div>' +
        '</div>' +
      '</div>';
  }

  // ============================================================
  // RENDER — CARD DE ARTISTA
  // ============================================================
  function renderCardArtista(artista, idx, total, perfil) {
    var nome = escapeHtml(artista.nome);
    var totalMusicas = artista.musicas.length;
    var elo = artista.eloMedio;
    var streams = formatarNumero(artista.streams);
    var jaSegue = perfil.following.indexOf(artista.nome) !== -1;

    // Usa a capa da primeira música como "foto" do artista
    var primeiraMusica = artista.musicas[0];
    var cover = primeiraMusica ? getCoverMusica(primeiraMusica) : '/images/logo.png';

    // Índice real da primeira música do artista para tocar
    var idxPrimeiraMusica = window.state.playlist.findIndex(function (m) {
      return String(m.id) === String(primeiraMusica && primeiraMusica.id);
    });

    return '' +
      '<div class="discovery-card discovery-card-artista" data-index="' + idx + '">' +
        '<div class="discovery-cover" style="background-image:url(\'' + cover + '\')">' +
          '<div class="discovery-cover-overlay artista"></div>' +
        '</div>' +
        '<div class="discovery-card-badge tipo-artista">' +
          '<i class="bi bi-mic-fill"></i> Artista' +
        '</div>' +
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
  // RENDER — despacha por tipo
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
        html += renderCardArtista(c.dados, i, total, perfil);
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
  // AÇÕES DOS CARDS
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

  window.discoveryFav = function (musicId) {
    if (typeof toggleFavoriteMusic === 'function') {
      toggleFavoriteMusic(musicId);
      log('Favoritar →', musicId);
    }
  };

  window.discoveryShare = function (musicId) {
    if (typeof shareMusic === 'function') {
      shareMusic(musicId);
      log('Compartilhar →', musicId);
    }
  };

  window.discoveryFollow = function (artistName) {
    // Procura o ID do artista na lista state.artists
    var artista = (window.state.artists || []).find(function (a) {
      return String(a.nome) === String(artistName);
    });

    if (artista && typeof toggleFollow === 'function') {
      toggleFollow(artista.id);
      log('Follow →', artistName);
      // Atualiza o card
      setTimeout(render, 300);
    } else if (typeof showToast === 'function') {
      showToast('Siga pelo card do artista', 'info');
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
  // ABRIR / FECHAR (com correção do travamento)
  // ============================================================
  window.openDiscoveryFeed = function () {
    _discoveryState.cards = construirCards();

    if (!_discoveryState.cards.length) {
      if (typeof showToast === 'function') {
        showToast('Nenhum conteúdo para descobrir ainda', 'warning');
      }
      return;
    }

    var el = garantirContainer();
    el.classList.add('visible');
    el.style.pointerEvents = 'auto';
    document.body.classList.add('discovery-open');
    document.body.style.overflow = 'hidden';
    _discoveryState.active = true;
    _discoveryState.currentIndex = 0;

    render();

    log('Feed aberto com', _discoveryState.cards.length, 'cards');
  };

  window.closeDiscoveryFeed = function () {
    try {
      var el = document.getElementById('discoveryFeed');
      if (el) {
        el.classList.remove('visible');
        setTimeout(function () {
          if (!el.classList.contains('visible')) {
            el.style.pointerEvents = 'none';
          }
        }, 400);
      }

      // Destrava o scroll
      document.body.classList.remove('discovery-open');
      document.body.style.overflow = '';

      _discoveryState.active = false;
      if (el) el.style.pointerEvents = 'none';

      log('Feed fechado');
    } catch (e) {
      console.error('[Discovery] Erro ao fechar:', e);
    }
  };

  // ============================================================
  // API pública
  // ============================================================
  window.discoveryNext = discoveryNext;
  window.discoveryPrev = discoveryPrev;

  log('v' + DISCOVERY_VERSION + ' carregado');

})();
