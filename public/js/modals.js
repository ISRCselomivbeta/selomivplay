// ============================================================
// js/modals.js — PLAY MY v8.5.0
// Modais, saldo, saque, PWA, UI updates.
// Depende de: config.js, utils.js, state.js, api.js
// DEVE carregar DEPOIS de news.js e ANTES de app.js.
// ============================================================

// ============================================================
// MODAIS GENÉRICOS (abrir/fechar)
// ============================================================
window.showModal = function (id) {
  const m = document.getElementById(id);
  if (m) {
    m.classList.add('show');
    document.body.style.overflow = 'hidden';
  }
};

window.closeModal = function (id) {
  const m = document.getElementById(id);
  if (m) {
    m.classList.remove('show');
    document.body.style.overflow = 'auto';
  }
};

// Fechar modal ao clicar no overlay (fora do conteúdo)
document.addEventListener('click', function (e) {
  if (e.target && e.target.classList && e.target.classList.contains('modal-overlay')) {
    closeModal(e.target.id);
  }
});

// Fechar modal com ESC
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.show').forEach(m => {
      closeModal(m.id);
    });
  }
});

// ============================================================
// ATUALIZAR UI DO USUÁRIO (badge, nav, saldo)
// ============================================================
window.updateUserInterface = function () {
  if (!state.currentUser) return;

  // Badge do usuário (Ouvinte / Artista / Admin)
  const b = document.getElementById('userBadge');
  if (b) {
    b.textContent =
      state.currentUser.tipo === 'admin'   ? 'Admin'   :
      state.currentUser.tipo === 'artista' ? 'Artista' :
      'Ouvinte';

    b.style.background =
      state.currentUser.tipo === 'admin'   ? 'var(--apple-purple)' :
      state.currentUser.tipo === 'artista' ? 'var(--apple-blue)'   :
      'var(--apple-green)';
  }

  // Item do menu do artista
  const a = document.getElementById('artistNavItem');
  if (a) {
    a.style.display =
      (state.currentUser.tipo === 'artista' || state.currentUser.tipo === 'admin')
        ? 'block'
        : 'none';
  }

  // Item do menu do admin
  const ad = document.getElementById('adminNavItem');
  if (ad) {
    ad.style.display = state.currentUser.tipo === 'admin' ? 'block' : 'none';
  }

  // Atualiza saldo
  updateBalanceDisplay();
};

// ============================================================
// ATUALIZAR SALDO (carteira + selo coin)
// ============================================================
window.updateBalanceDisplay = async function () {
  const el = document.getElementById('currentBalance');
  const seloEl = document.getElementById('seloCoinBalance');

  // Sem usuário logado: mostra zero
  if (!state.currentUser || !state.currentUser.id) {
    if (el) el.textContent = formatCurrency(0);
    if (seloEl) seloEl.textContent = '0';
    return;
  }

  // Busca do backend
  try {
    const r = await callAPI('get_saldo');
    if (r && r.success && r.data) {
      state.userBalance = r.data.saldo_disponivel || 0;
      state.seloCoinBalance = r.data.selo_coin || 0;
    }
  } catch (e) {
    // silencioso — usa valores em cache
  }

  // Atualiza UI
  if (el) el.textContent = formatCurrency(state.userBalance);
  if (seloEl) seloEl.textContent = new Intl.NumberFormat('pt-BR').format(state.seloCoinBalance);
};

// ============================================================
// ADICIONAR SALDO
// ============================================================
window.openAddBalanceModal = function () {
  const f = document.getElementById('balanceAmountField');
  if (f) f.value = 100;
  showModal('addBalanceModal');
};

window.setBalanceAmount = function (v) {
  const f = document.getElementById('balanceAmountField');
  if (f) f.value = v;
};

window.processBalanceAdd = function () {
  const f = document.getElementById('balanceAmountField');
  const a = parseFloat(f ? f.value : 0) || 0;

  if (a < 10) {
    showToast('Mínimo R$ 10', 'error');
    return;
  }

  // Abre Mercado Pago em nova aba
  window.open(CONFIG.MERCADO_PAGO_LINK, '_blank');
  closeModal('addBalanceModal');
  showToast('Finalize o pagamento. Saldo será creditado após confirmação.', 'info', 6000);
};

// ============================================================
// SOLICITAR SAQUE
// ============================================================
window.openWithdrawalModal = function () {
  if (state.userBalance < 50) {
    showToast('Saldo mínimo R$ 50', 'warning');
    return;
  }

  const f = document.getElementById('withdrawalAmountField');
  if (f) f.value = state.userBalance;

  showModal('withdrawalModal');
};

window.requestWithdrawal = async function () {
  const amount = parseFloat(document.getElementById('withdrawalAmountField').value) || 0;
  const method = document.getElementById('withdrawalMethodField').value;
  const details = document.getElementById('bankDetailsField').value.trim();

  if (amount < 50 || amount > state.userBalance || !method || !details) {
    showToast('Verifique os campos', 'error');
    return;
  }

  const btn = document.getElementById('requestWithdrawalBtn');
  if (btn) btn.disabled = true;

  try {
    const r = await callAPI('request_withdrawal', {
      valor: amount,
      metodo: method,
      dados_bancarios: details
    });

    if (r && r.success) {
      state.userBalance -= amount;
      updateBalanceDisplay();

      // Recarrega extrato se disponível
      if (typeof loadLedger === 'function') await loadLedger();

      closeModal('withdrawalModal');
      showToast('✅ Saque solicitado!', 'success');
    } else {
      showToast((r && r.message) || 'Erro', 'error');
    }
  } catch (e) {
    console.error('Erro no saque:', e);
    showToast('Erro', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
};

// ============================================================
// PWA — INSTALAÇÃO
// ============================================================
// Evento disparado pelo navegador quando o app pode ser instalado
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  state.deferredInstallPrompt = e;

  const btn = document.getElementById('installAppBtn');
  if (btn) btn.style.display = 'inline-flex';

  console.log('📱 PWA pronto para instalação');
});

window.installApp = function () {
  if (state.deferredInstallPrompt) {
    state.deferredInstallPrompt.prompt();

    state.deferredInstallPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        showToast('✅ App instalado!', 'success');
      }
      state.deferredInstallPrompt = null;

      const btn = document.getElementById('installAppBtn');
      if (btn) btn.style.display = 'none';
    });
  } else {
    showToast('Use o menu do navegador para instalar o app', 'info', 5000);
  }
};

// ============================================================
// MODO OFFLINE / ONLINE (badge)
// ============================================================
window.addEventListener('online', () => {
  const b = document.getElementById('offlineBadge');
  if (b) b.style.display = 'none';
  showToast('📶 Online', 'success');
});

window.addEventListener('offline', () => {
  const b = document.getElementById('offlineBadge');
  if (b) b.style.display = 'block';
  showToast('📴 Offline', 'warning');
});

// ============================================================
// LOG DE CARREGAMENTO
// ============================================================
console.log('✅ [modals.js] carregado — modais, saldo, saque, PWA prontos');
