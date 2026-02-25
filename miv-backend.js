const API_URL = 'https://script.google.com/macros/s/AKfycbwgjor-tLLzVrnJGNHOifL1O2sRBhysKJ3IbVJy_AHgtNqjk-6hazH8xuO6OaDXF_s/exec';

function iniciarApp() {
  document.body.classList.remove('loading');
  console.log('✅ SELO MIV carregado');
}

// Remove loading após 1 segundo, independente da API
window.addEventListener('load', () => {
  setTimeout(iniciarApp, 1000);
});
