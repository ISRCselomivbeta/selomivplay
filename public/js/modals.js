// ============================================================
// MODALS.JS - Controle de Modais
// ============================================================

// ===== INVEST MODAL =====
function openInvestModal(trackIndex) {
    if (trackIndex < 0 || trackIndex >= state.playlist.length) { showToast('Música não encontrada', 'error'); return; }
    const track = state.playlist[trackIndex];
    if (track.status === 'paused') { showToast('Esta música está pausada pelo artista', 'warning'); return; }
    if (track.status === 'deleted') { showToast('Esta música não está mais disponível', 'error'); return; }
    state.currentInvestTrack = track;
    document.getElementById('investTrackTitle').textContent = track.titulo || 'Sem título';
    document.getElementById('investTrackArtist').textContent = track.artista || 'Artista Desconhecido';
    document.getElementById('investUnitPriceDisplay').textContent = formatCurrency(track.valor_acao || 0);
    const balanceEl = document.getElementById('investAvailableBalanceDisplay');
    const streamingEarnings = state.streamingStats?.total_earnings || 0;
    if (streamingEarnings > 0) {
        balanceEl.innerHTML = `${formatCurrency(state.userBalance)} <small class="text-success d-block" style="font-size: 0.7rem;"><i class="bi bi-cash-stack"></i> Inclui ${formatCurrency(streamingEarnings)} de streaming</small>`;
    } else { balanceEl.textContent = formatCurrency(state.userBalance); }
    document.getElementById('investQuantityField').value = 1;
    const totalShares = (track.percentual_disponivel || 0) / 0.01;
    const availableShares = Math.max(0, totalShares - (track.acoes_vendidas || 0));
    document.getElementById('investSharesAvailable').textContent = `Disponível: ${availableShares} ações`;
    document.getElementById('investBlockchainPreview').innerHTML = `⛓️ Hash da transação: ${Blockchain.generateHash(track.id + Date.now()).substring(0, 20)}...`;
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

function openInvestModalFromPlayer() {
    if (state.currentTrackIndex < 0) { showToast('Nenhuma música tocando', 'error'); return; }
    if (state.currentTrackIndex >= 1000) { openInvestExternalModal(state.currentTrackIndex - 1000); }
    else { openInvestModal(state.currentTrackIndex); }
}

// ===== INVEST EXTERNAL MODAL =====
function openInvestExternalModal(trackIndex) {
    if (trackIndex < 0 || trackIndex >= state.externalPlaylist.length) { showToast('Música não encontrada', 'error'); return; }
    state.currentExternalTrack = state.externalPlaylist[trackIndex];
    document.getElementById('investExternalTitleDisplay').textContent = state.currentExternalTrack.titulo || 'Sem título';
    document.getElementById('investExternalArtistDisplay').textContent = state.currentExternalTrack.artista || 'Artista Desconhecido';
    document.getElementById('investExternalUnitPriceDisplay').textContent = formatCurrency(state.currentExternalTrack.valor_acao || 0);
    document.getElementById('investExternalBalanceDisplay').textContent = formatCurrency(state.userBalance);
    document.getElementById('investExternalQuantityField').value = 1;
    const totalShares = state.currentExternalTrack.total_acoes || ((state.currentExternalTrack.percentual_disponivel || 0) / 0.01);
    const availableShares = Math.max(0, totalShares - (state.currentExternalTrack.acoes_vendidas || 0));
    document.getElementById('investExternalSharesAvailable').textContent = `Disponível: ${availableShares} ações`;
    const progressPercent = Math.min(100, ((state.currentExternalTrack.vendas_atuais || 0) / (state.currentExternalTrack.meta_vendas || 1000000) * 100));
    document.getElementById('investExternalProgressBar').style.width = `${progressPercent}%`;
    document.getElementById('investExternalCurrentSales').textContent = `Vendas atuais: ${formatCurrency(state.currentExternalTrack.vendas_atuais || 0)}`;
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
    if (!state.currentUser || !state.currentExternalTrack) { showToast('Erro ao processar investimento', 'error'); return; }
    const qty = parseInt(document.getElementById('investExternalQuantityField').value) || 1;
    const total = qty * (state.currentExternalTrack.valor_acao || 0);
    if (total > state.userBalance) { showToast('Saldo insuficiente', 'error'); return; }
    const btn = document.getElementById('confirmExternalInvestBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="bi bi-arrow-clockwise spin"></i> Processando...';
    showLoading('Processando investimento...');
    try {
        const result = await callAPI('buy_external', { external_id: state.currentExternalTrack.id, quantidade: qty, valor_unitario: state.currentExternalTrack.valor_acao || 0, valor_total: total });
        if (result?.success) {
            state.userBalance -= total;
            updateBalanceDisplay();
            closeModal('investExternalModal');
            showToast('Investimento externo realizado!', 'success');
            await Promise.all([loadExternalMarketplace(), loadLedger()]);
        } else { showToast(result?.message || 'Erro ao processar investimento', 'error'); }
    } catch (error) { console.error('Erro ao investir externo:', error); showToast('Erro ao processar investimento', 'error'); }
    finally { btn.disabled = false; btn.innerHTML = '<i class="bi bi-check-circle me-2"></i> Confirmar Investimento'; hideLoading(); }
}

// ===== ADD BALANCE MODAL =====
function openAddBalanceModal() { document.getElementById('balanceAmountField').value = 100; showModal('addBalanceModal'); }
function setBalanceAmount(v) { document.getElementById('balanceAmountField').value = v; }
function validateBalanceAmount() { const input = document.getElementById('balanceAmountField'); let v = parseFloat(input.value) || 0; if (v < 10) input.value = 10; }

function processBalanceAdd() { 
    const amount = parseFloat(document.getElementById('balanceAmountField').value) || 0;
    if (amount < 10) { showToast('Valor mínimo: R$ 10,00', 'error'); return; }
    state.userBalance += amount;
    updateBalanceDisplay();
    closeModal('addBalanceModal');
    showToast(`Saldo de ${formatCurrency(amount)} adicionado!`, 'success');
    window.open(CONFIG.MERCADO_PAGO_LINK, '_blank');
}

// ===== WITHDRAWAL MODAL =====
function openWithdrawalModal() { 
    if (state.userBalance < 10) { showToast('Saldo mínimo para saque: R$ 10,00', 'warning'); return; } 
    document.getElementById('withdrawalAmountField').value = state.userBalance; 
    document.getElementById('maxWithdrawalDisplay').textContent = formatCurrency(state.userBalance); 
    showModal('withdrawalModal'); 
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
    if (!method) { showToast('Selecione um método de pagamento', 'error'); return; }
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
        } else { showToast(result?.message || 'Erro ao processar saque', 'error'); }
    } catch (error) { console.error('Erro ao solicitar saque:', error); showToast('Erro ao processar saque', 'error'); }
    finally { btn.disabled = false; btn.innerHTML = '<i class="bi bi-send me-2"></i> Solicitar Saque'; }
}

