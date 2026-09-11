// ============================================================
// APP - PLAY MY v8.2 (núcleo, auth, loaders, renderers)
// ============================================================

const HealthCheck = {
  backend: { online: null }, gas: { online: null }, youtube: { online: null }, mode: 'auto',
  async testBackend() { try { const c = new AbortController(); const t = setTimeout(() => c.abort(), 5000); const r = await fetch(CONFIG.API_URL + '?action=ping', { signal: c.signal }); clearTimeout(t); if (r.ok) { const d = await r.json(); this.backend.online = d.success === true; return this.backend.online; } } catch (e) {} this.backend.online = false; return false; },
  async testGAS() { try { const c = new AbortController(); const t = setTimeout(() => c.abort(), 8000); const r = await fetch(GAS_URL + '?action=ping', { signal: c.signal }); clearTimeout(t); if (r.ok) { const d = await r.json(); this.gas.online = d.success === true; return this.gas.online; } } catch (e) {} this.gas.online = false; return false; },
  async testYouTube() { if (!CONFIG.YOUTUBE_API_KEY) { this.youtube.online = false; return false; } try { const c = new AbortController(); const t = setTimeout(() => c.abort(), 5000); const r = await fetch('https://www.googleapis.com/youtube/v3/videos?part=statistics&id=fJ9rUzIMcZQ&key=' + CONFIG.YOUTUBE_API_KEY, { signal: c.signal }); clearTimeout(t); const d = await r.json(); this.youtube.online = !d.error; return this.youtube.online; } catch (e) { this.youtube.online = false; return false; } },
  async runAll() { console.log('🔍 Health Check...'); await Promise.all([this.testBackend(), this.testGAS(), this.testYouTube()]); if (this.backend.online) this.mode = 'backend'; else if (this.gas.online) this.mode = 'gas'; else this.mode = 'fallback'; console.log('📊 Modo:', this.mode); this.updateBadge(); return this.mode; },
  updateBadge() { const b = document.getElementById('healthBadge'); if (!b) return; const m = { backend: { i: '✅', t: 'Online', c: '#34c759', bg: 'rgba(52,199,89,0.15)' }, gas: { i: '⚠️', t: 'Reserva', c: '#ffcc00', bg: 'rgba(255,204,0,0.15)' }, fallback: { i: '❌', t: 'Offline', c: '#ff3b30', bg: 'rgba(255,59,48,0.15)' } }; const x = m[this.mode] || m.fallback; b.innerHTML = x.i + ' ' + x.t; b.style.color = x.c; b.style.background = x.bg; b.style.borderColor = x.c; }
};

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
  newsLikes: {}
};

const playQueue = {
  items: [], currentIndex: -1,
  playCurrent() { if (this.currentIndex < 0 || this.currentIndex >= this.items.length) return; const c = this.items[this.currentIndex]; if (c.type === 'internal') playTrack(c.index); else playExternalTrack(c.index); },
  playNext() { if (this.currentIndex < this.items.length - 1) { this.currentIndex++; this.playCurrent(); } else if (state.isRepeat) { this.currentIndex = 0; this.playCurrent(); } else { showToast('Fim da fila', 'info'); state.isPlaying = false; updatePlayerIcons(); } },
  playPrevious() { if (this.currentIndex > 0) { this.currentIndex--; this.playCurrent(); } },
  shuffle() { if (this.items.length <= 1) return; const c = this.items[this.currentIndex]; const o = this.items.filter((_, i) => i !== this.currentIndex); for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } this.items = [c, ...o]; this.currentIndex = 0; }
};

async function callAPI(action, data, _retry) {
  _retry = _retry || 0; data = data || {};
  if (state && state.currentUser && state.currentUser.id && !data.user_id) data.user_id = state.currentUser.id;
  if (HealthCheck.mode === 'backend' || HealthCheck.mode === 'auto') {
    try {
      const url = new URL(CONFIG.API_URL);
      url.searchParams.append('action', action);
      Object.keys(data).forEach(k => { if (data[k] !== undefined && data[k] !== null) url.searchParams.append(k, data[k]); });
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 25000);
      const r = await fetch(url.toString(), { signal: ctrl.signal, headers: { 'Accept': 'application/json' } });
      clearTimeout(timeout);
      if (r.ok) { const json = await r.json(); if (json && json.success !== false) { console.log('✅ [' + action + '] via Backend'); return json; } }
    } catch (e) {
      console.warn('⚠️ Backend falhou (tentativa ' + (_retry + 1) + '):', e.message);
      if (_retry < 1) { await new Promise(r => setTimeout(r, 1500)); return callAPI(action, data, _retry + 1); }
    }
  }
  if (HealthCheck.mode === 'gas' || HealthCheck.gas.online) {
    try {
      const url = new URL(GAS_URL);
      url.searchParams.append('action', action);
      Object.keys(data).forEach(k => { if (data[k] !== undefined && data[k] !== null) url.searchParams.append(k, data[k]); });
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 25000);
      const r = await fetch(url.toString(), { signal: ctrl.signal });
      clearTimeout(timeout);
      if (r.ok) { const text = await r.text(); const json = JSON.parse(text); if (json && json.success !== false) { console.log('📦 [' + action + '] via GAS'); return json; } }
    } catch (e) { console.warn('⚠️ GAS falhou:', e.message); }
  }
  console.warn('📦 [' + action + '] fallback local');
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
  if (action === 'buy' || action === 'buy_external') return { success: true, message: 'OK', data: { contrato_id: 'CT_' + Date.now(), blockchain_hash: '0x' + Date.now().toString(16) } };
  return { success: true, data: [] };
}

// ============ AUTH ============
async function handleLogin() {
  const email = document.getElementById('loginEmailField').value.trim();
  const password = document.getElementById('loginPasswordField').value.trim();
  const btn = document.getElementById('loginBtn');
  if (!email || !password) { showToast('Preencha todos os campos', 'error'); return; }
  btn.disabled = true; btn.innerHTML = '<i class="bi bi-arrow-clockwise spin"></i> Autenticando...';
  showLoading('Autenticando...');
  try {
    if (email === 'admin@selomiv.com' && password === 'admin123') {
      state.currentUser = { id: 'admin_master', nome: 'Administrador Master', email: email, tipo: 'admin', saldo: 1000000, selo_coin: 50000, favorite_music_ids: [] };
      state.userBalance = 1000000; state.seloCoinBalance = 50000; state.favoriteMusicIds = [];
      localStorage.setItem('miv_user', JSON.stringify(state.currentUser));
      showToast('Login ADMIN realizado!', 'success');
      hideLoading(); initializeApp(); return;
    }
    const r = await callAPI('login', { email: email, password: password });
    console.log('🔍 Resposta do login:', r);
    if (r && r.success && r.data && r.data.id) {
      const u = r.data;
      state.currentUser = u; state.userBalance = u.saldo || 0;
      state.seloCoinBalance = u.selo_coin || 0;
      state.favoriteMusicIds = Array.isArray(u.favorite_music_ids) ? u.favorite_music_ids : [];
      localStorage.setItem('miv_user', JSON.stringify(state.currentUser));
      showToast('Login realizado!', 'success');
      hideLoading(); initializeApp();
    } else if (r && r.message) {
      showToast(r.message, 'error');
    } else {
      showToast('Não foi possível conectar. Verifique sua internet.', 'error');
    }
  } catch (e) { console.error('Erro no login:', e); showToast('Erro ao conectar', 'error'); }
  finally { btn.disabled = false; btn.innerHTML = '<i class="bi bi-box-arrow-in-right"></i> Entrar'; hideLoading(); }
}

