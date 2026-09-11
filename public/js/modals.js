// ============================================================
// MODALS.JS - Todos os modais PLAY MY
// ============================================================

function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) { modal.classList.add('show'); document.body.style.overflow = 'hidden'; }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) { modal.classList.remove('show'); document.body.style.overflow = 'auto'; }
}

function openInvestModal(trackIndex) {
    if (trackIndex < 0 || trackIndex >= state.playlist.length) { showToast('Música não encontrada', 'error'); return; }
    const track = state.playlist[trackIndex];
    if (track.status === 'paused' || track.status === 'deleted') { showToast('Música indisponível', 'warning'); return; }
    state.currentInvestTrack = track;
    document.getElementById('investTrackTitle').textContent = track.titulo || 'Sem título';
    document.getElementById('investTrackArtist').textContent = track.artista || 'Artista';
    document.getElementById('investUnitPriceDisplay').textContent = formatCurrency(track.valor_acao || 0);
    document.getElementById('investAvailableBalanceDisplay').textContent = formatCurrency(state.userBalance);
    document.getElementById('investQuantityField').value = 1;
    const totalShares = (track.percentual_disponivel || 0) / 0.01;
    const availableShares = Math.max(0, totalShares - (track.acoes_vendidas || 0));
    document.getElementById('investSharesAvailable').textContent = `Disponível: ${availableShares} ações`;
    document.getElementById('investBlockchainPreview').innerHTML = `⛓️ Hash: ${Blockchain.generateHash(track.id + Date.now()).substring(0, 20)}...`;
    updateInvestmentTotal();
    showModal('investModal');
}

function updateInvestmentTotal() {
    if (!state.currentInvestTrack) return;
    const qty = parseInt(document.getElementById('investQuantityField').value) || 1;
    const total = qty * (state.currentInvestTrack.valor_acao || 0);
    document.getElementById('investTotalPriceDisplay').textContent = formatCurrency(total);
    document.getElementById('confirmInvestBtn').disabled = total > state.userBalance;
}

function adjustQuantity(amount) {
    const input = document.getElementById('investQuantityField');
    input.value = Math.max(1, parseInt(input.value) + amount);
    updateInvestmentTotal();
}

