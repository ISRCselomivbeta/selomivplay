// ============================================================
// js/discovery.js — PLAY MY v1.0.0
// Feed Vertical de Descoberta (estilo TikTok/Resso)
//
// ADITIVO — não altera player.js, state.js ou qualquer arquivo existente.
// Só adiciona uma nova tela de descoberta.
//
// API pública:
//   window.openDiscoveryFeed()    — abre o feed
//   window.closeDiscoveryFeed()   — fecha o feed
//   window.discoveryNext()        — próxima música
//   window.discoveryPrev()        — música anterior
//
// Depende de: state.js (state.playlist), player.js (playTrack),
//             marketplace.js (openInvestModal), share.js (shareMusic)
// ============================================================

(function () {
  'use strict';

  var DISCOVERY_VERSION = '1.0.0';

  // ============================================================
  // ESTADO INTERNO
  // ============================================================
  var _discoveryState = {
    active: false,
    currentIndex: 0,
    playlist: [],
    container: null,
    cardElement: null,
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
  // HELPERS — pegam dados de state sem quebrar se não existirem
  // ============================================================
  function getPlaylist() {
    try {
      if (window.state && Array.isArray(window.state.playlist)) {
        return window.state.playlist.filter(function (m) {
          return m && m.status !== 'deleted' && m.status !== 'paused';
        });
      }
    } catch (e) {}
    return [];
  }

  function getCover(musica) {
    if (!musica) return '/images/logo.png';
    if (musica.link_capa && musica.link_capa.startsWith('http')) return musica.link_capa;
    if (musica.link_capa) return musica.link_capa;
    // fallback: capa do YouTube
    if (musica.link_youtube) {
      var vid = extrairYoutubeId(musica.link_youtube);
      if (vid) return 'https://img.youtube.com/vi/' + vid + '/hqdefault.jpg';
    }
    return '/images/logo.png';
  }

  function extrairYoutubeId(url) {
    if (!url) return null;
    try {
      if (typeof extractYouTubeId === 'function') {
        return extractYouTubeId(url);
      }
      // fallback manual
      var m = String(url).match(/[?&]v=([^&]+)/);
      if (m) return m[1];
      m = String(url).match(/youtu\.be\/([^?]+)/);
      if (m) return m[1];
    } catch (e) {}
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

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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

    document.body.appendChild(el);
    _discoveryState.container = el;

    // Bind dos eventos de navegação
    bindKeyboard();
    bindTouch(el);
    bindWheel(el);

    return el;
  }

  // ============================================================
  // KEYBOARD — setas ↑ ↓
  // ============================================================
  function bindKeyboard() {
    if (window._discoveryKeyboardBound) return;
    window._discoveryKeyboardBound = true;

    document.addEventListener('keydown', function (e) {
      if (!_discoveryState.active) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); discoveryNext(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); discoveryPrev(); }
      if (e.key === 'Escape') { e.preventDefault(); closeDiscoveryFeed(); }
    });
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

      // Só considera swipe se for predominantemente vertical
      if (Math.abs(dy) < 60) return;
      if (Math.abs(dx) > Math.abs(dy)) return;

      if (dy < 0) discoveryNext();  // swipe pra cima → próxima
      else discoveryPrev();          // swipe pra baixo → anterior
    }, { passive: true });
  }

  // ============================================================
  // WHEEL — scroll do mouse (desktop)
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
  // RENDER — um card
  // ============================================================
  function renderCard(musica, index, total) {
    if (!musica) return '';

    var cover = getCover(musica);
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
      '<div class="discovery-card" data-index="' + index + '">' +
        '<div class="discovery-cover" style="background-image:url(\'' + cover + '\')">' +
          '<div class="discovery-cover-overlay"></div>' +
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
          '<div class="discovery-progress-bar" style="width:' + (((index + 1) / total) * 100) + '%"></div>' +
        '</div>' +
      '</div>';
  }

  // ============================================================
  // RENDER — todos os cards
  // ============================================================
  function render() {
    var cards = document.getElementById('discoveryCards');
    if (!cards) return;

    var playlist = _discoveryState.playlist;
    if (!playlist.length) {
      cards.innerHTML =
        '<div class="discovery-empty">' +
          '<i class="bi bi-music-note-list"></i>' +
          '<h2>Nenhuma música para descobrir</h2>' +
          '<p>Volte ao Marketplace e tente de novo</p>' +
        '</div>';
      return;
    }

    var html = '';
    for (var i = 0; i < playlist.length; i++) {
      html += renderCard(playlist[i], i, playlist.length);
    }
    cards.innerHTML = html;

    atualizarCounter();
    atualizarVisibilidade();
  }

  function atualizarCounter() {
    var el = document.getElementById('discoveryCounter');
    if (!el) return;
    var total = _discoveryState.playlist.length;
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
    var total = _discoveryState.playlist.length;
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
    // Fecha o feed depois de tocar (opcional)
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
    } else if (typeof showToast === 'function') {
      showToast('Adicione aos favoritos pelo card', 'info');
    }
  };

  window.discoveryShare = function (musicId) {
    if (typeof shareMusic === 'function') {
      shareMusic(musicId);
      log('Compartilhar →', musicId);
    } else if (typeof showToast === 'function') {
      showToast('Compartilhamento indisponível', 'warning');
    }
  };

  // ============================================================
  // ABRIR / FECHAR
  // ============================================================
  window.openDiscoveryFeed = function () {
    _discoveryState.playlist = getPlaylist();

    if (!_discoveryState.playlist.length) {
      if (typeof showToast === 'function') {
        showToast('Nenhuma música para descobrir ainda', 'warning');
      }
      return;
    }

    var el = garantirContainer();
    el.classList.add('visible');
    document.body.classList.add('discovery-open');
    _discoveryState.active = true;
    _discoveryState.currentIndex = 0;

    render();

    log('Feed aberto com', _discoveryState.playlist.length, 'músicas');
  };

  window.closeDiscoveryFeed = function () {
    var el = document.getElementById('discoveryFeed');
    if (el) el.classList.remove('visible');
    document.body.classList.remove('discovery-open');
    _discoveryState.active = false;
    log('Feed fechado');
  };

  // ============================================================
  // API pública (exporta funções diretas)
  // ============================================================
  window.discoveryNext = discoveryNext;
  window.discoveryPrev = discoveryPrev;

  // ============================================================
  // BOOT
  // ============================================================
  log('v' + DISCOVERY_VERSION + ' carregado');

})();
