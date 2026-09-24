// ============================================================
// js/api.js — PLAY MY v8.9.2
// HealthCheck + callAPI (roteador multi-API + Vercel → GAS → Local).
// Depende de: config.js, utils.js, state.js
// DEVE carregar DEPOIS de state.js e ANTES de auth.js.
//
// MUDANÇAS v8.9.2:
//   - 🔧 Bump de versão (8.9.1 → 8.9.2) para forçar atualização no cache
//   - Nenhuma mudança funcional
//
// MUDANÇAS v8.9.1:
//   - 🆕 DEDUP: chamadas idênticas simultâneas compartilham a mesma promise
//   - 🆕 CACHE curto (5s) para ações de leitura (evita re-fetch em cascata)
//   - 🆕 VALIDAÇÃO: success:true sem "data" em ações que exigem data → inválido
//   - 🆕 debug: window.callAPI.clearCache() limpa dedup + cache
//
// MUDANÇAS v8.9.0:
//   - 🆕 Suporte a MÚLTIPLAS APIs do Vercel
//   - 🆕 API_ENDPOINTS mapeia cada action para o endpoint correto
//   - 🆕 callAPI detecta automaticamente qual endpoint usar
//   - Mantém fallback GAS para actions que ele conhece
// ============================================================

// ============================================================
// MAPEAMENTO DE APIS — qual endpoint usar para cada action
// ============================================================
const API_ENDPOINTS = {
    // STREAMS (/api/streams)
    'registrar_stream':     'streams',
    'ver_stream':           'streams',
    'streams_total':        'streams',
    'streams_ranking':      'streams',
    'streaming_total':      'streams',

    // VALUATION (/api/valuation)
    'calcular_valuation':   'valuation',
    'valuation_catalogo':   'valuation',
    'ver_valuation':        'valuation',
    'valuation_mercado':    'valuation',
    'ultimo_catalogo':      'valuation',

    // ROYALTIES (/api/royalties)
    'importar_royalties':   'royalties',
    'royalties_periodos':   'royalties',
    'royalties_status':     'royalties',
    'distribuir_royalties': 'royalties',
    'distribuir_tudo':      'royalties',
    'extrato_usuario':      'royalties',
    'royalties_resumo':     'royalties',
    'royalties_extrato':    'royalties',

    // ELO (/api/elo)
    'calcular_elo':         'elo',
    'ver_elo':              'elo',
    'get_elo_ranking':      'elo',
    'atualizar_todos_elos': 'elo',

    // ISRC (/api/isrc)
    'validar_isrc':         'isrc',
    'buscar_isrc':          'isrc',
    'vincular_isrc':        'isrc',
    'ver_isrc':             'isrc',
    'listar_isrcs':         'isrc',

    // PLAYLISTS (backend principal /api/backend)
    'get_playlists':                        'backend',
    'create_playlist':                      'backend',
    'add_music_to_playlist':                'backend',
    'remove_music_from_playlist':           'backend',
    'get_global_playlists':                 'backend',
    'create_global_playlist':               'backend',
    'add_music_to_global_playlist':         'backend',
    'remove_music_from_global_playlist':    'backend',

    // AUTH + FINANCEIRO (backend principal /api/backend)
    'login':                        'backend',
    'register':                     'backend',
    'reset_password':               'backend',
    'request_password_reset':       'backend',
    'verify_reset_token':           'backend',
    'request_withdrawal':           'backend',
    'buy':                          'backend',
    'buy_external':                 'backend',
    'sell_to_market':               'backend',
    'create_trade':                 'backend',
    'accept_trade':                 'backend',
    'decline_trade':                'backend',
    'cancel_trade':                 'backend',
    'get_saldo':                    'backend',
    'get_carteira':                 'backend',
    'get_extrato':                  'backend',
    'get_trades':                   'backend',
    'get_following':                'backend',
    'toggle_follow':                'backend',
    'toggle_favorite':              'backend',
    'get_tickets':                  'backend',
    'redeem_ticket':                'backend',
    'create_ticket':                'backend',
    'get_user_profile':             'backend',
    'update_profile':               'backend',
    'upload_music':                 'backend',
    'update_music':                 'backend',
    'pause_music':                  'backend',
    'delete_music':                 'backend',
    'get_artist_data':              'backend',
    'search_youtube':               'backend',
    'search_isrc':                  'backend',
    'get_youtube_stats':            'backend',
    'register_streaming':           'backend',
    'get_streaming_stats':          'backend',
    'get_top_investments':          'backend',
    'get_external_musicas':         'backend',
    'suggest_external_music':       'backend',
    'get_news':                     'backend',
    'mark_news_seen':               'backend',
    'track_news_interaction':       'backend',
    'get_mining_blocks':            'backend',
    'add_block':                    'backend',
    'get_stats':                    'backend',
    'get_admin_stats':              'backend'
};

