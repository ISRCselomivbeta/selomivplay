// ============================================================
// api/valuation.js — PLAY MY v1.0.0
// Motor de valuation artístico.
// Transforma streams + ELO em previsão de receita futura.
//
// Fórmula:
//   Receita Projetada = Streams/mês × valor por stream × 12
//   Valuation = Receita Projetada × Múltiplo (ajustado pelo ELO)
// ============================================================

let kv = null;
try {
    kv = require('@vercel/kv').kv;
    console.log('✅ [valuation] Vercel KV carregado');
} catch (e) {
    console.warn('⚠️ [valuation] KV não instalado — usando fallback');
}

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || 'AIzaSyAPaYGY_MrrNgKdEqTs3Qw7tPNv5p5QwPM';

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
    // Valor por stream em R$ (base setembro 2026)
    valor_por_stream: {
        play_my: 0.015,        // PLAY MY paga mais (incentivo)
        youtube: 0.002,        // YouTube é baixo
        spotify: 0.004,        // Spotify ~R$ 0,004/stream
        deezer: 0.003,
        apple_music: 0.007,    // Apple paga mais
        amazon_music: 0.005,
        tidal: 0.010,
        outros: 0.003
    },

    // Múltiplo base do setor musical (quantas vezes a receita anual)
    multiplo_base: 10,

    // Faixas de múltiplo
    multiplo: {
        conservador: 8,
        realista: 10,
        otimista: 15
    },

    // Meses de projeção
    meses_projecao: 12,

    // Ajuste máximo do ELO no múltiplo (±50%)
    elo_ajuste_max: 0.5
};

// ============================================================
// REGRESSÃO LINEAR — calcula tendência
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

    // Limita tendência para não explodir (máx ±30%/mês)
    const tendenciaLimitada = Math.max(-0.3, Math.min(0.3, tendencia));

    // Projeta 12 meses aplicando tendência
    let projecaoTotal = 0;
    let streamAtual = media;
    for (let mes = 0; mes < MERCADO.meses_projecao; mes++) {
        streamAtual = streamAtual * (1 + tendenciaLimitada);
        projecaoTotal += streamAtual;
    }

    const valorStream = MERCADO.valor_por_stream[plataforma] ||
                        MERCADO.valor_por_stream.outros;
    const receitaProjetada = projecaoTotal * valorStream;

    // Confiança: quantos meses + variância
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

    // ============================================================
    // 1. PLAY MY
    // ============================================================
    const playmy = await getKV('stream_' + music_id) || { total: 0, por_dia: {} };
    if (playmy.por_dia) {
        const porMes = agruparPorMes(playmy.por_dia);
        dados.fontes.play_my = {
            total: playmy.total,
            por_mes: porMes
        };
        dados.projecoes.play_my = projetarReceita(porMes, 'play_my');
    }

    // ============================================================
    // 2. YOUTUBE
    // ============================================================
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

    // ============================================================
    // 3. ROC NATION (Spotify, Deezer, Apple, etc.)
    // ============================================================
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

    // ============================================================
    // 4. SOMA RECEITA ANUAL PROJETADA
    // ============================================================
    let receitaAnual = 0;
    for (const proj of Object.values(dados.projecoes)) {
        receitaAnual += proj.projecao_receita || 0;
    }
    dados.receita_anual_projetada = Math.round(receitaAnual * 100) / 100;

    // ============================================================
    // 5. BUSCA ELO
    // ============================================================
    try {
        let eloData = await getKV('elo_' + music_id);
        if (!eloData) {
            // Tenta calcular
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

    // ============================================================
    // 6. AJUSTE DO MÚLTIPLO PELO ELO
    // ============================================================
    // ELO 1000 = neutro (múltiplo base)
    // ELO 1500 = +50% no múltiplo
    // ELO 500  = -50% no múltiplo
    const ajusteBruto = (dados.elo - 1000) / 1000;
    const ajusteELO = ajusteBruto * MERCADO.elo_ajuste_max;

    const multiploFinal = MERCADO.multiplo_base * (1 + ajusteELO);

    dados.ajuste_elo = Math.round(ajusteELO * 1000) / 10; // em %
    dados.multiplo_final = Math.round(multiploFinal * 100) / 100;

    // ============================================================
    // 7. VALUATION FINAL
    // ============================================================
    dados.valuation = Math.round(receitaAnual * multiploFinal * 100) / 100;

    // Faixa de valuation (cenários)
    dados.valuation_faixa = {
        conservador: Math.round(receitaAnual * (multiploFinal * 0.8) * 100) / 100,
        realista: dados.valuation,
        otimista: Math.round(receitaAnual * (multiploFinal * 1.3) * 100) / 100
    };

    return dados;
}

// ============================================================
// CALCULAR VALUATION DO CATÁLOGO INTEIRO
// ============================================================
async function calcularValuationCatalogo() {
    const idx = await getKV('streams_index') || [];
    const valuations = [];

    for (const id of idx) {
        try {
            // Busca video_id do YouTube se existir
            const musica = await getKV('musica_' + id) || {};
            const videoId = musica.youtube_video_id || null;
            const v = await calcularValuation(id, videoId);
            valuations.push(v);
        } catch (e) {
            console.error('Erro valuation para', id, e.message);
        }
    }

    // Ordena por valuation
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
    const { action, music_id, video_id } = params;

    console.log(`💰 [valuation] ${action}`);

    try {
        // ============================================================
        // CALCULAR VALUATION DE UMA MÚSICA
        // ============================================================
        if (action === 'calcular') {
            if (!music_id) {
                return res.status(200).json({ success: false, message: 'music_id obrigatório' });
            }

            const resultado = await calcularValuation(music_id, video_id);
            await setKV('valuation_' + music_id, resultado);

            console.log(`💰 [valuation] ${music_id} | receita: R$ ${resultado.receita_anual_projetada} | ELO: ${resultado.elo} | valuation: R$ ${resultado.valuation}`);

            return res.status(200).json({ success: true, data: resultado });
        }

        // ============================================================
        // CALCULAR VALUATION DO CATÁLOGO
        // ============================================================
        if (action === 'catalogo') {
            const resultado = await calcularValuationCatalogo();
            await setKV('valuation_catalogo', resultado);

            return res.status(200).json({ success: true, data: resultado });
        }

        // ============================================================
        // VER VALUATION DE UMA MÚSICA (cache)
        // ============================================================
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

        // ============================================================
        // VER ÚLTIMO CATÁLOGO CALCULADO
        // ============================================================
        if (action === 'ultimo_catalogo') {
            const v = await getKV('valuation_catalogo');
            return res.status(200).json({
                success: true,
                data: v || { valuation_total: 0, quantidade_musicas: 0, musicas: [] }
            });
        }

        // ============================================================
        // CONFIGURAÇÕES DE MERCADO
        // ============================================================
        if (action === 'mercado') {
            return res.status(200).json({ success: true, data: MERCADO });
        }

        // ============================================================
        // DEFAULT
        // ============================================================
        return res.status(200).json({
            success: true,
            message: '💰 PLAY MY Valuation API',
            version: '1.0.0',
            acoes: [
                '?action=calcular&music_id=X&video_id=Y',
                '?action=catalogo',
                '?action=ver&music_id=X',
                '?action=ultimo_catalogo',
                '?action=mercado'
            ]
        });

    } catch (e) {
        console.error('❌ [valuation] Erro:', e);
        return res.status(200).json({ success: false, message: e.message });
    }
};
