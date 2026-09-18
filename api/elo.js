// ============================================================
// api/elo.js — PLAY MY v1.0.1
// Motor de ELO musical.
// Calcula o ELO de cada música com base em:
//   - Streams do PLAY MY
//   - Streams externos (ROC Nation: Spotify, Deezer, Apple)
//   - Consistência (meses ativos)
//   - Tendência (crescimento ou queda)
//   - Inatividade (penalidade)
//
// MUDANÇAS v1.0.1:
//   - 🆕 ALIASES: aceita "get_elo_ranking", "calcular_elo", etc.
//   - 🔧 DEFAULT agora retorna success:false
//   - 🔧 Log mostra action original → resolvida
// ============================================================

let kv = null;
try {
    kv = require('@vercel/kv').kv;
    console.log('✅ [elo] Vercel KV carregado');
} catch (e) {
    console.warn('⚠️ [elo] KV não instalado — usando fallback');
}

// ============================================================
// STORAGE FALLBACK
// ============================================================
const MEMORY = {};

async function getKV(key) {
    if (kv) {
        try {
            const v = await kv.get('playmy:' + key);
            if (v !== null && v !== undefined) return v;
        } catch (e) {}
    }
    return MEMORY[key] || null;
}

async function setKV(key, value) {
    if (kv) {
        try { await kv.set('playmy:' + key, value); return true; } catch (e) {}
    }
    MEMORY[key] = value;
    return true;
}

// ============================================================
// CONFIGURAÇÕES DE ELO
// ============================================================
const ELO_CONFIG = {
    base: 1000,
    k_fator: 32,
    ganhos: {
        stream_play_my: 2,
        view_youtube: 1,
        stream_spotify: 3,
        stream_deezer: 3,
        stream_apple: 3,
        investimento: 5,
        trade_aceito: 10,
        curtida: 1,
        compartilhamento: 2
    },
    limites: {
        play_my_max: 300,
        externos_max: 400,
        consistencia_max: 100,
        tendencia_max: 150
    },
    faixas: {
        'lendario': { min: 1600, cor: '#FFD700', label: 'Lendário' },
        'excelente': { min: 1400, cor: '#34c759', label: 'Excelente' },
        'bom': { min: 1200, cor: '#5AC8FA', label: 'Bom' },
        'neutro': { min: 1000, cor: '#8E8E93', label: 'Neutro' },
        'atencao': { min: 800, cor: '#FF9500', label: 'Atenção' },
        'baixa': { min: 0, cor: '#FF3B30', label: 'Baixa' }
    }
};

// ============================================================
// CALCULAR TENDÊNCIA MENSAL
// ============================================================
function calcularTendencia(porDia) {
    const porMes = {};
    for (const [dia, valor] of Object.entries(porDia || {})) {
        const mes = dia.slice(0, 7);
        porMes[mes] = (porMes[mes] || 0) + valor;
    }

    const meses = Object.keys(porMes).sort();
    if (meses.length < 2) return 0;

    const ultimo = porMes[meses[meses.length - 1]];
    const penultimo = porMes[meses[meses.length - 2]];

    if (penultimo === 0) return 1;
    return (ultimo - penultimo) / penultimo;
}

// ============================================================
// CALCULAR ELO DE UMA MÚSICA
// ============================================================
async function calcularELO(music_id) {
    const playmy = await getKV('stream_' + music_id) || { total: 0, por_dia: {} };

    const periodos = await getKV('royalties_periodos') || [];
    let streamsExternos = 0;
    let mesesComDados = 0;
    const streamsPorPlataforma = {};

    for (const periodo of periodos) {
        const dados = await getKV('royalties_' + periodo);
        if (!dados) continue;

        for (const musica of Object.values(dados.musicas || {})) {
            if (musica.isrc === music_id || musica.titulo === music_id) {
                streamsExternos += musica.streams_total || 0;
                mesesComDados++;

                for (const [plat, qtd] of Object.entries(musica.plataformas || {})) {
                    streamsPorPlataforma[plat] = (streamsPorPlataforma[plat] || 0) + qtd;
                }
            }
        }
    }

    let elo = ELO_CONFIG.base;
    const breakdown = {
        base: ELO_CONFIG.base,
        play_my_total: playmy.total || 0,
        play_my_streams: 0,
        externos_total: streamsExternos,
        externos_streams: 0,
        meses_ativos: 0,
        consistencia: 0,
        tendencia: 0,
        ajuste_tendencia: 0,
        penalidade_inatividade: 0
    };

    const ajustePlayMy = Math.min(
        ELO_CONFIG.limites.play_my_max,
        ((playmy.total || 0) * ELO_CONFIG.ganhos.stream_play_my) / 10
    );
    elo += ajustePlayMy;
    breakdown.play_my_streams = Math.round(ajustePlayMy);

    const ajusteExternos = Math.min(
        ELO_CONFIG.limites.externos_max,
        (streamsExternos * ELO_CONFIG.ganhos.stream_spotify) / 100
    );
    elo += ajusteExternos;
    breakdown.externos_streams = Math.round(ajusteExternos);

    const mesesAtivos = Object.keys(playmy.por_dia || {})
        .map(d => d.slice(0, 7))
        .filter((v, i, a) => a.indexOf(v) === i)
        .length;
    breakdown.meses_ativos = mesesAtivos;

    let ajusteConsistencia = 0;
    if (mesesAtivos >= 6) ajusteConsistencia = ELO_CONFIG.limites.consistencia_max;
    else if (mesesAtivos >= 3) ajusteConsistencia = 50;
    else if (mesesAtivos >= 1) ajusteConsistencia = 20;
    elo += ajusteConsistencia;
    breakdown.consistencia = ajusteConsistencia;

    const tendencia = calcularTendencia(playmy.por_dia || {});
    breakdown.tendencia = Math.round(tendencia * 1000) / 10;

    let ajusteTendencia = 0;
    if (tendencia > 0.2) ajusteTendencia = ELO_CONFIG.limites.tendencia_max;
    else if (tendencia > 0.05) ajusteTendencia = 80;
    else if (tendencia < -0.2) ajusteTendencia = -ELO_CONFIG.limites.tendencia_max;
    else if (tendencia < -0.05) ajusteTendencia = -80;
    elo += ajusteTendencia;
    breakdown.ajuste_tendencia = ajusteTendencia;

    const ultimoDia = Object.keys(playmy.por_dia || {}).sort().pop();
    let penalidade = 0;
    if (ultimoDia) {
        const dias = Math.floor((Date.now() - new Date(ultimoDia).getTime()) / 86400000);
        if (dias > 60) penalidade = -200;
        else if (dias > 30) penalidade = -100;
        else if (dias > 15) penalidade = -50;
    }
    elo += penalidade;
    breakdown.penalidade_inatividade = penalidade;

    elo = Math.max(0, Math.min(2000, Math.round(elo)));

    let faixa = 'baixa';
    for (const [nome, dados] of Object.entries(ELO_CONFIG.faixas)) {
        if (elo >= dados.min) { faixa = nome; break; }
    }

    const cor = ELO_CONFIG.faixas[faixa].cor;
    const label = ELO_CONFIG.faixas[faixa].label;

    return {
        music_id: music_id,
        elo: elo,
        faixa: faixa,
        faixa_label: label,
        cor: cor,
        breakdown: breakdown,
        streams_por_plataforma: streamsPorPlataforma,
        atualizado_em: new Date().toISOString()
    };
}

