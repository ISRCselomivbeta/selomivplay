// ============================================================
// js/background-play.js — PLAY MY v1.0.0
// Força o YouTube iframe a tocar em SEGUNDO PLANO (background).
//
// COMO FUNCIONA:
//   1. Sobrescreve document.hidden → sempre false
//   2. Sobrescreve document.visibilityState → sempre "visible"
//   3. Bloqueia o evento visibilitychange (YouTube usa para pausar)
//   4. Mantém Media Session ativo (controles na tela de bloqueio)
//   5. Audio silencioso em loop (evita que o SO mate a página)
//
// COMPATIBILIDADE:
//   ✅ Desktop (Chrome, Firefox, Edge) — 100%
//   ✅ Android (Chrome, Samsung Internet, Firefox) — alta
//   ⚠️ iOS Safari — limitação do sistema, funciona parcialmente
//   ⚠️ PWA standalone — funciona melhor que modo web
//
// USO:
//   Adicionar como PRIMEIRO script no index.html:
//   <script src="/js/background-play.js"></script>
//   <script src="/js/logger.js"></script>
//   <script src="/js/config.js"></script>
//   ...
//
// CONTROLE MANUAL:
//   window.pmBackgroundPlay.status()   → ver estado
//   window.pmBackgroundPlay.enable()   → ativar
//   window.pmBackgroundPlay.disable()  → desativar
// ============================================================

