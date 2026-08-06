// ============================================================
// TRADES.JS - Negociações P2P
// ============================================================

let currentTradeAsset = null;
let tradeOffers = { received: [], sent: [], history: [] };

// ===== ABRIR MODAL DE NEGOCIAÇÃO =====
function openTradeModal(asset) {
    if (!state.currentUser) {
        showToast('Faça login para negociar', 'error');
        return;
    }
    
    currentTradeAsset = asset;
    
    document.getElementById('tradeMusicTitle').textContent = asset.music_title || 'Música';
    document.getElementById('tradeMusicArtist').textContent = asset.artist || 'Artista';
    document.getElementById('tradeSharesOwned').textContent = asset.quantidade || 0;
    document.getElementById('tradeCurrentPrice').textContent = formatCurrency(asset.valor_acao || 0);
    document.getElementById('tradeInvestedValue').textContent = formatCurrency(asset.valor_investido || 0);
    document.getElementById('tradeCurrentValue').textContent = formatCurrency((asset.quantidade || 0) * (asset.valor_acao || 0));
    document.getElementById('tradeMaxQuantity').textContent = `Máximo disponível: ${asset.quantidade || 0} ações`;
    
    document.getElementById('tradeQuantity').value = 1;
    document.getElementById('tradePrice').value = asset.valor_acao || 10;
    document.getElementById('tradeBuyerEmail').value = '';
    document.getElementById('tradeMessage').value = '';
    document.getElementById('userSearchResults').innerHTML = '';
    
    updateTradeCalculation();
    showModal('tradeModal');
}

function adjustTradeQuantity(amount) {
    const input = document.getElementById('tradeQuantity');
    const max = currentTradeAsset?.quantidade || 0;
    let newValue = parseInt(input.value) + amount;
    newValue = Math.max(1, Math.min(max, newValue));
    input.value = newValue;
    updateTradeCalculation();
}

function updateTradeCalculation() {
    const qty = parseInt(document.getElementById('tradeQuantity').value) || 1;
    const price = parseFloat(document.getElementById('tradePrice').value) || 0;
    const total = qty * price;
    document.getElementById('tradeTotalDisplay').textContent = formatCurrency(total);
}