// ============================================================
// MAPA DE URLS DOS ENDPOINTS
// ============================================================
const ENDPOINT_URLS = {
    'backend':   '/api/backend',
    'streams':   '/api/streams',
    'valuation': '/api/valuation',
    'royalties': '/api/royalties',
    'elo':       '/api/elo',
    'isrc':      '/api/isrc'
};

// ============================================================
// AÇÕES QUE EXIGEM "data" NA RESPOSTA
// Se vierem com success:true mas SEM data → considerar inválido
// ============================================================
const ACOES_EXIGEM_DATA = [
    'valuation_catalogo', 'ver_valuation', 'calcular_valuation', 'ultimo_catalogo',
    'ver_stream', 'streams_total', 'streams_ranking',
    'get_elo_ranking', 'ver_elo', 'calcular_elo',
    'royalties_resumo', 'royalties_periodos', 'extrato_usuario',
    'get_saldo', 'get_carteira', 'get_extrato', 'get_musicas', 'get_artists',
    // Playlists — exigem data na resposta
    'get_playlists', 'create_playlist',
    'get_global_playlists', 'create_global_playlist',
    'add_music_to_playlist', 'remove_music_from_playlist',
    'add_music_to_global_playlist', 'remove_music_from_global_playlist'
];

// ============================================================
// AÇÕES DE LEITURA (elegíveis a cache curto)
// Não inclui mutações nem ações críticas
// ============================================================
const ACOES_CACHEAVEIS = [
    'valuation_catalogo', 'ver_valuation', 'ultimo_catalogo', 'valuation_mercado',
    'ver_stream', 'streams_total', 'streams_ranking',
    'get_elo_ranking', 'ver_elo',
    'royalties_resumo', 'royalties_periodos',
    'get_musicas', 'get_artists', 'get_extrato', 'get_carteira',
    'get_top_investments',
    'get_news', 'get_mining_blocks'
];

const CACHE_TTL_MS = 5000; // 5 segundos

