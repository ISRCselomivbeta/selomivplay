// ============================================================
// js/background-play.js — PLAY MY v1.1.2
// ============================================================
// REPRODUÇÃO EM SEGUNDO PLANO — PLAY MY
//
// API pública (window.pmBackgroundPlay):
//   • enable()                — ativa background play
//   • disable()               — desativa
//   • status()                — estado completo
//   • isPlaying()             — está tocando algo?
//   • updateMediaSession()    — força refresh de metadados
//   • updatePlaybackState()   — força refresh do playbackState
//   • getPlayer()             — devolve player YouTube atual
//   • enableAggressive()      — ativa modo agressivo (opt-in)
//   • disableAggressive()     — desativa modo agressivo
//   • isAggressive()          — modo agressivo ativo?
//   • preferNativeAudio(bool) — prioriza <audio> sobre YouTube
//   • version                 — "1.1.2"
//
// Integra:
//   • YouTube IFrame (state.youtubePlayer)
//   • HTMLAudioElement nativo (state.playMyAudio)
//   • Media Session API completa (metadados + handlers + position)
//   • Controles de tela bloqueada / Bluetooth / headset
//   • PWA standalone + detecção offline
//   • Aguarda window.state aparecer (SPA-safe)
//
// IMPORTANTE:
//   - NÃO falsifica document.hidden
//   - NÃO cria áudio keep-alive inaudível
//   - NÃO bloqueia visibilitychange do app inteiro
//   - O navegador decide quando suspender o iframe
//
// CONFIGURAÇÃO (opcional, antes de carregar):
//   window.PM_BG_CONFIG = {
//     debug: true,
//     keepAliveAudio: false,
//     checkInterval: 2000,
//     aggressiveByDefault: false,
//     preferNative: true,
//     waitStateTimeout: 15000
//   };
// ============================================================

