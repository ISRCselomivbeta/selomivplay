// ============================================================
// js/auth.js — PLAY MY v8.5.1
// Login, registro, logout, reset de senha, sessão.
// Depende de: config.js, utils.js, state.js, api.js
// DEVE carregar DEPOIS de api.js e ANTES de app.js.
//
// MUDANÇAS v8.5.1:
//   - 🔒 SEGURANÇA: restoreSession() apaga miv_user se tiver
//     'senha' ou 'senha_hash' (sessão antiga) e força login
// ============================================================

// ============ LOGIN ============
window.handleLogin = async function () {
  const email = document.getElementById('loginEmailField').value.trim();
  const password = document.getElementById('loginPasswordField').value.trim();
  const btn = document.getElementById('loginBtn');

  if (!email || !password) {
    showToast('Preencha todos os campos', 'error');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<i class="bi bi-arrow-clockwise spin"></i> Autenticando...';
  showLoading('Autenticando...');

  try {
    const r = await callAPI('login', { email, password });
    console.log('🔍 Login resposta:', r);

    if (r && r.success && r.data && r.data.id) {
      state.currentUser = r.data;
      state.userBalance = r.data.saldo || 0;
      state.seloCoinBalance = r.data.selo_coin || 0;
      state.favoriteMusicIds = Array.isArray(r.data.favorite_music_ids)
        ? r.data.favorite_music_ids
        : [];

      localStorage.setItem('miv_user', JSON.stringify(state.currentUser));
      showToast('Login realizado!', 'success');
      hideLoading();

      // initializeApp está em app.js — chamada via window para evitar dependência circular
      if (typeof window.initializeApp === 'function') {
        window.initializeApp();
      } else {
        console.warn('⚠️ initializeApp ainda não carregado');
      }
    } else {
      showToast((r && r.message) || 'Credenciais inválidas', 'error');
    }
  } catch (e) {
    console.error('Erro no login:', e);
    showToast('Erro ao conectar', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-box-arrow-in-right"></i> Entrar';
    hideLoading();
  }
};

// ============ REGISTRO ============
window.handleRegister = async function () {
  const name = document.getElementById('registerNameField').value.trim();
  const email = document.getElementById('registerEmailField').value.trim();
  const password = document.getElementById('registerPasswordField').value.trim();
  const type = document.getElementById('registerTypeField').value;
  const link = document.getElementById('registerLinkField').value.trim() || '';
  const accept = document.getElementById('acceptTermsField').checked;
  const btn = document.getElementById('registerBtn');

  // Validações
  if (!name || !email || !password || !type) {
    showToast('Preencha os campos', 'error');
    return;
  }
  if (password.length < 6) {
    showToast('Senha mínimo 6 caracteres', 'error');
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showToast('Email inválido', 'error');
    return;
  }
  if (!accept) {
    showToast('Aceite os Termos', 'error');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = 'Criando...';

  try {
    const r = await callAPI('register', {
      nome: name,
      email,
      senha: password,
      tipo: type,
      workLink: link,
      confirm_url: CONFIG.CONFIRM_EMAIL_URL
    });

    if (r && r.success) {
      showToast('Cadastro realizado! Verifique seu email.', 'success');
      showLoginForm();
    } else {
      showToast((r && r.message) || 'Erro', 'error');
    }
  } catch (e) {
    console.error('Erro no registro:', e);
    showToast('Erro', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-person-plus"></i> Solicitar Cadastro';
  }
};

// ============ LOGOUT ============
window.logout = function () {
  if (!confirm('Deseja sair?')) return;

  // Limpa estado
  state.currentUser = null;
  state.userBalance = 0;
  state.seloCoinBalance = 0;
  state.playlist = [];
  state.externalPlaylist = [];
  state.portfolioAssets = [];
  state.ledgerData = [];
  state.favoriteMusicIds = [];
  state.followingArtists = [];
  state.currentTrackIndex = -1;

  // Limpa storage
  localStorage.removeItem('miv_user');

  // Esconde app, mostra auth
  document.getElementById('mainApp').style.display = 'none';
  document.getElementById('authScreen').style.display = 'flex';
  document.getElementById('playerSpotify').style.display = 'none';

  // Para o player se estiver tocando
  if (state.youtubePlayer && state.youtubePlayer.stopVideo) {
    try { state.youtubePlayer.stopVideo(); } catch (e) {}
  }
  if (state.progressInterval) {
    clearInterval(state.progressInterval);
    state.progressInterval = null;
  }

  showToast('Logout realizado', 'success');
};

// ============ RESET DE SENHA ============
window.openResetPasswordModal = function () {
  const emailField = document.getElementById('loginEmailField');
  document.getElementById('resetEmailField').value = emailField ? emailField.value || '' : '';
  showModal('resetPasswordModal');
};

window.sendResetEmail = async function () {
  const email = document.getElementById('resetEmailField').value.trim();
  if (!email) {
    showToast('Digite seu email', 'error');
    return;
  }

  const btn = document.getElementById('sendResetBtn');
  btn.disabled = true;

  try {
    const r = await callAPI('request_password_reset', {
      email,
      reset_url: CONFIG.RESET_PASSWORD_URL
    });

    if (r && r.success) {
      showToast('Link enviado!', 'success');
      closeModal('resetPasswordModal');
    } else {
      showToast((r && r.message) || 'Erro', 'error');
    }
  } catch (e) {
    console.error('Erro no reset:', e);
    showToast('Erro', 'error');
  } finally {
    btn.disabled = false;
  }
};

// ============ ALTERNAR FORMULÁRIOS ============
window.showRegisterForm = function () {
  document.getElementById('loginForm').style.display = 'none';
  document.getElementById('registerForm').style.display = 'block';
};

window.showLoginForm = function () {
  document.getElementById('registerForm').style.display = 'none';
  document.getElementById('loginForm').style.display = 'block';
};

window.toggleArtistField = function () {
  const f = document.getElementById('artistLinkField');
  const typeField = document.getElementById('registerTypeField');
  if (f && typeField) {
    f.style.display = typeField.value === 'artista' ? 'block' : 'none';
  }
};

// ============ RESTAURAR SESSÃO (chamado por app.js) ============
window.restoreSession = function () {
  const stored = localStorage.getItem('miv_user');
  if (!stored) return false;

  try {
    const user = JSON.parse(stored);

    // 🔒 SEGURANÇA: sessão antiga com credenciais — apaga e força login
    if (user && (user.senha || user.senha_hash)) {
      console.warn('🔒 [auth] Sessão antiga com credenciais — removendo e forçando login');
      localStorage.removeItem('miv_user');
      return false;
    }

    state.currentUser = user;
    state.userBalance = user.saldo || 0;
    state.seloCoinBalance = user.selo_coin || 0;
    state.favoriteMusicIds = Array.isArray(user.favorite_music_ids)
      ? user.favorite_music_ids
      : [];
    console.log('✅ Sessão restaurada para:', user.email || user.nome);
    return true;
  } catch (e) {
    console.warn('⚠️ Sessão inválida, removendo:', e.message);
    localStorage.removeItem('miv_user');
    return false;
  }
};

// ============ LOG DE CARREGAMENTO ============
console.log('✅ [auth.js] v8.5.1 carregado — login, registro, logout prontos');
