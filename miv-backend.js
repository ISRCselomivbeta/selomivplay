const API_URL = 'https://script.google.com/macros/s/AKfycbzn9j15octMOpBlqLyAN66NrzvGAtK8wys8TW_eeigck4V1eGv-nyKsNn9YNkEJxkk/exec';

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
