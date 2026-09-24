// ============================================================
// js/config.js — PLAY MY v9.8.1
// Configurações globais. NÃO depende de nenhum outro módulo.
// DEVE ser o primeiro script a carregar.
//
// MUDANÇAS v9.8.1:
//   - VERSION bumpada para bater com app.js v9.8.1
//
// MUDANÇAS v8.6.0:
//   - FIX: Placeholders SVG com aspas simples (não quebram mais
//     o atributo onerror das <img>)
//   - FIX: Placeholders com URL encoding para segurança
//   - Mantém VERCEL_URL relativo (mesma origem)
// ============================================================

// ============ CONFIGURAÇÕES PRINCIPAIS ============
window.CONFIG = {
  // 🆕 URL RELATIVA — usa o domínio atual do usuário
  // Funciona em playmy.com.br, vercel.app, preview, etc
  VERCEL_URL: '/api/backend',

  GAS_URL: 'https://script.google.com/macros/s/AKfycbwgjor-tLLzVrnJGNHOifL1O2sRBhysKJ3IbVJy_AHgtNqjk-6hazH8xuO6OaDXF_s/exec',

  VERSION: '9.8.1',

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
// 🆕 CORREÇÃO CRÍTICA: SVGs usam ASPAS SIMPLES internas
//    para NÃO conflitar com as aspas duplas do atributo onerror=""
//    Exemplo do problema:
//      ❌ PLACEHOLDER = '<svg xmlns="http://...">'  ← aspas duplas quebram
//      ✅ PLACEHOLDER = "<svg xmlns='http://...'>"   ← aspas simples OK
//
// 🆕 URL ENCODING: caracteres especiais (#, <, >, ") são codificados
//    para máxima compatibilidade entre browsers
// ============================================================
window.PLACEHOLDERS = {
  // ---- MÚSICA INTERNA (PLAY MY) - 56x56 ----
  MIV_56: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='56' height='56'>" +
      "<rect width='56' height='56' fill='#1c1c1e'/>" +
      "<text x='50%' y='50%' text-anchor='middle' dy='.3em' " +
            "font-size='14' font-family='-apple-system,sans-serif' " +
            "font-weight='700' fill='#34c759'>PM</text>" +
    "</svg>"
  ),

  // ---- MÚSICA INTERNA (PLAY MY) - 300x300 ----
  MIV_300: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'>" +
      "<rect width='300' height='300' fill='#1c1c1e'/>" +
      "<text x='50%' y='45%' text-anchor='middle' dy='.3em' " +
            "font-size='50' font-family='-apple-system,sans-serif' " +
            "font-weight='700' fill='#34c759'>PLAY</text>" +
      "<text x='50%' y='65%' text-anchor='middle' dy='.3em' " +
            "font-size='40' font-family='-apple-system,sans-serif' " +
            "font-weight='700' fill='#34c759'>MY</text>" +
    "</svg>"
  ),

  // ---- MÚSICA EXTERNA - 56x56 ----
  EXT_56: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='56' height='56'>" +
      "<rect width='56' height='56' fill='#1c1c1e'/>" +
      "<text x='50%' y='50%' text-anchor='middle' dy='.3em' " +
            "font-size='14' font-family='-apple-system,sans-serif' " +
            "font-weight='700' fill='#ff9500'>EXT</text>" +
    "</svg>"
  ),

  // ---- MÚSICA EXTERNA - 300x300 ----
  EXT_300: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'>" +
      "<rect width='300' height='300' fill='#1c1c1e'/>" +
      "<text x='50%' y='50%' text-anchor='middle' dy='.3em' " +
            "font-size='50' font-family='-apple-system,sans-serif' " +
            "font-weight='700' fill='#ff9500'>EXT</text>" +
    "</svg>"
  ),

  // ---- ARTISTA (avatar circular) - 90x90 ----
  ARTIST: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='90' height='90'>" +
      "<circle cx='45' cy='45' r='45' fill='#1c1c1e'/>" +
      "<text x='50%' y='50%' text-anchor='middle' dy='.3em' " +
            "font-size='40' font-family='-apple-system,sans-serif' " +
            "font-weight='700' fill='#34c759'>A</text>" +
    "</svg>"
  )
};

// ============ LOG DE CARREGAMENTO ============
console.log('✅ [config.js] carregado — v' + window.CONFIG.VERSION);
console.log('🔗 VERCEL_URL:', window.CONFIG.VERCEL_URL);
