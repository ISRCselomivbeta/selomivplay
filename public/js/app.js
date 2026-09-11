// ============================================================
// APP - PLAY MY v8.4 (Vercel KV primário + GAS fallback)
// ============================================================

// ============ HEALTH CHECK ============
const HealthCheck = {
  vercel: { online: null },
  gas: { online: null },
  mode: 'checking',
  lastCheck: 0,

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
    } catch (e) {}
    this.gas.online = false;
    return false;
  },

  async runAll() {
    console.log('🔍 Health Check (Vercel + GAS)...');
    this.mode = 'checking';
    this.updateBadge();

    const vercelOk = await this.testVercel();

    if (vercelOk) {
      this.testGAS().catch(() => {});
      this.mode = 'vercel';
      console.log('✅ Vercel online — usando KV + proxy GAS');
    } else {
      const gasOk = await this.testGAS();
      if (gasOk) {
        this.mode = 'gas';
        console.warn('⚠️ Vercel offline — usando GAS direto');
        showToast('⚠️ Backend Vercel offline. Usando GAS direto.', 'warning', 5000);
      } else {
        this.mode = 'fallback';
        console.error('❌ Vercel e GAS offline — modo fallback local');
        showToast('❌ Sem conexão com backend. Dados não serão salvos.', 'error', 6000);
      }
    }

    this.lastCheck = Date.now();
    this.updateBadge();
    return this.mode;
  },

  updateBadge() {
    const b = document.getElementById('healthBadge');
    if (!b) return;
    const modes = {
      checking: { i: '🔄', t: 'Verificando...', c: '#8e8e93', bg: 'rgba(142,142,147,0.15)' },
      vercel:   { i: '✅', t: 'Online (KV)', c: '#34c759', bg: 'rgba(52,199,89,0.15)' },
      gas:      { i: '⚠️', t: 'GAS Direto', c: '#ffcc00', bg: 'rgba(255,204,0,0.15)' },
      fallback: { i: '❌', t: 'Offline', c: '#ff3b30', bg: 'rgba(255,59,48,0.15)' }
    };
    const x = modes[this.mode] || modes.checking;
    b.innerHTML = x.i + ' ' + x.t;
    b.style.color = x.c;
    b.style.background = x.bg;
    b.style.borderColor = x.c;
  }
};

// ============ STATE ============
const state = {
  currentUser: null, userBalance: 0, seloCoinBalance: 0, playlist: [], externalPlaylist: [],
  portfolioAssets: [], ledgerData: [], topInvestments: [], userPlaylists: [], globalPlaylists: [],
  artists: [], followingArtists: [], tickets: [], artistTickets: [],
  favoriteMusicIds: [], currentTrackIndex: -1, isPlaying: false,
  youtubePlayer: null, youtubeAPILoaded: false, currentVolume: 80,
  isShuffle: false, isRepeat: false, lastVolume: 80,
  currentInvestTrack: null, currentExternalTrack: null,
  blockchain: { enabled: true, contracts: [], transactions: [], lastBlock: 0 },
  streamingTimer: null, streamingProgress: 0, streamingTrackId: null,
  streamingLastReward: 0, isBuffering: false, playerReady: false,
  streamingStats: null, progressInterval: null, recommendations: [], streamingHistory: [],
  deferredInstallPrompt: null, adminStats: null,
  news: { items: [], page: 0, loading: false, hasMore: true, filter: 'all' },
  newsLikes: {},
  connectionMode: 'checking'
};

const playQueue = {
  items: [], currentIndex: -1,
  playCurrent() { if (this.currentIndex < 0 || this.currentIndex >= this.items.length) return; const c = this.items[this.currentIndex]; if (c.type === 'internal') playTrack(c.index); else playExternalTrack(c.index); },
  playNext() { if (this.currentIndex < this.items.length - 1) { this.currentIndex++; this.playCurrent(); } else if (state.isRepeat) { this.currentIndex = 0; this.playCurrent(); } else { showToast('Fim da fila', 'info'); state.isPlaying = false; updatePlayerIcons(); } },
  playPrevious() { if (this.currentIndex > 0) { this.currentIndex--; this.playCurrent(); } },
  shuffle() { if (this.items.length <= 1) return; const c = this.items[this.currentIndex]; const o = this.items.filter((_, i) => i !== this.currentIndex); for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } this.items = [c, ...o]; this.currentIndex = 0; }
};

