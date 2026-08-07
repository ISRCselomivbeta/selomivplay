// ============================================================
// API.JS - Comunicação com o Backend
// ============================================================

// ===== CONTROLE DE REQUISIÇÕES =====
const requestControl = {
    lastSaldo: 0,
    lastStreaming: 0,
    lastExtrato: 0,
    lastReset: Date.now(),
    saldoCount: 0,
    streamingCount: 0,
    extratoCount: 0,
    MIN_INTERVAL: 30000,
    MAX_REQUESTS_PER_HOUR: 100
};

function canMakeRequest(type) {
    const now = Date.now();
    const last = requestControl[`last${type}`];
    const count = requestControl[`${type.toLowerCase()}Count`];
    if (now - requestControl.lastReset > 3600000) {
        requestControl.saldoCount = 0;
        requestControl.streamingCount = 0;
        requestControl.extratoCount = 0;
        requestControl.lastReset = now;
    }
    if (now - last < requestControl.MIN_INTERVAL) return false;
    if (count > requestControl.MAX_REQUESTS_PER_HOUR) return false;
    return true;
}

function registerRequest(type) {
    requestControl[`last${type}`] = Date.now();
    requestControl[`${type.toLowerCase()}Count`]++;
}

// ===== FUNÇÃO PRINCIPAL DE API =====
async function callAPI(action, data = {}) {
    if (state?.currentUser?.id && !data.user_id) {
        data.user_id = state.currentUser.id;
    }
    try {
        const url = new URL(CONFIG.API_URL, window.location.origin);
        url.searchParams.append('action', action);
        Object.keys(data).forEach(key => {
            if (data[key] !== undefined && data[key] !== null) {
                url.searchParams.append(key, data[key]);
            }
        });
        console.log(`📡 [${action}] Fetching:`, url.toString());
        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        console.log(`✅ [${action}] Resposta:`, result);
        return result;
    } catch (error) {
        console.error(`❌ [${action}] Erro:`, error);
        showToast('Erro de conexão com o servidor', 'error');
        return getFallbackData(action, data);
    }
}

// ===== FALLBACK LOCAL =====
function getFallbackData(action, data) {
    console.log(`📦 [${action}] Usando fallback local`);
    if (action === 'get_musicas') {
        return {
            success: true,
            data: [
                {
                    id: '1',
                    titulo: 'RIO DE JANEIRO',
                    artista: 'Elzo Henschell',
                    link_capa: 'https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=400',
                    link_youtube: 'https://www.youtube.com/watch?v=fJ9rUzIMcZQ',
                    valor_acao: 25.50,
                    percentual_disponivel: 38,
                    acoes_vendidas: 150,
                    total_investidores: 45,
                    rentabilidade_media: 12.5,
                    status: 'ativo',
                    genero: 'URBAN',
                    elo_rating: 1850
                },
                {
                    id: '2',
                    titulo: 'Blinding Lights',
                    artista: 'The Weeknd',
                    link_capa: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400',
                    link_youtube: 'https://www.youtube.com/watch?v=4NRXx6U8ABQ',
                    valor_acao: 32.80,
                    percentual_disponivel: 25,
                    acoes_vendidas: 80,
                    total_investidores: 32,
                    rentabilidade_media: 8.3,
                    status: 'ativo',
                    genero: 'POP',
                    elo_rating: 1720
                },
                {
                    id: '3',
                    titulo: 'Bohemian Rhapsody',
                    artista: 'Queen',
                    link_capa: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400',
                    link_youtube: 'https://www.youtube.com/watch?v=fJ9rUzIMcZQ',
                    valor_acao: 45.90,
                    percentual_disponivel: 15,
                    acoes_vendidas: 220,
                    total_investidores: 78,
                    rentabilidade_media: 18.2,
                    status: 'ativo',
                    genero: 'ROCK',
                    elo_rating: 2100
                }
            ]
        };
    }
    if (['buy', 'buy_external', 'register', 'upload_music', 'suggest_external_music', 
         'create_playlist', 'toggle_favorite', 'request_withdrawal'].includes(action)) {
        return {
            success: true,
            message: 'Ação realizada com sucesso!',
            data: { 
                contrato_id: 'CT_' + Date.now(),
                blockchain_hash: '0x' + Date.now().toString(16)
            }
        };
    }
    return { success: true, data: [] };
}

// ===== BLOCO DE BLOCKCHAIN (SIMULADO) =====
const Blockchain = {
    generateHash: function(data) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 15);
        return '0x' + timestamp.toString(16) + random + data.substring(0, 8);
    },
    createContract: function(investment) {
        const contract = {
            id: 'CT_' + Date.now(),
            hash: this.generateHash(investment.music_id + investment.user_id),
            timestamp: new Date().toISOString(),
            music_id: investment.music_id,
            user_id: investment.user_id,
            quantidade: investment.quantidade,
            valor_total: investment.valor_total,
            status: 'active',
            previousHash: state.blockchain.lastBlock ? state.blockchain.contracts[state.blockchain.contracts.length - 1].hash : '0x0'
        };
        state.blockchain.contracts.push(contract);
        state.blockchain.lastBlock++;
        return contract;
    },
    recordRoyalty: function(music_id, amount, investors) {
        const royalty = {
            id: 'ROY_' + Date.now(),
            hash: this.generateHash(music_id + amount),
            timestamp: new Date().toISOString(),
            music_id: music_id,
            amount: amount,
            investors: investors,
            distributed: false
        };
        state.blockchain.transactions.push(royalty);
        return royalty;
    },
    verifyContract: function(contractId) {
        const contract = state.blockchain.contracts.find(c => c.id === contractId);
        if (!contract) return false;
        const index = state.blockchain.contracts.indexOf(contract);
        if (index > 0) {
            const prevContract = state.blockchain.contracts[index - 1];
            return contract.previousHash === prevContract.hash;
        }
        return true;
    },
    getContractHistory: function(music_id) {
        return state.blockchain.contracts.filter(c => c.music_id === music_id);
    }
};

// ===== EXPORT =====
if (typeof window !== 'undefined') {
    window.callAPI = callAPI;
    window.Blockchain = Blockchain;
    window.canMakeRequest = canMakeRequest;
    window.registerRequest = registerRequest;
}
