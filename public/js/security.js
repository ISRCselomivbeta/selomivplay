
/* ============================================================
 * js/security.js — PLAY MY v1.4.2
 *
 * Camada auxiliar de segurança e UX.
 *
 * COMPATIBILIDADE:
 * - Mantém window.PMSecurity.
 * - Mantém escapeForDisplay(), isSafeUrl(),
 *   isInternalUrl() e init().
 * - Mantém PM_SECURITY_CONFIG.
 * - Não intercepta navegação global.
 * - Não altera a URL nem sobrescreve APIs do navegador.
 *
 * IMPORTANTE:
 * - A segurança de autenticação e operações financeiras
 *   precisa ser aplicada também no backend.
 * - CSP e cabeçalhos HTTP devem ser configurados no servidor.
 * - Bloqueio de arrastar imagens é somente UX.
 *
 * Carregamento recomendado:
 * depois de logger.js e antes de config.js.
 * ============================================================ */

(function () {
  'use strict';

  // Evita registrar novamente a camada caso o arquivo
  // seja incluído acidentalmente mais de uma vez.
  if (window.PMSecurity) {
    return;
  }

  // ==========================================================
  // 1. CONFIGURAÇÃO
  // ==========================================================

  var DEFAULT_CONFIG = {
    blockImageDrag: true,
    blockWindowOpener: true,
    debug: true
  };

  function validateConfig(raw) {
    var result = {};

    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return result;
    }

    ['blockImageDrag', 'blockWindowOpener', 'debug'].forEach(
      function (key) {
        if (
          Object.prototype.hasOwnProperty.call(raw, key) &&
          typeof raw[key] === 'boolean'
        ) {
          result[key] = raw[key];
        }
      }
    );

    return result;
  }

  var CONFIG = Object.assign(
    {},
    DEFAULT_CONFIG,
    validateConfig(window.PM_SECURITY_CONFIG)
  );

  // ==========================================================
  // 2. LOG
  // ==========================================================

  function log() {
    if (!CONFIG.debug) return;

    try {
      var args = Array.prototype.slice.call(arguments);
      args.unshift('[security]');
      console.log.apply(console, args);
    } catch (e) {
      // O logger não deve interromper o aplicativo.
    }
  }

  // ==========================================================
  // 3. ESTADO DE INICIALIZAÇÃO
  // ==========================================================

  var initialized = false;
  var imageDragListenerAdded = false;
  var imageDragStyleAdded = false;
  var domReadyListenerAdded = false;

  // ==========================================================
  // 4. BLOQUEIO DE DRAG DE IMAGEM — APENAS UX
  // ==========================================================

  function setupImageDragBlock() {
    if (!CONFIG.blockImageDrag) return;

    if (!imageDragListenerAdded) {
      document.addEventListener('dragstart', onDragStart);
      imageDragListenerAdded = true;
    }

    if (
      !imageDragStyleAdded &&
      document.head &&
      !document.getElementById('pm-security-img-drag')
    ) {
      var style = document.createElement('style');

      style.id = 'pm-security-img-drag';
      style.textContent =
        'img{-webkit-user-drag:none;user-drag:none;}';

      document.head.appendChild(style);
      imageDragStyleAdded = true;
    }

    log('Bloqueio de arrastar imagens ativo (UX).');
  }

  function onDragStart(event) {
    var target = event.target;

    if (
      target &&
      target.nodeType === 1 &&
      String(target.tagName).toUpperCase() === 'IMG'
    ) {
      event.preventDefault();
    }
  }

  // ==========================================================
  // 5. WINDOW.OPENER — MITIGAÇÃO LIMITADA
  // ==========================================================

  function setupWindowOpenerBlock() {
    if (!CONFIG.blockWindowOpener) return;

    // Uma página aberta diretamente normalmente já terá
    // window.opener === null.
    //
    // A proteção principal deve ser aplicada no link de origem:
    // target="_blank" rel="noopener noreferrer"
    //
    // Não tentamos alterar window.opener: a atribuição não é
    // uma garantia universal e pode não ter o efeito esperado.
    try {
      if (window.opener) {
        log(
          'window.opener detectado. ' +
          'Verifique rel="noopener noreferrer" no link de origem.'
        );
      }
    } catch (e) {
      // A verificação é apenas diagnóstica.
    }
  }

  // ==========================================================
  // 6. INICIALIZAÇÃO IDEMPOTENTE
  // ==========================================================

  function init() {
    if (initialized) {
      return;
    }

    initialized = true;

    log('Inicializando camada de segurança v1.4.2.');

    setupImageDragBlock();
    setupWindowOpenerBlock();

    log('Camada auxiliar de segurança inicializada.');
  }

  function scheduleInit() {
    if (document.readyState === 'loading') {
      if (!domReadyListenerAdded) {
        domReadyListenerAdded = true;

        document.addEventListener(
          'DOMContentLoaded',
          init,
          { once: true }
        );
      }

      return;
    }

    init();
  }

  // ==========================================================
  // 7. VALIDAÇÃO DE HOSTS E PROTOCOLOS
  // ==========================================================

  function normalizeProtocol(protocol) {
    if (typeof protocol !== 'string') return '';

    var value = protocol.trim().toLowerCase();

    if (!value) return '';

    if (value.charAt(value.length - 1) !== ':') {
      value += ':';
    }

    return value;
  }

  function normalizeHost(host) {
    if (typeof host !== 'string') return '';

    var value = host.trim().toLowerCase();

    // Aceita hostname simples ou hostname internacional
    // já convertido para sua representação ASCII.
    if (!value || value.length > 253) return '';

    // Não aceita URLs, caminhos, portas, curingas,
    // credenciais ou espaços na lista de hosts.
    if (/[\s\/\\:*?#@]/.test(value)) return '';

    // Ponto final é permitido na representação de FQDN.
    value = value.replace(/\.$/, '');

    if (!value || value.charAt(0) === '.') return '';

    var labels = value.split('.');

    for (var i = 0; i < labels.length; i++) {
      var label = labels[i];

      if (
        !label ||
        label.length > 63 ||
        !/^[a-z0-9-]+$/.test(label) ||
        label.charAt(0) === '-' ||
        label.charAt(label.length - 1) === '-'
      ) {
        return '';
      }
    }

    return value;
  }

  function getAllowedProtocols(allowedProtocols) {
    if (allowedProtocols === undefined) {
      return ['https:'];
    }

    if (
      !Array.isArray(allowedProtocols) ||
      allowedProtocols.length === 0
    ) {
      return [];
    }

    var protocols = [];

    for (var i = 0; i < allowedProtocols.length; i++) {
      var protocol = normalizeProtocol(allowedProtocols[i]);

      if (
        protocol !== 'http:' &&
        protocol !== 'https:'
      ) {
        return [];
      }

      if (protocols.indexOf(protocol) === -1) {
        protocols.push(protocol);
      }
    }

    return protocols;
  }

  function getAllowedHosts(allowedHosts) {
    if (!Array.isArray(allowedHosts)) return [];

    var hosts = [];

    for (var i = 0; i < allowedHosts.length; i++) {
      var host = normalizeHost(allowedHosts[i]);

      // Uma entrada inválida não deve autorizar nenhum host.
      if (!host) return [];

      if (hosts.indexOf(host) === -1) {
        hosts.push(host);
      }
    }

    return hosts;
  }

  function parseAbsoluteHttpUrl(value) {
    if (typeof value !== 'string') return null;

    var input = value.trim();

    if (!input || input.length > 8192) return null;

    // Não permite caminhos relativos, URLs protocol-relative
    // ou esquemas diferentes de HTTP/HTTPS.
    if (!/^https?:\/\//i.test(input)) return null;

    try {
      var parsed = new URL(input);

      if (
        parsed.protocol !== 'http:' &&
        parsed.protocol !== 'https:'
      ) {
        return null;
      }

      if (!parsed.hostname) return null;

      if (parsed.username || parsed.password) {
        return null;
      }

      return parsed;
    } catch (e) {
      return null;
    }
  }

  // ==========================================================
  // 8. API PÚBLICA
  // ==========================================================

  var api = {
    version: '1.4.2',

    config: Object.freeze(CONFIG),

    /**
     * Escapa texto para inserção em contexto de texto HTML.
     *
     * Prefira textContent.
     * Não use como sanitizador universal de HTML, CSS,
     * JavaScript, URLs ou atributos de contexto especial.
     */
    escapeForDisplay: function (value) {
      if (typeof value !== 'string') return value;

      return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },

    /**
     * Valida uma URL EXTERNA absoluta.
     *
     * A whitelist é obrigatória e exige correspondência exata
     * do hostname. Subdomínios não são autorizados implicitamente.
     *
     * Por segurança, o protocolo padrão é HTTPS.
     * Para HTTP, passe ['http:', 'https:'] explicitamente.
     *
     * Não abre a URL nem substitui a validação no servidor.
     */
    isSafeUrl: function (
      url,
      allowedHosts,
      allowedProtocols
    ) {
      var hosts = getAllowedHosts(allowedHosts);
      var protocols = getAllowedProtocols(allowedProtocols);

      if (!hosts.length || !protocols.length) {
        return false;
      }

      var parsed = parseAbsoluteHttpUrl(url);

      if (!parsed) return false;

      if (protocols.indexOf(parsed.protocol) === -1) {
        return false;
      }

      var host = normalizeHost(parsed.hostname);

      if (!host || hosts.indexOf(host) === -1) {
        return false;
      }

      // Esta função trata somente destinos externos.
      if (parsed.origin === window.location.origin) {
        return false;
      }

      return true;
    },

    /**
     * Valida uma URL interna da mesma origem.
     *
     * Aceita caminhos relativos e URLs absolutas da mesma origem.
     * Rejeita protocolos diferentes de HTTP/HTTPS.
     *
     * Não significa que a rota está autorizada para o usuário.
     */
    isInternalUrl: function (url) {
      if (typeof url !== 'string' || !url.trim()) {
        return false;
      }

      var input = url.trim();

      if (input.length > 8192) return false;

      try {
        var parsed = new URL(
          input,
          window.location.origin
        );

        if (
          parsed.protocol !== 'http:' &&
          parsed.protocol !== 'https:'
        ) {
          return false;
        }

        if (parsed.origin !== window.location.origin) {
          return false;
        }

        if (parsed.username || parsed.password) {
          return false;
        }

        return true;
      } catch (e) {
        return false;
      }
    },

    /**
     * Inicialização idempotente.
     * Não altera a configuração após a criação do módulo.
     */
    init: init
  };

  // Publica a API uma única vez.
  window.PMSecurity = api;

  // Inicia os recursos opcionais.
  scheduleInit();

})();
