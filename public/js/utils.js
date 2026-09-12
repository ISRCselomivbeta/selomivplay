// ============================================================
// js/utils.js — PLAY MY v8.5.0
// Funções utilitárias: formatação, helpers de UI, placeholders.
// Depende de: config.js
// DEVE carregar DEPOIS de config.js.
// ============================================================

// ============ FORMATAÇÃO DE MOEDA E NÚMEROS ============
window.formatCurrency = function (v) {
  if (v === null || v === undefined || isNaN(v)) v = 0;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(Number(v));
};

window.formatSelo = function (v) {
  if (v === null || v === undefined || isNaN(v)) v = 0;
  return new Intl.NumberFormat('pt-BR').format(Number(v)) + ' SELO';
};

window.formatNumber = function (n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n || 0);
};

// ============ FORMATAÇÃO DE DATA E TEMPO ============
window.formatDate = function (d) {
  if (!d) return '-';
  try {
    const x = new Date(d);
    return x.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return d;
  }
};

window.formatTime = function (s) {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return m + ':' + sec.toString().padStart(2, '0');
};

window.formatRelativeTime = function (iso) {
  try {
    const d = new Date(iso);
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return 'agora';
    if (diff < 3600) return Math.floor(diff / 60) + 'min';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd';
    return d.toLocaleDateString('pt-BR');
  } catch (e) {
    return '';
  }
};

// ============ LOADING SCREEN ============
window.hideLoading = function () {
  const el = document.getElementById('loadingScreen');
  if (el) el.style.display = 'none';
};

window.showLoading = function (msg) {
  const el = document.getElementById('loadingScreen');
  if (el) {
    el.style.display = 'flex';
    const m = document.getElementById('loadingMessage');
    if (m && msg) m.textContent = msg;
  }
};

// ============ TOASTS (notificações) ============
window.showToast = function (message, type, duration) {
  type = type || 'success';
  duration = duration || 3000;

  const c = document.getElementById('toastContainer');
  if (!c) return;

  const t = document.createElement('div');
  t.className = 'toast ' + type;

  const icon =
    type === 'success' ? 'bi-check-circle' :
    type === 'error'   ? 'bi-exclamation-circle' :
    type === 'warning' ? 'bi-exclamation-triangle' :
    'bi-info-circle';

  t.innerHTML =
    '<i class="bi ' + icon + ' toast-icon"></i>' +
    '<div class="toast-message">' + message + '</div>';

  c.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);

  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, duration);
};

// ============ YOUTUBE HELPERS ============
window.extractYouTubeId = function (url) {
  if (!url || typeof url !== 'string') return null;

  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
    /youtu\.be\/([^&\n?#]+)/
  ];

  for (let p of patterns) {
    const m = url.match(p);
    if (m && m[1] && m[1].length === 11) return m[1];
  }
  return null;
};

// ============ COVERS / IMAGENS ============
window.getCoverUrl = function (track, isExternal) {
  if (!track) {
    return isExternal ? PLACEHOLDERS.EXT_300 : PLACEHOLDERS.MIV_300;
  }

  if (track.link_capa && track.link_capa.startsWith('http')) {
    return track.link_capa;
  }

  if (track.link_youtube) {
    const vid = extractYouTubeId(track.link_youtube);
    if (vid) {
      return 'https://img.youtube.com/vi/' + vid + '/hqdefault.jpg';
    }
  }

  return isExternal ? PLACEHOLDERS.EXT_300 : PLACEHOLDERS.MIV_300;
};

window.getCoverUrlSmall = function (track, isExternal) {
  return getCoverUrl(track, isExternal);
};

// ============ SANITIZAÇÃO (defensiva) ============
window.sanitizeText = function (str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
};

// ============ LOG DE CARREGAMENTO ============
console.log('✅ [utils.js] carregado');