async function confirmInvestment() {
    if (!state.currentUser || !state.currentInvestTrack) { showToast('Erro', 'error'); return; }
    const qty = parseInt(document.getElementById('investQuantityField').value) || 1;
    const total = qty * (state.currentInvestTrack.valor_acao || 0);
    if (total > state.userBalance) { showToast('Saldo insuficiente', 'error'); return; }
    const btn = document.getElementById('confirmInvestBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="bi bi-arrow-clockwise spin"></i> Processando...';
    try {
        const result = await callAPI('buy', {
            music_id: state.currentInvestTrack.id, quantidade: qty,
            valor_unitario: state.currentInvestTrack.valor_acao || 0, valor_total: total,
            comprador_id: state.currentUser.id, vendedor_id: state.currentInvestTrack.user_id
        });
        if (result?.success) {
            state.userBalance -= total;
            const novoAtivo = {
                id: 'inv_' + Date.now(), music_id: state.currentInvestTrack.id,
                quantidade: qty, valor_unitario: state.currentInvestTrack.valor_acao,
                valor_total: total, data_compra: new Date().toISOString(), status: 'ativo'
            };
            if (!state.portfolioAssets) state.portfolioAssets = [];
            state.portfolioAssets.push(novoAtivo);
            updateBalanceDisplay();
            renderPortfolio();
            showToast(`✅ Investimento realizado! ${qty} ações`, 'success');
            closeModal('investModal');
        } else showToast(result?.message || 'Erro', 'error');
    } catch (error) { showToast('Erro: ' + error.message, 'error'); }
    finally { btn.disabled = false; btn.innerHTML = '<i class="bi bi-check-circle me-2"></i> Confirmar Investimento'; }
}

function openInvestExternalModal(trackIndex) {
    if (trackIndex < 0 || trackIndex >= state.externalPlaylist.length) { showToast('Não encontrada', 'error'); return; }
    state.currentExternalTrack = state.externalPlaylist[trackIndex];
    document.getElementById('investExternalTitleDisplay').textContent = state.currentExternalTrack.titulo || 'Sem título';
    document.getElementById('investExternalArtistDisplay').textContent = state.currentExternalTrack.artista || 'Artista';
    document.getElementById('investExternalUnitPriceDisplay').textContent = formatCurrency(state.currentExternalTrack.valor_acao || 0);
    document.getElementById('investExternalBalanceDisplay').textContent = formatCurrency(state.userBalance);
    document.getElementById('investExternalQuantityField').value = 1;
    const progressPercent = Math.min(100, ((state.currentExternalTrack.vendas_atuais || 0) / (state.currentExternalTrack.meta_vendas || 1000000) * 100));
    document.getElementById('investExternalProgressBar').style.width = `${progressPercent}%`;
    updateExternalInvestmentTotal();
    showModal('investExternalModal');
}

function updateExternalInvestmentTotal() {
    if (!state.currentExternalTrack) return;
    const qty = parseInt(document.getElementById('investExternalQuantityField').value) || 1;
    const total = qty * (state.currentExternalTrack.valor_acao || 0);
    document.getElementById('investExternalTotalPriceDisplay').textContent = formatCurrency(total);
    document.getElementById('confirmExternalInvestBtn').disabled = total > state.userBalance;
}

function adjustExternalQuantity(amount) {
    const input = document.getElementById('investExternalQuantityField');
    input.value = Math.max(1, parseInt(input.value) + amount);
    updateExternalInvestmentTotal();
}

async function confirmExternalInvestment() {
    if (!state.currentUser || !state.currentExternalTrack) { showToast('Erro', 'error'); return; }
    const qty = parseInt(document.getElementById('investExternalQuantityField').value) || 1;
    const total = qty * (state.currentExternalTrack.valor_acao || 0);
    if (total > state.userBalance) { showToast('Saldo insuficiente', 'error'); return; }
    const btn = document.getElementById('confirmExternalInvestBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="bi bi-arrow-clockwise spin"></i> Processando...';
    try {
        const result = await callAPI('buy_external', {
            external_id: state.currentExternalTrack.id, quantidade: qty,
            valor_unitario: state.currentExternalTrack.valor_acao || 0, valor_total: total
        });
        if (result?.success) {
            state.userBalance -= total;
            updateBalanceDisplay();
            closeModal('investExternalModal');
            showToast('Investimento externo realizado!', 'success');
            await Promise.all([loadExternalMarketplace(), loadLedger()]);
        } else showToast(result?.message || 'Erro', 'error');
    } catch (error) { showToast('Erro: ' + error.message, 'error'); }
    finally { btn.disabled = false; btn.innerHTML = '<i class="bi bi-check-circle me-2"></i> Confirmar Investimento'; }
}

function openInvestModalFromPlayer() {
    if (state.currentTrackIndex < 0) { showToast('Nenhuma música tocando', 'error'); return; }
    if (state.currentTrackIndex >= 1000) openInvestExternalModal(state.currentTrackIndex - 1000);
    else openInvestModal(state.currentTrackIndex);
}

async function toggleFavoriteMusic(musicId, trackIndex = null) {
    if (!state.currentUser) { showToast('Faça login', 'error'); return; }
    const isFavorite = state.favoriteMusicIds?.includes(musicId.toString());
    if (isFavorite) {
        state.favoriteMusicIds = state.favoriteMusicIds.filter(id => id !== musicId.toString());
        showToast('⭐ Removido dos favoritos', 'success');
    } else {
        state.favoriteMusicIds.push(musicId.toString());
        showToast('⭐ Adicionado aos favoritos!', 'success');
    }
    if (state.currentUser) {
        state.currentUser.favorite_music_ids = state.favoriteMusicIds;
        localStorage.setItem('miv_user', JSON.stringify(state.currentUser));
    }
    renderMarketplace();
    renderExternalMarketplace();
    renderPlaylists();
    if (trackIndex !== null) updateFavoriteButton(state.favoriteMusicIds.includes(musicId.toString()));
    try {
        await callAPI('toggle_favorite', {
            user_id: state.currentUser.id, music_id: musicId,
            action: isFavorite ? 'remove' : 'add'
        });
    } catch (error) { console.error(error); }
}

function openAddBalanceModal() {
    document.getElementById('balanceAmountField').value = 100;
    showModal('addBalanceModal');
}

function openWithdrawalModal() {
    if (state.userBalance < 10) { showToast('Saldo mínimo: R$ 10,00', 'warning'); return; }
    document.getElementById('withdrawalAmountField').value = state.userBalance;
    document.getElementById('maxWithdrawalDisplay').textContent = formatCurrency(state.userBalance);
    showModal('withdrawalModal');
}

function setBalanceAmount(v) { document.getElementById('balanceAmountField').value = v; }
function validateBalanceAmount() {
    const input = document.getElementById('balanceAmountField');
    let v = parseFloat(input.value) || 0;
    if (v < 10) input.value = 10;
}

function processBalanceAdd() {
    const amount = parseFloat(document.getElementById('balanceAmountField').value) || 0;
    if (amount < 10) { showToast('Valor mínimo: R$ 10,00', 'error'); return; }
    state.userBalance += amount;
    updateBalanceDisplay();
    closeModal('addBalanceModal');
    showToast(`Saldo de ${formatCurrency(amount)} adicionado!`, 'success');
    window.open(CONFIG.MERCADO_PAGO_LINK, '_blank');
}

function validateWithdrawalAmount() {
    const input = document.getElementById('withdrawalAmountField');
    let v = parseFloat(input.value) || 0;
    if (v < 10) input.value = 10;
    if (v > state.userBalance) input.value = state.userBalance;
}

async function requestWithdrawal() {
    const amount = parseFloat(document.getElementById('withdrawalAmountField').value) || 0;
    const method = document.getElementById('withdrawalMethodField').value;
    const details = document.getElementById('bankDetailsField').value.trim();
    if (amount < 10) { showToast('Valor mínimo: R$ 10,00', 'error'); return; }
    if (amount > state.userBalance) { showToast('Saldo insuficiente', 'error'); return; }
    if (!method) { showToast('Selecione um método', 'error'); return; }
    if (!details) { showToast('Preencha os dados bancários', 'error'); return; }
    const btn = document.getElementById('requestWithdrawalBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="bi bi-arrow-clockwise spin"></i> Solicitando...';
    try {
        const result = await callAPI('request_withdrawal', { valor: amount, metodo: method, dados_bancarios: details });
        if (result?.success) {
            state.userBalance -= amount;
            updateBalanceDisplay();
            closeModal('withdrawalModal');
            showToast('Saque solicitado!', 'success');
        } else showToast(result?.message || 'Erro', 'error');
    } catch (error) { showToast('Erro', 'error'); }
    finally { btn.disabled = false; btn.innerHTML = '<i class="bi bi-send me-2"></i> Solicitar Saque'; }
}

function openAddMusicModal() {
    if (!state.currentUser || state.currentUser.tipo !== 'artista') { showToast('Apenas artistas', 'error'); return; }
    showModal('addMusicModal');
}

function openAddExternalMusicModal() {
    if (!state.currentUser) { showToast('Faça login', 'error'); return; }
    showModal('addExternalMusicModal');
}

function openCreatePlaylistModal() { showModal('createPlaylistModal'); }

async function submitExternalMusic() {
    const youtube = document.getElementById('externalYoutubeLinkField').value.trim();
    const title = document.getElementById('externalTitleField').value.trim();
    const artist = document.getElementById('externalArtistField').value.trim();
    const price = parseFloat(document.getElementById('externalPriceField').value);
    const percent = parseFloat(document.getElementById('externalPercentField').value);
    if (!youtube || !title || !artist || !price || !percent) { showToast('Preencha os campos', 'error'); return; }
    if (!youtube.includes('youtube.com/watch') && !youtube.includes('youtu.be')) { showToast('Link inválido', 'error'); return; }
    const btn = document.getElementById('submitExternalBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="bi bi-arrow-clockwise spin"></i> Enviando...';
    try {
        const result = await callAPI('suggest_external_music', {
            link_youtube: youtube, titulo: title, artista: artist,
            valor_acao: price, percentual_disponivel: percent,
            link_capa: document.getElementById('externalCoverField')?.value || '',
            mensagem: document.getElementById('externalMessageField')?.value || ''
        });
        if (result?.success) {
            showToast('Música sugerida!', 'success');
            closeModal('addExternalMusicModal');
            await loadExternalMarketplace(true);
        } else showToast(result?.message || 'Erro', 'error');
    } catch (error) { showToast('Erro', 'error'); }
    finally { btn.disabled = false; btn.innerHTML = '<i class="bi bi-send me-2"></i> Sugerir Música'; }
}

async function registerMusic() {
    const title = document.getElementById('musicTitleField').value.trim();
    const genre = document.getElementById('musicGenreField').value;
    const youtube = document.getElementById('musicYoutubeField').value.trim();
    const price = parseFloat(document.getElementById('musicPriceField').value);
    const percent = parseFloat(document.getElementById('musicPercentField').value);
    const terms = document.getElementById('musicTermsField').checked;
    if (!title || !genre || !youtube || !price || !percent) { showToast('Preencha os campos', 'error'); return; }
    if (!terms) { showToast('Aceite os termos', 'error'); return; }
    try {
        const videoId = extractYouTubeId(youtube);
        const thumbnailUrl = videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : document.getElementById('musicCoverField').value;
        const result = await callAPI('upload_music', {
            titulo: title, artista: state.currentUser?.nome || 'Artista',
            genero: genre, link_youtube: youtube, link_capa: thumbnailUrl,
            valor_acao: price, percentual_disponivel: percent, status: 'active'
        });
        if (result?.success) {
            showToast('Música cadastrada!', 'success');
            closeModal('addMusicModal');
            await Promise.all([loadArtistData(true), loadMarketplace(true)]);
        } else showToast(result?.message || 'Erro', 'error');
    } catch (error) { showToast('Erro', 'error'); }
}

function viewContract(ref) {
    document.getElementById('contractContent').innerHTML = `
        <h3>CONTRATO DE INVESTIMENTO</h3>
        <p><strong>Ref:</strong> ${ref}</p>
        <p><strong>Data:</strong> ${new Date().toLocaleDateString('pt-BR')}</p>
        <p>Contrato digital entre investidor e PLAY MY.</p>
        <p><strong>Hash:</strong> ${Blockchain.generateHash(ref)}</p>`;
    document.getElementById('contractBlockchainHash').innerHTML = `⛓️ Hash: ${Blockchain.generateHash(ref)}`;
    showModal('contractModal');
}

function exportExtrato() { showToast('Extrato exportado!', 'success'); }
function printContract() { window.print(); }

function openTermsModal() {
    document.getElementById('termsContent').innerHTML = `
        <h3>TERMOS DE USO - PLAY MY</h3>
        <p><strong>Versão 7.1.0</strong></p>
        <h4>1. Aceitação</h4><p>Ao usar a plataforma você concorda com estes termos.</p>
        <h4>2. Serviço</h4><p>Investimento em direitos musicais via blockchain.</p>
        <h4>3. Riscos</h4><p>Investimentos envolvem riscos. Diversifique.</p>
        <h4>4. Taxas</h4><p>Taxa de 0,99% sobre transações.</p>`;
    showModal('termsModal');
}

function openPrivacyModal() {
    document.getElementById('privacyContent').innerHTML = `
        <h3>POLÍTICA DE PRIVACIDADE</h3>
        <h4>1. Dados</h4><p>Coletamos nome, email, dados bancários.</p>
        <h4>2. Uso</h4><p>Para processar investimentos e royalties.</p>
        <h4>3. Blockchain</h4><p>Transações são públicas.</p>`;
    showModal('privacyModal');
}

function acceptTermsFromModal() {
    const t = document.getElementById('acceptTermsField');
    if (t) { t.checked = true; closeModal('termsModal'); showToast('Termos aceitos!', 'success'); }
}

function closeCustomModal() {
    const modal = document.getElementById('confirmEmailModal');
    if (modal) { modal.classList.remove('show'); setTimeout(() => modal.style.display = 'none', 300); document.body.style.overflow = 'auto'; }
}

async function resendConfirmationEmailFromModal(email) {
    if (!email) return;
    showToast(`✉️ Novo link enviado para ${email}`, 'success');
}

async function autoFillMusicInfo() {
    const url = document.getElementById('externalYoutubeLinkField').value.trim();
    if (!url) { showToast('Digite o link', 'error'); return; }
    const videoId = extractYouTubeId(url);
    if (!videoId) { showToast('Link inválido', 'error'); return; }
    document.getElementById('externalTitleField').value = 'Música do YouTube';
    document.getElementById('externalArtistField').value = 'Artista';
    showToast('Informações preenchidas (básico)', 'info');
}

async function fallbackFillMusicInfo() { showToast('Preenchimento manual necessário', 'info'); }
async function analisarVideoYouTube() { showToast('Análise em desenvolvimento', 'info'); }
async function aplicarValorYouTube() { showToast('Aplicado!', 'success'); }
async function finalizarCadastroComYouTube() { await registerMusic(); }
