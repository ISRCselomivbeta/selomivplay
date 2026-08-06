// ============================================================
// MODALS.JS - Controle de Modais
// ============================================================

// ===== INVEST MODAL =====
function openInvestModal(trackIndex) {
    if (trackIndex < 0 || trackIndex >= state.playlist.length) { 
        showToast('Música não encontrada', 'error'); 
        return; 
    }
    
    const track = state.playlist[trackIndex];
    if (track.status === 'paused') {
        showToast('Esta música está pausada pelo artista', 'warning');
        return;
    }
    if (track.status === 'deleted') {
        showToast('Esta música não está mais disponível', 'error');
        return;
    }
    
    state.currentInvestTrack = track;
    document.getElementById('investTrackTitle').textContent = track.titulo || 'Sem título';
    document.getElementById('investTrackArtist').textContent = track.artista || 'Artista Desconhecido';
    document.getElementById('investUnitPriceDisplay').textContent = formatCurrency(track.valor_acao || 0);
    
    const balanceEl = document.getElementById('investAvailableBalanceDisplay');
    const streamingEarnings = state.streamingStats?.total_earnings || 0;
    
    if (streamingEarnings > 0) {
        balanceEl.innerHTML = `${formatCurrency(state.userBalance)} 
            <small class="text-success d-block" style="font-size: 0.7rem;">
                <i class="bi bi-cash-stack"></i> 
                Inclui ${formatCurrency(streamingEarnings)} de streaming
            </small>`;
    } else {
        balanceEl.textContent = formatCurrency(state.userBalance);
    }
    
    document.getElementById('investQuantityField').value = 1;
    const totalShares = (track.percentual_disponivel || 0) / 0.01;
    const availableShares = Math.max(0, totalShares - (track.acoes_vendidas || 0));
    document.getElementById('investSharesAvailable').textContent = `Disponível: ${availableShares} ações`;
    
    document.getElementById('investBlockchainPreview').innerHTML = 
        `⛓️ Hash da transação: ${Blockchain.generateHash(track.id + Date.now()).substring(0, 20)}...`;
    
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
    if (state.currentTrackIndex < 0) { 
        showToast('Nenhuma música tocando', 'error'); 
        return; 
    }
    if (state.currentTrackIndex >= 1000) {
        openInvestExternalModal(state.currentTrackIndex - 1000);
    } else {
        openInvestModal(state.currentTrackIndex);
    }
}

