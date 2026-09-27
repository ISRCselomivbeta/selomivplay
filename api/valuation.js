// ============================================================
// api/valuation.js — PLAY MY v1.0.2
// Motor de valuation artístico.
// Transforma streams + ELO em previsão de receita futura.
//
// Fórmula:
//   Receita Projetada = Streams/mês × valor por stream × 12
//   Valuation = Receita Projetada × Múltiplo (ajustado pelo ELO)
//
// MUDANÇAS v1.0.2:
//   - 🆕 FALLBACK em 3 camadas no calcularValuationCatalogo():
//       1) streams_index (fonte principal)
//       2) musicas_all  (KV local)
//       3) /api/backend?action=get_musicas (último recurso)
//       4) get_musicas direto do GAS (último recurso)
//   - 🆕 Logs detalhados para diagnóstico do "0 músicas"
//   - ✅ Resolve "⚠️ valuation catálogo vazio" no portfolio.js
//
// MUDANÇAS v1.0.1:
//   - 🆕 ALIASES: aceita "valuation_catalogo", "valuation_ver", etc.
//   - 🔧 DEFAULT agora retorna success:false
// ============================================================

let kv = null;
try {
    kv = require('@vercel/kv').kv;
    console.log('✅ [valuation] Vercel KV carregado');
} catch (e) {
    console.warn('⚠️ [valuation] KV não instalado — usando fallback');
}

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || 'AIzaSyAPaYGY_MrrNgKdEqTs3Qw7tPNv5p5QwPM';
const GAS_URL_FALLBACK = 'https://script.google.com/macros/s/AKfycbwgjor-tLLzVrnJGNHOifL1O2sRBhysKJ3IbVJy_AHgtNqjk-6hazH8xuO6OaDXF_s/exec';
const GAS_URL = process.env.GAS_URL || GAS_URL_FALLBACK;

// ============================================================
// ALIASES
// ============================================================
const ALIASES = {
    'ver_valuation':       'ver',
    'ver_catalogo':        'catalogo',
    'valuation_catalogo':  'catalogo',
    'valuation_ver':       'ver',
    'valuation_calcular':  'calcular',
    'valuation_mercado':   'mercado',
    'calcular_valuation':  'calcular'
};

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
// CONFIGURAÇÕES DE MERCADO
// ============================================================
const MERCADO = {
    valor_por_stream: {
        play_my: 0.015,
        youtube: 0.002,
        spotify: 0.004,
        deezer: 0.003,
        apple_music: 0.007,
        amazon_music: 0.005,
        tidal: 0.010,
        outros: 0.003
    },
    multiplo_base: 10,
    multiplo: {
        conservador: 8,
        realista: 10,
        otimista: 15
    },
    meses_projecao: 12,
    elo_ajuste_max: 0.5
};

// ============================================================
// 🆕 v1.0.2 — RESOLVE LISTA DE IDs DO CATÁLOGO (fallback em camadas)
// ------------------------------------------------------------
// 1. streams_index (fonte principal — populado por register_streaming)
// 2. musicas_all  (KV local — populado por get_musicas)
// 3. /api/backend?action=get_musicas (último recurso interno)
// 4. get_musicas direto do GAS (último recurso externo)
// ============================================================
async function _resolverIdsCatalogo() {
    // ---------- Camada 1: streams_index ----------
    let idx = await getKV('streams_index') || [];
    if (idx.length) {
        console.log(`[valuation] ✅ streams_index: ${idx.length} músicas`);
        return idx.map(String);
    }

    // ---------- Camada 2: musicas_all ----------
    console.warn('[valuation] ⚠️ streams_index vazio — tentando musicas_all');
    const musicasAll = await getKV('musicas_all') || [];
    if (musicasAll.length) {
        idx = musicasAll.map(m => String(m.id)).filter(Boolean);
        if (idx.length) {
            console.log(`[valuation] ✅ musicas_all: ${idx.length} músicas`);
            return idx;
        }
    }

    // ---------- Camada 3: /api/backend?action=get_musicas ----------
    console.warn('[valuation] ⚠️ musicas_all vazio — consultando /api/backend');
    try {
        const baseUrl = process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : 'https://playmy.com.br';
        const r = await fetch(`${baseUrl}/api/backend?action=get_musicas`);
        const j = await r.json();
        if (j && j.success && Array.isArray(j.data) && j.data.length) {
            idx = j.data.map(m => String(m.id)).filter(Boolean);
            console.log(`[valuation] ✅ backend: ${idx.length} músicas`);
            return idx;
        }
    } catch (e) {
        console.warn('[valuation] fallback backend falhou:', e.message);
    }

    // ---------- Camada 4: get_musicas direto do GAS ----------
    console.warn('[valuation] ⚠️ backend vazio — consultando GAS');
    try {
        const gasUrl = new URL(GAS_URL);
        gasUrl.searchParams.append('action', 'get_musicas');
        const r = await fetch(gasUrl.toString());
        const j = await r.json();
        // GAS pode devolver {success:true, data:[...]} OU {success:true, musicas:[...]}
        const lista = (j && j.data) || (j && j.musicas) || (Array.isArray(j) ? j : []);
        if (Array.isArray(lista) && lista.length) {
            idx = lista.map(m => String(m.id)).filter(Boolean);
            console.log(`[valuation] ✅ GAS: ${idx.length} músicas`);
            return idx;
        }
    } catch (e) {
        console.warn('[valuation] fallback GAS falhou:', e.message);
    }

    console.error('[valuation] ❌ Todas as camadas falharam — catálogo permanece vazio');
    return [];
}