(function () {

  'use strict';

  // ==========================================================
  // CONFIGURAÇÃO
  // ==========================================================

  var DEFAULT_CONFIG = {
    debug: true,
    keepAliveAudio: false,
    checkInterval: 2000,
    aggressiveByDefault: false,
    preferNative: true,
    waitStateTimeout: 15000,
    aggressiveWatchInterval: 1000,
    aggressiveMaxResumes: 3,
    aggressiveResumeWindow: 15000
  };

  var CFG = (function () {
    var user = window.PM_BG_CONFIG || {};
    var out = {};
    Object.keys(DEFAULT_CONFIG).forEach(function (k) {
      out[k] = (typeof user[k] !== 'undefined') ? user[k] : DEFAULT_CONFIG[k];
    });
    return out;
  })();

  var VERSION = '1.1.2';
  var ENABLED_BY_DEFAULT = true;

  // ==========================================================
  // LOGGER (usa window.pmLogger se existir, senão console)
  // ==========================================================

  function _out(level, args) {
    try {
      if (window.pmLogger && typeof window.pmLogger[level] === 'function') {
        window.pmLogger[level].apply(window.pmLogger, args);
        return;
      }
      if (!CFG.debug && level === 'log') return;
      var fn = console[level] || console.log;
      fn.apply(console, args);
    } catch (e) {}
  }

  function log() {
    var a = Array.prototype.slice.call(arguments);
    a.unshift('[PlayMy BG v' + VERSION + ']');
    _out('log', a);
  }
  function warn() {
    var a = Array.prototype.slice.call(arguments);
    a.unshift('[PlayMy BG]');
    _out('warn', a);
  }
  function error() {
    var a = Array.prototype.slice.call(arguments);
    a.unshift('[PlayMy BG]');
    _out('error', a);
  }

  // ==========================================================
  // ESTADO GLOBAL
  // ==========================================================

  window._pmBgPlayEnabled = ENABLED_BY_DEFAULT;
  window._pmBgPlayVersion = VERSION;
  window._pmBgPlayAggressive = CFG.aggressiveByDefault;
  window._pmBgPlayPreferNative = CFG.preferNative;

  window._pmBgPlayState = {
    initialized: false,
    stateReady: false,
    userInteracted: false,
    pageHidden: false,
    wasPlayingBeforeBackground: false,
    lastPlayerState: -1,
    lastTitle: '',
    lastArtist: '',
    lastArtwork: '',
    lastUrl: '',
    mediaSessionActive: false,
    nativeAudioActive: false,
    aggressiveActive: false,
    aggressiveResumeCount: 0,
    aggressiveLastResumeAt: 0,
    offline: false
  };

  // Referências internas (modo agressivo)
  var _aggVisibilityHandler = null;
  var _aggPageHideHandler = null;
  var _aggWatchTimer = null;
  var _aggLastState = null;

  // Referência ao <audio> já "bindado"
  var _boundAudio = null;

  // Timer de aguardo do window.state
  var _stateWaitTimer = null;

  // ==========================================================
  // AGUARDA window.state (SPA-safe)
  // ==========================================================

  function waitForState(callback) {
    if (window.state) {
      window._pmBgPlayState.stateReady = true;
      callback();
      return;
    }

    var start = Date.now();

    _stateWaitTimer = setInterval(function () {
      if (window.state) {
        clearInterval(_stateWaitTimer);
        _stateWaitTimer = null;
        window._pmBgPlayState.stateReady = true;
        log('window.state detectado');
        callback();
        return;
      }
      if (Date.now() - start > CFG.waitStateTimeout) {
        clearInterval(_stateWaitTimer);
        _stateWaitTimer = null;
        warn('timeout aguardando window.state — seguindo com fallbacks');
        callback();
      }
    }, 200);
  }

  // ==========================================================
  // DETECÇÃO DO PLAYER YOUTUBE
  // ==========================================================

  function getYouTubePlayer() {
    try {
      if (window.state && window.state.youtubePlayer) {
        return window.state.youtubePlayer;
      }
    } catch (e) {}
    return null;
  }

  function getYouTubeState() {
    var player = getYouTubePlayer();
    if (!player) return -1;
    try {
      if (typeof player.getPlayerState === 'function') {
        return player.getPlayerState();
      }
    } catch (e) {}
    return -1;
  }

  // ==========================================================
  // DETECÇÃO DO AUDIO NATIVO
  // ==========================================================

  function getNativeAudio() {
    try {
      if (window.state && window.state.playMyAudio) {
        return window.state.playMyAudio;
      }
      if (window.playMyAudio) {
        return window.playMyAudio;
      }
      var a = document.getElementById('playmyAudio');
      if (a) return a;
      a = document.getElementById('audioPlayer');
      if (a) return a;
    } catch (e) {}
    return null;
  }

  // ==========================================================
  // ESTÁ TOCANDO?
  // ==========================================================

  function isPlayingSomething() {
    try {
      // 1. Áudio nativo (prioridade se preferNative)
      var audio = getNativeAudio();
      if (audio && !audio.paused && !audio.ended) {
        return true;
      }

      // 2. YouTube
      var yt = getYouTubeState();
      if (yt === 1 || yt === 3) {
        return true;
      }

      // 3. Estado interno
      if (window.state && window.state.isPlaying === true) {
        return true;
      }

      // 4. window.playMyAudio global
      if (window.playMyAudio &&
          typeof window.playMyAudio.paused !== 'undefined' &&
          !window.playMyAudio.paused &&
          !window.playMyAudio.ended) {
        return true;
      }
    } catch (e) {}
    return false;
  }

  // ==========================================================
  // DETECÇÃO DE AMBIENTE
  // ==========================================================

  function isMobile() {
    try {
      if (navigator.userAgentData && navigator.userAgentData.mobile) return true;
      return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    } catch (e) {
      return false;
    }
  }

  function isStandalonePWA() {
    try {
      if (window.matchMedia &&
          window.matchMedia('(display-mode: standalone)').matches) {
        return true;
      }
      if (window.navigator.standalone === true) return true;
    } catch (e) {}
    return false;
  }

  function isOffline() {
    try {
      return navigator.onLine === false;
    } catch (e) {
      return false;
    }
  }

  // ==========================================================
  // INTERAÇÃO DO USUÁRIO
  // ==========================================================

  function registerUserInteraction() {
    if (window._pmBgPlayState.userInteracted) return;
    window._pmBgPlayState.userInteracted = true;
    log('interação do usuário registrada');
    unlockNativeAudio();
    setupMediaSession();
  }

  function unlockNativeAudio() {
    var audio = getNativeAudio();
    if (!audio) return;
    try {
      window._pmBgPlayState.nativeAudioActive = true;
      audio.preload = 'auto';
      if ('playsInline' in audio) audio.playsInline = true;
      audio.setAttribute('playsinline', '');
      audio.setAttribute('webkit-playsinline', '');
    } catch (e) {}
  }

  // ==========================================================
  // MEDIA SESSION — suporte
  // ==========================================================

  function mediaSessionSupported() {
    return ('mediaSession' in navigator);
  }

  // ==========================================================
  // MEDIA SESSION — metadados
  // ==========================================================

  function getCurrentMediaInfo() {
    var info = {
      title: 'PlayMy',
      artist: 'PlayMy',
      album: 'Música independente',
      artwork: '',
      duration: 0,
      position: 0,
      playbackRate: 1
    };

    try {
      // 1. window.state
      if (window.state) {
        info.title =
          window.state.currentTrackTitle ||
          window.state.currentTitle ||
          window.state.currentSongTitle ||
          info.title;

        info.artist =
          window.state.currentArtist ||
          window.state.currentArtistName ||
          info.artist;

        info.album =
          window.state.currentAlbum ||
          info.album;

        info.artwork =
          window.state.currentArtwork ||
          window.state.currentCover ||
          window.state.currentThumbnail ||
          '';
      }

      // 2. Áudio nativo (mais preciso se existir)
      var audio = getNativeAudio();
      if (audio) {
        if (!isNaN(audio.duration) && audio.duration > 0) info.duration = audio.duration;
        if (!isNaN(audio.currentTime)) info.position = audio.currentTime;
        if (!isNaN(audio.playbackRate)) info.playbackRate = audio.playbackRate;
      }

      // 3. YouTube
      var player = getYouTubePlayer();
      if (player) {
        try {
          if (typeof player.getVideoData === 'function') {
            var data = player.getVideoData();
            if (data) {
              if (data.title && info.title === 'PlayMy') info.title = data.title;
              if (data.author && info.artist === 'PlayMy') info.artist = data.author;
            }
          }
          if (typeof player.getDuration === 'function' && !info.duration) {
            var d = player.getDuration();
            if (d > 0) info.duration = d;
          }
          if (typeof player.getCurrentTime === 'function' && !info.position) {
            info.position = player.getCurrentTime() || 0;
          }
        } catch (e) {}
      }

      // 4. Fallback DOM
      if (info.title === 'PlayMy') {
        var titleEl = document.querySelector(
          '[data-now-playing-title], .now-playing-title, #nowPlayingTitle'
        );
        if (titleEl && titleEl.textContent.trim()) {
          info.title = titleEl.textContent.trim();
        }
      }
      if (info.artist === 'PlayMy') {
        var artistEl = document.querySelector(
          '[data-now-playing-artist], .now-playing-artist, #nowPlayingArtist'
        );
        if (artistEl && artistEl.textContent.trim()) {
          info.artist = artistEl.textContent.trim();
        }
      }
    } catch (e) {}

    return info;
  }

  function normalizeArtwork(url) {
    if (!url) return '';
    try {
      return new URL(url, window.location.href).href;
    } catch (e) {
      return url;
    }
  }

  function buildArtworkArray(artwork) {
    if (!artwork) return [];
    // Múltiplos tamanhos ajuda o Android a escolher o melhor
    return [
      { src: artwork, sizes: '96x96',   type: 'image/png' },
      { src: artwork, sizes: '128x128', type: 'image/png' },
      { src: artwork, sizes: '192x192', type: 'image/png' },
      { src: artwork, sizes: '256x256', type: 'image/png' },
      { src: artwork, sizes: '384x384', type: 'image/png' },
      { src: artwork, sizes: '512x512', type: 'image/png' }
    ];
  }

  function updateMediaSession() {
    if (!mediaSessionSupported()) return;

    try {
      var info = getCurrentMediaInfo();
      var artwork = normalizeArtwork(info.artwork);

      navigator.mediaSession.metadata = new MediaMetadata({
        title: info.title || 'PlayMy',
        artist: info.artist || 'PlayMy',
        album: info.album || 'Música independente',
        artwork: buildArtworkArray(artwork)
      });

      window._pmBgPlayState.lastTitle = info.title;
      window._pmBgPlayState.lastArtist = info.artist;
      window._pmBgPlayState.lastArtwork = artwork;
      window._pmBgPlayState.mediaSessionActive = true;

      // Position state (barra de progresso na tela de bloqueio)
      if (info.duration > 0 && isFinite(info.duration)) {
        try {
          navigator.mediaSession.setPositionState({
            duration: info.duration,
            playbackRate: info.playbackRate || 1,
            position: Math.min(info.position || 0, info.duration)
          });
        } catch (e) {}
      }

      log('MS atualizada:', info.title, '-', info.artist);
    } catch (e) {
      warn('falha ao atualizar MS:', e.message);
    }
  }

  // ==========================================================
  // MEDIA SESSION — controles
  // ==========================================================

  function mediaPlay() {
    try {
      var audio = getNativeAudio();
      if (audio && typeof audio.play === 'function') {
        var p = audio.play();
        if (p && typeof p.catch === 'function') p.catch(function () {});
        return;
      }
      var player = getYouTubePlayer();
      if (player && typeof player.playVideo === 'function') {
        player.playVideo();
      }
    } catch (e) {
      warn('MS play:', e.message);
    }
  }

  function mediaPause() {
    try {
      var audio = getNativeAudio();
      if (audio && typeof audio.pause === 'function') {
        audio.pause();
        return;
      }
      var player = getYouTubePlayer();
      if (player && typeof player.pauseVideo === 'function') {
        player.pauseVideo();
      }
    } catch (e) {
      warn('MS pause:', e.message);
    }
  }

  function mediaNextTrack() {
    try {
      if (typeof window.playNext === 'function') { window.playNext(); return; }
      if (typeof window.nextTrack === 'function') { window.nextTrack(); return; }
      if (window.state && typeof window.state.nextTrack === 'function') {
        window.state.nextTrack();
        return;
      }
      var player = getYouTubePlayer();
      if (player && typeof player.nextVideo === 'function') {
        player.nextVideo();
      }
    } catch (e) {
      warn('MS next:', e.message);
    }
  }

  function mediaPreviousTrack() {
    try {
      if (typeof window.playPrevious === 'function') { window.playPrevious(); return; }
      if (typeof window.previousTrack === 'function') { window.previousTrack(); return; }
      if (window.state && typeof window.state.previousTrack === 'function') {
        window.state.previousTrack();
        return;
      }
      var player = getYouTubePlayer();
      if (player && typeof player.previousVideo === 'function') {
        player.previousVideo();
      }
    } catch (e) {
      warn('MS previous:', e.message);
    }
  }

  function mediaSeekBackward(details) {
    try {
      var offset = (details && details.seekOffset) ? details.seekOffset : 10;
      var audio = getNativeAudio();
      if (audio && typeof audio.currentTime === 'number') {
        audio.currentTime = Math.max(0, audio.currentTime - offset);
        return;
      }
      var player = getYouTubePlayer();
      if (player && typeof player.getCurrentTime === 'function' &&
          typeof player.seekTo === 'function') {
        player.seekTo(Math.max(0, player.getCurrentTime() - offset), true);
      }
    } catch (e) {}
  }

  function mediaSeekForward(details) {
    try {
      var offset = (details && details.seekOffset) ? details.seekOffset : 10;
      var audio = getNativeAudio();
      if (audio && typeof audio.currentTime === 'number') {
        audio.currentTime += offset;
        return;
      }
      var player = getYouTubePlayer();
      if (player && typeof player.getCurrentTime === 'function' &&
          typeof player.getDuration === 'function' &&
          typeof player.seekTo === 'function') {
        var d = player.getDuration() || Infinity;
        player.seekTo(Math.min(d, player.getCurrentTime() + offset), true);
      }
    } catch (e) {}
  }

  function mediaSeekTo(details) {
    try {
      if (!details || typeof details.seekTime !== 'number') return;
      var t = details.seekTime;
      var audio = getNativeAudio();
      if (audio && typeof audio.currentTime === 'number') {
        audio.currentTime = t;
        return;
      }
      var player = getYouTubePlayer();
      if (player && typeof player.seekTo === 'function') {
        player.seekTo(t, true);
      }
    } catch (e) {}
  }

  function mediaStop() {
    try {
      var audio = getNativeAudio();
      if (audio && typeof audio.pause === 'function') {
        audio.pause();
        if (typeof audio.currentTime === 'number') audio.currentTime = 0;
        return;
      }
      var player = getYouTubePlayer();
      if (player && typeof player.pauseVideo === 'function') {
        player.pauseVideo();
      }
    } catch (e) {}
  }

  // ==========================================================
  // MEDIA SESSION — setup
  // ==========================================================

  function setupMediaSession() {
    if (!mediaSessionSupported()) {
      log('Media Session não disponível neste navegador');
      return;
    }

    try {
      var actions = {
        play: mediaPlay,
        pause: mediaPause,
        stop: mediaStop,
        nexttrack: mediaNextTrack,
        previoustrack: mediaPreviousTrack,
        seekbackward: mediaSeekBackward,
        seekforward: mediaSeekForward,
        seekto: mediaSeekTo
      };

      Object.keys(actions).forEach(function (action) {
        try {
          navigator.mediaSession.setActionHandler(action, actions[action]);
        } catch (e) {
          // handlers não suportados em alguns navegadores
        }
      });

      updateMediaSession();
      log('Media Session configurada');
    } catch (e) {
      warn('falha MS setup:', e.message);
    }
  }

  function updatePlaybackState() {
    if (!mediaSessionSupported()) return;
    try {
      if (isPlayingSomething()) {
        navigator.mediaSession.playbackState = 'playing';
      } else {
        navigator.mediaSession.playbackState = 'paused';
      }
    } catch (e) {}
  }

  // ==========================================================
  // VISIBILITY / PAGE LIFECYCLE
  // ==========================================================

  function handleVisibilityChange() {
    try {
      var hidden = document.hidden;
      window._pmBgPlayState.pageHidden = hidden;

      if (hidden) {
        window._pmBgPlayState.wasPlayingBeforeBackground = isPlayingSomething();
        log('entrou em 2º plano. Tocando:', window._pmBgPlayState.wasPlayingBeforeBackground);
        // NÃO bloqueia — o app pode querer saber
      } else {
        log('voltou ao 1º plano');
        updatePlaybackState();
        updateMediaSession();
      }
    } catch (e) {}
  }

  function handlePageHide() {
    try {
      window._pmBgPlayState.wasPlayingBeforeBackground = isPlayingSomething();
      log('pagehide — estado:', window._pmBgPlayState.wasPlayingBeforeBackground);
    } catch (e) {}
  }

  function handlePageShow() {
    try {
      log('pageshow');
      updatePlaybackState();
      updateMediaSession();
    } catch (e) {}
  }

  function handleOnline() {
    window._pmBgPlayState.offline = false;
    log('online');
    updateMediaSession();
  }

  function handleOffline() {
    window._pmBgPlayState.offline = true;
    log('offline');
  }

  // ==========================================================
  // BIND DO AUDIO NATIVO
  // ==========================================================

  function bindNativeAudio(audio) {
    if (!audio || audio._pmBackgroundBound) return;
    audio._pmBackgroundBound = true;
    _boundAudio = audio;

    try {
      audio.addEventListener('play', function () {
        updateMediaSession();
        if (mediaSessionSupported()) {
          try { navigator.mediaSession.playbackState = 'playing'; } catch (e) {}
        }
      });

      audio.addEventListener('pause', function () {
        if (mediaSessionSupported()) {
          try { navigator.mediaSession.playbackState = 'paused'; } catch (e) {}
        }
      });

      audio.addEventListener('ended', function () {
        mediaNextTrack();
      });

      audio.addEventListener('loadedmetadata', function () {
        updateMediaSession();
      });

      // Atualiza position state periodicamente enquanto tocar
      audio.addEventListener('timeupdate', function () {
        if (!isFinite(audio.duration) || audio.duration <= 0) return;
        try {
          navigator.mediaSession.setPositionState({
            duration: audio.duration,
            playbackRate: audio.playbackRate || 1,
            position: Math.min(audio.currentTime, audio.duration)
          });
        } catch (e) {}
      });

      log('áudio nativo vinculado');
    } catch (e) {}
  }

  function bindAvailableAudio() {
    try {
      var audio = getNativeAudio();
      if (audio) bindNativeAudio(audio);
    } catch (e) {}
  }

  // ==========================================================
  // MONITOR DO PLAYER
  // ==========================================================

  function monitorPlayer() {
    var lastState = -1;

    setInterval(function () {
      if (!window._pmBgPlayEnabled) return;
      try {
        bindAvailableAudio();

        var state = getYouTubeState();
        if (state !== lastState) {
          lastState = state;
          window._pmBgPlayState.lastPlayerState = state;
          updatePlaybackState();
          if (state === 1 || state === 3) {
            updateMediaSession();
          }
        }
      } catch (e) {}
    }, CFG.checkInterval);
  }

  // ==========================================================
  // OBSERVA DOM (para pegar <audio> criado dinamicamente)
  // ==========================================================

  function observeAudio() {
    try {
      if (!window.MutationObserver) return;
      var observer = new MutationObserver(function () {
        bindAvailableAudio();
      });
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    } catch (e) {}
  }

  // ==========================================================
  // INTERAÇÕES DO USUÁRIO
  // ==========================================================

  function bindUserInteraction() {
    var events = ['click', 'touchstart', 'pointerdown', 'keydown'];
    events.forEach(function (eventName) {
      try {
        document.addEventListener(eventName, registerUserInteraction, {
          once: true,
          passive: true,
          capture: true
        });
      } catch (e) {
        try {
          document.addEventListener(eventName, registerUserInteraction, true);
        } catch (e2) {}
      }
    });
  }

  // ==========================================================
  // PWA / MOBILE
  // ==========================================================

  function detectPWA() {
    if (isStandalonePWA()) log('📱 PWA standalone');
    if (isMobile()) log('📱 mobile');
    if (isOffline()) {
      window._pmBgPlayState.offline = true;
      log('📴 offline');
    }
  }

  // ==========================================================
  // ENABLE / DISABLE
  // ==========================================================

  function enable() {
    window._pmBgPlayEnabled = true;
    setupMediaSession();
    bindAvailableAudio();
    log('✅ background play ATIVADO');
    return true;
  }

  function disable() {
    window._pmBgPlayEnabled = false;
    if (mediaSessionSupported()) {
      try { navigator.mediaSession.playbackState = 'none'; } catch (e) {}
    }
    log('⏸️ background play DESATIVADO');
    return true;
  }

  // ==========================================================
  // STATUS
  // ==========================================================

  function status() {
    var output = {
      version: VERSION,
      enabled: window._pmBgPlayEnabled,
      initialized: window._pmBgPlayState.initialized,
      stateReady: window._pmBgPlayState.stateReady,
      playing: isPlayingSomething(),
      pageHidden: document.hidden,
      visibilityState: document.visibilityState,
      mobile: isMobile(),
      standalonePWA: isStandalonePWA(),
      offline: window._pmBgPlayState.offline,
      mediaSession: mediaSessionSupported(),
      mediaSessionActive: window._pmBgPlayState.mediaSessionActive,
      nativeAudio: !!getNativeAudio(),
      youtubePlayer: !!getYouTubePlayer(),
      youtubeState: getYouTubeState(),
      userInteracted: window._pmBgPlayState.userInteracted,
      wasPlayingBeforeBackground: window._pmBgPlayState.wasPlayingBeforeBackground,
      preferNative: window._pmBgPlayPreferNative,
      aggressive: window._pmBgPlayAggressive,
      aggressiveResumeCount: window._pmBgPlayState.aggressiveResumeCount
    };
    log('STATUS:', output);
    return output;
  }

  // ==========================================================
  // MODO AGRESSIVO (v1.1.1 preservado)
  // ==========================================================

  function _aggShouldBlock() {
    return (
      window._pmBgPlayAggressive === true &&
      window._pmBgPlayEnabled === true &&
      isPlayingSomething()
    );
  }

  function _aggVisibilityFn(e) {
    if (!_aggShouldBlock()) return;
    try {
      e.stopImmediatePropagation();
      e.stopPropagation();
      log('🛡️ [AGG] visibilitychange bloqueado');
    } catch (err) {}
  }

  function _aggPageHideFn(e) {
    if (!_aggShouldBlock()) return;
    try {
      e.stopImmediatePropagation();
      e.stopPropagation();
      log('🛡️ [AGG] pagehide bloqueado');
    } catch (err) {}
  }

  function _aggWatchFn() {
    if (window._pmBgPlayAggressive !== true ||
        window._pmBgPlayEnabled !== true) {
      return;
    }

    try {
      var player = getYouTubePlayer();
      if (!player || typeof player.getPlayerState !== 'function') return;

      var current = player.getPlayerState();

      if (_aggLastState === 1 && current === 2) {
        var now = Date.now();

        if (now - window._pmBgPlayState.aggressiveLastResumeAt >
            CFG.aggressiveResumeWindow) {
          window._pmBgPlayState.aggressiveResumeCount = 0;
        }

        if (window._pmBgPlayState.aggressiveResumeCount >=
            CFG.aggressiveMaxResumes) {
          warn('🛡️ [AGG] limite de retomadas — desistindo');
          disableAggressive();
          return;
        }

        window._pmBgPlayState.aggressiveResumeCount++;
        window._pmBgPlayState.aggressiveLastResumeAt = now;

        log('🛡️ [AGG] pausa fantasma — retomando (' +
            window._pmBgPlayState.aggressiveResumeCount + '/' +
            CFG.aggressiveMaxResumes + ')');

        try { player.playVideo(); } catch (err) {}
      }

      _aggLastState = current;
    } catch (err) {}
  }

  function enableAggressive() {
    if (window._pmBgPlayAggressive === true) {
      log('🛡️ [AGG] já ativo');
      return true;
    }

    window._pmBgPlayAggressive = true;
    window._pmBgPlayState.aggressiveActive = true;
    window._pmBgPlayState.aggressiveResumeCount = 0;
    window._pmBgPlayState.aggressiveLastResumeAt = 0;
    _aggLastState = null;

    if (!_aggVisibilityHandler) {
      _aggVisibilityHandler = _aggVisibilityFn;
      ['visibilitychange', 'webkitvisibilitychange',
       'mozvisibilitychange', 'msvisibilitychange'].forEach(function (evt) {
        try { document.addEventListener(evt, _aggVisibilityHandler, true); } catch (e) {}
      });
    }

    if (!_aggPageHideHandler) {
      _aggPageHideHandler = _aggPageHideFn;
      try {
        window.addEventListener('pagehide', _aggPageHideHandler, true);
      } catch (e) {}
    }

    if (!_aggWatchTimer) {
      _aggWatchTimer = setInterval(_aggWatchFn, CFG.aggressiveWatchInterval);
    }

    log('🛡️ [AGG] ✅ ATIVADO');
    return true;
  }

  function disableAggressive() {
    if (window._pmBgPlayAggressive !== true) {
      log('🛡️ [AGG] já desligado');
      return true;
    }

    window._pmBgPlayAggressive = false;
    window._pmBgPlayState.aggressiveActive = false;

    if (_aggVisibilityHandler) {
      ['visibilitychange', 'webkitvisibilitychange',
       'mozvisibilitychange', 'msvisibilitychange'].forEach(function (evt) {
        try { document.removeEventListener(evt, _aggVisibilityHandler, true); } catch (e) {}
      });
      _aggVisibilityHandler = null;
    }

    if (_aggPageHideHandler) {
      try {
        window.removeEventListener('pagehide', _aggPageHideHandler, true);
      } catch (e) {}
      _aggPageHideHandler = null;
    }

    if (_aggWatchTimer) {
      clearInterval(_aggWatchTimer);
      _aggWatchTimer = null;
    }

    _aggLastState = null;
    log('🛡️ [AGG] ⏸️ DESATIVADO');
    return true;
  }

  function isAggressive() {
    return window._pmBgPlayAggressive === true;
  }

  // ==========================================================
  // PREFERÊNCIA NATIVO vs YOUTUBE
  // ==========================================================

  function preferNativeAudio(flag) {
    window._pmBgPlayPreferNative = !!flag;
    log('preferNative =', window._pmBgPlayPreferNative);
    return window._pmBgPlayPreferNative;
  }

  // ==========================================================
  // INIT
  // ==========================================================

  function init() {
    if (window._pmBgPlayState.initialized) return;
    window._pmBgPlayState.initialized = true;

    log('🎵 inicializando PlayMy Background Play v' + VERSION);

    // Listeners de lifecycle (NÃO bloqueiam)
    document.addEventListener('visibilitychange', handleVisibilityChange, false);
    window.addEventListener('pagehide', handlePageHide, false);
    window.addEventListener('pageshow', handlePageShow, false);
    window.addEventListener('online', handleOnline, false);
    window.addEventListener('offline', handleOffline, false);

    // Interação
    bindUserInteraction();

    // Media Session (pode ser reconfigurada quando state chegar)
    setupMediaSession();

    // Áudio (tenta agora e depois quando state chegar)
    bindAvailableAudio();
    observeAudio();

    // PWA / mobile / offline
    detectPWA();

    // Monitoramento
    monitorPlayer();

    // Aguarda window.state e refaz setup completo
    waitForState(function () {
      bindAvailableAudio();
      setupMediaSession();
      updatePlaybackState();
      log('setup completo pós-state');
    });

    // Modo agressivo (se configurado por padrão)
    if (CFG.aggressiveByDefault) {
      enableAggressive();
    }

    log('✅ PlayMy Background Play inicializado');
  }

  // ==========================================================
  // API PÚBLICA
  // ==========================================================

  window.pmBackgroundPlay = {
    version: VERSION,

    // v1.1.0 — core
    enable: enable,
    disable: disable,
    status: status,
    isPlaying: isPlayingSomething,
    updateMediaSession: updateMediaSession,
    updatePlaybackState: updatePlaybackState,
    getPlayer: getYouTubePlayer,

    // v1.1.1 — agressivo
    enableAggressive: enableAggressive,
    disableAggressive: disableAggressive,
    isAggressive: isAggressive,

    // v1.1.2 — novos
    preferNativeAudio: preferNativeAudio,
    getNativeAudio: getNativeAudio,
    refresh: function () {
      bindAvailableAudio();
      setupMediaSession();
      updatePlaybackState();
      updateMediaSession();
      return true;
    },
    config: CFG
  };

  // ==========================================================
  // BOOT
  // ==========================================================

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

})();