// ============================================================
// HEALTH CHECK
// ============================================================
window.HealthCheck = {
  vercel: { online: null },
  gas: { online: null },
  mode: 'checking',

  async testVercel() {
    const url = ENDPOINT_URLS.backend + '?action=ping';
    try {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 8000);

      const r = await fetch(url, { signal: c.signal });
      clearTimeout(t);

      console.log('🔍 Vercel ping →', r.status, r.headers.get('content-type'));

      if (!r.ok) {
        console.warn('⚠️ Vercel HTTP', r.status, 'em', url);
        this.vercel.online = false;
        return false;
      }

      const text = await r.text();
      let d;
      try {
        d = JSON.parse(text);
      } catch (_) {
        console.warn('⚠️ Vercel não retornou JSON. Body:', text.slice(0, 200));
        this.vercel.online = false;
        return false;
      }

      const ok = d.success === true || d.pong === true || d.ok === true || (d && typeof d === 'object');
      this.vercel.online = ok;
      console.log('✅ Vercel ping:', d, '→ online =', ok);
      return ok;
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.warn('⚠️ Vercel offline:', e.name, e.message, '| url:', url);
      }
    }
    this.vercel.online = false;
    return false;
  },

  async testGAS() {
    const url = CONFIG.GAS_URL + '?action=health';
    try {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 12000);

      const r = await fetch(url, { signal: c.signal });
      clearTimeout(t);

      console.log('🔍 GAS health →', r.status);

      if (!r.ok) {
        console.warn('⚠️ GAS HTTP', r.status);
        this.gas.online = false;
        return false;
      }

      const text = await r.text();
      let d;
      try {
        d = JSON.parse(text);
      } catch (_) {
        console.warn('⚠️ GAS não-JSON:', text.slice(0, 200));
        this.gas.online = false;
        return false;
      }

      const ok = d && d.success !== false;
      this.gas.online = ok;
      console.log('✅ GAS health:', d, '→ online =', ok);
      return ok;
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.warn('⚠️ GAS offline:', e.name, e.message);
      }
    }
    this.gas.online = false;
    return false;
  },

  async runAll() {
    console.log('🔍 Health Check...');
    this.mode = 'checking';
    this.updateBadge();

    const vercelOk = await this.testVercel();

    if (vercelOk) {
      this.testGAS().catch(() => {});
      this.mode = 'vercel';
      console.log('✅ Vercel online — modo vercel');
    } else {
      const gasOk = await this.testGAS();
      if (gasOk) {
        this.mode = 'gas';
        console.warn('⚠️ Vercel offline — usando GAS direto');
        if (typeof showToast === 'function') {
          showToast('⚠️ Usando GAS direto', 'warning', 4000);
        }
      } else {
        this.mode = 'fallback';
        console.error('❌ Offline total — usando fallback local');
        if (typeof showToast === 'function') {
          showToast('❌ Sem conexão', 'error', 6000);
        }
      }
    }

    this.updateBadge();
    return this.mode;
  },

  updateBadge() {
    const b = document.getElementById('healthBadge');
    if (!b) return;

    const modes = {
      checking: { i: '🔄', t: 'Verificando', c: '#8e8e93', bg: 'rgba(142,142,147,0.15)' },
      vercel:   { i: '✅', t: 'Online',     c: '#34c759', bg: 'rgba(52,199,89,0.15)' },
      gas:      { i: '⚠️', t: 'GAS',        c: '#ffcc00', bg: 'rgba(255,204,0,0.15)' },
      fallback: { i: '❌', t: 'Offline',    c: '#ff3b30', bg: 'rgba(255,59,48,0.15)' }
    };

    const x = modes[this.mode] || modes.checking;
    b.innerHTML = x.i + ' ' + x.t;
    b.style.color = x.c;
    b.style.background = x.bg;
    b.style.borderColor = x.c;
  }
};

// ============================================================
// AÇÕES CRÍTICAS (não retentar)
// ============================================================
const ACOES_CRITICAS = [
  'login',
  'register',
  'reset_password',
  'request_withdrawal',
  'confirm_investment',
  'confirm_external_investment',
  'create_trade_offer',
  'accept_trade_offer',
  'confirm_sell'
];

// ============================================================
// DEDUP + CACHE (v8.9.1)
// ============================================================
const _inFlight = new Map();
const _cache    = new Map();

function _keyFor(action, data) {
    const keys = Object.keys(data || {}).sort();
    const parts = keys.map(k => k + '=' + String(data[k]));
    return action + '|' + parts.join('&');
}

function _getCached(action, data) {
    if (!ACOES_CACHEAVEIS.includes(action)) return null;
    const k = _keyFor(action, data);
    const hit = _cache.get(k);
    if (!hit) return null;
    if (Date.now() - hit.at > CACHE_TTL_MS) {
        _cache.delete(k);
        return null;
    }
    return hit.json;
}

function _setCached(action, data, json) {
    if (!ACOES_CACHEAVEIS.includes(action)) return;
    if (!json || json.success === false) return;
    const k = _keyFor(action, data);
    _cache.set(k, { at: Date.now(), json });
}