// ============ CALL API (Vercel → GAS → Fallback) ============
async function callAPI(action, data, _retry) {
  _retry = _retry || 0;
  data = data || {};
  if (state && state.currentUser && state.currentUser.id && !data.user_id) {
    data.user_id = state.currentUser.id;
  }

  const buildUrl = (baseUrl) => {
    const url = new URL(baseUrl);
    url.searchParams.append('action', action);
    Object.keys(data).forEach(k => {
      if (data[k] !== undefined && data[k] !== null) url.searchParams.append(k, data[k]);
    });
    return url.toString();
  };

  // 1. VERCEL (primário — KV + proxy GAS)
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
        try { json = JSON.parse(text); } catch (e) {
          const match = text.match(/\{[\s\S]*\}/);
          if (match) json = JSON.parse(match[0]);
        }
        if (json && json.success !== false) {
          console.log('✅ [' + action + '] via Vercel');
          return json;
        }
      }
    } catch (e) {
      console.warn('⚠️ Vercel falhou [' + action + ']:', e.message);
      if (_retry < 1) {
        await new Promise(r => setTimeout(r, 800));
        return callAPI(action, data, _retry + 1);
      }
      HealthCheck.vercel.online = false;
      HealthCheck.mode = 'gas';
      HealthCheck.updateBadge();
    }
  }

  // 2. GAS (fallback)
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
        try { json = JSON.parse(text); } catch (e) {
          const match = text.match(/\{[\s\S]*\}/);
          if (match) json = JSON.parse(match[0]);
        }
        if (json && json.success !== false) {
          console.log('📦 [' + action + '] via GAS');
          return json;
        }
      }
    } catch (e) {
      console.warn('⚠️ GAS falhou [' + action + ']:', e.message);
    }
  }

  // 3. Fallback local
  console.warn('📦 [' + action + '] fallback local (dados mock)');
  return getFallbackData(action, data);
}

function getFallbackData(action, data) {
  const mockMusics = [
    { id: '1', titulo: 'RIO DE JANEIRO', artista: 'Elzo Henschell', link_capa: 'https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=400', link_youtube: 'https://www.youtube.com/watch?v=fJ9rUzIMcZQ', valor_acao: 25.50, percentual_disponivel: 38, acoes_vendidas: 150, total_investidores: 45, rentabilidade_media: 12.5, status: 'ativo', genero: 'URBAN', user_id: 'artist1' },
    { id: '2', titulo: 'Blinding Lights', artista: 'The Weeknd', link_capa: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400', link_youtube: 'https://www.youtube.com/watch?v=4NRXx6U8ABQ', valor_acao: 32.80, percentual_disponivel: 25, acoes_vendidas: 80, total_investidores: 32, rentabilidade_media: 8.3, status: 'ativo', genero: 'POP', user_id: 'artist2' }
  ];
  if (action === 'get_musicas') return { success: true, data: mockMusics };
  if (action === 'get_external_musicas') return { success: true, data: [] };
  if (action === 'get_artists') return { success: true, data: [{ id: 'artist1', nome: 'Elzo Henschell', avatar: '', followers: 1543, is_following: false }, { id: 'artist2', nome: 'The Weeknd', avatar: '', followers: 8450, is_following: false }] };
  if (action === 'get_global_playlists') return { success: true, data: [] };
  if (action === 'get_tickets') return { success: true, data: [] };
  if (action === 'get_saldo') return { success: true, data: { saldo_disponivel: 0, saldo_bloqueado: 0, selo_coin: 0 } };
  if (action === 'get_news') return { success: true, data: [] };
  if (action === 'get_mining_blocks') return { success: true, data: [] };
  if (action === 'buy' || action === 'buy_external') return { success: true, message: 'OK (offline — não persistido)', data: { contrato_id: 'CT_OFFLINE_' + Date.now(), blockchain_hash: '0x' + Date.now().toString(16) } };
  return { success: true, data: [] };
}

// ============================================================
// ⬇️⬇️⬇️ COLE A PARTIR DAQUI O RESTANTE DO SEU app.js ATUAL ⬇️⬇️⬇️
// (tudo que vem depois de "// ============ AUTH ============")
// ============================================================
