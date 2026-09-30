// ============================================================
// js/logger.js — PLAY MY v1.0.0
// Logger centralizado com gate de login.
//
// COMPORTAMENTO:
//   - Antes do login: console.log/info/warn/debug são SILENCIADOS
//   - Depois do login: todos os logs aparecem normalmente
//   - console.error SEMPRE passa (erros são importantes)
//   - Logs de terceiros (YouTube, Bootstrap) são silenciados
//   - Controle manual via window.pmLogger.enable() / .disable()
//
// USO:
//   Adicionar ANTES dos módulos no index.html:
//   <script src="/js/background-play.js"></script>
//   <script src="/js/logger.js"></script>       ← este arquivo
//   <script src="/js/config.js"></script>
//   ...
//
// CONTROLE MANUAL (console F12):
//   window.pmLogger.status()   → ver estado atual
//   window.pmLogger.enable()   → ativar logs (mesmo sem login)
//   window.pmLogger.disable()  → desativar logs
// ============================================================

(function () {
  'use strict';

  // ============ CONFIGURAÇÃO ============
  const DEBUG_MODE_DEFAULT = false;   // padrão: silencioso até o login
  const SILENT_HOSTS = [              // hosts cujos logs silenciamos
    'www-widgetapi',
    'youtube.com',
    'cdn.jsdelivr',
    'bootstrap'
  ];

  // ============ ESTADO ============
  window.PM_DEBUG = DEBUG_MODE_DEFAULT;
  window._pmLoggerReady = true;
  window._pmOriginalConsole = {
    log:   console.log.bind(console),
    info:  console.info.bind(console),
    warn:  console.warn.bind(console),
    debug: console.debug.bind(console),
    error: console.error.bind(console)  // sempre passa
  };

  // ============ HELPERS ============
  function _isLoggedIn() {
    try {
      // 1. state.currentUser existe e tem id?
      if (window.state && window.state.currentUser && window.state.currentUser.id) {
        return true;
      }
      // 2. Fallback: localStorage tem miv_user?
      var raw = localStorage.getItem('miv_user');
      if (raw) {
        var u = JSON.parse(raw);
        if (u && u.id) return true;
      }
    } catch (e) {}
    return false;
  }

  function _deveLogar() {
    // 1. Debug manual ligado?
    if (window.PM_DEBUG === true) return true;
    // 2. Usuário logado?
    if (_isLoggedIn()) return true;
    // 3. Caso contrário: não loga
    return false;
  }

  function _callerEhTerceiro() {
    // Se o stack contém um dos hosts silenciados, ignora
    try {
      var stack = new Error().stack || '';
      for (var i = 0; i < SILENT_HOSTS.length; i++) {
        if (stack.indexOf(SILENT_HOSTS[i]) !== -1) return true;
      }
    } catch (e) {}
    return false;
  }

  // ============ PATCH DO CONSOLE ============
  ['log', 'info', 'warn', 'debug'].forEach(function (level) {
    console[level] = function () {
      // Silencia logs de terceiros
      if (_callerEhTerceiro()) return;

      // Gate de login
      if (!_deveLogar()) return;

      // Chama o console original
      window._pmOriginalConsole[level].apply(console, arguments);
    };
  });

  // error SEMPRE passa (não queremos esconder erros reais)
  console.error = function () {
    var args = Array.prototype.slice.call(arguments);
    window._pmOriginalConsole.error.apply(console, args);
  };

  // ============ API PÚBLICA ============
  window.pmLogger = {
    enable: function () {
      window.PM_DEBUG = true;
      window._pmOriginalConsole.log('[PM] 🔓 Logger ATIVADO manualmente');
    },
    disable: function () {
      window.PM_DEBUG = false;
      window._pmOriginalConsole.log('[PM] 🔒 Logger DESATIVADO manualmente');
    },
    status: function () {
      var logged = _isLoggedIn();
      var out = {
        debug_manual: window.PM_DEBUG,
        logged_in: logged,
        effective: _deveLogar(),
        hint: 'Use window.pmLogger.enable() / .disable()'
      };
      window._pmOriginalConsole.log('[PM] Status do logger:', out);
      return out;
    }
  };

  // ============ HOOKS AUTOMÁTICOS ============
  // Quando fizer login, libera os logs automaticamente
  // Quando fizer logout, volta a silenciar

  // 1. Intercepta fetch para detectar login bem-sucedido
  var _origFetch = window.fetch;
  window.fetch = function () {
    return _origFetch.apply(this, arguments).then(function (response) {
      try {
        var url = response.url || '';
        // Se foi uma chamada de login bem-sucedida
        if (url.indexOf('action=login') !== -1 && response.ok) {
          setTimeout(function () {
            if (_isLoggedIn()) {
              window.PM_DEBUG = true;
              window._pmOriginalConsole.log('[PM] 🔓 Login detectado — logs ativados');
            }
          }, 500);
        }
        // Se foi logout
        if (url.indexOf('action=logout') !== -1) {
          setTimeout(function () {
            window.PM_DEBUG = false;
            window._pmOriginalConsole.log('[PM] 🔒 Logout detectado — logs desativados');
          }, 500);
        }
      } catch (e) {}
      return response;
    });
  };

  // 2. Também monitora mudanças no state (fallback)
  setInterval(function () {
    if (!window.state) return;
    var wasLogged = window._pmLastLoggedState || false;
    var isLogged = _isLoggedIn();
    if (isLogged !== wasLogged) {
      window._pmLastLoggedState = isLogged;
      if (isLogged) {
        window.PM_DEBUG = true;
        window._pmOriginalConsole.log('[PM] 🔓 state detectou login — logs ativados');
      } else {
        window.PM_DEBUG = false;
        window._pmOriginalConsole.log('[PM] 🔒 state detectou logout — logs desativados');
      }
    }
  }, 1000);

  // ============ LOG DE BOOT (sempre visível, é meta) ============
  window._pmOriginalConsole.log(
    '%c🔇 [PM] Logger ativo — logs silenciados até o login',
    'color: #8e8e93; font-style: italic'
  );
  window._pmOriginalConsole.log(
    '%c💡 Para ativar agora: window.pmLogger.enable()',
    'color: #ffcc00; font-size: 11px'
  );
})();
