// ============================================================
// BLOCKCHAIN.JS - Blockchain Explorer
// ============================================================

async function loadBlockchainData() {
    console.log('🔍 Carregando blockchain com dados REAIS...');
    try {
        const contractsList = document.getElementById('blockchainContractsList');
        const transactionsList = document.getElementById('blockchainTransactionsList');
        const visualization = document.getElementById('blockchainVisualization');
        if (contractsList) { contractsList.innerHTML = '<tr><td colspan="6" class="text-center py-4"><div class="spinner-border text-success"></div><p class="mt-2">Buscando blocos reais...</p></td></tr>'; }
        let blocksResult = await callAPI('get_mining_blocks', { limit: 20 });
        console.log('📦 Blocos de streaming (reais):', blocksResult);
        if (!blocksResult?.success || !blocksResult?.data || blocksResult.data.length === 0) {
            console.log('🔄 Buscando investimentos da carteira...');
            const carteiraResult = await callAPI('get_carteira', { limit: 20 });
            if (carteiraResult?.success && carteiraResult.data) {
                const investimentos = Array.isArray(carteiraResult.data) ? carteiraResult.data : (carteiraResult.data.investimentos || []);
                blocksResult = { success: true, data: investimentos.map((inv, index) => ({ block_index: 1000 + index, block_hash: inv.hash_transacao || '0x' + Date.now().toString(16) + index, previous_hash: '0x' + (Date.now() - 1000).toString(16), timestamp: inv.data_compra || new Date().toISOString(), music_title: `Investimento #${index + 1}`, reward_amount: inv.valor_total || 0, miner_user_id: inv.user_id || 'investidor' })) };
                console.log('📦 Dados da carteira convertidos:', blocksResult.data.length, 'itens');
            }
        }
        if (!blocksResult?.data || blocksResult.data.length === 0) {
            console.log('🔄 Buscando negociações...');
            const tradesResult = await callAPI('get_trades', { limit: 20 });
            if (tradesResult?.success && tradesResult.data) {
                const todasTrades = [...(tradesResult.data.received || []), ...(tradesResult.data.sent || []), ...(tradesResult.data.history || [])];
                blocksResult = { success: true, data: todasTrades.map((trade, index) => ({ block_index: 2000 + index, block_hash: trade.blockchain_hash || '0x' + Date.now().toString(16) + index, previous_hash: '0x' + (Date.now() - 2000).toString(16), timestamp: trade.timestamp || new Date().toISOString(), music_title: trade.music_title || 'Negociação', reward_amount: trade.total || 0, miner_user_id: trade.seller_id || trade.buyer_id || 'trader' })) };
                console.log('📦 Negociações convertidas:', blocksResult.data.length, 'itens');
            }
        }
        if (blocksResult?.data && blocksResult.data.length > 0) {
            console.log('✅ Dados REAIS carregados:', blocksResult.data.length, 'blocos');
            document.getElementById('blockchainContractsCount').textContent = blocksResult.data.length;
            document.getElementById('blockchainLastBlock').textContent = blocksResult.data.length;
            document.getElementById('currentBlockNumber').textContent = blocksResult.data.length;
            if (contractsList) {
                contractsList.innerHTML = blocksResult.data.slice(0, 10).map((block, index) => {
                    const blockHash = block.block_hash || block.hash || 'hash_' + index;
                    const blockPrevHash = block.previous_hash || block.previousHash || '0x0';
                    const blockMusic = block.music_title || block.music_name || 'Bloco Real';
                    const blockValue = block.reward_amount || block.valor_total || block.total || 0;
                    return `<tr><td><span class="blockchain-hash" title="${blockHash}">${blockHash.substring(0, 15)}...</span></td><td>${new Date(block.timestamp || Date.now()).toLocaleDateString('pt-BR')}</td><td>${blockMusic}</td><td>${formatCurrency(blockValue)}</td><td><span class="blockchain-verified"><i class="bi bi-shield-check"></i> Real</span></td><td><span class="text-muted small">${blockPrevHash.substring(0, 10)}...</span></td></tr>`;
                }).join('');
            }
            renderBlockchainVisualization(blocksResult.data);
        } else {
            console.log('⚠️ NENHUM dado real encontrado - usando simulados para demonstração');
            if (visualization) {
                visualization.innerHTML = `<div class="text-center text-muted py-4"><i class="bi bi-info-circle fs-1 d-block mb-3"></i><h5>Nenhum bloco real encontrado</h5><p class="small">Para gerar blocos reais:</p><ul class="list-unstyled mt-3"><li class="mb-2">🎵 <strong>Ouça músicas</strong> - Cada 30s de streaming minera um bloco</li><li class="mb-2">💰 <strong>Invista</strong> - Cada compra de ações gera um bloco</li><li class="mb-2">🤝 <strong>Negocie</strong> - Cada trade aceito gera um bloco</li></ul><button class="btn btn-outline-success mt-3" onclick="gerarBlocosSimuladosParaVisualizacao()"><i class="bi bi-magic me-2"></i>Ver exemplo (simulado)</button></div>`;
            }
            const blocosSimulados = gerarBlocosSimulados(5);
            renderBlockchainVisualization(blocosSimulados);
        }
    } catch (error) {
        console.error('❌ Erro ao carregar blockchain:', error);
        const contractsList = document.getElementById('blockchainContractsList');
        if (contractsList) { contractsList.innerHTML = gerarDadosSimulados(); }
        const transactionsList = document.getElementById('blockchainTransactionsList');
        if (transactionsList) { transactionsList.innerHTML = gerarTransacoesSimuladas(); }
        renderBlockchainVisualization(gerarBlocosSimulados(5));
    }
}

