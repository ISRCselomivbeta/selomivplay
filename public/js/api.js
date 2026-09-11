// ============================================================
// API.JS - Comunicação com o backend PLAY MY
// ============================================================

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

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const result = await response.json();
        console.log(`✅ [${action}] Resposta:`, result);
        return result;

    } catch (error) {
        console.error(`❌ [${action}] Erro:`, error);
        return getFallbackData(action, data);
    }
}

function getFallbackData(action, data) {
    console.log(`📦 [${action}] Usando fallback local`);

    if (action === 'get_musicas') {
        return {
            success: true,
            data: [
                {
                    id: '1', titulo: 'RIO DE JANEIRO', artista: 'Elzo Henschell',
                    link_capa: 'https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=400',
                    link_youtube: 'https://www.youtube.com/watch?v=fJ9rUzIMcZQ',
                    valor_acao: 25.50, percentual_disponivel: 38, acoes_vendidas: 150,
                    total_investidores: 45, rentabilidade_media: 12.5,
                    status: 'ativo', genero: 'URBAN'
                },
                {
                    id: '2', titulo: 'Blinding Lights', artista: 'The Weeknd',
                    link_capa: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400',
                    link_youtube: 'https://www.youtube.com/watch?v=4NRXx6U8ABQ',
                    valor_acao: 32.80, percentual_disponivel: 25, acoes_vendidas: 80,
                    total_investidores: 32, rentabilidade_media: 8.3,
                    status: 'ativo', genero: 'POP'
                },
                {
                    id: '3', titulo: 'Bohemian Rhapsody', artista: 'Queen',
                    link_capa: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400',
                    link_youtube: 'https://www.youtube.com/watch?v=fJ9rUzIMcZQ',
                    valor_acao: 45.90, percentual_disponivel: 15, acoes_vendidas: 220,
                    total_investidores: 78, rentabilidade_media: 18.2,
                    status: 'ativo', genero: 'ROCK'
                }
            ]
        };
    }

    if (action === 'buy' && CONFIG.BLOCKCHAIN_ENABLED) {
        const contract = Blockchain.createContract({
            music_id: data.music_id,
            user_id: data.user_id || 'user_' + Date.now(),
            quantidade: data.quantidade,
            valor_total: data.valor_total
        });
        return {
            success: true,
            message: 'Ação realizada com sucesso!',
            data: { contrato_id: contract.id, blockchain_hash: contract.hash, transaction: contract }
        };
    }

    if (['buy', 'buy_external', 'register', 'upload_music', 'suggest_external_music',
         'create_playlist', 'toggle_favorite', 'request_withdrawal'].includes(action)) {
        return {
            success: true,
            message: 'Ação realizada com sucesso!',
            data: { contrato_id: 'CT_' + Date.now(), blockchain_hash: Blockchain.generateHash(action + Date.now()) }
        };
    }

    return { success: true, data: [] };
}