// ============================================================
// VALIDAÇÃO DE RESPOSTA
// ============================================================
const ACOES_ACEITAM_FALSE = [
    'login',
    'register',
    'reset_password',
    'request_password_reset',
    'verify_reset_token',
    'buy',
    'buy_external',
    'sell_to_market',
    'create_trade',
    'accept_trade',
    'decline_trade',
    'cancel_trade',
    'request_withdrawal',
    'redeem_ticket'
];

function _isValidResponse(action, json) {
    if (!json || typeof json !== 'object') return false;

    if (ACOES_ACEITAM_FALSE.includes(action)) {
        if (json.message !== undefined || json.data !== undefined) {
            return true;
        }
        return false;
    }

    if (json.success === false) return false;

    if (ACOES_EXIGEM_DATA.includes(action)) {
        if (json.data === undefined || json.data === null) {
            console.warn(`⚠️ [${action}] respondeu success:true SEM data — tratando como inválido`);
            return false;
        }
    }
    return true;
}

// ============================================================
// OBTER ENDPOINT PARA UMA ACTION
// ============================================================
function getEndpointForAction(action) {
    const endpointKey = API_ENDPOINTS[action];
    if (endpointKey && ENDPOINT_URLS[endpointKey]) {
        return ENDPOINT_URLS[endpointKey];
    }
    return ENDPOINT_URLS.backend;
}

// ============================================================
// CONSTRUIR URL
// ============================================================
function buildUrl(baseUrl, action, data) {
    const isAbsolute = baseUrl.startsWith('http');
    const url = isAbsolute ? new URL(baseUrl) : new URL(baseUrl, window.location.origin);
    url.searchParams.append('action', action);
    Object.keys(data).forEach(k => {
        if (data[k] !== undefined && data[k] !== null) {
            url.searchParams.append(k, data[k]);
        }
    });
    return url.toString();
}

