// ============================================================
// js/api.js — PLAY MY v8.6.0
// HealthCheck + callAPI (roteador Vercel → GAS → fallback local).
// Depende de: config.js, utils.js, state.js
// DEVE carregar DEPOIS de state.js e ANTES de auth.js.
// ============================================================

// ============ HEALTH CHECK ============
window.HealthCheck = {
  vercel: { online: null },
  gas: { online: null },
  mode: 'checking',

  // ---------- VERCEL ----------
  async testVercel() {
    const url = CONFIG.VERCEL_URL + '?action=ping';
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

      // Aceita success:true OU pong:true OU ok:true OU qualquer JSON válido
      const ok = d.success === true || d.pong === true || d.ok === true || (d && typeof d === 'object');
      this.vercel.online = ok;
      console.log('✅ Vercel ping:', d, '→ online =', ok);
      return ok;
    } catch (e) {
      console.warn('⚠️ Vercel offline:', e.name, e.message, '| url:', url);
    }
    this.vercel.online = false;
    return false;
  },

  // ---------- GAS ----------
  async testGAS() {
    const url = CONFIG.GAS_URL + '?action=health';
    try {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 8000);

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

      // Aceita qualquer JSON válido (não exige success:true)
      const ok = d && d.success !== false;
      this.gas.online = ok;
      console.log('✅ GAS health:', d, '→ online =', ok);
      return ok;
    } catch (e) {
      console.warn('⚠️ GAS offline:', e.name, e.message);
    }
    this.gas.online = false;
    return false;
  },

  // ---------- RUN ALL ----------
  async runAll() {
    console.log('🔍 Health Check...');
    this.mode = 'checking';
    this.updateBadge();

    const vercelOk = await this.testVercel();

    if (vercelOk) {
      // Testa GAS em background (não bloqueia)
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

  // ---------- BADGE ----------
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

// ============ CALL API (roteador Vercel → GAS → fallback) ============
window.callAPI = async function (action, data, _retry) {
  _retry = _retry || 0;
  data = data || {};

  // Adiciona user_id automaticamente se estiver logado
  if (state && state.currentUser && state.currentUser.id && !data.user_id) {
    data.user_id = state.currentUser.id;
  }

  // ---------- HELPERS ----------
  const buildUrl = (baseUrl) => {
    const url = new URL(baseUrl);
    url.searchParams.append('action', action);
    Object.keys(data).forEach(k => {
      if (data[k] !== undefined && data[k] !== null) {
        url.searchParams.append(k, data[k]);
      }
    });
    return url.toString();
  };

  const tryFetch = async (baseUrl, timeoutMs, label) => {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await fetch(buildUrl(baseUrl), {
        signal: ctrl.signal,
        headers: { 'Accept': 'application/json' }
      });
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

      if (json && json.success !== false) {
        console.log(`✅ [${action}] via ${label}`);
        return json;
      }

      console.warn(`⚠️ [${action}] ${label} respondeu success:false`, json);
      return null;
    } catch (e) {
      clearTimeout(timeout);
      console.warn(`⚠️ [${action}] ${label} erro:`, e.name, e.message);
      return null;
    }
  };

  // ============ TENTATIVA 1: VERCEL (sempre) ============
  const vercelJson = await tryFetch(CONFIG.VERCEL_URL, 20000, 'Vercel');
  if (vercelJson) {
    HealthCheck.vercel.online = true;
    if (HealthCheck.mode !== 'vercel') {
      HealthCheck.mode = 'vercel';
      HealthCheck.updateBadge();
    }
    return vercelJson;
  }

  // Se falhou e é a 1ª tentativa, espera 800ms e tenta de novo
  if (_retry < 1) {
    await new Promise(r => setTimeout(r, 800));
    return callAPI(action, data, _retry + 1);
  }

  // Marca Vercel como offline
  if (HealthCheck.vercel.online !== false) {
    HealthCheck.vercel.online = false;
    HealthCheck.mode = 'gas';
    HealthCheck.updateBadge();
    console.warn('⚠️ Vercel marcada offline — tentando GAS');
  }

  // ============ TENTATIVA 2: GAS ============
  const gasJson = await tryFetch(CONFIG.GAS_URL, 25000, 'GAS');
  if (gasJson) {
    HealthCheck.gas.online = true;
    return gasJson;
  }

  // ============ TENTATIVA 3: FALLBACK LOCAL ============
  console.warn(`📦 [${action}] fallback local`);
  return getFallbackData(action);
};

// ============ FALLBACK LOCAL ============
window.getFallbackData = function (action) {
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
  return { success: true, data: [], _via: 'local' };
};

// ============ LOG DE CARREGAMENTO ============
console.log('✅ [api.js] v8.6.0 carregado — HealthCheck + callAPI (Vercel → GAS → Local)');
