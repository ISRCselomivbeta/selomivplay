// ============================================================
// PORTFOLIO.JS - Carteira e Investimentos
// ============================================================

// ===== CARREGAR PORTFOLIO =====
async function loadPortfolio(silent = false) {
    if (!state.currentUser) return;
    
    try {
        const result = await callAPI('get_carteira', { user_id: state.currentUser.id });
        
        if (result?.success && result?.data) {
            if (Array.isArray(result.data)) {
                state.portfolioAssets = result.data;
            } else if (result.data && typeof result.data === 'object') {
                state.portfolioAssets = result.data.investimentos || [];
            } else {
                state.portfolioAssets = [];
            }
        } else {
            state.portfolioAssets = [];
        }
    } catch (error) {
        console.error('Erro ao carregar portfólio:', error);
        state.portfolioAssets = [];
    }
    
    renderPortfolio();
    updatePortfolioValue();
}

// ===== RENDERIZAR PORTFOLIO =====
function renderPortfolio() {
    const container = document.getElementById('portfolioContent');
    if (!container) return;
    
    const assets = Array.isArray(state.portfolioAssets) ? state.portfolioAssets : [];
    
    document.getElementById('assetsCount').textContent = `${assets.length} ativo${assets.length !== 1 ? 's' : ''}`;
    
    if (!assets.length) {
        container.innerHTML = '<div class="empty-state-actionable" style="grid-column: 1/-1;"><i class="bi bi-briefcase empty-icon"></i><h5 class="text-muted">Nenhum investimento</h5><p class="text-muted">Você ainda não investiu em nenhuma música</p><button class="btn-miv mt-3" onclick="changeSection(\'marketplace\')"><i class="bi bi-shop me-2"></i> Explorar Marketplace</button></div>';
        return;
    }
    
    let totalInvestido = 0;
    let valorAtualTotal = 0;
    
    assets.forEach(asset => {
        const valorInvestido = asset.valor_total || 0;
        totalInvestido += valorInvestido;
        
        const music = state.playlist.find(m => m.id === asset.music_id);
        if (music && music.valor_acao) {
            const valorAtual = (asset.quantidade || 0) * music.valor_acao;
            valorAtualTotal += valorAtual;
        } else {
            valorAtualTotal += valorInvestido;
        }
    });
    
    const profit = valorAtualTotal - totalInvestido;
    const profitPercent = totalInvestido > 0 ? (profit / totalInvestido * 100) : 0;
    
    container.innerHTML = `
        <div class="artist-stats mb-4" style="grid-column: 1/-1;">
            <div class="stat-card">
                <div class="stat-icon"><i class="bi bi-cash-stack"></i></div>
                <div class="stat-value">${formatCurrency(totalInvestido)}</div>
                <div class="stat-label">Total Investido</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon"><i class="bi bi-graph-up-arrow"></i></div>
                <div class="stat-value">${formatCurrency(valorAtualTotal)}</div>
                <div class="stat-label">Valor Atual</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon"><i class="bi bi-arrow-up-right ${profit >= 0 ? 'text-success' : 'text-danger'}"></i></div>
                <div class="stat-value ${profit >= 0 ? 'text-success' : 'text-danger'}">
                    ${formatCurrency(profit)} (${profitPercent.toFixed(1)}%)
                </div>
                <div class="stat-label">Lucro/Prejuízo</div>
            </div>
        </div>
    `;
    
    container.innerHTML += assets.map((asset) => {
        const music = state.playlist.find(m => m.id === asset.music_id) || {};
        const valorInvestido = asset.valor_total || 0;
        const quantidade = asset.quantidade || 0;
        
        let valorAtual = valorInvestido;
        let profitVal = 0;
        let profitPerc = 0;
        
        if (music.valor_acao) {
            valorAtual = quantidade * music.valor_acao;
            profitVal = valorAtual - valorInvestido;
            profitPerc = valorInvestido > 0 ? (profitVal / valorInvestido * 100) : 0;
        }
        
        let coverImage = CONFIG.PLACEHOLDERS.MIV_300;
        if (music.link_capa?.trim()) {
            coverImage = music.link_capa.trim();
        } else if (music.link_youtube) {
            const videoId = extractYouTubeId(music.link_youtube);
            if (videoId) coverImage = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        }
        
        const musicIndex = state.playlist.findIndex(m => m.id === music.id);
        
        return `
        <div class="spotify-card" onclick="playTrack(${musicIndex})">
            <div class="spotify-cover">
                <img src="${coverImage}" alt="${music.titulo || 'Música'}" 
                     onerror="this.src='${CONFIG.PLACEHOLDERS.MIV_300}'">
                <div class="play-overlay" onclick="event.stopPropagation(); playTrack(${musicIndex})">
                    <i class="bi bi-play-fill"></i>
                </div>
            </div>
            <h3 class="spotify-title">${music.titulo || 'Sem título'}</h3>
            <p class="spotify-artist">${music.artista || 'Artista'}</p>
            
            <div class="spotify-stats">
                <span class="spotify-elo">${quantidade} ações</span>
                <span class="spotify-price">${formatCurrency(valorAtual)}</span>
            </div>
            
            <div style="margin-top: 8px;">
                <span class="badge ${profitVal >= 0 ? 'badge-success' : 'badge-danger'}">
                    ${profitVal >= 0 ? '+' : ''}${profitPerc.toFixed(1)}%
                </span>
            </div>
            
            <button class="btn-invest" onclick="event.stopPropagation(); openTradeModal({
                music_id: '${asset.music_id}',
                music_title: '${music.titulo || ''}',
                artist: '${music.artista || ''}',
                quantidade: ${quantidade},
                valor_acao: ${music.valor_acao || 0},
                valor_investido: ${valorInvestido}
            })">
                <i class="bi bi-arrow-left-right me-1"></i> NEGOCIAR
            </button>
            
            ${asset.blockchain_hash ? '<div class="blockchain-hash mt-2">⛓️ ' + asset.blockchain_hash.substring(0, 10) + '...</div>' : ''}
        </div>`;
    }).join('');
}

// ===== UPDATE PORTFOLIO VALUE =====
function updatePortfolioValue() {
    const el = document.getElementById('portfolioValue');
    if (!el) return;
    
    let totalValue = 0;
    const assets = Array.isArray(state.portfolioAssets) ? state.portfolioAssets : [];
    
    assets.forEach(asset => {
        const music = state.playlist.find(m => m.id === asset.music_id);
        if (music && music.valor_acao) {
            totalValue += (asset.quantidade || 0) * music.valor_acao;
        } else {
            totalValue += asset.valor_total || 0;
        }
    });
    
    el.textContent = formatCurrency(totalValue);
    
    const updateEl = document.getElementById('portfolioUpdateTime');
    if (updateEl) {
        updateEl.textContent = `Atualizado: ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    }
}

// ===== EXPORT =====
if (typeof window !== 'undefined') {
    window.loadPortfolio = loadPortfolio;
    window.renderPortfolio = renderPortfolio;
    window.updatePortfolioValue = updatePortfolioValue;
}
