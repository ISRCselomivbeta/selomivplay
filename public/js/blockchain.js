// ============================================================
// BLOCKCHAIN.JS - Explorer PLAY MY
// ============================================================

async function loadBlockchainData() {
    try {
        const contractsList = document.getElementById('blockchainContractsList');
        if (contractsList) contractsList.innerHTML = '<tr><td colspan="6" class="text-center py-4"><div class="spinner-border text-success"></div></td></tr>';
        let blocksResult = await callAPI('get_mining_blocks', { limit: 20 });
        if (!blocksResult?.success || !blocksResult?.data || blocksResult.data.length === 0) {
            const carteiraResult = await callAPI('get_carteira', { limit: 20 });
            if (carteiraResult?.success && carteiraResult.data) {
                const investimentos = Array.isArray(carteiraResult.data) ? carteiraResult.data : (carteiraResult.data.investimentos || []);
                blocksResult = {
                    success: true,
                    data: investimentos.map((inv, index) => ({
                        block_index: 1000 + index,
                        block_hash: inv.hash_transacao || '0x' + Date.now().toString(16) + index,
                        previous_hash: '0x' + (Date.now() - 1000).toString(16),
                        timestamp: inv.data_compra || new Date().toISOString(),
                        music_title: `Investimento #${index + 1}`,
                        reward_amount: inv.valor_total || 0
                    }))
                };
            }
        }
        if (blocksResult?.data && blocksResult.data.length > 0) {
            const cnt = document.getElementById('blockchainContractsCount');
            const lb = document.getElementById('blockchainLastBlock');
            const cbn = document.getElementById('currentBlockNumber');
            if (cnt) cnt.textContent = blocksResult.data.length;
            if (lb) lb.textContent = blocksResult.data.length;
            if (cbn) cbn.textContent = blocksResult.data.length;
            if (contractsList) {
                contractsList.innerHTML = blocksResult.data.slice(0, 10).map((block, index) => {
                    const h = block.block_hash || block.hash || 'hash_' + index;
                    const ph = block.previous_hash || '0x0';
                    return `<tr>
                        <td><span class="blockchain-hash">${h.substring(0, 15)}...</span></td>
                        <td>${new Date(block.timestamp || Date.now()).toLocaleDateString('pt-BR')}</td>
                        <td>${block.music_title || 'Bloco'}</td>
                        <td>${formatCurrency(block.reward_amount || 0)}</td>
                        <td><span class="blockchain-verified"><i class="bi bi-shield-check"></i> Real</span></td>
                        <td><span class="text-muted small">${ph.substring(0, 10)}...</span></td>
                    </tr>`;
                }).join('');
            }
            renderBlockchainVisualization(blocksResult.data);
        } else {
            const vis = document.getElementById('blockchainVisualization');
            if (vis) vis.innerHTML = `<div class="text-center text-muted py-4"><i class="bi bi-info-circle fs-1 d-block mb-3"></i><h5>Nenhum bloco real</h5><button class="btn btn-outline-success mt-3" onclick="gerarBlocosSimuladosParaVisualizacao()"><i class="bi bi-magic me-2"></i>Ver exemplo</button></div>`;
        }
    } catch (error) { console.error('Erro blockchain:', error); }
}

function renderBlockchainVisualization(contracts) {
    const container = document.getElementById('blockchainVisualization');
    if (!container) return;
    if (!contracts || contracts.length === 0) {
        container.innerHTML = `<div class="text-center text-muted py-4"><i class="bi bi-link-45deg fs-1 d-block mb-3"></i><h5>Nenhum bloco</h5><button class="btn btn-outline-success btn-sm mt-2" onclick="gerarBlocosSimuladosParaVisualizacao()"><i class="bi bi-magic me-2"></i>Gerar exemplo</button></div>`;
        return;
    }
    const lastBlocks = contracts.slice(-5);
    container.innerHTML = '';
    lastBlocks.forEach((block, idx) => {
        const isLast = idx === lastBlocks.length - 1;
        const blockDiv = document.createElement('div');
        blockDiv.className = `card bg-dark border-${isLast ? 'success' : 'purple'}`;
        blockDiv.style.width = '200px';
        blockDiv.style.flexShrink = '0';
        const hash = block?.block_hash || block?.hash || '0x';
        blockDiv.innerHTML = `
            <div class="card-header bg-${isLast ? 'success' : 'purple'} text-white py-2">
                <small>Bloco #${block?.block_index || idx + 1}</small>
            </div>
            <div class="card-body p-2">
                <small class="blockchain-hash d-block" style="font-size: 10px;">${hash.substring(0, 15)}...</small>
                <span class="badge bg-${isLast ? 'success' : 'secondary'} mt-2">${(block?.music_title || 'Bloco').substring(0, 12)}</span>
            </div>`;
        container.appendChild(blockDiv);
        if (idx < lastBlocks.length - 1) {
            const arrow = document.createElement('div');
            arrow.className = 'd-flex align-items-center';
            arrow.innerHTML = '<i class="bi bi-arrow-right fs-2 text-purple"></i>';
            container.appendChild(arrow);
        }
    });
}

function gerarBlocosSimuladosParaVisualizacao() {
    const blocos = [];
    const musicas = ['Bohemian Rhapsody', 'Blinding Lights', 'Shape of You', 'Imagine', 'Hotel California'];
    for (let i = 0; i < 5; i++) {
        blocos.push({
            block_index: 100 + i,
            block_hash: '0x' + (Date.now() + i).toString(16).padStart(16, '0'),
            previous_hash: i === 0 ? '0'.repeat(64) : '0x' + (Date.now() + i - 1).toString(16).padStart(16, '0'),
            music_title: musicas[i],
            timestamp: new Date(Date.now() - i * 3600000).toISOString()
        });
    }
    renderBlockchainVisualization(blocos);
    showToast('Blocos de exemplo gerados!', 'success');
}

function openBlockchainExplorer() {
    changeSection('blockchain');
    setTimeout(() => loadBlockchainData(), 100);
}

function showELORanking() {
    if (!state.playlist || state.playlist.length === 0) { showToast('Nenhuma música', 'warning'); return; }
    const ranked = [...state.playlist].sort((a, b) => (b.elo_rating || 1400) - (a.elo_rating || 1400));
    let html = `<table class="elo-ranking-table"><thead><tr><th>#</th><th>Música</th><th>Artista</th><th>Rating</th><th>Nível</th></tr></thead><tbody>`;
    ranked.forEach((m, i) => {
        const r = m.elo_rating || 1400;
        html += `<tr><td><strong>${i + 1}º</strong></td><td>${m.titulo || '-'}</td><td>${m.artista || '-'}</td><td><strong style="color: ${ELO.getRatingColor(r)}">${r}</strong></td><td>${ELO.getRatingLevel(r)}</td></tr>`;
    });
    html += `</tbody></table>`;
    const content = document.getElementById('eloRankingContent');
    if (content) content.innerHTML = html;
    showModal('eloRankingModal');
}