(function () {
  'use strict';

  // ============ CONFIGURAÇÃO ============
  const ENABLED_BY_DEFAULT = true;   // ligar automaticamente ao carregar
  const KEEPALIVE_AUDIO = true;      // tocar audio silencioso em loop

  // ============ ESTADO ============
  window._pmBgPlayEnabled = ENABLED_BY_DEFAULT;
  window._pmBgPlayOverridden = false;
  window._pmBgPlayOriginal = {};

  // ============ HELPERS ============

  // Detecta se está tocando algo (YouTube player ativo)
  function _isPlayingSomething() {
    try {
      // Verifica state.youtubePlayer (o player global do app)
      if (window.state && window.state.youtubePlayer) {
        var p = window.state.youtubePlayer;
        if (typeof p.getPlayerState === 'function') {
          var st = p.getPlayerState();
          // 1 = PLAYING, 3 = BUFFERING
          return st === 1 || st === 3;
        }
      }
      // Fallback: state.isPlaying
      if (window.state && window.state.isPlaying) return true;
    } catch (e) {}
    return false;
  }

  // ============ PATCH 1 — Page Visibility API ============
  function _patchVisibility() {
    if (window._pmBgPlayOverridden) return;

    try {
      // Salva os originais (para poder restaurar depois)
      window._pmBgPlayOriginal.hidden = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden')
        || Object.getOwnPropertyDescriptor(HTMLDocument.prototype, 'hidden');
      window._pmBgPlayOriginal.visibilityState = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState')
        || Object.getOwnPropertyDescriptor(HTMLDocument.prototype, 'visibilityState');

      // Override: document.hidden SEMPRE false
      Object.defineProperty(document, 'hidden', {
        get: function () {
          if (!window._pmBgPlayEnabled) {
            return window._pmBgPlayOriginal.hidden && window._pmBgPlayOriginal.hidden.get
              ? window._pmBgPlayOriginal.hidden.get.call(document)
              : false;
          }
          return false;  // <- força "sempre visível"
        },
        configurable: true
      });

      // Override: document.visibilityState SEMPRE 'visible'
      Object.defineProperty(document, 'visibilityState', {
        get: function () {
          if (!window._pmBgPlayEnabled) {
            return window._pmBgPlayOriginal.visibilityState && window._pmBgPlayOriginal.visibilityState.get
              ? window._pmBgPlayOriginal.visibilityState.get.call(document)
              : 'visible';
          }
          return 'visible';  // <- força "sempre visível"
        },
        configurable: true
      });

      window._pmBgPlayOverridden = true;
      console.log('🎵 [bgPlay] Page Visibility API patcheada');
    } catch (e) {
      console.warn('⚠️ [bgPlay] falha no patch de visibility:', e.message);
    }
  }

  // ============ PATCH 2 — Bloquear visibilitychange ============
  function _blockVisibilityEvents() {
    // Bloqueia em CAPTURA (antes de qualquer outro handler receber)
    ['visibilitychange', 'webkitvisibilitychange', 'mozvisibilitychange', 'msvisibilitychange'].forEach(function (evtName) {
      document.addEventListener(evtName, function (e) {
        if (!window._pmBgPlayEnabled) return;   // se desligado, deixa passar

        // Se está tocando música, bloqueia o evento
        if (_isPlayingSomething()) {
          e.stopImmediatePropagation();
          e.stopPropagation();
          // Não chama preventDefault() — não é cancelável
          console.log('🎵 [bgPlay] visibilitychange BLOQUEADO (música tocando)');
        }
      }, true);  // <- CAPTURA: executa ANTES de todos os outros
    });

    // Também bloqueia pagehide (mas NÃO bloqueia beforeunload,
    // porque isso quebraria o fechamento normal)
    window.addEventListener('pagehide', function (e) {
      if (!window._pmBgPlayEnabled) return;
      if (_isPlayingSomething()) {
        e.stopImmediatePropagation();
        e.stopPropagation();
        console.log('🎵 [bgPlay] pagehide BLOQUEADO (música tocando)');
      }
    }, true);

    console.log('🎵 [bgPlay] visibilitychange + pagehide bloqueados em captura');
  }

  // ============ PATCH 3 — Media Session reforçado ============
  function _reforcarMediaSession() {
    if (!('mediaSession' in navigator)) return;

    // Reafirma periodicamente que o estado é "playing"
    setInterval(function () {
      if (!window._pmBgPlayEnabled) return;
      if (_isPlayingSomething()) {
        try {
          navigator.mediaSession.playbackState = 'playing';
        } catch (e) {}
      }
    }, 5000);
  }

  // ============ PATCH 4 — Audio keep-alive silencioso ============
  function _criarKeepAliveAudio() {
    if (!KEEPALIVE_AUDIO) return;

    try {
      // Cria um <audio> silencioso em loop
      var audio = document.createElement('audio');
      audio.id = '_pmBgPlayKeepAlive';
      audio.loop = true;
      audio.volume = 0.001;  // quase inaudível, mas o SO detecta como áudio ativo
      audio.muted = false;   // MUTED=true faz o SO ignorar; false com volume baixíssimo é melhor
      audio.setAttribute('playsinline', '');
      audio.setAttribute('webkit-playsinline', '');

      // Fonte: áudio silencioso inline (WAV, 1 segundo)
      audio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

      document.body.appendChild(audio);

      // Tenta tocar (pode ser bloqueado até o usuário interagir)
      var playPromise = audio.play();
      if (playPromise && playPromise.catch) {
        playPromise.catch(function (e) {
          // Espera o primeiro clique do usuário para iniciar
          console.log('🎵 [bgPlay] keep-alive aguardando interação do usuário');
          var _primeiroClique = function () {
            audio.play().catch(function () {});
            document.removeEventListener('click', _primeiroClique);
            document.removeEventListener('touchstart', _primeiroClique);
          };
          document.addEventListener('click', _primeiroClique, { once: true });
          document.addEventListener('touchstart', _primeiroClique, { once: true });
        });
      }

      console.log('🎵 [bgPlay] keep-alive audio criado');
    } catch (e) {
      console.warn('⚠️ [bgPlay] falha no keep-alive:', e.message);
    }
  }

  // ============ PATCH 5 — YouTube iframe: forçar PLAYING ============
  function _forcarPlayQuandoBackground() {
    // Monitora: se a música estava tocando e o player pausou "sozinho"
    // (por causa de blur / visibility), tenta retomar
    var _ultimoEstado = null;

    setInterval(function () {
      if (!window._pmBgPlayEnabled) return;

      try {
        if (!window.state || !window.state.youtubePlayer) return;
        var p = window.state.youtubePlayer;
        if (typeof p.getPlayerState !== 'function') return;

        var estadoAtual = p.getPlayerState();

        // Se estava PLAYING (1) e agora está PAUSED (2) sem ação do usuário
        if (_ultimoEstado === 1 && estadoAtual === 2) {
          console.log('🎵 [bgPlay] detectou pausa fantasma — retomando');
          try {
            p.playVideo();
          } catch (e) {}
        }

        _ultimoEstado = estadoAtual;
      } catch (e) {}
    }, 1000);
  }

  // ============ ATIVAR / DESATIVAR ============
  function enable() {
    window._pmBgPlayEnabled = true;
    _patchVisibility();
    console.log('🎵 [bgPlay] ✅ ATIVADO');
  }

  function disable() {
    window._pmBgPlayEnabled = false;
    console.log('🎵 [bgPlay] ⏸️ DESATIVADO');
  }

  function status() {
    var out = {
      enabled: window._pmBgPlayEnabled,
      patched: window._pmBgPlayOverridden,
      playing: _isPlayingSomething(),
      userAgent: navigator.userAgent.substring(0, 80),
      platform: (navigator.userAgentData && navigator.userAgentData.platform) || 'unknown'
    };
    console.log('🎵 [bgPlay] Status:', out);
    return out;
  }

  // ============ INICIALIZAÇÃO ============
  function init() {
    if (!window._pmBgPlayEnabled) return;

    // 1. Patcheia visibility
    _patchVisibility();

    // 2. Bloqueia eventos
    _blockVisibilityEvents();

    // 3. Reforça Media Session
    _reforcarMediaSession();

    // 4. Cria keep-alive (aguarda DOM)
    if (document.body) {
      _criarKeepAliveAudio();
    } else {
      document.addEventListener('DOMContentLoaded', _criarKeepAliveAudio);
    }

    // 5. Força retomada quando pausar "fantasma"
    _forcarPlayQuandoBackground();

    console.log('🎵 [bgPlay] v1.0.0 inicializado — música em segundo plano ativa');
  }

  // ============ API PÚBLICA ============
  window.pmBackgroundPlay = {
    enable: enable,
    disable: disable,
    status: status,
    isPlaying: _isPlayingSomething
  };

  // ============ BOOT ============
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
