// ============================================================
// js/api.js — PLAY MY v8.5.0
// HealthCheck + callAPI (roteador Vercel → GAS → fallback).
// Depende de: config.js, utils.js, state.js
// DEVE carregar DEPOIS de state.js e ANTES de auth.js.
// ============================================================

// ============ HEALTH CHECK ============
window.HealthCheck = {
  vercel: { online: null },
  gas: { online: null },
  mode: 'checking',

  async testVercel() {
    try {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 8000);

      const r = await fetch(CONFIG.VERCEL_URL + '?action=ping', { signal: c.signal });
      clearTimeout(t);

      if (r.ok) {
        const d = await r.json();
        this.vercel.online = d.success === true;
        console.log('✅ Vercel ping:', d);
        return this.vercel.online;
      }
    } catch (e) {
      console.warn('⚠️ Vercel offline:', e.message);
    }
    this.vercel.online = false;
    return false;
  },

  async testGAS() {
    try {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 8000);

      const r = await fetch(CONFIG.GAS_URL + '?action=health', { signal: c.signal });
      clearTimeout(t);

      if (r.ok) {
        const d = await r.json();
        this.gas.online = d.success === true;
        return this.gas.online;
      }
    } catch (e) {
      // silencioso
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
      // Testa GAS em background (não bloqueia)
      this.testGAS().catch(() => {});
      this.mode = 'vercel';
      console.log('✅ Vercel online');
    } else {
      const gasOk = await this.testGAS();
      if (gasOk) {
        this.mode = 'gas';
        console.warn('⚠️ Vercel offline — usando GAS');
        showToast('⚠️ Usando GAS direto', 'warning', 4000);
      } else {
        this.mode = 'fallback';
        console.error('❌ Offline total');
        showToast('❌ Sem conexão', 'error', 6000);
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

// ============ CALL API (roteador Vercel → GAS → fallback) ============
window.callAPI = async function (action, data, _retry) {
  _retry = _retry || 0;
  data = data || {};

  // Adiciona user_id automaticamente se estiver logado
  if (state && state.currentUser && state.currentUser.id && !data.user_id) {
    data.user_id = state.currentUser.id;
  }

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

  // ============ TENTATIVA 1: VERCEL ============
  if (HealthCheck.mode === 'vercel' || HealthCheck.mode === 'checking') {
    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 20000);

      const r = await fetch(buildUrl(CONFIG.VERCEL_URL), {
        signal: ctrl.signal,
        headers: { 'Accept': 'application/json' }
      });
      clearTimeout(timeout);

      if (r.ok) {
        const text = await r.text();
        let json;
        try {
          json = JSON.parse(text);
        } catch (e) {
          const match = text.match(/\{[\s\S]*\}/);
          if (match) json = JSON.parse(match[0]);
        }

        if (json && json.success !== false) {
          console.log('✅ [' + action + '] via Vercel');
          return json;
        }
      }
    } catch (e) {
      if (_retry < 1) {
        await new Promise(r => setTimeout(r, 800));
        return callAPI(action, data, _retry + 1);
      }
      HealthCheck.vercel.online = false;
      HealthCheck.mode = 'gas';
      HealthCheck.updateBadge();
    }
  }

  // ============ TENTATIVA 2: GAS ============
  if (HealthCheck.mode === 'gas' || HealthCheck.mode === 'fallback') {
    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 25000);

      const r = await fetch(buildUrl(CONFIG.GAS_URL), {
        signal: ctrl.signal,
        headers: { 'Accept': 'application/json' }
      });
      clearTimeout(timeout);

      if (r.ok) {
        const text = await r.text();
        let json;
        try {
          json = JSON.parse(text);
        } catch (e) {
          const match = text.match(/\{[\s\S]*\}/);
          if (match) json = JSON.parse(match[0]);
        }

        if (json && json.success !== false) {
          console.log('📦 [' + action + '] via GAS');
          return json;
        }
      }
    } catch (e) {
      console.warn('⚠️ GAS falhou:', e.message);
    }
  }

  // ============ TENTATIVA 3: FALLBACK LOCAL ============
  console.warn('📦 [' + action + '] fallback local');
  return getFallbackData(action);
};

// ============ FALLBACK LOCAL ============
window.getFallbackData = function (action) {
  if (action === 'get_musicas') return { success: true, data: [] };
  if (action === 'get_external_musicas') return { success: true, data: [] };
  if (action === 'get_artists') return { success: true, data: [] };
  if (action === 'get_saldo') return { success: true, data: { saldo_disponivel: 0, selo_coin: 0 } };
  if (action === 'get_carteira') return { success: true, data: { investimentos: [], total_investido: 0, quantidade_itens: 0 } };
  if (action === 'get_extrato') return { success: true, data: [] };
  if (action === 'get_playlists') return { success: true, data: [] };
  if (action === 'get_global_playlists') return { success: true, data: [] };
  if (action === 'get_tickets') return { success: true, data: [] };
  if (action === 'get_news') return { success: true, data: [], has_more: false };
  if (action === 'mark_news_seen') return { success: true };
  if (action === 'track_news_interaction') return { success: true };
  if (action === 'get_mining_blocks') return { success: true, data: [] };
  if (action === 'get_trades') return { success: true, data: { received: [], sent: [], history: [] } };
  if (action === 'get_top_investments') return { success: true, data: [] };
  return { success: true, data: [] };
};

// ============ LOG DE CARREGAMENTO ============
console.log('✅ [api.js] carregado — HealthCheck e callAPI prontos');
