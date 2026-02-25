const API_URL = 'https://script.google.com/macros/s/AKfycbwgjor-tLLzVrnJGNHOifL1O2sRBhysKJ3IbVJy_AHgtNqjk-6hazH8xuO6OaDXF_s/exec';

function iniciarApp() {
  console.log('✅ App iniciado com sucesso');
  document.body.classList.remove('loading');
}

// BOOT SEGURO COM JSONP (para compatibilidade com Google Apps Script)
window.addEventListener('load', async () => {
  try {
    // Usa JSONP em vez de fetch para compatibilidade
    const checkAPI = () => {
      return new Promise((resolve) => {
        const callbackName = 'jsonp_status_' + Date.now();
        window[callbackName] = function(response) {
          delete window[callbackName];
          document.head.removeChild(script);
          resolve(response);
        };

        const script = document.createElement('script');
        script.src = API_URL + '?callback=' + encodeURIComponent(callbackName) + '&action=status&_=' + Date.now();
        
        script.onerror = () => {
          delete window[callbackName];
          document.head.removeChild(script);
          resolve({ status: 'offline' });
        };

        document.head.appendChild(script);

        setTimeout(() => {
          if (window[callbackName]) {
            delete window[callbackName];
            document.head.removeChild(script);
            resolve({ status: 'offline' });
          }
        }, 5000);
      });
    };

    const data = await checkAPI();
    
    if (data && data.status === 'online') {
      console.log('✅ API está online');
    } else {
      console.warn('⚠️ API não respondeu, continuando mesmo assim');
    }
    
    iniciarApp();
    
  } catch (e) {
    console.error('❌ Erro na inicialização:', e);
    iniciarApp(); // NUNCA trava o site
  }
});