// ===== ADD MUSIC MODAL =====
function openAddMusicModal() { 
    if (!state.currentUser || state.currentUser.tipo !== 'artista') { showToast('Apenas artistas podem cadastrar músicas', 'error'); return; }
    showModal('addMusicModal'); 
}

function openAddExternalMusicModal() { 
    if (!state.currentUser) { showToast('Faça login para sugerir músicas', 'error'); return; } 
    showModal('addExternalMusicModal'); 
}

function openCreatePlaylistModal() { showModal('createPlaylistModal'); }

// ===== CONTRACT MODAL =====
function viewContract(ref) { 
    document.getElementById('contractContent').innerHTML = `
        <h3>CONTRATO DE INVESTIMENTO</h3>
        <p><strong>Referência:</strong> ${ref}</p>
        <p><strong>Data:</strong> ${new Date().toLocaleDateString('pt-BR')}</p>
        <hr>
        <p>Este é um contrato digital entre o investidor e o SELO MIV.</p>
        <p>O investidor adquire direitos proporcionais sobre os royalties da música conforme o percentual investido.</p>
        <p>Os termos completos estão disponíveis na plataforma.</p>
        <p><strong>Blockchain Hash:</strong> ${Blockchain.generateHash(ref)}</p>
    `; 
    document.getElementById('contractBlockchainHash').innerHTML = `⛓️ Hash: ${Blockchain.generateHash(ref)}`;
    showModal('contractModal'); 
}

function printContract() { window.print(); }

// ===== EDIT MUSIC MODAL =====
function openEditMusicModal(musicId) {
    const music = state.playlist.find(m => m.id === musicId) || (state.externalPlaylist ? state.externalPlaylist.find(m => m.id === musicId) : null);
    if (!music) { showToast('Música não encontrada', 'error'); return; }
    document.getElementById('editMusicId').value = music.id;
    document.getElementById('editMusicTitleField').value = music.titulo || '';
    document.getElementById('editMusicGenreField').value = music.genero || 'POP';
    document.getElementById('editMusicYoutubeField').value = music.link_youtube || '';
    document.getElementById('editMusicCoverField').value = music.link_capa || '';
    document.getElementById('editMusicPriceField').value = music.valor_acao || 10;
    document.getElementById('editMusicPercentField').value = music.percentual_disponivel || 20;
    document.getElementById('editMusicStatusField').value = music.status || 'active';
    document.getElementById('editMusicBlockchainInfo').innerHTML = `⛓️ Hash atual: ${music.blockchain_hash || 'A ser gerado'}`;
    showModal('editMusicModal');
}