async function handleRegister() {
  const name = document.getElementById('registerNameField').value.trim();
  const email = document.getElementById('registerEmailField').value.trim();
  const password = document.getElementById('registerPasswordField').value.trim();
  const type = document.getElementById('registerTypeField').value;
  const link = document.getElementById('registerLinkField').value.trim() || '';
  const accept = document.getElementById('acceptTermsField').checked;
  const acceptMkt = document.getElementById('acceptMarketingField').checked || false;
  const btn = document.getElementById('registerBtn');
  if (!name || !email || !password || !type) { showToast('Preencha os campos', 'error'); return; }
  if (password.length < 6) { showToast('Senha mínimo 6', 'error'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast('Email inválido', 'error'); return; }
  if (!accept) { showToast('Aceite os Termos', 'error'); return; }
  btn.disabled = true; btn.innerHTML = '<i class="bi bi-arrow-clockwise spin"></i> Criando...';
  showLoading('Criando conta...');
  try {
    const r = await callAPI('register', { nome: name, email: email, senha: password, tipo: type, workLink: link, confirm_url: CONFIG.CONFIRM_EMAIL_URL, accepted_terms: true, terms_version: '8.2.0', accepted_marketing: acceptMkt });
    if (r && r.success) {
      showToast('Cadastro realizado! Verifique seu email.', 'success');
      hideLoading();
      setTimeout(() => showToast('✉️ Enviamos um email para ' + email, 'info', 5000), 1000);
      ['registerNameField','registerEmailField','registerPasswordField','registerTypeField'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
      const t = document.getElementById('acceptTermsField'); if (t) t.checked = false;
      showLoginForm();
    } else showToast((r && r.message) || 'Erro', 'error');
  } catch (e) { showToast('Erro ao criar conta', 'error'); }
  finally { btn.disabled = false; btn.innerHTML = '<i class="bi bi-person-plus"></i> Solicitar Cadastro'; hideLoading(); }
}

async function resendConfirmationEmail() { const email = document.getElementById('loginEmailField').value.trim(); if (!email) { showToast('Digite seu email', 'error'); return; } showLoading('Enviando...'); try { const r = await callAPI('resend_confirmation', { email: email, confirm_url: CONFIG.CONFIRM_EMAIL_URL }); if (r && r.success) showToast('✉️ Novo link enviado!', 'success', 5000); else showToast((r && r.message) || 'Erro', 'error'); } catch (e) { showToast('Erro', 'error'); } finally { hideLoading(); } }
function openResetPasswordModal() { document.getElementById('resetEmailField').value = document.getElementById('loginEmailField').value || ''; showModal('resetPasswordModal'); }
async function sendResetEmail() {
  const email = document.getElementById('resetEmailField').value.trim();
  if (!email) { showToast('Digite seu e-mail', 'error'); return; }
  const btn = document.getElementById('sendResetBtn');
  btn.disabled = true; btn.innerHTML = '<i class="bi bi-arrow-clockwise spin"></i> Enviando...';
  try {
    const r = await callAPI('request_password_reset', { email: email, reset_url: CONFIG.RESET_PASSWORD_URL });
    if (r && r.success) { showToast('✉️ Link enviado!', 'success', 5000); closeModal('resetPasswordModal'); }
    else showToast((r && r.message) || 'Erro', 'error');
  } catch (e) { showToast('Erro ao enviar', 'error'); }
  finally { btn.disabled = false; btn.innerHTML = 'Enviar'; }
}
function showRegisterForm() { document.getElementById('loginForm').style.display = 'none'; document.getElementById('registerForm').style.display = 'block'; }
function showLoginForm() { document.getElementById('registerForm').style.display = 'none'; document.getElementById('loginForm').style.display = 'block'; }
function toggleArtistField() { const f = document.getElementById('artistLinkField'); if (f) f.style.display = document.getElementById('registerTypeField').value === 'artista' ? 'block' : 'none'; }
function logout() { if (!confirm('Deseja realmente sair?')) return; state.currentUser = null; state.userBalance = 0; state.seloCoinBalance = 0; state.playlist = []; state.externalPlaylist = []; state.portfolioAssets = []; state.ledgerData = []; state.favoriteMusicIds = []; state.followingArtists = []; state.currentTrackIndex = -1; state.isPlaying = false; localStorage.removeItem('miv_user'); document.getElementById('mainApp').style.display = 'none'; document.getElementById('authScreen').style.display = 'flex'; document.getElementById('loginForm').style.display = 'block'; document.getElementById('registerForm').style.display = 'none'; document.getElementById('playerSpotify').style.display = 'none'; showToast('Logout realizado', 'success'); }

async function initializeApp() {
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('mainApp').style.display = 'block';
  updateUserInterface();
  await loadAllData();
  await loadUserFavorites();
  await loadFollowingArtists();
  loadNewsFeed();
  loadYouTubeAPI();
  setupMediaSession();
  setInterval(() => { if (state.currentUser) updateBalanceDisplay(); }, 30000);
  setInterval(() => { if (state.currentUser) loadStreamingStats(); }, 60000);
}

async function loadAllData() {
  showLoading('Carregando dados...');
  try {
    await Promise.all([
      loadMarketplace(), loadExternalMarketplace(), loadPortfolio(),
      loadLedger(), loadTopInvestments(), loadUserPlaylists(),
      loadGlobalPlaylists(), loadArtists(), loadTickets()
    ]);
    await updateBalanceDisplay();
    if (state.currentUser && state.currentUser.tipo === 'artista') await loadArtistData();
    if (state.currentUser && state.currentUser.tipo === 'admin') await loadAdminData();
    showToast('Sistema carregado!', 'success');
  } catch (e) { console.error(e); showToast('Alguns dados não carregaram', 'warning'); }
  finally { hideLoading(); }
}

async function updateBalanceDisplay() {
  const el = document.getElementById('currentBalance');
  const seloEl = document.getElementById('seloCoinBalance');
  if (!state.currentUser || !state.currentUser.id) { if (el) el.textContent = formatCurrency(0); if (seloEl) seloEl.textContent = '0'; return; }
  try { const r = await callAPI('get_saldo', { user_id: state.currentUser.id }); if (r && r.success && r.data) { state.userBalance = r.data.saldo_disponivel || 0; state.seloCoinBalance = r.data.selo_coin || 0; } } catch (e) {}
  if (el) el.textContent = formatCurrency(state.userBalance);
  if (seloEl) seloEl.textContent = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(state.seloCoinBalance);
}

function updateUserInterface() {
  if (!state.currentUser) return;
  const b = document.getElementById('userBadge');
  if (b) { b.textContent = state.currentUser.tipo === 'admin' ? 'Admin' : (state.currentUser.tipo === 'artista' ? 'Artista' : 'Ouvinte'); b.style.background = state.currentUser.tipo === 'admin' ? 'var(--apple-purple)' : (state.currentUser.tipo === 'artista' ? 'var(--apple-blue)' : 'var(--apple-green)'); }
  const a = document.getElementById('artistNavItem');
  if (a) a.style.display = (state.currentUser.tipo === 'artista' || state.currentUser.tipo === 'admin') ? 'block' : 'none';
  const ad = document.getElementById('adminNavItem');
  if (ad) ad.style.display = state.currentUser.tipo === 'admin' ? 'block' : 'none';
  updateBalanceDisplay();
}

// ============ LOADERS ============
async function loadMarketplace() { if (!state.playlist || state.playlist.length === 0) { state.playlist = getFallbackData('get_musicas').data; renderMarketplace(); } try { const r = await callAPI('get_musicas'); if (r && r.success && r.data && r.data.length > 0) state.playlist = r.data; } catch (e) {} renderMarketplace(); }
async function loadExternalMarketplace(force) { if (!force) { const c = localStorage.getItem('miv_external_playlist'); const t = localStorage.getItem('miv_external_timestamp'); if (c && t && (Date.now() - parseInt(t)) < 600000) { try { state.externalPlaylist = JSON.parse(c); renderExternalMarketplace(); return; } catch (e) {} } } try { const r = await callAPI('get_external_musicas'); if (r && r.success && r.data) { state.externalPlaylist = r.data; localStorage.setItem('miv_external_playlist', JSON.stringify(r.data)); localStorage.setItem('miv_external_timestamp', Date.now().toString()); } } catch (e) {} renderExternalMarketplace(); }
async function loadTopInvestments() { try { const r = await callAPI('get_top_investments'); if (r && r.success && r.data) state.topInvestments = r.data; } catch (e) {} renderTopInvestments(); }
async function loadPortfolio() { if (!state.currentUser) return; try { const r = await callAPI('get_carteira', { user_id: state.currentUser.id }); if (r && r.success && r.data) state.portfolioAssets = Array.isArray(r.data) ? r.data : (r.data.investimentos || []); } catch (e) {} renderPortfolio(); updatePortfolioValue(); }
async function loadLedger() { if (!state.currentUser) return; try { const r = await callAPI('get_extrato', { user_id: state.currentUser.id }); if (r && r.success && r.data) state.ledgerData = r.data; } catch (e) {} renderLedger(); }
async function loadUserPlaylists() { if (!state.currentUser) { state.userPlaylists = []; renderPlaylists(); return; } try { const r = await callAPI('get_playlists', { user_id: state.currentUser.id }); if (r && r.success && r.data) state.userPlaylists = r.data; } catch (e) {} renderPlaylists(); }

async function loadGlobalPlaylists() {
  try {
    const r = await callAPI('get_global_playlists');
    if (r && r.success && Array.isArray(r.data)) {
      state.globalPlaylists = r.data.map(p => ({
        id: p.id || ('gp_' + Date.now() + Math.random()),
        nome: p.nome || '',
        descricao: p.descricao || '',
        musicas: Array.isArray(p.musicas) ? p.musicas.map(String)
               : (typeof p.musicas === 'string' ? p.musicas.split(',').filter(Boolean) : []),
        music_count: p.music_count || (Array.isArray(p.musicas) ? p.musicas.length : 0),
        is_global: true
      }));
      localStorage.setItem('miv_global_playlists', JSON.stringify(state.globalPlaylists));
    } else {
      const isAdmin = state.currentUser && state.currentUser.tipo === 'admin';
      if (isAdmin) {
        const cached = localStorage.getItem('miv_global_playlists');
        if (cached) { try { state.globalPlaylists = JSON.parse(cached); } catch(e) { state.globalPlaylists = []; } }
      } else { state.globalPlaylists = []; }
    }
  } catch (e) { console.warn('Erro ao carregar playlists globais:', e); state.globalPlaylists = []; }
  renderGlobalPlaylists();
  if (state.currentUser && state.currentUser.tipo === 'admin') { renderAdminGlobalPlaylists(); }
}

async function loadArtists(force) { try { const r = await callAPI('get_artists'); if (r && r.success && r.data) state.artists = r.data; } catch (e) { state.artists = getFallbackData('get_artists').data; } renderArtists(); renderFeaturedArtists(); }
async function loadFollowingArtists() { if (!state.currentUser) { state.followingArtists = []; return; } try { const r = await callAPI('get_following', { user_id: state.currentUser.id }); if (r && r.success && r.data) state.followingArtists = Array.isArray(r.data) ? r.data.map(x => String(x)) : []; } catch (e) { state.followingArtists = state.followingArtists || []; } }
async function loadTickets(force) { try { const r = await callAPI('get_tickets'); if (r && r.success && r.data) state.tickets = r.data; } catch (e) { state.tickets = state.tickets || []; } renderTickets(); }
async function loadArtistData(force) {
  if (!state.currentUser || state.currentUser.tipo !== 'artista') return;
  try {
    const r = await callAPI('get_artist_data', { user_id: state.currentUser.id });
    if (r && r.success && r.data) {
      document.getElementById('artistMusicCount').textContent = r.data.total_musicas || 0;
      document.getElementById('artistSeloBalance').textContent = new Intl.NumberFormat('pt-BR').format(r.data.selo_coin || 0);
      document.getElementById('artistFollowersCount').textContent = r.data.followers || 0;
      document.getElementById('artistTicketsCount').textContent = (r.data.tickets || []).length;
      state.artistTickets = r.data.tickets || [];
      renderArtistMusic(r.data.musics || []);
    }
  } catch (e) {}
}
async function loadAdminData() {
  if (!state.currentUser || state.currentUser.tipo !== 'admin') return;
  try {
    const r = await callAPI('get_admin_stats');
    if (r && r.success && r.data) {
      state.adminStats = r.data;
      document.getElementById('adminUsersCount').textContent = r.data.users_count || 0;
      document.getElementById('adminMusicsCount').textContent = r.data.musics_count || 0;
      document.getElementById('adminGlobalPlaylistsCount').textContent = (state.globalPlaylists || []).length;
      document.getElementById('adminSeloCirculation').textContent = new Intl.NumberFormat('pt-BR').format(r.data.selo_circulation || 0);
    }
  } catch (e) {}
}

// ============ RENDERERS ============
function renderMarketplace() {
  const c = document.getElementById('marketplaceContent'); if (!c) return;
  if (!state.playlist || state.playlist.length === 0) { c.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--apple-label-2);padding:40px">Nenhuma música disponível</div>'; return; }
  c.innerHTML = state.playlist.slice(0, 7).map((t, i) => {
    const cover = getCoverUrl(t, false);
    return '<div class="spotify-card"><div class="spotify-cover"><img src="' + cover + '" loading="lazy" onerror="this.onerror=null;this.src=\'' + PLACEHOLDERS.MIV_300 + '\'"><div class="play-overlay" onclick="playTrack(' + i + ')"><i class="bi bi-play-fill"></i></div></div><h3 class="spotify-title">' + (t.titulo || '') + '</h3><p class="spotify-artist">' + (t.artista || '') + '</p><div class="spotify-stats mt-2"><span class="spotify-elo">' + (t.percentual_disponivel || 0) + '%</span><span class="spotify-price">' + formatCurrency(t.valor_acao || 0) + '</span></div><button class="btn-invest" onclick="openInvestModal(' + i + ')"><i class="bi bi-currency-dollar"></i> INVESTIR</button></div>';
  }).join('');
  const rec = document.getElementById('recommendedCard');
  if (rec && state.playlist[0]) {
    const p = state.playlist[0]; const cover = getCoverUrl(p, false);
    rec.innerHTML = '<img src="' + cover + '" class="recommended-cover" onerror="this.onerror=null;this.src=\'' + PLACEHOLDERS.MIV_300 + '\'"><div class="recommended-info"><h4>' + (p.titulo || '') + ' • ' + (p.artista || '') + '</h4><p>' + formatCurrency(p.valor_acao || 0) + ' por ação</p></div><button class="btn-play" onclick="playTrack(0)"><i class="bi bi-play-fill"></i></button>';
  }
}
function renderExternalMarketplace() {
  const c = document.getElementById('externalContent'); if (!c) return;
  if (!state.externalPlaylist || state.externalPlaylist.length === 0) { c.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--apple-label-2)"><i class="bi bi-globe" style="font-size:48px;color:var(--apple-orange)"></i><h3>Nenhuma música externa</h3></div>'; return; }
  c.innerHTML = state.externalPlaylist.map((t, i) => '<div class="spotify-card external-card"><div class="external-badge">EXT</div><div class="spotify-cover"><img src="' + getCoverUrl(t, true) + '" onerror="this.onerror=null;this.src=\'' + PLACEHOLDERS.EXT_300 + '\'"><div class="play-overlay" onclick="playExternalTrack(' + i + ')"><i class="bi bi-play-fill"></i></div></div><h3 class="spotify-title">' + (t.titulo || '') + '</h3><p class="spotify-artist">' + (t.artista || '') + '</p></div>').join('');
}
function renderTopInvestments() {
  const c = document.getElementById('investmentsContent'); if (!c) return;
  if (!state.topInvestments || state.topInvestments.length === 0) { c.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--apple-label-2);padding:40px">Nenhuma recomendação</div>'; return; }
  c.innerHTML = state.topInvestments.map(t => '<div class="spotify-card"><div class="spotify-cover"><img src="' + getCoverUrl(t, false) + '" onerror="this.onerror=null;this.src=\'' + PLACEHOLDERS.MIV_300 + '\'"></div><h3 class="spotify-title">' + (t.titulo || '') + '</h3><p class="spotify-artist">' + (t.artista || '') + '</p></div>').join('');
}
function renderPortfolio() {
  const c = document.getElementById('portfolioContent'); if (!c) return;
  const a = state.portfolioAssets || []; const cnt = document.getElementById('assetsCount');
  if (cnt) cnt.textContent = a.length + ' ativo' + (a.length !== 1 ? 's' : '');
  if (!a.length) { c.innerHTML = '<div class="empty-state-actionable" style="grid-column:1/-1"><i class="bi bi-briefcase empty-icon"></i><h5 class="text-muted">Nenhum investimento</h5></div>'; return; }
  c.innerHTML = a.map(x => { const m = state.playlist.find(y => y.id === x.music_id) || {}; return '<div class="spotify-card"><div class="spotify-cover"><img src="' + getCoverUrl(m, false) + '" onerror="this.onerror=null;this.src=\'' + PLACEHOLDERS.MIV_300 + '\'"></div><h3 class="spotify-title">' + (m.titulo || 'Música') + '</h3><p class="spotify-artist">' + (m.artista || '') + '</p><div class="spotify-stats"><span class="spotify-elo">' + (x.quantidade || 0) + ' ações</span><span class="spotify-price">' + formatCurrency(x.valor_total || 0) + '</span></div></div>'; }).join('');
}
function updatePortfolioValue() { const el = document.getElementById('portfolioValue'); if (!el) return; let t = 0; (state.portfolioAssets || []).forEach(a => { const m = state.playlist.find(x => x.id === a.music_id); if (m && m.valor_acao) t += (a.quantidade || 0) * m.valor_acao; else t += a.valor_total || 0; }); el.textContent = formatCurrency(t); }
function renderLedger() {
  const c = document.getElementById('ledgerContent'); if (!c) return;
  if (!state.ledgerData || !state.ledgerData.length) { c.innerHTML = '<tr><td colspan="4" class="text-center py-5 text-muted">Nenhuma transação</td></tr>'; return; }
  const sorted = [...state.ledgerData].sort((a, b) => new Date(b.data) - new Date(a.data));
  c.innerHTML = sorted.map(t => { const isNeg = t.valor < 0; return '<tr><td>' + formatDate(t.data) + '</td><td>' + (t.descricao || t.tipo) + '</td><td class="text-end ' + (isNeg ? 'text-danger' : 'text-success') + '"><strong>' + (isNeg ? '-' : '+') + formatCurrency(Math.abs(t.valor || 0)) + '</strong></td><td>' + (t.blockchain_hash ? '⛓️' : '-') + '</td></tr>'; }).join('');
}
function renderPlaylists() {
  const pc = document.getElementById('playlistsContent'); const fc = document.getElementById('favoritesContent');
  if (pc) { if (state.userPlaylists && state.userPlaylists.length) { pc.innerHTML = state.userPlaylists.map(p => '<div class="playlist-item"><div class="playlist-cover"><i class="bi bi-music-note-list"></i></div><div><h6 class="mb-0">' + p.nome + '</h6></div></div>').join(''); } else pc.innerHTML = '<div class="empty-state-actionable"><i class="bi bi-music-note-list empty-icon"></i><h5 class="text-muted">Nenhuma playlist</h5></div>'; }
  if (fc) {
    const favs = [...(state.playlist || []).filter(t => state.favoriteMusicIds && state.favoriteMusicIds.includes(String(t.id))), ...(state.externalPlaylist || []).filter(t => state.favoriteMusicIds && state.favoriteMusicIds.includes(String(t.id)))];
    if (favs.length) { fc.innerHTML = favs.map(t => '<div class="spotify-card"><div class="spotify-cover"><img src="' + getCoverUrl(t, false) + '"></div><h3 class="spotify-title">' + t.titulo + '</h3></div>').join(''); }
    else fc.innerHTML = '<div class="empty-state-actionable" style="grid-column:1/-1"><i class="bi bi-star empty-icon"></i><h5 class="text-muted">Sem favoritas</h5></div>';
  }
}
function renderGlobalPlaylists() {
  const c1 = document.getElementById('globalPlaylistsGrid'); const c2 = document.getElementById('globalPlaylistsContent');
  const items = state.globalPlaylists || [];
  const isAdmin = state.currentUser && state.currentUser.tipo === 'admin';
  const html = items.length ? items.map(p =>
    '<div class="playlist-item" onclick="playGlobalPlaylist(\'' + p.id + '\')">' +
      '<div class="playlist-cover" style="background:linear-gradient(135deg,var(--apple-blue),var(--apple-purple))"><i class="bi bi-globe"></i></div>' +
      '<div class="flex-grow-1"><h6 class="mb-0">' + (p.nome || '') + '</h6>' +
      '<small class="text-muted">' + (p.descricao || 'Playlist global') + ' • ' + (p.music_count || (p.musicas ? p.musicas.length : 0)) + ' músicas</small></div>' +
      '<button class="btn btn-sm btn-success me-2" onclick="event.stopPropagation(); playGlobalPlaylist(\'' + p.id + '\')"><i class="bi bi-play-fill"></i> Tocar</button>' +
      (isAdmin ? '<button class="btn btn-sm btn-info me-2" onclick="event.stopPropagation(); openManageGlobalPlaylist(\'' + p.id + '\')"><i class="bi bi-pencil-square me-1"></i>Gerenciar</button>' : '') +
      '<span class="global-badge" style="position:static"><i class="bi bi-globe"></i> Global</span>' +
    '</div>'
  ).join('') : '<div class="empty-state-actionable"><i class="bi bi-globe empty-icon"></i><h5 class="text-muted">Nenhuma playlist global ainda</h5><p class="text-muted small">O Admin ainda não criou playlists globais</p></div>';
  if (c1) c1.innerHTML = items.length ? items.map(p =>
    '<div class="spotify-card" onclick="playGlobalPlaylist(\'' + p.id + '\')">' +
      '<div class="spotify-cover" style="background:linear-gradient(135deg,var(--apple-blue),var(--apple-purple));display:flex;align-items:center;justify-content:center;position:relative">' +
        '<i class="bi bi-globe" style="font-size:64px;color:#fff"></i>' +
        '<div class="global-badge" style="position:absolute"><i class="bi bi-globe"></i> Global</div>' +
      '</div>' +
      '<h3 class="spotify-title">' + (p.nome || '') + '</h3>' +
      '<p class="spotify-artist">' + (p.music_count || (p.musicas ? p.musicas.length : 0)) + ' músicas</p>' +
    '</div>'
  ).join('') : '';
  if (c2) c2.innerHTML = html;
}

function playGlobalPlaylist(playlistId) {
  const pl = (state.globalPlaylists || []).find(p => String(p.id) === String(playlistId));
  if (!pl) { showToast('Playlist não encontrada', 'error'); return; }
  const ids = (pl.musicas || []).map(String);
  if (!ids.length) { showToast('Playlist vazia', 'warning'); return; }
  const queueItems = [];
  ids.forEach(id => {
    const idx = (state.playlist || []).findIndex(m => String(m.id) === String(id));
    if (idx !== -1) queueItems.push({ type: 'internal', index: idx, track: state.playlist[idx], trackId: id });
  });
  if (!queueItems.length) { showToast('Nenhuma música disponível nesta playlist', 'warning'); return; }
  playQueue.items = queueItems;
  playQueue.currentIndex = 0;
  playQueue.playCurrent();
  showToast('▶️ Tocando playlist: ' + (pl.nome || ''), 'success');
}

function renderArtists() {
  const c = document.getElementById('artistsContent'); if (!c) return;
  const items = state.artists || [];
  if (!items.length) { c.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--apple-label-2)">Nenhum artista</div>'; return; }
  c.innerHTML = items.map(a => {
    const isFollowing = (state.followingArtists || []).map(String).includes(String(a.id));
    const avatar = a.avatar && a.avatar.startsWith('http') ? a.avatar : PLACEHOLDERS.ARTIST;
    return '<div class="artist-card"><img src="' + avatar + '" class="artist-avatar" onerror="this.onerror=null;this.src=\'' + PLACEHOLDERS.ARTIST + '\'"><h4 class="artist-name">' + (a.nome || '') + '</h4><p class="artist-followers">' + formatNumber(a.followers || 0) + ' seguidores</p><button class="btn-follow ' + (isFollowing ? 'following' : '') + '" onclick="toggleFollow(\'' + a.id + '\')">' + (isFollowing ? 'Seguindo' : 'Seguir') + '</button></div>';
  }).join('');
}
function renderFeaturedArtists() {
  const c = document.getElementById('featuredArtistsGrid'); if (!c) return;
  const items = (state.artists || []).slice(0, 6);
  if (!items.length) { c.innerHTML = ''; return; }
  c.innerHTML = items.map(a => {
    const isFollowing = (state.followingArtists || []).map(String).includes(String(a.id));
    const avatar = a.avatar && a.avatar.startsWith('http') ? a.avatar : PLACEHOLDERS.ARTIST;
    return '<div class="artist-card"><img src="' + avatar + '" class="artist-avatar" onerror="this.onerror=null;this.src=\'' + PLACEHOLDERS.ARTIST + '\'"><h4 class="artist-name">' + (a.nome || '') + '</h4><button class="btn-follow ' + (isFollowing ? 'following' : '') + '" onclick="toggleFollow(\'' + a.id + '\')">' + (isFollowing ? 'Seguindo' : 'Seguir') + '</button></div>';
  }).join('');
}
function renderTickets() {
  const c = document.getElementById('ticketsContent'); if (!c) return;
  const items = state.tickets || [];
  if (!items.length) { c.innerHTML = '<div class="empty-state-actionable"><i class="bi bi-ticket-perforated empty-icon"></i><h5 class="text-muted">Nenhum ingresso disponível</h5></div>'; return; }
  c.innerHTML = items.map(t => '<div class="ticket-card"><div class="d-flex justify-content-between"><div class="ticket-title">' + (t.titulo || 'Ingresso') + '</div><span class="badge badge-selo">' + (t.quantidade_disponivel || 0) + ' restantes</span></div><p class="text-muted small mt-2">' + (t.descricao || '') + '</p><div class="d-flex justify-content-between align-items-center"><div class="ticket-price">' + (t.preco_selo || 0) + ' SELO</div><button class="btn-redeem" onclick="redeemTicket(\'' + t.id + '\')" ' + ((state.seloCoinBalance || 0) < (t.preco_selo || 0) ? 'disabled' : '') + '>Resgatar</button></div></div>').join('');
}
function renderArtistMusic(musics) {
  const c = document.getElementById('artistMusicContent'); if (!c) return;
  if (!musics.length) { c.innerHTML = '<div class="empty-state-actionable" style="grid-column:1/-1"><i class="bi bi-music-note-beamed empty-icon"></i><h5 class="text-muted">Nenhuma música</h5></div>'; return; }
  c.innerHTML = musics.map(t => '<div class="spotify-card"><div class="spotify-cover"><img src="' + getCoverUrl(t, false) + '"></div><h3 class="spotify-title">' + (t.titulo || '') + '</h3><p class="spotify-artist">' + formatCurrency(t.valor_acao || 0) + '</p></div>').join('');
}
function renderAdminGlobalPlaylists() {
  const c = document.getElementById('adminGlobalPlaylistsContent'); if (!c) return;
  const items = state.globalPlaylists || [];
  if (!items.length) { c.innerHTML = '<div class="empty-state-actionable"><i class="bi bi-globe empty-icon"></i><h5 class="text-muted">Nenhuma playlist global</h5></div>'; return; }
  c.innerHTML = items.map(p => '<div class="playlist-item"><div class="playlist-cover" style="background:linear-gradient(135deg,var(--apple-blue),var(--apple-purple))"><i class="bi bi-globe"></i></div><div class="flex-grow-1"><h6 class="mb-0">' + (p.nome || '') + '</h6><small class="text-muted">' + (p.music_count || (p.musicas ? p.musicas.length : 0)) + ' músicas</small></div><button class="btn btn-sm btn-info me-2" onclick="openManageGlobalPlaylist(\'' + p.id + '\')"><i class="bi bi-list-music me-1"></i>Músicas</button></div>').join('');
}

function changeSection(section) {
  const a = document.querySelector('.section.active');
  if (a) localStorage.setItem('lastSection', a.id.replace('Section', ''));
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(section + 'Section');
  if (el) el.classList.add('active');
  document.getElementById('sidebar').classList.remove('open');
  window.scrollTo(0, 0);
  if (section === 'news') loadNewsFeed();
}
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }

// ============ MODAIS ============
function showModal(id) { const m = document.getElementById(id); if (m) { m.classList.add('show'); document.body.style.overflow = 'hidden'; } }
function closeModal(id) { const m = document.getElementById(id); if (m) { m.classList.remove('show'); document.body.style.overflow = 'auto'; } }
function openInvestModal(i) { if (i < 0 || i >= state.playlist.length) return; const t = state.playlist[i]; state.currentInvestTrack = t; document.getElementById('investTrackTitle').textContent = t.titulo || ''; document.getElementById('investTrackArtist').textContent = t.artista || ''; document.getElementById('investUnitPriceDisplay').textContent = formatCurrency(t.valor_acao || 0); document.getElementById('investAvailableBalanceDisplay').textContent = formatCurrency(state.userBalance); document.getElementById('investQuantityField').value = 1; updateInvestmentTotal(); showModal('investModal'); }
function updateInvestmentTotal() { if (!state.currentInvestTrack) return; const q = parseInt(document.getElementById('investQuantityField').value) || 1; const t = q * (state.currentInvestTrack.valor_acao || 0); document.getElementById('investTotalPriceDisplay').textContent = formatCurrency(t); document.getElementById('confirmInvestBtn').disabled = t > state.userBalance; }
function adjustQuantity(a) { const i = document.getElementById('investQuantityField'); i.value = Math.max(1, parseInt(i.value) + a); updateInvestmentTotal(); }
async function confirmInvestment() {
  if (!state.currentUser || !state.currentInvestTrack) return;
  const q = parseInt(document.getElementById('investQuantityField').value) || 1;
  const t = q * (state.currentInvestTrack.valor_acao || 0);
  if (t > state.userBalance) { showToast('Saldo insuficiente', 'error'); return; }
  const btn = document.getElementById('confirmInvestBtn');
  btn.disabled = true; btn.innerHTML = 'Processando...';
  try {
    const r = await callAPI('buy', { music_id: state.currentInvestTrack.id, quantidade: q, valor_total: t });
    if (r && r.success) {
      state.userBalance -= t;
      state.portfolioAssets.push({ id: 'inv_' + Date.now(), music_id: state.currentInvestTrack.id, quantidade: q, valor_total: t });
      updateBalanceDisplay(); renderPortfolio();
      showToast('✅ Investimento realizado!', 'success'); closeModal('investModal');
    } else showToast((r && r.message) || 'Erro', 'error');
  } catch (e) { showToast('Erro', 'error'); }
  finally { btn.disabled = false; btn.innerHTML = 'Confirmar'; }
}
function openInvestExternalModal(i) { if (i < 0 || i >= state.externalPlaylist.length) return; state.currentExternalTrack = state.externalPlaylist[i]; document.getElementById('investExternalTitleDisplay').textContent = state.currentExternalTrack.titulo || ''; document.getElementById('investExternalArtistDisplay').textContent = state.currentExternalTrack.artista || ''; document.getElementById('investExternalUnitPriceDisplay').textContent = formatCurrency(state.currentExternalTrack.valor_acao || 0); document.getElementById('investExternalQuantityField').value = 1; updateExternalInvestmentTotal(); showModal('investExternalModal'); }
function updateExternalInvestmentTotal() { if (!state.currentExternalTrack) return; const q = parseInt(document.getElementById('investExternalQuantityField').value) || 1; const t = q * (state.currentExternalTrack.valor_acao || 0); document.getElementById('investExternalTotalPriceDisplay').textContent = formatCurrency(t); }
function adjustExternalQuantity(a) { const i = document.getElementById('investExternalQuantityField'); i.value = Math.max(1, parseInt(i.value) + a); updateExternalInvestmentTotal(); }
async function confirmExternalInvestment() { if (!state.currentUser || !state.currentExternalTrack) return; const q = parseInt(document.getElementById('investExternalQuantityField').value) || 1; const t = q * (state.currentExternalTrack.valor_acao || 0); if (t > state.userBalance) { showToast('Saldo insuficiente', 'error'); return; } try { const r = await callAPI('buy_external', { external_id: state.currentExternalTrack.id, quantidade: q, valor_total: t }); if (r && r.success) { state.userBalance -= t; updateBalanceDisplay(); closeModal('investExternalModal'); showToast('Investimento externo realizado!', 'success'); } } catch (e) { showToast('Erro', 'error'); } }
function openAddBalanceModal() { document.getElementById('balanceAmountField').value = 100; showModal('addBalanceModal'); }
function openWithdrawalModal() { if (state.userBalance < 10) { showToast('Saldo mínimo R$ 10', 'warning'); return; } document.getElementById('withdrawalAmountField').value = state.userBalance; showModal('withdrawalModal'); }
function setBalanceAmount(v) { document.getElementById('balanceAmountField').value = v; }
function processBalanceAdd() { const a = parseFloat(document.getElementById('balanceAmountField').value) || 0; if (a < 10) { showToast('Mínimo R$ 10', 'error'); return; } state.userBalance += a; updateBalanceDisplay(); closeModal('addBalanceModal'); showToast('Saldo adicionado!', 'success'); window.open(CONFIG.MERCADO_PAGO_LINK, '_blank'); }
async function requestWithdrawal() { const amount = parseFloat(document.getElementById('withdrawalAmountField').value) || 0; const method = document.getElementById('withdrawalMethodField').value; const details = document.getElementById('bankDetailsField').value.trim(); if (amount < 10 || amount > state.userBalance || !method || !details) { showToast('Verifique os campos', 'error'); return; } const btn = document.getElementById('requestWithdrawalBtn'); btn.disabled = true; try { const r = await callAPI('request_withdrawal', { valor: amount, metodo: method, dados_bancarios: details }); if (r && r.success) { state.userBalance -= amount; updateBalanceDisplay(); closeModal('withdrawalModal'); showToast('Saque solicitado!', 'success'); } } catch (e) { showToast('Erro', 'error'); } finally { btn.disabled = false; } }
function openAddMusicModal() { if (!state.currentUser || state.currentUser.tipo !== 'artista') { showToast('Apenas artistas', 'error'); return; } showModal('addMusicModal'); }
function openAddExternalMusicModal() { if (!state.currentUser) { showToast('Faça login', 'error'); return; } showModal('addExternalMusicModal'); }
function openCreatePlaylistModal() { showModal('createPlaylistModal'); }
function openCreateGlobalPlaylistModal() { if (!state.currentUser || state.currentUser.tipo !== 'admin') { showToast('Apenas admin', 'error'); return; } showModal('createGlobalPlaylistModal'); }

async function createGlobalPlaylist() {
  const nome = document.getElementById('globalPlaylistNameField').value.trim();
  const desc = document.getElementById('globalPlaylistDescField').value.trim();
  if (!nome) { showToast('Digite um nome', 'error'); return; }
  const btn = document.getElementById('createGlobalPlaylistBtn');
  btn.disabled = true; btn.innerHTML = 'Criando...';
  try {
    const r = await callAPI('create_global_playlist', { nome, descricao: desc, user_id: state.currentUser.id, is_global: true });
    const newPl = {
      id: (r && r.data && r.data.id) || ('gp_' + Date.now() + Math.random().toString(36).substring(2, 6)),
      nome: nome, descricao: desc, musicas: [], music_count: 0, is_global: true, created_at: new Date().toISOString()
    };
    state.globalPlaylists = state.globalPlaylists || [];
    state.globalPlaylists.push(newPl);
    localStorage.setItem('miv_global_playlists', JSON.stringify(state.globalPlaylists));
    renderGlobalPlaylists(); renderAdminGlobalPlaylists();
    showToast('✅ Playlist global criada!', 'success');
    closeModal('createGlobalPlaylistModal');
    document.getElementById('globalPlaylistNameField').value = '';
    document.getElementById('globalPlaylistDescField').value = '';
    document.getElementById('adminGlobalPlaylistsCount').textContent = state.globalPlaylists.length;
  } catch (e) { showToast('Erro', 'error'); }
  finally { btn.disabled = false; btn.innerHTML = 'Criar'; }
}

let currentManagingPlaylistId = null;
function openManageGlobalPlaylist(playlistId) {
  if (!state.currentUser || state.currentUser.tipo !== 'admin') { showToast('Apenas admin', 'error'); return; }
  const pl = (state.globalPlaylists || []).find(p => String(p.id) === String(playlistId));
  if (!pl) { showToast('Playlist não encontrada', 'error'); return; }
  currentManagingPlaylistId = playlistId;
  document.getElementById('manageGlobalPlaylistName').value = pl.nome || '';
  const sel = document.getElementById('manageGlobalMusicSelect');
  sel.innerHTML = '<option value="">Selecione uma música...</option>' + (state.playlist || []).map(m => '<option value="' + m.id + '">' + (m.titulo || '') + ' — ' + (m.artista || '') + '</option>').join('');
  renderManageGlobalMusicList();
  showModal('manageGlobalPlaylistModal');
}
function renderManageGlobalMusicList() {
  const list = document.getElementById('manageGlobalMusicList');
  const pl = (state.globalPlaylists || []).find(p => String(p.id) === String(currentManagingPlaylistId));
  if (!pl) { list.innerHTML = ''; return; }
  const musicIds = pl.musicas || [];
  document.getElementById('manageGlobalMusicCount').textContent = musicIds.length;
  if (musicIds.length === 0) { list.innerHTML = '<div class="text-muted text-center p-3">Nenhuma música ainda</div>'; return; }
  list.innerHTML = musicIds.map(id => {
    const m = (state.playlist || []).find(x => String(x.id) === String(id));
    if (!m) return '';
    return '<div class="d-flex align-items-center justify-content-between p-2 mb-1" style="background:var(--apple-gray-5);border-radius:var(--radius-sm)"><div class="d-flex align-items-center gap-2"><img src="' + getCoverUrl(m, false) + '" style="width:36px;height:36px;border-radius:6px;object-fit:cover"><div><div class="text-white" style="font-size:13px;font-weight:600">' + (m.titulo || '') + '</div><div class="text-muted" style="font-size:11px">' + (m.artista || '') + '</div></div></div><button class="btn btn-sm btn-outline-danger" onclick="removeMusicFromGlobalPlaylist(\'' + id + '\')"><i class="bi bi-trash"></i></button></div>';
  }).join('');
}
async function addMusicToGlobalPlaylist() {
  const musicId = document.getElementById('manageGlobalMusicSelect').value;
  if (!musicId) { showToast('Selecione uma música', 'warning'); return; }
  const pl = (state.globalPlaylists || []).find(p => String(p.id) === String(currentManagingPlaylistId));
  if (!pl) { showToast('Playlist não encontrada', 'error'); return; }
  pl.musicas = pl.musicas || [];
  if (pl.musicas.map(String).includes(String(musicId))) { showToast('Música já está na playlist', 'info'); return; }
  pl.musicas.push(musicId);
  pl.music_count = pl.musicas.length;
  localStorage.setItem('miv_global_playlists', JSON.stringify(state.globalPlaylists));
  renderManageGlobalMusicList(); renderGlobalPlaylists(); renderAdminGlobalPlaylists();
  try { await callAPI('add_music_to_global_playlist', { playlist_id: currentManagingPlaylistId, music_id: musicId, user_id: state.currentUser.id }); showToast('✅ Música adicionada!', 'success'); }
  catch (e) { showToast('Salvo localmente', 'warning'); }
}
async function removeMusicFromGlobalPlaylist(musicId) {
  const pl = (state.globalPlaylists || []).find(p => String(p.id) === String(currentManagingPlaylistId));
  if (!pl) return;
  pl.musicas = (pl.musicas || []).filter(id => String(id) !== String(musicId));
  pl.music_count = pl.musicas.length;
  localStorage.setItem('miv_global_playlists', JSON.stringify(state.globalPlaylists));
  renderManageGlobalMusicList(); renderGlobalPlaylists(); renderAdminGlobalPlaylists();
  try { await callAPI('remove_music_from_global_playlist', { playlist_id: currentManagingPlaylistId, music_id: musicId }); showToast('🗑️ Removida', 'success'); }
  catch (e) { showToast('Salvo localmente', 'warning'); }
}
function openCreateTicketModal() { if (!state.currentUser || state.currentUser.tipo !== 'artista') { showToast('Apenas artistas', 'error'); return; } showModal('createTicketModal'); }
async function createTicket() {
  const titulo = document.getElementById('ticketTitleField').value.trim();
  const desc = document.getElementById('ticketDescField').value.trim();
  const preco = parseFloat(document.getElementById('ticketPriceField').value) || 0;
  const qtd = parseInt(document.getElementById('ticketQuantityField').value) || 0;
  if (!titulo || preco <= 0 || qtd <= 0) { showToast('Preencha os campos', 'error'); return; }
  const newTicket = { id: 'tk_' + Date.now(), titulo, descricao: desc, preco_selo: preco, quantidade_total: qtd, quantidade_disponivel: qtd, data_evento: document.getElementById('ticketDateField').value, artista_nome: state.currentUser.nome };
  state.tickets.push(newTicket);
  renderTickets();
  closeModal('createTicketModal');
  showToast('✅ Ingresso criado!', 'success');
  try { await callAPI('create_ticket', newTicket); } catch (e) {}
}
async function redeemTicket(id) {
  if (!state.currentUser) return;
  const ticket = (state.tickets || []).find(t => String(t.id) === String(id));
  if (!ticket) return;
  if ((state.seloCoinBalance || 0) < (ticket.preco_selo || 0)) { showToast('SELO insuficiente', 'error'); return; }
  if (!confirm('Resgatar por ' + ticket.preco_selo + ' SELO?')) return;
  state.seloCoinBalance -= ticket.preco_selo;
  ticket.quantidade_disponivel = Math.max(0, ticket.quantidade_disponivel - 1);
  updateBalanceDisplay(); renderTickets();
  showToast('🎟️ Ingresso resgatado!', 'success');
  try { await callAPI('redeem_ticket', { ticket_id: id }); } catch (e) {}
}
async function toggleFollow(artistId) {
  if (!state.currentUser) { showToast('Faça login', 'error'); return; }
  const sid = String(artistId);
  const isFollowing = (state.followingArtists || []).map(String).includes(sid);
  if (isFollowing) { state.followingArtists = state.followingArtists.filter(x => String(x) !== sid); showToast('Deixou de seguir', 'info'); }
  else { state.followingArtists.push(sid); showToast('❤️ Seguindo!', 'success'); }
  renderArtists(); renderFeaturedArtists();
  try { await callAPI('toggle_follow', { user_id: state.currentUser.id, artist_id: artistId, action: isFollowing ? 'unfollow' : 'follow' }); } catch (e) {}
}
async function submitExternalMusic() { const y = document.getElementById('externalYoutubeLinkField').value.trim(); const t = document.getElementById('externalTitleField').value.trim(); const a = document.getElementById('externalArtistField').value.trim(); const p = parseFloat(document.getElementById('externalPriceField').value); if (!y || !t || !a || !p) { showToast('Preencha os campos', 'error'); return; } try { const r = await callAPI('suggest_external_music', { link_youtube: y, titulo: t, artista: a, valor_acao: p }); if (r && r.success) { showToast('Sugerida!', 'success'); closeModal('addExternalMusicModal'); await loadExternalMarketplace(true); } } catch (e) { showToast('Erro', 'error'); } }
async function createPlaylist() { const name = document.getElementById('playlistNameField').value.trim(); if (!name || !state.currentUser) return; try { const r = await callAPI('create_playlist', { nome: name, publica: document.getElementById('playlistPublicField').checked, user_id: state.currentUser.id }); if (r && r.success) { showToast('Playlist criada!', 'success'); closeModal('createPlaylistModal'); await loadUserPlaylists(); } } catch (e) { showToast('Erro', 'error'); } }
function exportExtrato() { showToast('Exportado!', 'success'); }
function printContract() { window.print(); }
function viewContract(ref) { showToast('Contrato ' + ref, 'info'); }

// ============ SEARCH ============
async function performSearch() {
  const q = document.getElementById('searchInput').value.trim();
  if (!q) { showToast('Digite uma busca', 'warning'); return; }
  const c = document.getElementById('searchResults');
  c.style.display = 'block';
  c.innerHTML = '<div class="p-4 text-center text-muted"><div class="spinner-border spinner-border-sm text-success me-2"></div>Buscando...</div>';
  const toStr = (v) => (v === null || v === undefined) ? '' : String(v).toLowerCase();
  try {
    const ql = q.toLowerCase();
    const internal = (state.playlist || []).filter(i => i && (toStr(i.titulo).includes(ql) || toStr(i.artista).includes(ql)));
    const external = (state.externalPlaylist || []).filter(i => i && (toStr(i.titulo).includes(ql) || toStr(i.artista).includes(ql)));
    const artists = (state.artists || []).filter(a => a && toStr(a.nome).includes(ql));
    let apiRes = [];
    try {
      const r = await Promise.race([callAPI('search', { q: q }), new Promise(res => setTimeout(() => res(null), 3000))]);
      if (r && r.success && Array.isArray(r.data)) apiRes = r.data.filter(x => x && (toStr(x.titulo).includes(ql) || toStr(x.artista).includes(ql)));
    } catch (e) {}
    let ytResults = [];
    if (internal.length + external.length + artists.length + apiRes.length === 0) {
      ytResults = await searchYouTubeDirect(q);
    }
    displaySearchResults(internal, external, apiRes.concat(ytResults || []), artists, q);
  } catch (e) { c.innerHTML = '<div class="p-4 text-center text-danger">Erro ao buscar</div>'; }
}
async function searchYouTubeDirect(query) {
  try {
    try {
      const r = await callAPI('search_youtube', { query: query, limit: 10 });
      if (r && r.success && r.data && r.data.length > 0) return r.data.map(item => ({ id: item.id || ('yt_' + (item.link_youtube || '').split('v=')[1]), titulo: item.titulo || item.title, artista: item.artista || item.channelTitle, link_capa: item.link_capa || item.thumbnail, link_youtube: item.link_youtube, is_youtube: true }));
    } catch (e) {}
    if (!CONFIG.YOUTUBE_API_KEY) return [];
    const url = 'https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=10&q=' + encodeURIComponent(query + ' música') + '&key=' + CONFIG.YOUTUBE_API_KEY;
    const resp = await fetch(url); const data = await resp.json();
    if (!data.items) return [];
    return data.items.map(item => ({ id: 'yt_' + item.id.videoId, titulo: item.snippet.title, artista: item.snippet.channelTitle, link_capa: item.snippet.thumbnails.high.url, link_youtube: 'https://www.youtube.com/watch?v=' + item.id.videoId, is_youtube: true }));
  } catch (e) { return []; }
}
function displaySearchResults(internal, external, yt, artists, q) {
  const c = document.getElementById('searchResults');
  const all = [].concat(
    (internal || []).map(x => Object.assign({}, x, { _type: 'internal' })),
    (external || []).map(x => Object.assign({}, x, { _type: 'external' })),
    (yt || []).map(x => Object.assign({}, x, { _type: 'external' })),
    (artists || []).map(x => Object.assign({}, x, { _type: 'artist' }))
  );
  if (!all.length) { c.innerHTML = '<div class="p-4 text-center text-muted">Nenhum resultado</div>'; return; }
  c.innerHTML = '<div class="p-2">' + all.slice(0, 30).map((item) => {
    if (!item) return '';
    const isExt = item._type === 'external';
    const isArtist = item._type === 'artist';
    const isYouTube = item.is_youtube || (item.id && String(item.id).startsWith('yt_'));
    const cover = isArtist ? (item.avatar || PLACEHOLDERS.ARTIST) : getCoverUrlSmall(item, isExt);
    const badge = isArtist ? '<span class="search-result-badge artist">🎤</span>' : (isYouTube ? '<span class="search-result-badge" style="background:rgba(255,59,48,.18);color:var(--apple-red)">▶ YT</span>' : (isExt ? '<span class="search-result-badge">🌐</span>' : '<span class="search-result-badge normal">🔷</span>'));
    const title = isArtist ? (item.nome || '') : (item.titulo || '');
    const sub = isArtist ? ((item.followers || 0) + ' seguidores') : (item.artista || '');
    let clickAction;
    if (isArtist) { clickAction = 'viewArtist(\'' + item.id + '\')'; }
    else if (isYouTube) { const vid = String(item.id).replace('yt_', ''); clickAction = 'playSearchResult(\'youtube\', \'' + vid + '\')'; }
    else { clickAction = 'playSearchResult(\'' + item._type + '\', \'' + item.id + '\')'; }
    return '<div class="search-result-item" onclick="' + clickAction + '"><img src="' + cover + '" class="search-result-cover"><div class="search-result-info"><div class="search-result-title">' + title + '</div><div class="search-result-artist">' + sub + '</div></div>' + badge + '</div>';
  }).join('') + '</div>';
}
function playSearchResult(type, id) {
  document.getElementById('searchResults').style.display = 'none';
  document.getElementById('searchInput').value = '';
  if (type === 'internal') { const idx = (state.playlist || []).findIndex(t => String(t.id) === String(id)); if (idx !== -1) playTrack(idx); }
  else if (type === 'external') { const idx = (state.externalPlaylist || []).findIndex(t => String(t.id) === String(id)); if (idx !== -1) playExternalTrack(idx); }
  else if (type === 'youtube') {
    const vid = String(id).replace('yt_', '');
    state.currentTrackIndex = 2000;
    document.getElementById('playerSpotify').style.display = 'flex';
    document.getElementById('playerTitle').textContent = 'YouTube';
    document.getElementById('playerArtist').textContent = 'YouTube';
    const art = document.getElementById('playerAlbumArt');
    if (art) art.src = 'https://img.youtube.com/vi/' + vid + '/hqdefault.jpg';
    loadYouTubeAPI(() => initializeYouTubePlayer(vid));
    state.isPlaying = true; updatePlayerIcons();
  }
}
function viewArtist(id) { changeSection('artists'); }

// ============ YOUTUBE ANALYZE ============
let dadosVideoAnalisado = null;
let videoIdAtual = null;
async function analisarVideoYouTube() {
  const link = document.getElementById('musicYoutubeField').value;
  videoIdAtual = extractYouTubeId(link);
  if (!videoIdAtual) { showToast('Link inválido', 'error'); return; }
  const btn = document.getElementById('btnAnalisarVideo');
  btn.disabled = true; btn.innerHTML = 'Analisando...';
  try {
    const url = 'https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=' + videoIdAtual + '&key=' + CONFIG.YOUTUBE_API_KEY;
    const resp = await fetch(url); const dados = await resp.json();
    if (dados.items && dados.items.length > 0) {
      const video = dados.items[0]; const stats = video.statistics;
      const views = parseInt(stats.viewCount) || 0;
      dadosVideoAnalisado = { views, titulo: video.snippet.title };
      document.getElementById('musicTitleField').value = dadosVideoAnalisado.titulo;
      document.getElementById('musicCoverField').value = 'https://img.youtube.com/vi/' + videoIdAtual + '/maxresdefault.jpg';
      showToast('✅ Dados carregados!', 'success');
    }
  } catch (e) { showToast('Erro ao analisar', 'error'); }
  finally { btn.disabled = false; btn.innerHTML = 'Analisar'; }
}
async function finalizarCadastroComYouTube() {
  if (!dadosVideoAnalisado || !videoIdAtual) { showToast('Analise um vídeo primeiro', 'error'); return; }
  const genero = document.getElementById('musicGenreField').value;
  const preco = parseFloat(document.getElementById('musicPriceField').value);
  const percentual = parseFloat(document.getElementById('musicPercentField').value);
  if (!genero || !preco || !percentual) { showToast('Preencha os campos', 'error'); return; }
  try {
    const r = await callAPI('upload_music', { titulo: dadosVideoAnalisado.titulo, artista: state.currentUser.nome, genero, link_youtube: 'https://youtube.com/watch?v=' + videoIdAtual, link_capa: document.getElementById('musicCoverField').value, valor_acao: preco, percentual_disponivel: percentual });
    if (r && r.success) { showToast('✅ Música cadastrada!', 'success'); closeModal('addMusicModal'); await loadMarketplace(); }
  } catch (e) { showToast('Erro', 'error'); }
}
async function autoFillMusicInfo() {}

// ============ FAVORITES ============
async function loadUserFavorites() { if (!state.currentUser) return; const cached = localStorage.getItem('miv_favorites_' + state.currentUser.id); if (cached) { try { const p = JSON.parse(cached); if (Array.isArray(p)) state.favoriteMusicIds = p; } catch (e) {} } }
function renderMyMusic(tab) { const c = document.getElementById('myMusicContent'); if (!c) return; c.innerHTML = '<div class="empty-state-actionable" style="grid-column:1/-1"><i class="bi bi-music-note-beamed empty-icon"></i><h5 class="text-muted">Nenhuma música</h5></div>'; }

// ============ STREAMING MONITOR ============
function startStreamingMonitor() { if (state.streamingTimer) clearInterval(state.streamingTimer); state.streamingTimer = setInterval(checkStreamingProgress, 1000); }
async function checkStreamingProgress() {
  if (!state.youtubePlayer || !state.playerReady) return;
  try {
    if (typeof state.youtubePlayer.getPlayerState !== 'function') return;
    const s = state.youtubePlayer.getPlayerState();
    const c = state.youtubePlayer.getCurrentTime() || 0;
    updatePlayerProgress();
    if (s === 1 && c >= 30 && state.currentTrackIndex >= 0 && state.currentTrackIndex < state.playlist.length) {
      const now = Date.now();
      if (now - state.streamingLastReward > 29000) {
        const t = state.playlist[state.currentTrackIndex];
        const key = 'reward_' + t.id + '_' + (state.currentUser ? state.currentUser.id : '');
        if (state.currentUser && !localStorage.getItem(key)) {
          localStorage.setItem(key, 'true');
          state.seloCoinBalance = (state.seloCoinBalance || 0) + 1;
          updateBalanceDisplay();
          showToast('🪙 +1 SELO COIN por "' + t.titulo + '"', 'success');
          try { await callAPI('register_streaming', { music_id: t.id }); } catch (e) {}
        }
        state.streamingLastReward = now;
      }
    }
  } catch (e) {}
}
async function loadStreamingStats() {}

// ============ INSTALL APP ============
function installApp() { showToast('Use o menu do navegador para instalar', 'info'); }

// ============ INIT ============
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 PLAY MY v' + CONFIG.VERSION + ' — Apple Design + Correções + News Feed');
  HealthCheck.runAll().catch(() => {});
  setInterval(() => HealthCheck.runAll(), 300000);
  window.addEventListener('online', () => { const b = document.getElementById('offlineBadge'); if (b) b.style.display = 'none'; showToast('📶 Online', 'success'); });
  window.addEventListener('offline', () => { const b = document.getElementById('offlineBadge'); if (b) b.style.display = 'block'; showToast('📴 Offline', 'warning'); });
  setTimeout(() => loadYouTubeAPI(), 2000);
  setTimeout(() => loadNewsFeed(), 1500);
  const stored = localStorage.getItem('miv_user');
  if (stored) {
    try {
      state.currentUser = JSON.parse(stored);
      state.userBalance = state.currentUser.saldo || 0;
      state.seloCoinBalance = state.currentUser.selo_coin || 0;
      state.favoriteMusicIds = Array.isArray(state.currentUser.favorite_music_ids) ? state.currentUser.favorite_music_ids : [];
      initializeApp();
    } catch (e) { localStorage.removeItem('miv_user'); hideLoading(); }
  } else { hideLoading(); }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (state.streamingTimer) { clearInterval(state.streamingTimer); state.streamingTimer = null; } }
  else { if (state.isPlaying && state.playerReady) startStreamingMonitor(); }
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try { await navigator.serviceWorker.register('/sw.js'); } catch (error) { console.warn('SW não registrado:', error.message); }
  });
}