function renderBlockchainVisualization(contracts) {
    const container = document.getElementById('blockchainVisualization');
    if (!container) return;
    if (!contracts || contracts.length === 0) {
        container.innerHTML = `<div class="text-center text-muted py-4"><i class="bi bi-link-45deg fs-1 d-block mb-3"></i><h5>Nenhum bloco encontrado</h5><p class="small">Os primeiros blocos aparecerão quando houver investimentos</p><button class="btn btn-outline-success btn-sm mt-2" onclick="gerarBlocosSimuladosParaVisualizacao()"><i class="bi bi-magic me-2"></i>Gerar blocos de exemplo</button></div>`;
        return;
    }
    const hasValidBlocks = contracts.some(b => b.block_hash || b.hash);
    if (!hasValidBlocks) {
        container.innerHTML = `<div class="alert alert-info bg-dark border-info"><i class="bi bi-info-circle me-2"></i>Mostrando ranking de mineração. Clique em "Gerar blocos" para ver a visualização.</div><div class="text-center mt-3"><button class="btn btn-outline-success" onclick="gerarBlocosSimuladosParaVisualizacao()"><i class="bi bi-magic me-2"></i>Gerar blocos de exemplo</button></div>`;
        return;
    }
    const lastBlocks = contracts.slice(-5);
    container.innerHTML = '';
    function criarBloco(block, index, isLast) {
        const blockHash = block?.block_hash || block?.hash || '0x' + Date.now().toString(16).substring(0, 16);
        const blockPrevHash = block?.previous_hash || block?.previousHash || '0x' + (index).toString(16).padStart(16, '0');
        const blockIndex = block?.block_index || block?.index || index + 1;
        const blockMusic = block?.music_title || block?.music_name || block?.music_id || 'Bloco';
        const blockDiv = document.createElement('div');
        blockDiv.className = `card bg-dark border-${isLast ? 'success' : 'purple'}`;
        blockDiv.style.width = '200px';
        blockDiv.style.flexShrink = '0';
        blockDiv.innerHTML = `<div class="card-header bg-${isLast ? 'success' : 'purple'} text-white py-2"><small class="d-flex justify-content-between align-items-center"><span>Bloco #${blockIndex}</span>${isLast ? '<i class="bi bi-check-circle-fill"></i>' : ''}</small></div><div class="card-body p-2"><small class="d-block text-muted">Hash:</small><small class="blockchain-hash d-block mb-2" style="font-size: 10px; word-break: break-all;" title="${blockHash}">${blockHash.substring(0, 15)}...</small><small class="d-block text-muted">Prev:</small><small class="text-muted" style="font-size: 10px; word-break: break-all;" title="${blockPrevHash}">${blockPrevHash.substring(0, 10)}...</small><div class="mt-2 text-center"><span class="badge bg-${isLast ? 'success' : 'secondary'}"><i class="bi bi-music-note-beamed me-1"></i>${blockMusic.length > 15 ? blockMusic.substring(0, 12) + '...' : blockMusic}</span></div></div>`;
        return blockDiv;
    }
    lastBlocks.forEach((block, idx) => {
        const isLast = idx === lastBlocks.length - 1;
        container.appendChild(criarBloco(block, idx, isLast));
        if (idx < lastBlocks.length - 1) {
            const arrowDiv = document.createElement('div');
            arrowDiv.className = 'd-flex align-items-center';
            arrowDiv.innerHTML = '<i class="bi bi-arrow-right fs-2 text-purple"></i>';
            container.appendChild(arrowDiv);
        }
    });
    if (lastBlocks.length > 0) {
        const arrowDiv = document.createElement('div');
        arrowDiv.className = 'd-flex align-items-center';
        arrowDiv.innerHTML = '<i class="bi bi-arrow-right fs-2 text-purple"></i>';
        container.appendChild(arrowDiv);
        const nextBlockDiv = document.createElement('div');
        nextBlockDiv.className = 'card bg-dark border-purple';
        nextBlockDiv.style.width = '200px';
        nextBlockDiv.style.flexShrink = '0';
        nextBlockDiv.style.opacity = '0.7';
        nextBlockDiv.innerHTML = `<div class="card-header bg-purple text-white py-2"><small>Próximo Bloco</small></div><div class="card-body p-2 text-center"><i class="bi bi-plus-circle text-muted fs-4"></i><small class="d-block text-muted mt-2">Aguardando mineração</small><div class="progress-loading mt-2" style="max-width: 100%;"><div class="progress-loading-bar"></div></div></div>`;
        container.appendChild(nextBlockDiv);
    }
}

