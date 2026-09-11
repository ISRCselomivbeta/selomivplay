// ============================================================
// TRADES - PLAY MY v8.2 (Negociações)
// ============================================================

let currentTradeAsset = null;
let tradeOffers = { received: [], sent: [], history: [] };

function openTradeModal(asset) {
  if (!state.currentUser) return;
  currentTradeAsset = asset;
  document.getElementById('tradeMusicTitle').textContent = asset.music_title || 'Música';
  showModal('tradeModal');
}

async function searchUserByEmail() {}

async function createTradeOffer() {
  showToast('Enviado!', 'success');
  closeModal('tradeModal');
}

async function loadTradeOffers() {
  const empty = document.getElementById('tradesEmpty');
  if (empty) empty.style.display = 'block';
}

async function acceptTradeOffer(id) { showToast('Aceita!', 'success'); }
async function declineTradeOffer(id) { showToast('Recusada', 'info'); }
async function cancelTradeOffer(id) { showToast('Cancelada', 'info'); }

function adjustTradeQuantity(delta) {
  const input = document.getElementById('tradeQuantity');
  if (!input) return;
  const max = currentTradeAsset ? (currentTradeAsset.quantidade || 0) : 999;
  const next = Math.max(1, Math.min(max, (parseInt(input.value) || 1) + delta));
  input.value = next;
  updateTradeCalculation();
}

function updateTradeCalculation() {
  const q = parseInt((document.getElementById('tradeQuantity') || {}).value) || 1;
  const p = parseFloat((document.getElementById('tradePrice') || {}).value) || 0;
  const el = document.getElementById('tradeTotalDisplay');
  if (el) el.textContent = formatCurrency(q * p);
}

window.openTradeModal = openTradeModal;
window.searchUserByEmail = searchUserByEmail;
window.createTradeOffer = createTradeOffer;
window.loadTradeOffers = loadTradeOffers;
window.acceptTradeOffer = acceptTradeOffer;
window.declineTradeOffer = declineTradeOffer;
window.cancelTradeOffer = cancelTradeOffer;
window.adjustTradeQuantity = adjustTradeQuantity;
window.updateTradeCalculation = updateTradeCalculation;
