// ============================================================
// api/streams.js — PLAY MY v1.1.0
// READ-ONLY: contadores de streams do PLAY MY.
//
// MUDANÇAS v1.1.0 (consolidação Opção A):
//   - 🚫 action=registrar REMOVIDA (escrita foi consolidada no /api/backend)
//        → retorna success:false com instrução para o novo endpoint
//   - 🔧 Leitura compatível com ambos formatos de chave:
//        • stream_<id>    (formato antigo, /api/streams)
//        • streams_<id>   (formato novo, /api/backend v9.8.3)
//        • streams_global (compartilhado)
//   - 🔧 Fallback: se o novo formato existe, ele tem prioridade
//   - ✅ Mantém ver / total / ranking / ping
// ============================================================

let kv = null;
try {
    kv = require('@vercel/kv').kv;
    console.log('✅ [streams] Vercel KV carregado');
} catch (e) {
    console.warn('⚠️ [streams] KV não instalado — usando fallback em memória');
}

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

// ============================================================
// ALIASES DE ACTION (compatibilidade com o front)
// ============================================================
const ALIASES = {
    'streams_ranking':   'ranking',
    'stream_ranking':    'ranking',
    'streams_total':     'total',
    'stream_total':      'total',
    'streaming_total':   'total',
    'ver_stream':        'ver',
    'registrar_stream':  'registrar'
};

// ============================================================
// LEITURA DE CONTADOR — tenta os dois formatos de chave
//   1) stream_<id>   (formato antigo)
//   2) streams_<id>  (formato novo — backend v9.8.3)
// ============================================================
async function lerContador(music_id) {
    const antigo = await getKV('stream_' + music_id);
    const novo = await getKV('streams_' + music_id);

    // Prefere o novo (backend tem o guard e é a fonte de verdade)
    if (novo) {
        return {
            music_id: music_id,
            titulo: novo.titulo || (antigo && antigo.titulo) || '',
            total: novo.total || 0,
            hoje: novo.hoje || 0,
            ultima_data: novo.ultima_data || '',
            ultima_atualizacao: novo.ultima_atualizacao || '',
            _formato: 'novo'
        };
    }
    if (antigo) {
        return {
            music_id: music_id,
            titulo: antigo.titulo || '',
            total: antigo.total || 0,
            hoje: antigo.hoje || 0,
            ultima_data: antigo.ultima_data || '',
            ultima_atualizacao: antigo.ultima_atualizacao || '',
            _formato: 'antigo'
        };
    }
    return null;
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
    const { action: _actionOriginal, music_id } = params;

    // ✅ Resolve alias
    const action = ALIASES[_actionOriginal] || _actionOriginal;

    console.log(`🎵 [streams] ${_actionOriginal}${action !== _actionOriginal ? ' → ' + action : ''}`);

    try {
        // ============================================================
        // 🚫 REGISTRAR — MOVIDO PARA /api/backend
        // ============================================================
        if (action === 'registrar') {
            console.warn(`⚠️ [streams] escrita descontinuada — use /api/backend?action=register_streaming`);
            return res.status(200).json({
                success: false,
                message: 'A ação "registrar" foi movida para /api/backend?action=register_streaming',
                novo_endpoint: '/api/backend?action=register_streaming',
                motivo: 'Stream Guard (IP + intervalo 30min + duration mínima)',
                version: '1.1.0'
            });
        }

        // ============================================================
        // VER STREAMS DE UMA MÚSICA
        // ============================================================
        if (action === 'ver') {
            if (!music_id) {
                return res.status(200).json({ success: false, message: 'music_id obrigatório' });
            }
            const d = await lerContador(music_id);
            return res.status(200).json({
                success: true,
                data: d || { music_id: music_id, total: 0, hoje: 0 }
            });
        }

        // ============================================================
        // TOTAL GERAL
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
        // RANKING (top músicas) — lê dos dois formatos
        // ============================================================
        if (action === 'ranking') {
            const idx = await getKV('streams_index') || [];
            const lista = [];

            for (const id of idx) {
                const d = await lerContador(id);
                if (d) lista.push(d);
            }

            lista.sort((a, b) => (b.total || 0) - (a.total || 0));

            return res.status(200).json({
                success: true,
                data: lista.slice(0, 50)
            });
        }

        // ============================================================
        // PING
        // ============================================================
        if (action === 'ping') {
            return res.status(200).json({
                success: true,
                message: 'pong',
                version: '1.1.0',
                mode: 'read-only',
                kv_enabled: !!kv,
                note: 'escrita consolidada no /api/backend (Stream Guard)'
            });
        }

        // ============================================================
        // DEFAULT — action desconhecida
        // ============================================================
        console.warn(`⚠️ [streams] action desconhecida: ${_actionOriginal}`);
        return res.status(200).json({
            success: false,
            message: `Action desconhecida: ${_actionOriginal}`,
            version: '1.1.0',
            acoes: ['ver', 'total', 'ranking', 'ping'],
            note: 'escrita via /api/backend?action=register_streaming'
        });

    } catch (e) {
        console.error('❌ [streams] Erro:', e);
        return res.status(200).json({ success: false, message: e.message });
    }
};