// ============================================================
// CALL API (roteador multi-API + Vercel → GAS → fallback)
// ============================================================
window.callAPI = async function (action, data, _retry) {
  _retry = _retry || 0;
  data = data || {};

  if (state && state.currentUser && state.currentUser.id && !data.user_id) {
    data.user_id = state.currentUser.id;
  }

  // DEDUP: mesma chamada em andamento → mesma promise
  if (_retry === 0) {
      const inFlightKey = _keyFor(action, data);
      if (_inFlight.has(inFlightKey)) {
          console.log(`♻️ [${action}] dedup — reutilizando promise em andamento`);
          return _inFlight.get(inFlightKey);
      }

      // CACHE: resposta recente (5s)
      const cached = _getCached(action, data);
      if (cached) {
          console.log(`📦 [${action}] cache hit (${CACHE_TTL_MS}ms)`);
          return cached;
      }
  }

  const _run = async () => {
      // TENTATIVA 1: API ESPECÍFICA (streams, valuation, royalties, elo, isrc)
      const specificEndpoint = getEndpointForAction(action);

      if (specificEndpoint !== ENDPOINT_URLS.backend) {
          const ctrl = new AbortController();
          const timeout = setTimeout(() => ctrl.abort(), 20000);

          try {
              const url = buildUrl(specificEndpoint, action, data);
              console.log(`🔍 [${action}] chamando ${specificEndpoint}`);

              const r = await fetch(url, {
                  signal: ctrl.signal,
                  headers: { 'Accept': 'application/json' }
              });
              clearTimeout(timeout);

              if (r.ok) {
                  const text = await r.text();
                  let json = null;
                  try {
                      json = JSON.parse(text);
                  } catch (_) {
                      const m = text.match(/\{[\s\S]*\}/);
                      if (m) {
                          try { json = JSON.parse(m[0]); } catch (_) {}
                      }
                  }

                  if (_isValidResponse(action, json)) {
                      console.log(`✅ [${action}] via ${specificEndpoint}`);
                      _setCached(action, data, json);
                      return json;
                  }

                  console.warn(`⚠️ [${action}] ${specificEndpoint} resposta inválida`, json);
              }
          } catch (e) {
              clearTimeout(timeout);
              if (e.name !== 'AbortError') {
                  console.warn(`⚠️ [${action}] ${specificEndpoint} erro:`, e.name, e.message);
              }
          }
      }

      // TENTATIVA 2: BACKEND PRINCIPAL (Vercel)
      const tryFetch = async (baseUrl, timeoutMs, label) => {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const isGAS = baseUrl.includes('script.google.com');
        const url = buildUrl(baseUrl, action, data);

        const fetchOptions = {
            signal: ctrl.signal,
            method: 'GET',
            redirect: 'follow'
        };
        if (!isGAS) {
            fetchOptions.headers = { 'Accept': 'application/json' };
        }

        const r = await fetch(url, fetchOptions);
        clearTimeout(timeout);

        if (!r.ok) {
            console.warn(`⚠️ [${action}] ${label} HTTP ${r.status}`);
            return null;
        }

        const text = await r.text();
        let json = null;
        try {
            json = JSON.parse(text);
        } catch (_) {
            const m = text.match(/\{[\s\S]*\}/);
            if (m) {
                try { json = JSON.parse(m[0]); } catch (_) {}
            }
        }

        if (_isValidResponse(action, json)) {
            console.log(`✅ [${action}] via ${label}`);
            return json;
        }

        console.warn(`⚠️ [${action}] ${label} resposta inválida`, json);
        return null;
    } catch (e) {
        clearTimeout(timeout);
        if (e.name !== 'AbortError') {
            console.warn(`⚠️ [${action}] ${label} erro:`, e.name, e.message);
        }
        return null;
    }
};

      // Tentar backend — SEMPRE na mesma origem do usuário
      const vercelJson = await tryFetch(ENDPOINT_URLS.backend, 20000, 'Vercel');
      if (vercelJson) {
        HealthCheck.vercel.online = true;
        if (HealthCheck.mode !== 'vercel') {
          HealthCheck.mode = 'vercel';
          HealthCheck.updateBadge();
        }
        _setCached(action, data, vercelJson);
        return vercelJson;
      }

      const isCritica = ACOES_CRITICAS.includes(action);

      if (!isCritica && _retry < 1) {
        await new Promise(r => setTimeout(r, 800));
        return callAPI(action, data, _retry + 1);
      }

      if (HealthCheck.vercel.online !== false) {
        HealthCheck.vercel.online = false;
        HealthCheck.mode = 'gas';
        HealthCheck.updateBadge();
        console.warn('⚠️ Vercel marcada offline — tentando GAS');
      }

      // TENTATIVA 3: GAS
      const gasJson = await tryFetch(CONFIG.GAS_URL, 30000, 'GAS');
      if (gasJson) {
        HealthCheck.gas.online = true;
        _setCached(action, data, gasJson);
        return gasJson;
      }

      // TENTATIVA 4: FALLBACK LOCAL
      console.warn(`📦 [${action}] fallback local`);
      return getFallbackData(action);
  };

  if (_retry === 0) {
      const inFlightKey = _keyFor(action, data);
      const p = (async () => {
          try {
              return await _run();
          } finally {
              _inFlight.delete(inFlightKey);
          }
      })();
      _inFlight.set(inFlightKey, p);
      return p;
  }

  return _run();
};

// ============================================================
// DEBUG — limpar caches
// ============================================================
window.callAPI.clearCache = function () {
    _inFlight.clear();
    _cache.clear();
    console.log('🧹 [api] caches limpos (dedup + TTL)');
};

