/*********************************
 * CONFIGURAÇÃO
 *********************************/
const MIV_API_URL = 'https://script.google.com/macros/s/AKfycbzF31lrSN6b2V6AT38VU2qzsRhOO8yiXIkdhknMqm6GVD5v4UgTmwDceKT5MqMe8nA/exec';

/*********************************
 * ESTADO GLOBAL
 *********************************/
let MIV_TOKEN = localStorage.getItem('miv_token') || null;

/*********************************
 * UTIL
 *********************************/
async function mivPost(action, payload = {}) {
  const res = await fetch(MIV_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action,
      token: MIV_TOKEN,
      ...payload
    })
  });
  return res.json();
}

/*********************************
 * AUTH
 *********************************/
async function mivRegister(nome, email, senha) {
  const r = await mivPost('register', { nome, email, senha });
  return r.success;
}

async function mivLogin(email, senha) {
  const r = await mivPost('login', { email, senha });
  if (r.token) {
    MIV_TOKEN = r.token;
    localStorage.setItem('miv_token', r.token);
    return true;
  }
  return false;
}

function mivLogout() {
  localStorage.removeItem('miv_token');
  MIV_TOKEN = null;
  location.reload();
}

/*********************************
 * PLAYER – CONTABILIZA PLAY ≥30s
 *********************************/
let playTimer = null;
let playSeconds = 0;
let currentTrackId = null;

function mivStartPlay(trackId) {
  currentTrackId = trackId;
  playSeconds = 0;

  clearInterval(playTimer);
  playTimer = setInterval(() => {
    playSeconds++;

    if (playSeconds === 30) {
      mivPost('play', {
        track_id: currentTrackId,
        segundos: playSeconds
      });
    }
  }, 1000);
}

function mivStopPlay() {
  clearInterval(playTimer);
  playTimer = null;
  playSeconds = 0;
}

/*********************************
 * SALDO / TRANSAÇÃO
 *********************************/
async function mivRegistrarPagamento(valor, status = 'approved') {
  return await mivPost('transacao', {
    valor,
    status,
    origem: 'mercado_pago'
  });
}

/*********************************
 * INTEGRAÇÃO COM SEU INDEX
 *********************************
 * Chame essas funções nos pontos
 * onde hoje existe simulação
 *********************************/

// EXEMPLO:
// ao dar play real:
// mivStartPlay('track_123');

// ao pausar:
// mivStopPlay();

// ao confirmar pagamento:
// mivRegistrarPagamento(100);

// ao logar:
// await mivLogin(email, senha);