// ============================================================
// ATUALIZAR ELO DE TODAS AS MÚSICAS
// ============================================================
async function atualizarTodosELOs() {
    const idx = await getKV('streams_index') || [];
    const resultados = [];

    for (const id of idx) {
        try {
            const r = await calcularELO(id);
            await setKV('elo_' + id, r);
            resultados.push(r);
        } catch (e) {
            console.error('Erro ELO para', id, e.message);
        }
    }

    resultados.sort((a, b) => b.elo - a.elo);
    await setKV('elo_ranking', resultados);
    await setKV('elo_ultima_atualizacao', new Date().toISOString());

    console.log(`⚡ [ELO] ${resultados.length} músicas atualizadas`);
    return resultados;
}

// ============================================================
// ALIASES — compatibilidade com o front (api.js usa prefixo "get_")
// ============================================================
const ALIASES = {
    'get_elo_ranking':      'ranking',
    'elo_ranking':          'ranking',
    'get_ranking':          'ranking',
    'calcular_elo':         'calcular',
    'ver_elo':              'ver',
    'atualizar_todos_elos': 'atualizar_todos'
};

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

    console.log(`⚡ [elo] ${_actionOriginal}${action !== _actionOriginal ? ' → ' + action : ''}`);

    try {
        // ============================================================
        // CALCULAR ELO DE UMA MÚSICA
        // ============================================================
        if (action === 'calcular') {
            if (!music_id) {
                return res.status(200).json({ success: false, message: 'music_id obrigatório' });
            }

            const resultado = await calcularELO(music_id);
            await setKV('elo_' + music_id, resultado);

            return res.status(200).json({ success: true, data: resultado });
        }

        // ============================================================
        // ATUALIZAR TODOS OS ELOs
        // ============================================================
        if (action === 'atualizar_todos') {
            const resultados = await atualizarTodosELOs();

            return res.status(200).json({
                success: true,
                message: 'ELOs atualizados',
                data: {
                    total: resultados.length,
                    ranking: resultados
                }
            });
        }

        // ============================================================
        // RANKING DE ELO
        // ============================================================
        if (action === 'ranking') {
            const ranking = await getKV('elo_ranking') || [];
            const ultima = await getKV('elo_ultima_atualizacao');

            return res.status(200).json({
                success: true,
                data: {
                    ultima_atualizacao: ultima,
                    total: ranking.length,
                    ranking: ranking.slice(0, 50)
                }
            });
        }

        // ============================================================
        // VER ELO DE UMA MÚSICA (cache)
        // ============================================================
        if (action === 'ver') {
            if (!music_id) {
                return res.status(200).json({ success: false, message: 'music_id obrigatório' });
            }

            let elo = await getKV('elo_' + music_id);
            if (!elo) {
                elo = await calcularELO(music_id);
                await setKV('elo_' + music_id, elo);
            }

            return res.status(200).json({ success: true, data: elo });
        }

        // ============================================================
        // CONFIGURAÇÕES
        // ============================================================
        if (action === 'config') {
            return res.status(200).json({ success: true, data: ELO_CONFIG });
        }

        // ============================================================
        // DEFAULT — action desconhecida
        // ✅ success:false (era true) — quebra loop do front
        // ============================================================
        console.warn(`⚠️ [elo] action desconhecida: ${_actionOriginal}`);
        return res.status(200).json({
            success: false,
            message: `Action desconhecida: ${_actionOriginal}`,
            version: '1.0.1',
            acoes: ['calcular', 'atualizar_todos', 'ranking', 'ver', 'config']
        });

    } catch (e) {
        console.error('❌ [elo] Erro:', e);
        return res.status(200).json({ success: false, message: e.message });
    }
};
