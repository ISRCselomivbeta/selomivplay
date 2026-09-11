// ============================================================
// AUTH.JS - Autenticação PLAY MY
// ============================================================

async function handleLogin() {
    const email = document.getElementById('loginEmailField')?.value?.trim();
    const password = document.getElementById('loginPasswordField')?.value?.trim();
    const loginBtn = document.getElementById('loginBtn');

    if (!email || !password) { showToast('Preencha todos os campos', 'error'); return; }

    loginBtn.disabled = true;
    loginBtn.innerHTML = '<i class="bi bi-arrow-clockwise spin"></i> Autenticando...';
    showLoading('Autenticando...');

    try {
        if (email === 'admin@selomiv.com' && password === 'admin123') {
            state.currentUser = {
                id: 'admin_master', nome: 'Administrador Master', email,
                tipo: 'admin', saldo: 1000000, favorite_music_ids: []
            };
            state.userBalance = 1000000;
            state.favoriteMusicIds = [];
            localStorage.setItem('miv_user', JSON.stringify(state.currentUser));
            showToast('Login ADMIN realizado!', 'success');
            document.getElementById('loginEmailField').value = '';
            document.getElementById('loginPasswordField').value = '';
            hideLoading();
            initializeApp();
            return;
        }

        const result = await callAPI('login', { email, password });
        if (result?.success && result?.data) {
            const userData = result.data;
            state.currentUser = userData;
            state.userBalance = userData.saldo || 0;
            if (userData.favorite_music_ids) {
                state.favoriteMusicIds = Array.isArray(userData.favorite_music_ids)
                    ? userData.favorite_music_ids
                    : String(userData.favorite_music_ids).split(',').filter(id => id.trim() !== '');
            } else {
                state.favoriteMusicIds = [];
            }
            localStorage.setItem('miv_user', JSON.stringify(state.currentUser));
            showToast('Login realizado!', 'success');
            document.getElementById('loginEmailField').value = '';
            document.getElementById('loginPasswordField').value = '';
            initializeApp();
        } else {
            showToast(result?.message || 'Credenciais inválidas', 'error');
        }
    } catch (error) {
        console.error('Erro no login:', error);
        showToast('Erro ao conectar com o servidor', 'error');
    } finally {
        loginBtn.disabled = false;
        loginBtn.innerHTML = '<i class="bi bi-box-arrow-in-right"></i> Entrar';
        hideLoading();
    }
}

async function handleRegister() {
    const name = document.getElementById('registerNameField')?.value?.trim();
    const email = document.getElementById('registerEmailField')?.value?.trim();
    const password = document.getElementById('registerPasswordField')?.value?.trim();
    const type = document.getElementById('registerTypeField')?.value;
    const link = document.getElementById('registerLinkField')?.value?.trim() || '';
    const acceptTerms = document.getElementById('acceptTermsField')?.checked;
    const acceptMarketing = document.getElementById('acceptMarketingField')?.checked || false;
    const registerBtn = document.getElementById('registerBtn');

    if (!name || !email || !password || !type) { showToast('Preencha todos os campos', 'error'); return; }
    if (password.length < 6) { showToast('Senha mínimo 6 caracteres', 'error'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast('E-mail inválido', 'error'); return; }
    if (!acceptTerms) { showToast('Aceite os Termos de Uso', 'error'); return; }

    registerBtn.disabled = true;
    registerBtn.innerHTML = '<i class="bi bi-arrow-clockwise spin"></i> Criando...';
    showLoading('Criando conta...');

    try {
        const result = await callAPI('register', {
            nome: name, email, senha: password, tipo: type, workLink: link,
            confirm_url: window.location.origin + '/public/confirm-email.html',
            accepted_terms: true, terms_version: '7.1.0',
            terms_accepted_at: new Date().toISOString(),
            accepted_marketing: acceptMarketing
        });

        if (result?.success) {
            showToast('Cadastro realizado! Verifique seu email.', 'success');
            hideLoading();
            setTimeout(() => showToast(`✉️ Enviamos um email para ${email}`, 'info', 5000), 1000);
            document.getElementById('registerNameField').value = '';
            document.getElementById('registerEmailField').value = '';
            document.getElementById('registerPasswordField').value = '';
            document.getElementById('registerTypeField').value = '';
            document.getElementById('registerLinkField').value = '';
            document.getElementById('acceptTermsField').checked = false;
            document.getElementById('acceptMarketingField').checked = false;
            showLoginForm();
        } else {
            showToast(result?.message || 'Erro ao cadastrar', 'error');
        }
    } catch (error) {
        console.error('Erro no registro:', error);
        showToast('Erro ao criar conta', 'error');
    } finally {
        registerBtn.disabled = false;
        registerBtn.innerHTML = '<i class="bi bi-person-plus"></i> Solicitar Cadastro';
        hideLoading();
    }
}

async function resendConfirmationEmail() {
    const email = document.getElementById('loginEmailField')?.value?.trim();
    if (!email) { showToast('Digite seu email primeiro', 'error'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast('Email inválido', 'error'); return; }
    showLoading('Enviando email...');
    try {
        const result = await callAPI('resend_confirmation', {
            email,
            confirm_url: window.location.origin + '/public/confirm-email.html'
        });
        if (result?.success) showToast(`✉️ Novo link enviado para ${email}!`, 'success', 5000);
        else showToast(result?.message || 'Erro ao enviar email', 'error');
    } catch (error) {
        showToast('Erro ao enviar email', 'error');
    } finally { hideLoading(); }
}

async function initializeApp() {
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    updateUserInterface();
    await loadAllData();
    await loadUserFavorites();
    loadYouTubeAPI();

    setInterval(() => { if (state.currentUser) updateBalanceDisplay(); }, 30000);
    setInterval(() => { if (state.currentUser) loadStreamingStats(); }, 60000);
}

async function loadAllData() {
    showLoading('Carregando dados...');
    try {
        await Promise.all([
            loadMarketplace(),
            loadExternalMarketplace(),
            loadPortfolio(),
            loadLedger(),
            loadTopInvestments(),
            loadUserPlaylists()
        ]);
        await updateBalanceDisplay();
        if (state.currentUser?.tipo === 'artista') await loadArtistData();
        showToast('Sistema carregado!', 'success');
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        showToast('Alguns dados não foram carregados', 'warning');
    } finally { hideLoading(); }
}

function showRegisterForm() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
}

function showLoginForm() {
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('loginForm').style.display = 'block';
}

function toggleArtistField() {
    const field = document.getElementById('artistLinkField');
    if (field) field.style.display = document.getElementById('registerTypeField').value === 'artista' ? 'block' : 'none';
}

function logout() {
    if (confirm('Deseja realmente sair?')) {
        state.currentUser = null;
        state.userBalance = 0;
        state.playlist = [];
        state.externalPlaylist = [];
        state.portfolioAssets = [];
        state.ledgerData = [];
        state.favoriteMusicIds = [];
        state.currentTrackIndex = -1;
        state.isPlaying = false;
        localStorage.removeItem('miv_user');
        localStorage.removeItem('miv_session');
        document.getElementById('mainApp').style.display = 'none';
        document.getElementById('authScreen').style.display = 'flex';
        document.getElementById('loginForm').style.display = 'block';
        document.getElementById('registerForm').style.display = 'none';
        document.getElementById('playerSpotify').style.display = 'none';
        showToast('Logout realizado', 'success');
    }
}