// ============================================================
// REGRESSÃO LINEAR
// ============================================================
function calcularTendencia(valores) {
    const n = valores.length;
    if (n < 2) return 0;

    let somaX = 0, somaY = 0, somaXY = 0, somaX2 = 0;
    for (let i = 0; i < n; i++) {
        somaX += i;
        somaY += valores[i];
        somaXY += i * valores[i];
        somaX2 += i * i;
    }

    const denom = (n * somaX2 - somaX * somaX);
    if (denom === 0) return 0;

    const slope = (n * somaXY - somaX * somaY) / denom;
    const media = somaY / n;
    if (media === 0) return 0;

    return slope / media;
}

// ============================================================
// AGRUPAR POR MÊS
// ============================================================
function agruparPorMes(porDia) {
    const porMes = {};
    for (const [dia, valor] of Object.entries(porDia || {})) {
        const mes = dia.slice(0, 7);
        porMes[mes] = (porMes[mes] || 0) + valor;
    }
    return porMes;
}

// ============================================================
// PROJETAR RECEITA 12 MESES
// ============================================================
function projetarReceita(streamsPorMes, plataforma) {
    const valores = Object.values(streamsPorMes || {}).sort((a, b) => a - b);
    if (valores.length === 0) {
        return {
            projecao_streams: 0,
            projecao_receita: 0,
            tendencia: 0,
            confianca: 0,
            media_mensal: 0
        };
    }

    const media = valores.reduce((a, b) => a + b, 0) / valores.length;
    const tendencia = calcularTendencia(valores);
    const tendenciaLimitada = Math.max(-0.3, Math.min(0.3, tendencia));

    let projecaoTotal = 0;
    let streamAtual = media;
    for (let mes = 0; mes < MERCADO.meses_projecao; mes++) {
        streamAtual = streamAtual * (1 + tendenciaLimitada);
        projecaoTotal += streamAtual;
    }

    const valorStream = MERCADO.valor_por_stream[plataforma] ||
                        MERCADO.valor_por_stream.outros;
    const receitaProjetada = projecaoTotal * valorStream;
    const confianca = Math.min(100, valores.length * 20);

    return {
        projecao_streams: Math.round(projecaoTotal),
        projecao_receita: Math.round(receitaProjetada * 100) / 100,
        tendencia: Math.round(tendencia * 1000) / 10,
        confianca: confianca,
        media_mensal: Math.round(media)
    };
}