// ===== BUSCAR USUÁRIO =====
async function searchUserByEmail() {
    const email = document.getElementById('tradeBuyerEmail').value.trim();
    const resultsDiv = document.getElementById('userSearchResults');
    
    if (!email || email.length < 3) {
        resultsDiv.innerHTML = '';
        return;
    }
    
    resultsDiv.innerHTML = '<div class="p-3 text-center"><div class="spinner-border spinner-border-sm text-info"></div> Buscando...</div>';
    
    try {
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Exemplo - na prática, isso viria da API
        const users = [
            { id: 'user1', nome: 'João Silva', email: 'joao@email.com' },
            { id: 'user2', nome: 'Maria Santos', email: 'maria@email.com' },
            { id: 'user3', nome: 'Pedro Oliveira', email: 'pedro@email.com' }
        ].filter(u => u.email.includes(email) || u.nome.toLowerCase().includes(email.toLowerCase()));
        
        if (users.length === 0) {
            resultsDiv.innerHTML = '<div class="p-3 text-center text-muted">Nenhum usuário encontrado</div>';
            return;
        }
        
        resultsDiv.innerHTML = users.map(user => `
            <div class="user-search-result p-3 border-bottom" onclick="selectUser('${user.id}', '${user.nome}', '${user.email}')">
                <div class="d-flex align-items-center">
                    <div class="bg-info rounded-circle p-2 me-2" style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
                        <span class="text-dark fw-bold">${user.nome.charAt(0)}</span>
                    </div>
                    <div>
                        <strong>${user.nome}</strong><br>
                        <small class="text-muted">${user.email}</small>
                    </div>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Erro ao buscar usuários:', error);
        resultsDiv.innerHTML = '<div class="p-3 text-center text-danger">Erro ao buscar usuários</div>';
    }
}

function selectUser(userId, userName, userEmail) {
    document.getElementById('tradeBuyerEmail').value = userEmail;
    document.getElementById('userSearchResults').innerHTML = `
        <div class="p-3 bg-info bg-opacity-10 rounded-3">
            <i class="bi bi-check-circle-fill text-info me-2"></i>
            Negociando com: <strong>${userName}</strong>
        </div>
    `;
}

// ===== CRIAR OFERTA =====
async function createTradeOffer() {
    if (!state.currentUser || !currentTradeAsset) {
        showToast('Erro ao criar oferta', 'error');
        return;
    }
    
    const buyerEmail = document.getElementById('tradeBuyerEmail').value.trim();
    if (!buyerEmail) {
        showToast('Digite o email do comprador', 'error');
        return;
    }
    
    const quantity = parseInt(document.getElementById('tradeQuantity').value) || 1;
    const price = parseFloat(document.getElementById('tradePrice').value) || 0;
    const message = document.getElementById('tradeMessage').value.trim();
    
    if (quantity > (currentTradeAsset.quantidade || 0)) {
        showToast(`Você só tem ${currentTradeAsset.quantidade} ações`, 'error');
        return;
    }
    
    if (price <= 0) {
        showToast('Preço inválido', 'error');
        return;
    }
    
    const total = quantity * price;
    
    const btn = document.getElementById('createTradeBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="bi bi-arrow-clockwise spin"></i> Enviando...';
    
    try {
        const result = await callAPI('create_trade', {
            seller_id: state.currentUser.id,
            buyer_email: buyerEmail,
            music_id: currentTradeAsset.music_id,
            quantity: quantity,
            price: price,
            total: total,
            message: message
        });
        
        if (result?.success) {
            showToast('Oferta enviada com sucesso!', 'success');
            closeModal('tradeModal');
            await loadTradeOffers();
        } else {
            showToast(result?.message || 'Erro ao enviar oferta', 'error');
        }
        
    } catch (error) {
        console.error('Erro ao criar oferta:', error);
        showToast('Erro ao enviar oferta: ' + (error.message || 'erro desconhecido'), 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-send me-2"></i> Enviar Oferta';
    }
}

// ===== CARREGAR OFERTAS =====
async function loadTradeOffers() {
    const loading = document.getElementById('tradesLoading');
    const empty = document.getElementById('tradesEmpty');
    const container = document.getElementById('tradesContainer');
    const pendingBadge = document.getElementById('pendingTradesCount');
    
    if (loading) loading.style.display = 'block';
    if (empty) empty.style.display = 'none';
    if (container) container.innerHTML = '';
    
    try {
        if (!state.currentUser || !state.currentUser.id) {
            throw new Error('Usuário não logado');
        }
        
        const result = await callAPI('get_trades', { user_id: state.currentUser.id });
        
        if (result?.success && result.data) {
            tradeOffers = {
                received: result.data.received || [],
                sent: result.data.sent || [],
                history: result.data.history || []
            };
            
            const pendingCount = 
                (tradeOffers.received?.filter(o => o.status === 'pending')?.length || 0) +
                (tradeOffers.sent?.filter(o => o.status === 'pending')?.length || 0);
            
            if (pendingBadge) {
                if (pendingCount > 0) {
                    pendingBadge.textContent = pendingCount;
                    pendingBadge.style.display = 'inline';
                } else {
                    pendingBadge.style.display = 'none';
                }
            }
            
            renderTradeOffers('received');
        } else {
            tradeOffers = { received: [], sent: [], history: [] };
            if (empty) empty.style.display = 'block';
        }
        
    } catch (error) {
        console.error('❌ Erro ao carregar negociações:', error);
        if (empty) {
            empty.style.display = 'block';
            empty.innerHTML = `
                <i class="bi bi-exclamation-triangle empty-icon text-danger"></i>
                <h5 class="text-muted">Erro ao carregar</h5>
                <p class="text-muted">${error.message || 'Tente novamente mais tarde'}</p>
                <button class="btn btn-outline-danger mt-3" onclick="loadTradeOffers()">
                    <i class="bi bi-arrow-clockwise me-2"></i> Tentar novamente
                </button>
            `;
        }
    } finally {
        if (loading) loading.style.display = 'none';
    }
}

// ===== RENDERIZAR OFERTAS =====
function renderTradeOffers(type) {
    const container = document.getElementById('tradesContainer');
    const empty = document.getElementById('tradesEmpty');
    const offers = tradeOffers[type] || [];
    
    if (offers.length === 0) {
        container.innerHTML = '';
        empty.style.display = 'block';
        return;
    }
    
    empty.style.display = 'none';
    
    container.innerHTML = offers.map(offer => {
        const isReceived = type === 'received';
        const isSent = type === 'sent';
        
        let statusClass = 'pending';
        let statusText = '⏳ Aguardando';
        
        if (offer.status === 'accepted') {
            statusClass = 'accepted';
            statusText = '✅ Aceita';
        } else if (offer.status === 'declined') {
            statusClass = 'declined';
            statusText = '❌ Recusada';
        } else if (offer.status === 'cancelled') {
            statusClass = 'declined';
            statusText = '⛔ Cancelada';
        }
        
        let dataFormatada = 'Data não disponível';
        const dataOriginal = offer.timestamp || offer.created_at || offer.updated_at || offer.data;
        
        if (dataOriginal) {
            try {
                const data = new Date(dataOriginal);
                if (!isNaN(data.getTime())) {
                    dataFormatada = data.toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                }
            } catch (e) {}
        }
        
        const precoFormatado = formatCurrency(offer.price || 0);
        const totalFormatado = formatCurrency(offer.total || 0);
        
        return `
        <div class="trade-offer-card bg-dark p-4 mb-3 rounded-3 border border-secondary ${offer.status}">
            <div class="d-flex justify-content-between align-items-start mb-3">
                <div>
                    <h5 class="text-white mb-1">${offer.music_title || 'Música'}</h5>
                    <p class="text-muted small">${offer.artist || 'Artista'}</p>
                </div>
                <span class="badge bg-${offer.status === 'pending' ? 'warning' : (offer.status === 'accepted' ? 'success' : 'danger')}">
                    ${statusText}
                </span>
            </div>
            
            <div class="row g-3 mb-3">
                <div class="col-md-4">
                    <div class="bg-black bg-opacity-50 p-2 rounded text-center">
                        <small class="text-muted d-block">Quantidade</small>
                        <strong>${offer.quantity || 0} ações</strong>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="bg-black bg-opacity-50 p-2 rounded text-center">
                        <small class="text-muted d-block">Preço unitário</small>
                        <strong class="text-info">${precoFormatado}</strong>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="bg-black bg-opacity-50 p-2 rounded text-center">
                        <small class="text-muted d-block">Total</small>
                        <strong class="text-warning">${totalFormatado}</strong>
                    </div>
                </div>
            </div>
            
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    ${isReceived ? `
                        <div class="d-flex align-items-center">
                            <i class="bi bi-person text-info me-2"></i>
                            <span>${offer.seller_name || 'Vendedor'}</span>
                            <small class="text-muted ms-2">(${offer.seller_email || 'email'})</small>
                        </div>
                    ` : ''}
                    ${isSent ? `
                        <div class="d-flex align-items-center">
                            <i class="bi bi-envelope text-info me-2"></i>
                            <span>Para: ${offer.buyer_email || 'comprador'}</span>
                        </div>
                    ` : ''}
                    ${offer.message ? `
                        <div class="mt-2 p-2 bg-black bg-opacity-25 rounded">
                            <i class="bi bi-chat-quote text-muted me-2"></i>
                            <span class="text-muted">"${offer.message}"</span>
                        </div>
                    ` : ''}
                </div>
                
                ${offer.status === 'pending' && isReceived ? `
                    <div class="d-flex gap-2">
                        <button class="btn btn-success btn-sm" onclick="acceptTradeOffer('${offer.id}')">
                            <i class="bi bi-check-lg me-1"></i> Aceitar
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="declineTradeOffer('${offer.id}')">
                            <i class="bi bi-x-lg me-1"></i> Recusar
                        </button>
                    </div>
                ` : ''}
                
                ${offer.status === 'pending' && isSent ? `
                    <button class="btn btn-outline-danger btn-sm" onclick="cancelTradeOffer('${offer.id}')">
                        <i class="bi bi-x-circle me-1"></i> Cancelar
                    </button>
                ` : ''}
            </div>
            
            <div class="mt-2 small text-muted">
                <i class="bi bi-clock me-1"></i>
                ${dataFormatada}
            </div>
        </div>
        `;
    }).join('');
}

// ===== ACEITAR OFERTA =====
async function acceptTradeOffer(offerId) {
    const currentOffer = tradeOffers.received?.find(o => o.id === offerId);
    
    if (!currentOffer) {
        showToast('Oferta não encontrada.', 'error');
        return;
    }

    const totalValue = currentOffer.total || (currentOffer.quantity * currentOffer.price);
    
    if (!confirm(`Confirmar compra de ${currentOffer.quantity || 0} ações de "${currentOffer.music_title}" por ${formatCurrency(totalValue)}?`)) {
        return;
    }

    const btn = event?.target;
    const originalText = btn?.innerHTML;
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="bi bi-arrow-clockwise spin"></i> Processando...';
    }
    
    showLoading('Processando negociação...');
    
    try {
        const result = await callAPI('process_trade', { 
            trade_id: offerId,
            action_type: 'accept',
            user_id: state.currentUser.id
        });
        
        if (result?.success) {
            // Atualizar saldo
            if (state.userBalance >= totalValue) {
                state.userBalance -= totalValue;
            }
            
            // Adicionar ao portfólio
            const novoAtivo = {
                id: 'asset_' + Date.now(),
                music_id: currentOffer.music_id,
                music_title: currentOffer.music_title,
                artist: currentOffer.artist,
                quantidade: currentOffer.quantity,
                valor_unitario: currentOffer.price,
                valor_total: totalValue,
                data_compra: new Date().toISOString(),
                status: 'ativo',
                trade_id: offerId,
                blockchain_hash: result.data?.blockchain_hash || '0x' + Date.now().toString(16)
            };
            
            if (!state.portfolioAssets) state.portfolioAssets = [];
            state.portfolioAssets.push(novoAtivo);
            
            // Remover da lista
            if (tradeOffers.received) {
                tradeOffers.received = tradeOffers.received.filter(o => o.id !== offerId);
            }
            
            // Adicionar ao histórico
            if (!tradeOffers.history) tradeOffers.history = [];
            tradeOffers.history.unshift({
                ...currentOffer,
                status: 'accepted',
                completed_at: new Date().toISOString()
            });
            
            // Atualizar UI
            updateBalanceDisplay();
            renderTradeOffers('received');
            renderPortfolio();
            
            showToast('✅ Negociação concluída com sucesso!', 'success');
            closeModal('tradeModal');
            
            // Sincronizar em segundo plano
            setTimeout(async () => {
                await Promise.all([
                    updateBalanceDisplay(true),
                    loadPortfolio(true),
                    loadLedger(true),
                    loadTradeOffers()
                ]);
            }, 2000);
            
        } else {
            showToast(result?.message || 'Erro ao processar negociação', 'error');
            await loadTradeOffers();
        }
        
    } catch (error) {
        console.error('Erro ao aceitar oferta:', error);
        showToast('Erro ao processar negociação: ' + error.message, 'error');
    } finally {
        hideLoading();
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
}

// ===== RECUSAR OFERTA =====
async function declineTradeOffer(offerId) {
    if (!confirm('Recusar esta oferta?')) return;
    
    const btn = event?.target;
    const originalText = btn?.innerHTML;
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="bi bi-arrow-clockwise spin"></i> Recusando...';
    }
    
    try {
        const result = await callAPI('process_trade', { 
            trade_id: offerId,
            action_type: 'decline',
            user_id: state.currentUser.id
        });
        
        if (result?.success) {
            showToast('Oferta recusada', 'info');
            
            if (tradeOffers.received) {
                tradeOffers.received = tradeOffers.received.filter(o => o.id !== offerId);
            }
            
            renderTradeOffers('received');
            await loadTradeOffers();
        } else {
            showToast(result?.message || 'Erro ao recusar', 'error');
        }
        
    } catch (error) {
        console.error('Erro ao recusar oferta:', error);
        showToast('Erro ao recusar oferta', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
}

// ===== CANCELAR OFERTA =====
async function cancelTradeOffer(offerId) {
    if (!confirm('Cancelar esta oferta?')) return;
    
    const btn = event?.target;
    const originalText = btn?.innerHTML;
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="bi bi-arrow-clockwise spin"></i> Cancelando...';
    }
    
    try {
        const result = await callAPI('process_trade', { 
            trade_id: offerId,
            action_type: 'cancel',
            user_id: state.currentUser.id
        });
        
        if (result?.success) {
            showToast('Oferta cancelada', 'info');
            
            if (tradeOffers.sent) {
                tradeOffers.sent = tradeOffers.sent.filter(o => o.id !== offerId);
            }
            
            renderTradeOffers('sent');
            await loadTradeOffers();
        } else {
            showToast(result?.message || 'Erro ao cancelar', 'error');
        }
        
    } catch (error) {
        console.error('Erro ao cancelar oferta:', error);
        showToast('Erro ao cancelar oferta', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
}

// ===== SWITCH TAB =====
function switchTradeTab(type) {
    event?.preventDefault();
    renderTradeOffers(type);
}

// ===== EXPORT =====
if (typeof window !== 'undefined') {
    window.openTradeModal = openTradeModal;
    window.adjustTradeQuantity = adjustTradeQuantity;
    window.updateTradeCalculation = updateTradeCalculation;
    window.searchUserByEmail = searchUserByEmail;
    window.selectUser = selectUser;
    window.createTradeOffer = createTradeOffer;
    window.loadTradeOffers = loadTradeOffers;
    window.renderTradeOffers = renderTradeOffers;
    window.switchTradeTab = switchTradeTab;
    window.acceptTradeOffer = acceptTradeOffer;
    window.declineTradeOffer = declineTradeOffer;
    window.cancelTradeOffer = cancelTradeOffer;
}