// ===== INVEST EXTERNAL MODAL =====
function openInvestExternalModal(trackIndex) {
    if (trackIndex < 0 || trackIndex >= state.externalPlaylist.length) { 
        showToast('Música não encontrada', 'error'); 
        return; 
    }
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

// ===== ADD BALANCE MODAL =====
function openAddBalanceModal() { 
    document.getElementById('balanceAmountField').value = 100; 
    showModal('addBalanceModal'); 
}

function setBalanceAmount(v) { 
    document.getElementById('balanceAmountField').value = v; 
}

function validateBalanceAmount() { 
    const input = document.getElementById('balanceAmountField'); 
    let v = parseFloat(input.value) || 0; 
    if (v < 10) input.value = 10; 
}

function processBalanceAdd() { 
    const amount = parseFloat(document.getElementById('balanceAmountField').value) || 0;
    if (amount < 10) { 
        showToast('Valor mínimo: R$ 10,00', 'error'); 
        return; 
    }
    state.userBalance += amount;
    updateBalanceDisplay();
    closeModal('addBalanceModal');
    showToast(`Saldo de ${formatCurrency(amount)} adicionado!`, 'success');
    window.open(CONFIG.MERCADO_PAGO_LINK, '_blank');
}

// ===== WITHDRAWAL MODAL =====
function openWithdrawalModal() { 
    if (state.userBalance < 10) { 
        showToast('Saldo mínimo para saque: R$ 10,00', 'warning'); 
        return; 
    } 
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

// ===== ADD MUSIC MODAL =====
function openAddMusicModal() { 
    if (!state.currentUser || state.currentUser.tipo !== 'artista') { 
        showToast('Apenas artistas podem cadastrar músicas', 'error'); 
        return; 
    }
    showModal('addMusicModal'); 
}

function openAddExternalMusicModal() { 
    if (!state.currentUser) { 
        showToast('Faça login para sugerir músicas', 'error'); 
        return; 
    } 
    showModal('addExternalMusicModal'); 
}

function openCreatePlaylistModal() { 
    showModal('createPlaylistModal'); 
}

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
    document.getElementById('contractBlockchainHash').innerHTML = 
        `⛓️ Hash: ${Blockchain.generateHash(ref)}`;
    showModal('contractModal'); 
}

function printContract() { 
    window.print(); 
}

// ===== EDIT MUSIC MODAL =====
function openEditMusicModal(musicId) {
    const music = state.playlist.find(m => m.id === musicId) || 
                 (state.externalPlaylist ? state.externalPlaylist.find(m => m.id === musicId) : null);
    
    if (!music) {
        showToast('Música não encontrada', 'error');
        return;
    }
    
    document.getElementById('editMusicId').value = music.id;
    document.getElementById('editMusicTitleField').value = music.titulo || '';
    document.getElementById('editMusicGenreField').value = music.genero || 'POP';
    document.getElementById('editMusicYoutubeField').value = music.link_youtube || '';
    document.getElementById('editMusicCoverField').value = music.link_capa || '';
    document.getElementById('editMusicPriceField').value = music.valor_acao || 10;
    document.getElementById('editMusicPercentField').value = music.percentual_disponivel || 20;
    document.getElementById('editMusicStatusField').value = music.status || 'active';
    
    document.getElementById('editMusicBlockchainInfo').innerHTML = 
        `⛓️ Hash atual: ${music.blockchain_hash || 'A ser gerado'}`;
    
    showModal('editMusicModal');
}

// ===== ELO RANKING MODAL =====
function showELORanking() {
    console.log('showELORanking chamado');
    if (!state.playlist || state.playlist.length === 0) {
        showToast('Nenhuma música para ranking', 'warning');
        return;
    }
    
    const ranked = [...state.playlist].sort((a, b) => (b.elo_rating || 1400) - (a.elo_rating || 1400));
    
    let rankingHTML = `
        <table class="elo-ranking-table">
            <thead>
                <tr>
                    <th>#</th>
                    <th>Música</th>
                    <th>Artista</th>
                    <th>Rating</th>
                    <th>Nível</th>
                    <th>Tendência</th>
                    <th>Retorno</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    ranked.forEach((music, index) => {
        const eloRating = music.elo_rating || 1400;
        const eloLevel = getELOLevel(eloRating);
        const eloColor = getELOColor(eloRating);
        const trend = getELOTrend(music);
        const trendClass = trend.includes('Subindo') ? 'elo-trend-up' : (trend.includes('Descendo') ? 'elo-trend-down' : 'elo-trend-stable');
        
        rankingHTML += `
            <tr>
                <td><strong>${index + 1}º</strong></td>
                <td>${music.titulo || 'Sem título'}</td>
                <td>${music.artista || 'Desconhecido'}</td>
                <td><strong style="color: ${eloColor}">${eloRating}</strong></td>
                <td><span class="elo-badge" style="background-color: ${eloColor};">${eloLevel}</span></td>
                <td class="${trendClass}">${trend}</td>
                <td class="text-success">+${music.rentabilidade_media || 0}%</td>
            </tr>
        `;
    });
    
    rankingHTML += `
            </tbody>
        </table>
    `;
    
    document.getElementById('eloRankingContent').innerHTML = rankingHTML;
    showModal('eloRankingModal');
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
    window.openAddBalanceModal = openAddBalanceModal;
    window.setBalanceAmount = setBalanceAmount;
    window.validateBalanceAmount = validateBalanceAmount;
    window.processBalanceAdd = processBalanceAdd;
    window.openWithdrawalModal = openWithdrawalModal;
    window.validateWithdrawalAmount = validateWithdrawalAmount;
    window.openAddMusicModal = openAddMusicModal;
    window.openAddExternalMusicModal = openAddExternalMusicModal;
    window.openCreatePlaylistModal = openCreatePlaylistModal;
    window.viewContract = viewContract;
    window.printContract = printContract;
    window.openEditMusicModal = openEditMusicModal;
    window.showELORanking = showELORanking;
}