// ============================================================
// FALLBACK LOCAL
// ============================================================
window.getFallbackData = function (action) {
  // AÇÕES CRÍTICAS — NUNCA retornar sucesso falso
  if (action === 'login') {
    return { success: false, message: 'Não foi possível conectar. Verifique sua internet e tente novamente.', _via: 'local', _offline: true };
  }
  if (action === 'register') {
    return { success: false, message: 'Cadastro indisponível offline. Tente novamente.', _via: 'local', _offline: true };
  }
  if (action === 'reset_password') {
    return { success: false, message: 'Recuperação indisponível offline. Tente novamente.', _via: 'local', _offline: true };
  }
  if (action === 'request_withdrawal') {
    return { success: false, message: 'Saque indisponível offline. Tente novamente.', _via: 'local', _offline: true };
  }
  if (action === 'confirm_investment') {
    return { success: false, message: 'Investimento indisponível offline.', _via: 'local', _offline: true };
  }
  if (action === 'confirm_external_investment') {
    return { success: false, message: 'Investimento externo indisponível offline.', _via: 'local', _offline: true };
  }
  if (action === 'create_trade_offer') {
    return { success: false, message: 'Negociação indisponível offline.', _via: 'local', _offline: true };
  }
  if (action === 'accept_trade_offer') {
    return { success: false, message: 'Aceitar negociação indisponível offline.', _via: 'local', _offline: true };
  }
  if (action === 'confirm_sell') {
    return { success: false, message: 'Venda indisponível offline.', _via: 'local', _offline: true };
  }

  // AÇÕES DE LEITURA
  if (action === 'get_musicas') return { success: true, data: [], _via: 'local' };
  if (action === 'get_external_musicas') return { success: true, data: [], _via: 'local' };
  if (action === 'get_artists') return { success: true, data: [], _via: 'local' };
  if (action === 'get_saldo') return { success: true, data: { saldo_disponivel: 0, selo_coin: 0 }, _via: 'local' };
  if (action === 'get_carteira') return { success: true, data: { investimentos: [], total_investido: 0, quantidade_itens: 0 }, _via: 'local' };
  if (action === 'get_extrato') return { success: true, data: [], _via: 'local' };
  if (action === 'get_playlists') return { success: true, data: [], _via: 'local' };
  if (action === 'get_global_playlists') return { success: true, data: [], _via: 'local' };
  if (action === 'get_tickets') return { success: true, data: [], _via: 'local' };
  if (action === 'get_news') return { success: true, data: [], has_more: false, _via: 'local' };
  if (action === 'mark_news_seen') return { success: true, _via: 'local' };
  if (action === 'track_news_interaction') return { success: true, _via: 'local' };
  if (action === 'get_mining_blocks') return { success: true, data: [], _via: 'local' };
  if (action === 'get_trades') return { success: true, data: { received: [], sent: [], history: [] }, _via: 'local' };
  if (action === 'get_top_investments') return { success: true, data: [], _via: 'local' };

  // AÇÕES DAS NOVAS APIs
  if (action === 'streams_total') return { success: true, data: { streams_total: 0, streams_hoje: 0, total_musicas: 0 }, _via: 'local' };
  if (action === 'streams_ranking') return { success: true, data: [], _via: 'local' };
  if (action === 'ver_stream') return { success: true, data: { total: 0, hoje: 0 }, _via: 'local' };
  if (action === 'valuation_catalogo') return { success: true, data: { valuation_total: 0, quantidade_musicas: 0, musicas: [] }, _via: 'local' };
  if (action === 'ultimo_catalogo') return { success: true, data: { valuation_total: 0, quantidade_musicas: 0, musicas: [] }, _via: 'local' };
  if (action === 'royalties_resumo') return { success: true, data: [], _via: 'local' };
  if (action === 'royalties_periodos') return { success: true, data: [], _via: 'local' };
  if (action === 'extrato_usuario') return { success: true, data: { total_recebido: 0, quantidade: 0, ultimos: [] }, _via: 'local' };
  if (action === 'get_elo_ranking') return { success: true, data: { total: 0, ranking: [] }, _via: 'local' };

  return { success: false, message: 'Ação indisponível offline', _via: 'local', _offline: true };
};

// ============================================================
// LOG DE CARREGAMENTO
// ============================================================
console.log('✅ [api.js] v8.9.2 carregado — dedup + cache TTL + validação de resposta');
