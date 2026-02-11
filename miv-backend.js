const API_URL = 'https://script.google.com/macros/s/AKfycbzary8pXafHTVG4rZD8lBuvHUIqDrYBNH9jp9b47P3Kpuzw0cada3HcB8uBHuSrkk0/exec';

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
