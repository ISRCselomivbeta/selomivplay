// ============================================================
// js/config.js — PLAY MY v8.5.0
// Configurações globais. NÃO depende de nenhum outro módulo.
// DEVE ser o primeiro script a carregar.
// ============================================================

// ============ CONFIGURAÇÕES PRINCIPAIS ============
window.CONFIG = {
  VERCEL_URL: 'https://selomivplay-seyv.vercel.app/api/backend',
  GAS_URL: 'https://script.google.com/macros/s/AKfycbwgjor-tLLzVrnJGNHOifL1O2sRBhysKJ3IbVJy_AHgtNqjk-6hazH8xuO6OaDXF_s/exec',
  VERSION: '8.5.0',
  MERCADO_PAGO_LINK: 'https://link.mercadopago.com.br/selomiv',
  RESET_PASSWORD_URL: 'https://playmy.com.br/reset-password.html',
  CONFIRM_EMAIL_URL: 'https://playmy.com.br/confirm-email.html'
  // ⚠️ ATENÇÃO: YOUTUBE_API_KEY foi REMOVIDA do frontend por segurança.
  // Todas as chamadas ao YouTube devem passar pelo backend (/api/backend?action=search_youtube)
};

// ============ ALIASES (compatibilidade com código legado) ============
window.GAS_URL = window.CONFIG.GAS_URL;
window.API_URL = window.CONFIG.VERCEL_URL;

// ============ PLACEHOLDERS (imagens SVG em data-URI) ============
window.PLACEHOLDERS = {
  MIV_56: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56"><rect width="56" height="56" fill="%231c1c1e"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="14" fill="%2334c759">PM</text></svg>',

  MIV_300: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="%231c1c1e"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="50" fill="%2334c759">PLAY</text><text x="50%" y="65%" text-anchor="middle" dy=".3em" font-size="40" fill="%2334c759">MY</text></svg>',

  EXT_56: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56"><rect width="56" height="56" fill="%231c1c1e"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="14" fill="%23ff9500">EXT</text></svg>',

  EXT_300: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="%231c1c1e"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="50" fill="%23ff9500">EXT</text></svg>',

  ARTIST: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="90" height="90"><circle cx="45" cy="45" r="45" fill="%231c1c1e"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="40" fill="%2334c759">A</text></svg>'
};

// ============ LOG DE CARREGAMENTO ============
console.log('✅ [config.js] carregado — v' + window.CONFIG.VERSION);
