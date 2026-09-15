// ============================================================
// js/modals.js — PLAY MY v9.0.0
// Modais, saldo, saque, PWA, UI updates, ISRC.
// Depende de: config.js, utils.js, state.js, api.js
// DEVE carregar DEPOIS de news.js e ANTES de app.js.
//
// MUDANÇAS v9.0.0:
//   - Modal de cadastro de música com campo ISRC (obrigatório)
//   - Busca automática de ISRC (MusicBrainz)
//   - Validação em tempo real do formato do ISRC
//   - Mantém: saldo, saque, PWA, UI updates
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

document.addEventListener('click', function (e) {
  if (e.target && e.target.classList && e.target.classList.contains('modal-overlay')) {
    closeModal(e.target.id);
  }
});

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.show').forEach(m => {
      closeModal(m.id);
    });
  }
});

// ============================================================
// ATUALIZAR UI DO USUÁRIO
// ============================================================
window.updateUserInterface = function () {
  if (!state.currentUser) return;

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

  const a = document.getElementById('artistNavItem');
  if (a) {
    a.style.display =
      (state.currentUser.tipo === 'artista' || state.currentUser.tipo === 'admin')
        ? 'block' : 'none';
  }

  const ad = document.getElementById('adminNavItem');
  if (ad) {
    ad.style.display = state.currentUser.tipo === 'admin' ? 'block' : 'none';
  }

  updateBalanceDisplay();
};

// ============================================================
// ATUALIZAR SALDO
// ============================================================
window.updateBalanceDisplay = async function () {
  const el = document.getElementById('currentBalance');
  const seloEl = document.getElementById('seloCoinBalance');

  if (!state.currentUser || !state.currentUser.id) {
    if (el) el.textContent = formatCurrency(0);
    if (seloEl) seloEl.textContent = '0';
    return;
  }

  try {
    const r = await callAPI('get_saldo');
    if (r && r.success && r.data) {
      state.userBalance = r.data.saldo_disponivel || 0;
      state.seloCoinBalance = r.data.selo_coin || 0;
    }
  } catch (e) {}

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
// 🆕 ISRC — VALIDAÇÃO EM TEMPO REAL
// ============================================================
window.validarIsrcInput = function () {
  const input = document.getElementById('musicIsrcField');
  const feedback = document.getElementById('musicIsrcFeedback');
  if (!input || !feedback) return;

  const valor = input.value.trim();
  if (!valor) {
    feedback.innerHTML = '';
    return;
  }

  const limpo = valor.replace(/[-\s]/g, '').toUpperCase();

  // Validação do formato
  const regex = /^[A-Z]{2}[A-Z0-9]{3}[0-9]{2}[0-9]{5}$/;

  if (limpo.length === 12 && regex.test(limpo)) {
    feedback.innerHTML = '<span style="color:var(--apple-green)">✅ ISRC válido</span>';

    // Formata visualmente com hífens
    const formatado = `${limpo.slice(0, 2)}-${limpo.slice(2, 5)}-${limpo.slice(5, 7)}-${limpo.slice(7)}`;
    if (valor !== formatado) input.value = formatado;
  } else if (limpo.length < 12) {
    feedback.innerHTML = '<span style="color:var(--apple-yellow)">⚠️ ' + (12 - limpo.length) + ' caracteres restantes</span>';
  } else {
    feedback.innerHTML = '<span style="color:var(--apple-red)">❌ Formato inválido</span>';
  }
};

// ============================================================
// 🆕 BUSCAR ISRC AUTOMATICAMENTE (via backend)
// ============================================================
window.buscarIsrcAutomatico = async function () {
  const tituloEl = document.getElementById('musicTitleField');
  const artistaEl = document.getElementById('musicArtistField');
  const ytEl = document.getElementById('musicYoutubeField');
  const btn = document.getElementById('btnBuscarIsrc');
  const resultados = document.getElementById('isrcResultados');

  if (!resultados) return;

  const titulo = tituloEl ? tituloEl.value.trim() : '';
  const artista = artistaEl ? artistaEl.value.trim() : '';
  const linkYt = ytEl ? ytEl.value.trim() : '';

  if (!titulo && !linkYt) {
    showToast('Informe o título ou o link do YouTube primeiro', 'warning');
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Buscando...';
  }

  resultados.style.display = 'block';
  resultados.innerHTML = '<div class="text-center p-3 text-muted">' +
    '<div class="spinner-border spinner-border-sm"></div> Consultando MusicBrainz...' +
  '</div>';

  try {
    const r = await callAPI('buscar_isrc', {
      titulo: titulo,
      artista: artista,
      link_youtube: linkYt
    });

    if (!r || !r.success || !r.isrcs || !r.isrcs.length) {
      resultados.innerHTML =
        '<div style="padding:12px;background:rgba(255,204,0,0.1);border-radius:8px;color:#c7c7cc;font-size:13px">' +
          '⚠️ Nenhum ISRC encontrado automaticamente.<br><br>' +
          'Você pode obter o ISRC:<br>' +
          '• Na UBC/Abramus (se for associado)<br>' +
          '• Na sua distribuidora (ROC Nation, OneRPM, etc.)<br>' +
          '• No SISRC (gratuito)<br><br>' +
          'Ou digite manualmente no campo acima.' +
        '</div>';
      return;
    }

    let html = '<div style="font-size:12px;color:var(--apple-label-2);margin-bottom:8px">' +
      r.total + ' ISRC(s) encontrado(s). Clique para usar:</div>';

    r.isrcs.forEach(function (item) {
      html +=
        '<div onclick="escolherIsrc(\'' + item.isrc + '\')" ' +
          'style="padding:10px;background:var(--apple-gray-6);border-radius:8px;' +
          'margin-bottom:6px;cursor:pointer;transition:background 0.2s" ' +
          'onmouseover="this.style.background=\'var(--apple-gray-5)\'" ' +
          'onmouseout="this.style.background=\'var(--apple-gray-6)\'">' +
          '<div style="color:var(--apple-yellow);font-weight:700;font-size:14px">' + item.isrc_formatado + '</div>' +
          '<div style="color:#fff;font-size:13px">' + (item.titulo || '—') + '</div>' +
          '<div style="color:var(--apple-label-2);font-size:11px">' +
            (item.artista || '—') + ' • fonte: ' + item.fonte +
            ' • score: ' + (item.score || 0) +
          '</div>' +
        '</div>';
    });

    resultados.innerHTML = html;

  } catch (e) {
    console.error('Erro buscar ISRC:', e);
    resultados.innerHTML = '<div class="text-danger p-3">Erro ao buscar ISRC</div>';
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-search"></i> Buscar';
    }
  }
};

// ============================================================
// 🆕 ESCOLHER ISRC DA LISTA
// ============================================================
window.escolherIsrc = function (isrc) {
  const input = document.getElementById('musicIsrcField');
  const resultados = document.getElementById('isrcResultados');

  if (input) {
    input.value = isrc;
    validarIsrcInput();
  }

  if (resultados) resultados.style.display = 'none';

  showToast('✅ ISRC selecionado: ' + isrc, 'success');
};

// ============================================================
// PWA — INSTALAÇÃO
// ============================================================
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
// MODO OFFLINE / ONLINE
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
console.log('✅ [modals.js] v9.0.0 carregado — modais, saldo, saque, PWA, ISRC');
