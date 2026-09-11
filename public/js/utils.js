// ============================================================
// UTILS - PLAY MY v8.4 (Vercel KV primário + GAS fallback)
// ============================================================
const CONFIG = {
  VERCEL_URL: 'https://selomivplay.vercel.app/api/backend',
  GAS_URL: 'https://script.google.com/macros/s/AKfycbwgjor-tLLzVrnJGNHOifL1O2sRBhysKJ3IbVJy_AHgtNqjk-6hazH8xuO6OaDXF_s/exec',
  DEV_MODE: false,
  VERSION: '8.4.0',
  MERCADO_PAGO_LINK: 'https://link.mercadopago.com.br/selomiv',
  BLOCKCHAIN_ENABLED: true,
  SELO_COIN_RATE: 1,
  RESET_PASSWORD_URL: 'https://playmy.com.br/reset-password.html',
  CONFIRM_EMAIL_URL: 'https://playmy.com.br/confirm-email.html',
  TERMS_PDF_URL: 'https://playmy.com.br/termos-de-uso.pdf'
};

// Aliases para compatibilidade com código antigo
const GAS_URL = CONFIG.GAS_URL;
const API_URL = CONFIG.VERCEL_URL;

const PLACEHOLDERS = {
  MIV_56: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56"><rect width="56" height="56" fill="%231c1c1e"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="14" fill="%2334c759">PM</text></svg>',
  MIV_300: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="%231c1c1e"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="50" fill="%2334c759">PLAY</text><text x="50%" y="65%" text-anchor="middle" dy=".3em" font-size="40" fill="%2334c759">MY</text></svg>',
  EXT_56: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56"><rect width="56" height="56" fill="%231c1c1e"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="14" fill="%23ff9500">EXT</text></svg>',
  EXT_300: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="%231c1c1e"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="50" fill="%23ff9500">EXT</text></svg>',
  ARTIST: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="90" height="90"><circle cx="45" cy="45" r="45" fill="%231c1c1e"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="40" fill="%2334c759">A</text></svg>'
};

function formatCurrency(v) { if (v === null || v === undefined || isNaN(v)) v = 0; return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v)); }
function formatSelo(v) { if (v === null || v === undefined || isNaN(v)) v = 0; return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(Number(v)) + ' SELO'; }
function formatDate(d) { if (!d) return '-'; try { const x = new Date(d); return x.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (e) { return d; } }
function formatTime(s) { if (!s || isNaN(s)) return '0:00'; const m = Math.floor(s / 60), sec = Math.floor(s % 60); return m + ':' + sec.toString().padStart(2, '0'); }
function formatNumber(n) { if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'; if (n >= 1000) return (n / 1000).toFixed(1) + 'K'; return String(n || 0); }
function formatRelativeTime(iso) { try { const d = new Date(iso); const diff = Math.floor((Date.now() - d.getTime()) / 1000); if (diff < 60) return 'agora'; if (diff < 3600) return Math.floor(diff / 60) + 'min'; if (diff < 86400) return Math.floor(diff / 3600) + 'h'; if (diff < 604800) return Math.floor(diff / 86400) + 'd'; return d.toLocaleDateString('pt-BR'); } catch (e) { return ''; } }
function hideLoading() { const el = document.getElementById('loadingScreen'); if (el) el.style.display = 'none'; }
function showLoading(msg) { const el = document.getElementById('loadingScreen'); if (el) { el.style.display = 'flex'; const m = document.getElementById('loadingMessage'); if (m && msg) m.textContent = msg; } }

function showToast(message, type, duration) {
  type = type || 'success'; duration = duration || 3000;
  const c = document.getElementById('toastContainer'); if (!c) return;
  const t = document.createElement('div'); t.className = 'toast ' + type;
  const icon = type === 'success' ? 'bi-check-circle' : type === 'error' ? 'bi-exclamation-circle' : type === 'warning' ? 'bi-exclamation-triangle' : 'bi-info-circle';
  t.innerHTML = '<i class="bi ' + icon + ' toast-icon"></i><div class="toast-message">' + message + '</div>';
  c.appendChild(t); setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, duration);
}

function extractYouTubeId(url) { if (!url || typeof url !== 'string') return null; const patterns = [/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/, /youtube\.com\/watch\?.*v=([^&\n?#]+)/, /youtu\.be\/([^&\n?#]+)/]; for (let p of patterns) { const m = url.match(p); if (m && m[1] && m[1].length === 11) return m[1]; } return null; }
function getCoverUrl(track, isExternal) { if (!track) return isExternal ? PLACEHOLDERS.EXT_300 : PLACEHOLDERS.MIV_300; if (track.link_capa && track.link_capa.startsWith('http')) return track.link_capa; if (track.link_youtube) { const vid = extractYouTubeId(track.link_youtube); if (vid) return 'https://img.youtube.com/vi/' + vid + '/hqdefault.jpg'; } return isExternal ? PLACEHOLDERS.EXT_300 : PLACEHOLDERS.MIV_300; }
function getCoverUrlSmall(track, isExternal) { return getCoverUrl(track, isExternal); }

async function getYouTubeStats(videoId) {
  if (!videoId) return null;
  const key = 'yt_stats_' + videoId;
  const cached = localStorage.getItem(key);
  if (cached) { try { return JSON.parse(cached); } catch (e) {} }
  try {
    const r = await callAPI('get_youtube_stats', { video_id: videoId });
    if (r && r.success && r.data) { localStorage.setItem(key, JSON.stringify(r.data)); return r.data; }
  } catch (e) {}
  return { views: 100000, likes: 3000, comments: 500, is_estimate: true };
}
function calculateEstimatedRevenue(views) { const brl = (views / 1000) * 1.5; return { brl: brl, formatted: formatCurrency(brl) }; }
async function updateCardWithRealData(track, card) { if (!track || !track.link_youtube) return; const vid = extractYouTubeId(track.link_youtube); if (!vid) return; const vEl = card.querySelector('.youtube-views'); const eEl = card.querySelector('.estimated-earnings'); try { const stats = await getYouTubeStats(vid); const rev = calculateEstimatedRevenue(stats.views || 0); if (vEl) vEl.innerHTML = '<i class="bi bi-eye-fill me-1"></i>' + formatNumber(stats.views || 0); if (eEl) eEl.innerHTML = '<i class="bi bi-cash-stack me-1"></i>' + rev.formatted; track.youtube_stats = stats; } catch (e) {} }

// Expose globalmente
window.CONFIG = CONFIG;
window.GAS_URL = GAS_URL;
window.API_URL = API_URL;
window.PLACEHOLDERS = PLACEHOLDERS;
window.formatCurrency = formatCurrency;
window.formatSelo = formatSelo;
window.formatDate = formatDate;
window.formatTime = formatTime;
window.formatNumber = formatNumber;
window.formatRelativeTime = formatRelativeTime;
window.hideLoading = hideLoading;
window.showLoading = showLoading;
window.showToast = showToast;
window.extractYouTubeId = extractYouTubeId;
window.getCoverUrl = getCoverUrl;
window.getCoverUrlSmall = getCoverUrlSmall;
window.getYouTubeStats = getYouTubeStats;
window.calculateEstimatedRevenue = calculateEstimatedRevenue;
window.updateCardWithRealData = updateCardWithRealData;