// ============================================================
// CALCULAR VALUATION DE UMA MÚSICA
// ============================================================
async function calcularValuation(music_id, video_id_youtube) {
    const dados = {
        music_id: music_id,
        fontes: {},
        projecoes: {},
        receita_anual_projetada: 0,
        valuation: 0,
        valuation_faixa: {},
        elo: 1000,
        elo_faixa: 'neutro',
        elo_cor: '#8E8E93',
        multiplo_base: MERCADO.multiplo_base,
        multiplo_final: MERCADO.multiplo_base,
        ajuste_elo: 0,
        atualizado_em: new Date().toISOString()
    };

    // 1. PLAY MY (tenta formato novo, cai no antigo)
    const playmyNovo = await getKV('streams_' + music_id) || { total: 0, por_dia: {} };
    const playmyAntigo = await getKV('stream_' + music_id) || { total: 0, por_dia: {} };
    const playmy = (playmyNovo.total || 0) >= (playmyAntigo.total || 0) ? playmyNovo : playmyAntigo;
    if (playmy.por_dia) {
        const porMes = agruparPorMes(playmy.por_dia);
        dados.fontes.play_my = { total: playmy.total || 0, por_mes: porMes };
        dados.projecoes.play_my = projetarReceita(porMes, 'play_my');
    }

    // 2. YOUTUBE
    if (video_id_youtube) {
        try {
            const url = `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${video_id_youtube}&key=${YOUTUBE_API_KEY}`;
            const r = await fetch(url);
            const j = await r.json();
            if (j.items && j.items[0]) {
                const v = j.items[0];
                const views = parseInt(v.statistics.viewCount || 0);
                const likes = parseInt(v.statistics.likeCount || 0);
                dados.fontes.youtube = {
                    video_id: video_id_youtube,
                    titulo: v.snippet.title,
                    canal: v.snippet.channelTitle,
                    views_total: views,
                    likes: likes,
                    thumbnail: v.snippet.thumbnails.high.url
                };
                dados.projecoes.youtube = {
                    projecao_receita: Math.round(views * MERCADO.valor_por_stream.youtube * 100) / 100,
                    confianca: 30,
                    observacao: 'YouTube não expõe streams mensais via API'
                };
            }
        } catch (e) {
            dados.fontes.youtube = { erro: e.message };
        }
    }

    // 3. ROC NATION
    const periodos = await getKV('royalties_periodos') || [];
    const porPlataforma = {};

    for (const periodo of periodos) {
        const dadosPeriodo = await getKV('royalties_' + periodo);
        if (!dadosPeriodo) continue;

        const musicas = dadosPeriodo.musicas || {};
        for (const [chave, musica] of Object.entries(musicas)) {
            if (musica.isrc === music_id || musica.titulo === music_id) {
                for (const [plataforma, streams] of Object.entries(musica.plataformas || {})) {
                    const platKey = plataforma.toLowerCase().replace(/\s/g, '_');
                    if (!porPlataforma[platKey]) porPlataforma[platKey] = {};
                    porPlataforma[platKey][periodo] = streams;
                }
            }
        }
    }

    for (const [plataforma, dadosPlat] of Object.entries(porPlataforma)) {
        dados.fontes[plataforma] = { por_mes: dadosPlat };
        dados.projecoes[plataforma] = projetarReceita(dadosPlat, plataforma);
    }

    // 4. SOMA RECEITA ANUAL
    let receitaAnual = 0;
    for (const proj of Object.values(dados.projecoes)) {
        receitaAnual += proj.projecao_receita || 0;
    }
    dados.receita_anual_projetada = Math.round(receitaAnual * 100) / 100;

    // 5. BUSCA ELO (tenta novo, cai no antigo)
    try {
        let eloData = await getKV('elo_' + music_id);
        if (!eloData) {
            const baseUrl = process.env.VERCEL_URL
                ? `https://${process.env.VERCEL_URL}`
                : 'https://playmy.com.br';
            const r = await fetch(`${baseUrl}/api/elo?action=calcular&music_id=${music_id}`);
            const j = await r.json();
            if (j.success) {
                eloData = j.data;
                await setKV('elo_' + music_id, eloData);
            }
        }
        if (eloData) {
            dados.elo = eloData.elo;
            dados.elo_faixa = eloData.faixa;
            dados.elo_cor = eloData.cor;
            dados.elo_label = eloData.faixa_label;
            dados.elo_breakdown = eloData.breakdown;
        }
    } catch (e) {
        console.warn('[valuation] ELO não disponível:', e.message);
    }

    // 6. AJUSTE DO MÚLTIPLO PELO ELO
    const ajusteBruto = (dados.elo - 1000) / 1000;
    const ajusteELO = ajusteBruto * MERCADO.elo_ajuste_max;
    const multiploFinal = MERCADO.multiplo_base * (1 + ajusteELO);

    dados.ajuste_elo = Math.round(ajusteELO * 1000) / 10;
    dados.multiplo_final = Math.round(multiploFinal * 100) / 100;

    // 7. VALUATION FINAL
    dados.valuation = Math.round(receitaAnual * multiploFinal * 100) / 100;
    dados.valuation_faixa = {
        conservador: Math.round(receitaAnual * (multiploFinal * 0.8) * 100) / 100,
        realista: dados.valuation,
        otimista: Math.round(receitaAnual * (multiploFinal * 1.3) * 100) / 100
    };

    return dados;
}

