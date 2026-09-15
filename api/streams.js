// ============================================================
// api/streams.js — PLAY MY v1.0.0
// Contador simples de streams do PLAY MY.
// Chamado pelo frontend a cada play no player interno.
// ============================================================

let kv = null;
try {
    kv = require('@vercel/kv').kv;
    console.log('✅ [streams] Vercel KV carregado');
} catch (e) {
    console.warn('⚠️ [streams] KV não instalado — usando fallback em memória');
}

// ============================================================
// STORAGE FALLBACK
// ============================================================
const MEMORY = {
    streams: {},
    streams_index: [],
    streams_global: { total: 0, hoje: 0, ultima_data: '' }
};

async function getKV(key) {
    if (kv) {
        try {
            const v = await kv.get('playmy:' + key);
            if (v !== null && v !== undefined) return v;
        } catch (e) {}
    }
    return MEMORY[key] !== undefined ? MEMORY[key] : null;
}

async function setKV(key, value) {
    if (kv) {
        try { await kv.set('playmy:' + key, value); return true; } catch (e) {}
    }
    MEMORY[key] = value;
    return true;
}

// ============================================================
// HANDLER
// ============================================================
module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const params = req.method === 'POST' ? req.body : req.query;
    const { action, music_id, user_id, titulo, duration } = params;

    console.log(`🎵 [streams] ${action}`);

    try {
        // ============================================================
        // 1. REGISTRAR UM STREAM
        // ============================================================
        if (action === 'registrar') {
            if (!music_id) {
                return res.status(200).json({ success: false, message: 'music_id obrigatório' });
            }

            const hoje = new Date().toISOString().slice(0, 10);

            // --- Contador por música ---
            const key = 'stream_' + music_id;
            let contador = await getKV(key) || {
                music_id: music_id,
                titulo: titulo || '',
                total: 0,
                hoje: 0,
                ultima_data: hoje,
                por_dia: {}
            };

            if (contador.ultima_data !== hoje) {
                contador.hoje = 0;
                contador.ultima_data = hoje;
            }

            contador.total++;
            contador.hoje++;
            contador.por_dia[hoje] = (contador.por_dia[hoje] || 0) + 1;
            contador.ultima_atualizacao = new Date().toISOString();
            contador.ultimo_user = user_id || 'anon';

            await setKV(key, contador);

            // --- Índice de músicas ---
            let idx = await getKV('streams_index') || [];
            if (!idx.includes(music_id)) {
                idx.push(music_id);
                await setKV('streams_index', idx);
            }

            // --- Contador global ---
            let globalCont = await getKV('streams_global') || { total: 0, hoje: 0, ultima_data: hoje };
            if (globalCont.ultima_data !== hoje) {
                globalCont.hoje = 0;
                globalCont.ultima_data = hoje;
            }
            globalCont.total++;
            globalCont.hoje++;
            await setKV('streams_global', globalCont);

            console.log(`🎵 [streams] PLAY MY registrou: ${music_id} | total: ${contador.total} | hoje: ${contador.hoje} | user: ${user_id}`);

            return res.status(200).json({
                success: true,
                music_id: music_id,
                total: contador.total,
                hoje: contador.hoje,
                global: globalCont.total,
                mensagem: '✅ Play do PLAY MY registrado'
            });
        }

        // ============================================================
        // 2. VER STREAMS DE UMA MÚSICA
        // ============================================================
        if (action === 'ver') {
            if (!music_id) {
                return res.status(200).json({ success: false, message: 'music_id obrigatório' });
            }
            const d = await getKV('stream_' + music_id);
            return res.status(200).json({
                success: true,
                data: d || { music_id: music_id, total: 0, hoje: 0 }
            });
        }

        // ============================================================
        // 3. TOTAL GERAL
        // ============================================================
        if (action === 'total') {
            const globalCont = await getKV('streams_global') || { total: 0, hoje: 0 };
            const idx = await getKV('streams_index') || [];

            return res.status(200).json({
                success: true,
                data: {
                    streams_total: globalCont.total,
                    streams_hoje: globalCont.hoje,
                    total_musicas: idx.length,
                    ultima_atualizacao: globalCont.ultima_data
                }
            });
        }

        // ============================================================
        // 4. RANKING (top músicas)
        // ============================================================
        if (action === 'ranking') {
            const idx = await getKV('streams_index') || [];
            const lista = [];

            for (const id of idx) {
                const d = await getKV('stream_' + id);
                if (d) lista.push(d);
            }

            lista.sort((a, b) => (b.total || 0) - (a.total || 0));

            return res.status(200).json({
                success: true,
                data: lista.slice(0, 50)
            });
        }

        // ============================================================
        // 5. PING
        // ============================================================
        if (action === 'ping') {
            return res.status(200).json({
                success: true,
                message: 'pong',
                version: '1.0.0',
                kv_enabled: !!kv
            });
        }

        // ============================================================
        // DEFAULT
        // ============================================================
        return res.status(200).json({
            success: true,
            message: '🎵 PLAY MY Streams API',
            version: '1.0.0',
            acoes: [
                '?action=registrar&music_id=X&user_id=Y&titulo=Z',
                '?action=ver&music_id=X',
                '?action=total',
                '?action=ranking',
                '?action=ping'
            ]
        });

    } catch (e) {
        console.error('❌ [streams] Erro:', e);
        return res.status(200).json({ success: false, message: e.message });
    }
};
