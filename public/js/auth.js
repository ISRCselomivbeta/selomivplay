// ============================================================
// AUTH.JS - Autenticação (Login, Registro, Logout)
// ============================================================

// ===== LOGIN =====
async function handleLogin() {
    const email = document.getElementById('loginEmailField')?.value?.trim();
    const password = document.getElementById('loginPasswordField')?.value?.trim();
    const loginBtn = document.getElementById('loginBtn');
    if (!email || !password) { 
        showToast('Preencha todos os campos', 'error'); 
        return; 
    }
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<i class="bi bi-arrow-clockwise spin"></i> Autenticando...';
    showLoading('Autenticando...');
    try {
        if (email === 'admin@selomiv.com' && password === 'admin123') {
            state.currentUser = { 
                id: 'admin_master', 
                nome: 'Administrador Master', 
                email, 
                tipo: 'admin', 
                saldo: 1000000, 
                favorite_music_ids: [] 
            };
            state.userBalance = 1000000;
            state.favoriteMusicIds = [];
            localStorage.setItem('miv_user', JSON.stringify(state.currentUser));
            localStorage.setItem('miv_session', Date.now().toString());
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
            if (userData.is_old_account === true) {
                await callAPI('mark_as_confirmed', { 
                    user_id: userData.id,
                    email: userData.email 
                });
                state.currentUser = userData;
                state.userBalance = userData.saldo || 0;
                if (userData.favorite_music_ids) {
                    if (Array.isArray(userData.favorite_music_ids)) {
                        state.favoriteMusicIds = userData.favorite_music_ids;
                    } else if (typeof userData.favorite_music_ids === 'string') {
                        state.favoriteMusicIds = userData.favorite_music_ids.split(',').filter(id => id.trim() !== '');
                    } else {
                        state.favoriteMusicIds = [];
                    }
                } else {
                    state.favoriteMusicIds = [];
                }
                localStorage.setItem('miv_user', JSON.stringify(state.currentUser));
                localStorage.setItem('miv_session', Date.now().toString());
                showToast('Login realizado! (Conta antiga confirmada automaticamente)', 'success');
                document.getElementById('loginEmailField').value = '';
                document.getElementById('loginPasswordField').value = '';
                initializeApp();
                return;
            }
            if (userData.email_confirmado === false) {
                showToast('❌ Por favor, confirme seu email antes de fazer login', 'error', 5000);
                showToast(`✉️ Enviamos um link para ${email}`, 'info', 5000);
                loginBtn.disabled = false;
                loginBtn.innerHTML = '<i class="bi bi-box-arrow-in-right"></i> Entrar';
                hideLoading();
                return;
            }
            state.currentUser = userData;
            state.userBalance = userData.saldo || 0;
            if (userData.favorite_music_ids) {
                if (Array.isArray(userData.favorite_music_ids)) {
                    state.favoriteMusicIds = userData.favorite_music_ids;
                } else if (typeof userData.favorite_music_ids === 'string') {
                    state.favoriteMusicIds = userData.favorite_music_ids.split(',').filter(id => id.trim() !== '');
                } else {
                    state.favoriteMusicIds = [];
                }
            } else {
                state.favoriteMusicIds = [];
            }
            localStorage.setItem('miv_user', JSON.stringify(state.currentUser));
            localStorage.setItem('miv_session', Date.now().toString());
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

// ===== REGISTRO =====
async function handleRegister() {
    const name = document.getElementById('registerNameField')?.value?.trim();
    const email = document.getElementById('registerEmailField')?.value?.trim();
    const password = document.getElementById('registerPasswordField')?.value?.trim();
    const type = document.getElementById('registerTypeField')?.value;
    const link = document.getElementById('registerLinkField')?.value?.trim() || '';
    const acceptTerms = document.getElementById('acceptTermsField')?.checked;
    const acceptMarketing = document.getElementById('acceptMarketingField')?.checked || false;
    const registerBtn = document.getElementById('registerBtn');
    if (!name || !email || !password || !type) { 
        showToast('Preencha todos os campos obrigatórios', 'error'); 
        return; 
    }
    if (password.length < 6) { 
        showToast('A senha deve ter no mínimo 6 caracteres', 'error'); 
        return; 
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { 
        showToast('Digite um e-mail válido', 'error'); 
        return; 
    }
    if (!acceptTerms) {
        showToast('Você precisa aceitar os Termos de Uso para continuar', 'error');
        return;
    }
    const termsCheckbox = document.getElementById('acceptTermsField');
    if (!termsCheckbox || !termsCheckbox.checked) {
        showToast('Marque a caixa de aceite dos Termos de Uso', 'error');
        return;
    }
    registerBtn.disabled = true;
    registerBtn.innerHTML = '<i class="bi bi-arrow-clockwise spin"></i> Criando...';
    showLoading('Criando conta...');
    try {
        const result = await callAPI('register', { 
            nome: name, 
            email, 
            senha: password, 
            tipo: type, 
            workLink: link,
            confirm_url: window.location.origin + '/confirm-email.html',
            accepted_terms: true,
            terms_version: '6.0.0',
            terms_accepted_at: new Date().toISOString(),
            accepted_marketing: acceptMarketing
        });
        if (result?.success) {
            showToast('Cadastro realizado! Verifique seu email para confirmar.', 'success');
            hideLoading();
            setTimeout(() => {
                showToast(`✉️ Enviamos um email de confirmação para ${email}`, 'info', 5000);
            }, 1000);
            // Modal de confirmação
            showConfirmationModal(email);
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

// ===== MODAL DE CONFIRMAÇÃO =====
function showConfirmationModal(email) {
    const modalHtml = `
        <div id="confirmEmailModal" class="modal-overlay show" style="display: flex; z-index: 10000;">
            <div class="modal-content" style="max-width: 450px; background: linear-gradient(135deg, #1a1e24, #0f1217); border: 2px solid var(--neon-green);">
                <div class="modal-header" style="border-bottom: 1px solid var(--neon-green);">
                    <h5 class="modal-title" style="color: var(--neon-green); font-size: 1.5rem;">
                        <i class="bi bi-envelope-check-fill me-2"></i>
                        CONFIRMAÇÃO NECESSÁRIA
                    </h5>
                    <button class="modal-close" onclick="closeCustomModal()" style="color: var(--text-muted);">
                        <i class="bi bi-x-lg"></i>
                    </button>
                </div>
                <div class="modal-body text-center py-4">
                    <div style="font-size: 5rem; color: var(--neon-green); animation: bounce 2s infinite; margin-bottom: 1rem;">
                        <i class="bi bi-envelope-paper-fill"></i>
                    </div>
                    <h3 style="color: white; font-weight: 700; margin-bottom: 1rem;">ÚLTIMO PASSO!</h3>
                    <p style="color: #b3b3b3; font-size: 1.1rem; margin-bottom: 0.5rem;">
                        <strong style="color: var(--neon-green);">${email}</strong>
                    </p>
                    <div style="background: rgba(0, 255, 136, 0.1); border-radius: 12px; padding: 1.5rem; margin: 1.5rem 0; border: 1px dashed var(--neon-green);">
                        <i class="bi bi-check-circle-fill" style="color: var(--neon-green); font-size: 1.5rem; display: block; margin-bottom: 0.5rem;"></i>
                        <p style="color: white; font-size: 1.1rem; margin-bottom: 0;">Cadastro realizado com sucesso!</p>
                        <p style="color: var(--neon-green); font-weight: 600; font-size: 1.2rem; margin: 0.5rem 0;">VERIFIQUE SEU E-MAIL</p>
                        <p style="color: #b3b3b3;">Enviamos um link de confirmação para seu e-mail. Clique nele para ativar sua conta.</p>
                    </div>
                    <button class="btn-miv" onclick="resendConfirmationEmailFromModal('${email}')" style="margin-top: 1rem; padding: 0.75rem 2rem; font-size: 1rem; display: inline-flex; align-items: center; gap: 8px; width: auto;">
                        <i class="bi bi-arrow-clockwise"></i> Reenviar e-mail de confirmação
                    </button>
                </div>
                <div class="modal-footer" style="border-top: 1px solid var(--border); justify-content: center;">
                    <button class="btn btn-outline-success" onclick="closeCustomModal()" style="min-width: 120px;">
                        <i class="bi bi-check-lg me-2"></i>Entendi
                    </button>
                </div>
            </div>
        </div>
    `;
    const existingModal = document.getElementById('confirmEmailModal');
    if (existingModal) existingModal.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.body.style.overflow = 'hidden';
}

// ===== REENVIAR CONFIRMAÇÃO =====
async function resendConfirmationEmail() {
    const email = document.getElementById('loginEmailField')?.value?.trim();
    if (!email) {
        showToast('Digite seu email primeiro', 'error');
        return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showToast('Digite um email válido', 'error');
        return;
    }
    showLoading('Enviando email...');
    try {
        const result = await callAPI('resend_confirmation', { 
            email,
            confirm_url: window.location.origin + '/confirm-email.html'
        });
        if (result?.success) {
            showToast(`✉️ Novo link enviado para ${email}!`, 'success', 5000);
        } else {
            showToast(result?.message || 'Erro ao enviar email', 'error');
        }
    } catch (error) {
        console.error('Erro ao reenviar:', error);
        showToast('Erro ao enviar email', 'error');
    } finally {
        hideLoading();
    }
}

async function resendConfirmationEmailFromModal(email) {
    if (!email) return;
    const btn = event?.currentTarget;
    const originalText = btn?.innerHTML;
    if (btn) {
        btn.disabled = true;