// ============================================================
// 🆕 v1.0.2 — CALCULAR VALUATION DO CATÁLOGO (com fallback)
// ============================================================
async function calcularValuationCatalogo() {
    const ids = await _resolverIdsCatalogo();

    if (!ids.length) {
        console.error('[valuation] ❌ catálogo vazio após todas as tentativas');
        return {
            valuation_total: 0,
            receita_anual_total: 0,
            quantidade_musicas: 0,
            musicas: [],
            aviso: 'Catálogo em atualização — nenhuma música com streams registrados ainda',
            atualizado_em: new Date().toISOString()
        };
    }

    const valuations = [];
    for (const id of ids) {
        try {
            const musica = await getKV('musica_' + id) || {};
            const videoId = musica.youtube_video_id || null;
            const v = await calcularValuation(id, videoId);
            valuations.push(v);
        } catch (e) {
            console.error('Erro valuation para', id, e.message);
        }
    }

    valuations.sort((a, b) => b.valuation - a.valuation);

    const total = valuations.reduce((s, v) => s + (v.valuation || 0), 0);
    const receitaTotal = valuations.reduce((s, v) => s + (v.receita_anual_projetada || 0), 0);

    return {
        valuation_total: Math.round(total * 100) / 100,
        receita_anual_total: Math.round(receitaTotal * 100) / 100,
        quantidade_musicas: valuations.length,
        musicas: valuations,
        atualizado_em: new Date().toISOString()
    };
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
    const { action: _actionOriginal, music_id, video_id } = params;

    const action = ALIASES[_actionOriginal] || _actionOriginal;

    console.log(`💰 [valuation] ${_actionOriginal}${action !== _actionOriginal ? ' → ' + action : ''}`);

    try {
        // CALCULAR UMA MÚSICA
        if (action === 'calcular') {
            if (!music_id) {
                return res.status(200).json({ success: false, message: 'music_id obrigatório' });
            }

            const resultado = await calcularValuation(music_id, video_id);
            await setKV('valuation_' + music_id, resultado);

            console.log(`💰 [valuation] ${music_id} | receita: R$ ${resultado.receita_anual_projetada} | ELO: ${resultado.elo} | valuation: R$ ${resultado.valuation}`);

            return res.status(200).json({ success: true, data: resultado });
        }

        // 🆕 v1.0.2 — CATÁLOGO (com fallback em camadas)
        if (action === 'catalogo') {
            const resultado = await calcularValuationCatalogo();
            await setKV('valuation_catalogo', resultado);
            console.log(`💰 [valuation] catálogo: ${resultado.quantidade_musicas} músicas | total: R$ ${resultado.valuation_total}`);
            return res.status(200).json({ success: true, data: resultado });
        }

        // VER VALUATION DE UMA MÚSICA
        if (action === 'ver') {
            if (!music_id) {
                return res.status(200).json({ success: false, message: 'music_id obrigatório' });
            }

            let v = await getKV('valuation_' + music_id);
            if (!v) {
                v = await calcularValuation(music_id, video_id);
                await setKV('valuation_' + music_id, v);
            }

            return res.status(200).json({ success: true, data: v });
        }

        // VER ÚLTIMO CATÁLOGO
        if (action === 'ultimo_catalogo') {
            const v = await getKV('valuation_catalogo');
            return res.status(200).json({
                success: true,
                data: v || { valuation_total: 0, quantidade_musicas: 0, musicas: [] }
            });
        }

        // MERCADO
        if (action === 'mercado') {
            return res.status(200).json({ success: true, data: MERCADO });
        }

        // DEFAULT
        console.warn(`⚠️ [valuation] action desconhecida: ${_actionOriginal}`);
        return res.status(200).json({
            success: false,
            message: `Action desconhecida: ${_actionOriginal}`,
            version: '1.0.2',
            acoes: ['calcular', 'catalogo', 'ver', 'ultimo_catalogo', 'mercado']
        });

    } catch (e) {
        console.error('❌ [valuation] Erro:', e);
        return res.status(200).json({ success: false, message: e.message });
    }
};

console.log('✅ [valuation] v1.0.2 carregado — fallback em 3 camadas');
