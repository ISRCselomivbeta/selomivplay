const API_URL = 'https://script.google.com/macros/s/AKfycbzF31lrSN6b2V6AT38VU2qzsRhOO8yiXIkdhknMqm6GVD5v4UgTmwDceKT5MqMe8nA/exec';

function iniciarApp() {
  console.log('App iniciado com sucesso');
  document.body.classList.remove('loading');
}

// BOOT SEGURO
window.addEventListener('load', async () => {
  try {
    const res = await fetch(API_URL);
    const data = await res.json();

    if (data.status === 'online') {
      iniciarApp();
    } else {
      console.warn('API respondeu diferente:', data);
      iniciarApp(); // libera mesmo assim
    }
  } catch (e) {
    console.error('Erro ao conectar API:', e);
    iniciarApp(); // NUNCA trava o site
  }
});
