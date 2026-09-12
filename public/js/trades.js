// ============================================================
// js/trades.js — PLAY MY v8.5.0
// Sistema de negociações (trades) entre usuários.
// Depende de: config.js, utils.js, state.js, api.js
// DEVE carregar DEPOIS de portfolio.js e ANTES de blockchain.js.
// ============================================================

// ============================================================
// ABRIR MODAL DE NOVA OFERTA
// ============================================================
window.openTradeModal = function (asset) {
  if (!state.currentUser) {
    showToast('Faça login', 'error');
    return;
  }

  state.currentTradeAsset = asset;

  const titleEl = document.getElementById('tradeMusicTitle');
  if (titleEl) titleEl.textContent = asset.music_title || 'Música';

  showModal('tradeModal');
};

// ============================================================
// CRIAR OFERTA
// ============================================================
window.createTradeOffer = async function () {
  const buyerEmail = document.getElementById('tradeBuyerEmail').value.trim();
  const quantity = parseInt(document.getElementById('tradeQuantity').value) || 1;
  const price = parseFloat(document.getElementById('tradePrice').value) || 0;
  const message = document.getElementById('tradeMessage').value.trim();

  if (!buyerEmail || !quantity || !price || !state.currentTradeAsset) {
    showToast('Preencha os campos', 'error');
    return;
  }

  const total = quantity * price;

  try {
    const r = await callAPI('create_trade', {
      seller_id: state.currentUser.id,
      buyer_email: buyerEmail,
      music_id: state.currentTradeAsset.music_id,
      quantity,
      price,
      total,
      message
    });

    if (r && r.success) {
      showToast('✅ Oferta enviada!', 'success');
      closeModal('tradeModal');
      await loadTradeOffers();
    } else {
      showToast((r && r.message) || 'Erro', 'error');
    }
  } catch (e) {
    console.error('Erro ao criar oferta:', e);
    showToast('Erro', 'error');
  }
};

// ============================================================
// CARREGAR OFERTAS
// ============================================================
window.loadTradeOffers = async function () {
  if (!state.currentUser) return;

  try {
    const r = await callAPI('get_trades');
    if (r && r.success && r.data) {
      state.tradesData = r.data;
      renderTrades();
    }
  } catch (e) {
    console.warn('⚠️ loadTradeOffers:', e.message);
  }
};

// ============================================================
// RENDERIZAR OFERTAS
// ============================================================
window.renderTrades = function () {
  const c = document.getElementById('tradesContainer');
  if (!c) return;

  const empty = document.getElementById('tradesEmpty');
  const { received, sent, history } = state.tradesData || { received: [], sent: [], history: [] };

  const total =
    (received || []).length +
    (sent || []).length +
    (history || []).length;

  if (empty) empty.style.display = total ? 'none' : 'block';

  let html = '';

  if (received && received.length) {
    html += '<h5 class="mt-3">📥 Recebidas</h5>' +
      received.map(t => renderTradeCard(t, 'received')).join('');
  }

  if (sent && sent.length) {
    html += '<h5 class="mt-3">📤 Enviadas</h5>' +
      sent.map(t => renderTradeCard(t, 'sent')).join('');
  }

  if (history && history.length) {
    html += '<h5 class="mt-3">📜 Histórico</h5>' +
      history.map(t => renderTradeCard(t, 'history')).join('');
  }

  c.innerHTML = html;
};

// ============================================================
// RENDERIZAR CARD INDIVIDUAL
// ============================================================
window.renderTradeCard = function (t, kind) {
  const statusClass =
    t.status === 'pending'  ? 'pending'  :
    t.status === 'accepted' ? 'accepted' :
    t.status === 'declined' ? 'declined' :
    '';

  let actions = '';

  if (kind === 'received' && t.status === 'pending') {
    actions =
      '<button class="btn btn-sm btn-success me-2" onclick="acceptTradeOffer(\'' + t.id + '\')">Aceitar</button>' +
      '<button class="btn btn-sm btn-danger" onclick="declineTradeOffer(\'' + t.id + '\')">Recusar</button>';
  } else if (kind === 'sent' && t.status === 'pending') {
    actions =
      '<button class="btn btn-sm btn-warning" onclick="cancelTradeOffer(\'' + t.id + '\')">Cancelar</button>';
  }

  return '<div class="trade-offer-card ' + statusClass + '">' +
    '<div class="d-flex justify-content-between">' +
      '<div>' +
        '<strong>' + (t.music_title || 'Música') + '</strong><br>' +
        '<small class="text-muted">' + (t.quantity || 0) + ' ações × ' + formatCurrency(t.price || 0) + '</small>' +
      '</div>' +
      '<div class="text-end">' +
        '<div>' + formatCurrency(t.total || 0) + '</div>' +
        '<small class="text-muted">' + (t.status || '') + '</small>' +
      '</div>' +
    '</div>' +
    (t.message
      ? '<div class="mt-2 text-muted"><small>💬 ' + t.message + '</small></div>'
      : '') +
    '<div class="mt-3">' + actions + '</div>' +
  '</div>';
};

// ============================================================
// ACEITAR OFERTA
// ============================================================
window.acceptTradeOffer = async function (id) {
  if (!confirm('Aceitar essa oferta?')) return;

  try {
    const r = await callAPI('accept_trade', { trade_id: id });

    if (r && r.success) {
      showToast('✅ Negociação concluída!', 'success');
      await loadTradeOffers();

      // Atualiza portfólio e saldo (funções de outros módulos)
      if (typeof loadPortfolio === 'function') await loadPortfolio();
      if (typeof updateBalanceDisplay === 'function') await updateBalanceDisplay();
    } else {
      showToast((r && r.message) || 'Erro', 'error');
    }
  } catch (e) {
    console.error('Erro ao aceitar oferta:', e);
    showToast('Erro', 'error');
  }
};

// ============================================================
// RECUSAR OFERTA
// ============================================================
window.declineTradeOffer = async function (id) {
  try {
    const r = await callAPI('decline_trade', { trade_id: id });

    if (r && r.success) {
      showToast('Recusada', 'info');
      await loadTradeOffers();
    } else {
      showToast((r && r.message) || 'Erro', 'error');
    }
  } catch (e) {
    console.error('Erro ao recusar oferta:', e);
    showToast('Erro', 'error');
  }
};

// ============================================================
// CANCELAR OFERTA
// ============================================================
window.cancelTradeOffer = async function (id) {
  try {
    const r = await callAPI('cancel_trade', { trade_id: id });

    if (r && r.success) {
      showToast('Cancelada', 'info');
      await loadTradeOffers();
    } else {
      showToast((r && r.message) || 'Erro', 'error');
    }
  } catch (e) {
    console.error('Erro ao cancelar oferta:', e);
    showToast('Erro', 'error');
  }
};

// ============================================================
// LOG DE CARREGAMENTO
// ============================================================
console.log('✅ [trades.js] carregado — sistema de negociações pronto');