function gerarBlocosSimulados(quantidade = 5) {
    const blocos = [];
    const musicas = ['Bohemian Rhapsody - Queen', 'Blinding Lights - The Weeknd', 'Lose Yourself - Eminem', 'Shape of You - Ed Sheeran', 'Rolling in the Deep - Adele', 'Hotel California - Eagles', 'Imagine - John Lennon', 'Smells Like Teen Spirit - Nirvana'];
    for (let i = 0; i < quantidade; i++) {
        const timestamp = new Date(Date.now() - i * 3600000).toISOString();
        const hash = '0x' + (Date.now() + i).toString(16).padStart(16, '0');
        const prevHash = i === 0 ? '0'.repeat(64) : '0x' + (Date.now() + i - 1).toString(16).padStart(16, '0');
        blocos.push({ block_index: 100 + i, block_hash: hash, previous_hash: prevHash, timestamp: timestamp, music_title: musicas[i % musicas.length], miner_user_id: 'miner_' + (1000 + i), reward_amount: (Math.random() * 5 + 0.5).toFixed(2), stream_quality: 'SIMULATED' });
    }
    return blocos;
}

function gerarDadosSimulados() {
    return `<tr><td colspan="6" class="text-center py-4"><i class="bi bi-link-45deg fs-1 text-muted d-block mb-3"></i><span class="text-muted">🔗 Dados simulados para demonstração</span><button class="btn btn-sm btn-outline-success mt-3" onclick="gerarBlocosSimuladosParaVisualizacao()"><i class="bi bi-magic me-2"></i> Gerar blocos de exemplo</button></td></tr>`;
}

function gerarTransacoesSimuladas() {
    const transacoes = [];
    const tipos = ['🎵 Royalty', '💰 Investimento', '💸 Streaming', '⛓️ Contrato'];
    for (let i = 0; i < 5; i++) {
        const hash = '0x' + (Date.now() + i).toString(16).substring(0, 16);
        transacoes.push(`<tr><td><span class="blockchain-hash">${hash.substring(0, 15)}...</span></td><td>${new Date(Date.now() - i * 3600000).toLocaleString()}</td><td>${tipos[i % tipos.length]}</td><td>Transação simulada #${i+1}</td><td><span class="badge bg-success">Confirmada</span></td></tr>`);
    }
    return transacoes.join('');
}

function gerarBlocosSimuladosParaVisualizacao() {
    const blocos = gerarBlocosSimulados(5);
    renderBlockchainVisualization(blocos);
    showToast('Blocos de exemplo gerados!', 'success');
}

// ===== EXPORT =====
if (typeof window !== 'undefined') {
    window.loadBlockchainData = loadBlockchainData;
    window.renderBlockchainVisualization = renderBlockchainVisualization;
    window.gerarBlocosSimulados = gerarBlocosSimulados;
    window.gerarDadosSimulados = gerarDadosSimulados;
    window.gerarTransacoesSimuladas = gerarTransacoesSimuladas;
    window.gerarBlocosSimuladosParaVisualizacao = gerarBlocosSimuladosParaVisualizacao;
}