// ============ EXPOSE GLOBAL ============
window.CONFIG = CONFIG;
window.GAS_URL = GAS_URL;
window.PLACEHOLDERS = PLACEHOLDERS;
window.HealthCheck = HealthCheck;
window.state = state;
window.playQueue = playQueue;
window.callAPI = callAPI;
window.getFallbackData = getFallbackData;
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.resendConfirmationEmail = resendConfirmationEmail;
window.openResetPasswordModal = openResetPasswordModal;
window.sendResetEmail = sendResetEmail;
window.logout = logout;
window.toggleSidebar = toggleSidebar;
window.changeSection = changeSection;
window.showRegisterForm = showRegisterForm;
window.showLoginForm = showLoginForm;
window.toggleArtistField = toggleArtistField;
window.showModal = showModal;
window.closeModal = closeModal;
window.openInvestModal = openInvestModal;
window.updateInvestmentTotal = updateInvestmentTotal;
window.adjustQuantity = adjustQuantity;
window.confirmInvestment = confirmInvestment;
window.openInvestExternalModal = openInvestExternalModal;
window.updateExternalInvestmentTotal = updateExternalInvestmentTotal;
window.adjustExternalQuantity = adjustExternalQuantity;
window.confirmExternalInvestment = confirmExternalInvestment;
window.openAddBalanceModal = openAddBalanceModal;
window.openWithdrawalModal = openWithdrawalModal;
window.setBalanceAmount = setBalanceAmount;
window.processBalanceAdd = processBalanceAdd;
window.requestWithdrawal = requestWithdrawal;
window.openAddMusicModal = openAddMusicModal;
window.openAddExternalMusicModal = openAddExternalMusicModal;
window.openCreatePlaylistModal = openCreatePlaylistModal;
window.openCreateGlobalPlaylistModal = openCreateGlobalPlaylistModal;
window.createGlobalPlaylist = createGlobalPlaylist;
window.openManageGlobalPlaylist = openManageGlobalPlaylist;
window.addMusicToGlobalPlaylist = addMusicToGlobalPlaylist;
window.removeMusicFromGlobalPlaylist = removeMusicFromGlobalPlaylist;
window.playGlobalPlaylist = playGlobalPlaylist;
window.openCreateTicketModal = openCreateTicketModal;
window.createTicket = createTicket;
window.redeemTicket = redeemTicket;
window.toggleFollow = toggleFollow;
window.submitExternalMusic = submitExternalMusic;
window.createPlaylist = createPlaylist;
window.exportExtrato = exportExtrato;
window.printContract = printContract;
window.viewContract = viewContract;
window.performSearch = performSearch;
window.playSearchResult = playSearchResult;
window.viewArtist = viewArtist;
window.analisarVideoYouTube = analisarVideoYouTube;
window.finalizarCadastroComYouTube = finalizarCadastroComYouTube;
window.autoFillMusicInfo = autoFillMusicInfo;
window.renderMyMusic = renderMyMusic;
window.installApp = installApp;
window.loadMarketplace = loadMarketplace;
window.loadExternalMarketplace = loadExternalMarketplace;
window.loadPortfolio = loadPortfolio;
window.loadLedger = loadLedger;
window.loadTopInvestments = loadTopInvestments;
window.loadArtists = loadArtists;
window.loadTickets = loadTickets;
window.loadArtistData = loadArtistData;
window.loadAdminData = loadAdminData;
window.loadUserPlaylists = loadUserPlaylists;
window.loadGlobalPlaylists = loadGlobalPlaylists;
window.loadFollowingArtists = loadFollowingArtists;
window.loadUserFavorites = loadUserFavorites;
window.updateBalanceDisplay = updateBalanceDisplay;
window.updateUserInterface = updateUserInterface;
window.initializeApp = initializeApp;
window.loadAllData = loadAllData;
window.startStreamingMonitor = startStreamingMonitor;
window.loadStreamingStats = loadStreamingStats;