async function updateMusic() {
    const musicId = document.getElementById('editMusicId').value;
    const title = document.getElementById('editMusicTitleField').value.trim();
    const genre = document.getElementById('editMusicGenreField').value;
    const youtube = document.getElementById('editMusicYoutubeField').value.trim();
    const cover = document.getElementById('editMusicCoverField').value.trim();
    const price = parseFloat(document.getElementById('editMusicPriceField').value);
    const percent = parseFloat(document.getElementById('editMusicPercentField').value);
    const status = document.getElementById('editMusicStatusField').value;
    if (!title || !genre || !youtube || !price || !percent) { showToast('Preencha todos os campos obrigatórios', 'error'); return; }
    if (price < 1) { showToast('Valor mínimo por ação: R$ 1,00', 'error'); return; }
    if (percent < 1 || percent > 100) { showToast('Percentual deve estar entre 1% e 100%', 'error'); return; }
    const btn = document.getElementById('updateMusicBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="bi bi-arrow-clockwise spin"></i> Atualizando...';
    try {
        const result = await callAPI('update_music', { music_id: musicId, titulo: title, genero: genre, link_youtube: youtube, link_capa: cover, valor_acao: price, percentual_disponivel: percent, status: status });
        if (result?.success) { showToast('Música atualizada com sucesso!', 'success'); closeModal('editMusicModal'); await Promise.all([loadMarketplace(true), loadArtistData(true)]); }
        else { showToast(result?.message || 'Erro ao atualizar música', 'error'); }
    } catch (error) { console.error('Erro ao atualizar música:', error); showToast('Erro ao atualizar música', 'error'); }
    finally { btn.disabled = false; btn.innerHTML = '<i class="bi bi-save me-2"></i> Salvar Alterações'; }
}

async function pauseMusic(musicId) {
    if (!confirm('Deseja pausar esta música? Ela não aparecerá no marketplace até ser reativada.')) return;
    try {
        const result = await callAPI('pause_music', { music_id: musicId, action: 'pause' });
        if (result?.success) { showToast('Música pausada com sucesso!', 'success'); await Promise.all([loadMarketplace(true), loadArtistData(true)]); }
    } catch (error) { console.error('Erro ao pausar música:', error); showToast('Erro ao pausar música', 'error'); }
}

async function unpauseMusic(musicId) {
    try {
        const result = await callAPI('pause_music', { music_id: musicId, action: 'unpause' });
        if (result?.success) { showToast('Música reativada com sucesso!', 'success'); await Promise.all([loadMarketplace(true), loadArtistData(true)]); }
    } catch (error) { console.error('Erro ao reativar música:', error); showToast('Erro ao reativar música', 'error'); }
}

async function requestDeleteMusic(musicId) {
    if (!confirm('Tem certeza que deseja solicitar a exclusão desta música? Esta ação não pode ser desfeita e afetará todos os investidores.')) return;
    try {
        const result = await callAPI('delete_music', { music_id: musicId });
        if (result?.success) { showToast('Solicitação de exclusão enviada!', 'success'); await Promise.all([loadMarketplace(true), loadArtistData(true)]); }
    } catch (error) { console.error('Erro ao solicitar exclusão:', error); showToast('Erro ao solicitar exclusão', 'error'); }
}

// ===== EXPORT =====
if (typeof window !== 'undefined') {
    window.openInvestModal = openInvestModal;
    window.updateInvestmentTotal = updateInvestmentTotal;
    window.adjustQuantity = adjustQuantity;
    window.openInvestModalFromPlayer = openInvestModalFromPlayer;
    window.openInvestExternalModal = openInvestExternalModal;
    window.updateExternalInvestmentTotal = updateExternalInvestmentTotal;
    window.adjustExternalQuantity = adjustExternalQuantity;
    window.confirmExternalInvestment = confirmExternalInvestment;
    window.openAddBalanceModal = openAddBalanceModal;
    window.setBalanceAmount = setBalanceAmount;
    window.validateBalanceAmount = validateBalanceAmount;
    window.processBalanceAdd = processBalanceAdd;
    window.openWithdrawalModal = openWithdrawalModal;
    window.validateWithdrawalAmount = validateWithdrawalAmount;
    window.requestWithdrawal = requestWithdrawal;
    window.openAddMusicModal = openAddMusicModal;
    window.openAddExternalMusicModal = openAddExternalMusicModal;
    window.openCreatePlaylistModal = openCreatePlaylistModal;
    window.viewContract = viewContract;
    window.printContract = printContract;
    window.openEditMusicModal = openEditMusicModal;
    window.updateMusic = updateMusic;
    window.pauseMusic = pauseMusic;
    window.unpauseMusic = unpauseMusic;
    window.requestDeleteMusic = requestDeleteMusic;
}
