// ============================================================
// api/royalties.js — PLAY MY v1.0.0
// Importa relatório da ROC Nation (CSV) e distribui royalties.
// Depende de: Vercel KV (mesmo do backend.js)
// ============================================================

let kv = null;
try {
    kv = require('@vercel/kv').kv;
    console.log('✅ [royalties] Vercel KV carregado');
} catch (e) {
    console.warn('⚠️ [royalties] @vercel/kv não instalado — usando fallback em memória');
}

const crypto = require('crypto');

// ============================================================
// STORAGE EM MEMÓRIA (FALLBACK)
// ============================================================
const MEMORY_STORAGE = {};

const Storage = {
    async get(key) {
        if (kv) {
            try {
                const value = await kv.get('playmy:' + key);
                if (value !== null && value !== undefined) return value;
            } catch (e) { console.warn('KV get error:', e.message); }
        }
        return MEMORY_STORAGE[key] !== undefined ? MEMORY_STORAGE[key] : null;
    },
    async set(key, value) {
        if (kv) {
            try { await kv.set('playmy:' + key, value); return true; } catch (e) { console.warn('KV set error:', e.message); }
        }
        MEMORY_STORAGE[key] = value;
        return true;
    }
};

// ============================================================
// HELPERS
// ============================================================
function sanitize(input) {
    if (typeof input !== 'string') return input;
    return input.trim().replace(/[<>]/g, '').slice(0, 500);
}

function sha256(str) {
    return crypto.createHash('sha256').update(str).digest('hex');
}

// ============================================================
// ADICIONAR BLOCO NA BLOCKCHAIN INTERNA
// ============================================================
async function addBlockToChain(data) {
    let chain = await Storage.get('blockchain');
    if (!chain || !chain.blocks) chain = { blocks: [] };
    const last = chain.blocks[chain.blocks.length - 1];
    const prevHash = last ? last.hash : '0'.repeat(64);
    const index = chain.blocks.length + 1;
    const timestamp = new Date().toISOString();
    let nonce = 0;
    let hash = '';
    for (let i = 0; i < 10000; i++) {
        hash = sha256(index + timestamp + JSON.stringify(data) + prevHash + i);
        if (hash.startsWith('00')) { nonce = i; break; }
        nonce = i;
    }
    const block = { index, timestamp, data, prevHash, nonce, hash };
    chain.blocks.push(block);
    if (chain.blocks.length > 500) chain.blocks = chain.blocks.slice(-500);
    await Storage.set('blockchain', chain);
    return block;
}

// ============================================================
// PARSER DE CSV DA ROC NATION
// ============================================================
// Aceita CSV com cabeçalho em qualquer ordem.
// Colunas reconhecidas (case-insensitive):
//   - isrc | track_id | musica_id
//   - title | track_title | titulo
//   - platform | plataforma | service
//   - country | pais
//   - streams | quantity
//   - net_revenue | revenue | receita | earnings | net
// ============================================================
function parseRocNationCSV(csv) {
    const linhas = csv.split(/\r?\n/).filter(l => l.trim());
    if (linhas.length < 2) {
        return { erro: 'CSV vazio ou sem dados', porMusica: {} };
    }

    // Detecta separador (vírgula, ponto-e-vírgula ou tab)
    const sep = linhas[0].includes('\t') ? '\t' :
                linhas[0].includes(';') ? ';' : ',';

    const cabecalho = linhas[0].split(sep).map(c => c.trim().toLowerCase().replace(/[^a-z0-9_]/g, ''));

    // Mapeia colunas
    const idx = {
        isrc: cabecalho.findIndex(c => ['isrc', 'trackid', 'musicid', 'id'].includes(c)),
        titulo: cabecalho.findIndex(c => ['title', 'tracktitle', 'titulo', 'song', 'songtitle'].includes(c)),
        plataforma: cabecalho.findIndex(c => ['platform', 'plataforma', 'service', 'store'].includes(c)),
        pais: cabecalho.findIndex(c => ['country', 'pais', 'territory'].includes(c)),
        streams: cabecalho.findIndex(c => ['streams', 'quantity', 'plays', 'count'].includes(c)),
        receita: cabecalho.findIndex(c => ['netrevenue', 'revenue', 'receita', 'earnings', 'net', 'amount'].includes(c))
    };

    if (idx.isrc === -1 && idx.titulo === -1) {
        return { erro: 'CSV sem coluna de ISRC nem Título', porMusica: {} };
    }
    if (idx.receita === -1) {
        return { erro: 'CSV sem coluna de receita', porMusica: {} };
    }

    const porMusica = {};

    for (let i = 1; i < linhas.length; i++) {
        const cols = linhas[i].split(sep).map(c => c.trim().replace(/^"|"$/g, ''));
        if (cols.length < 2) continue;

        const isrc = idx.isrc >= 0 ? cols[idx.isrc] : '';
        const titulo = idx.titulo >= 0 ? cols[idx.titulo] : '';
        const plataforma = idx.plataforma >= 0 ? cols[idx.plataforma] : 'unknown';
        const pais = idx.pais >= 0 ? cols[idx.pais] : 'BR';
        const streams = idx.streams >= 0 ? parseInt(cols[idx.streams].replace(/[^\d]/g, '')) || 0 : 0;
        const receita = idx.receita >= 0 ? parseFloat(cols[idx.receita].replace(/[^\d.-]/g, '')) || 0 : 0;

        // Chave da música: ISRC se tiver, senão título normalizado
        const chave = isrc || titulo.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 40);

        if (!chave) continue;

        if (!porMusica[chave]) {
            porMusica[chave] = {
                chave: chave,
                isrc: isrc || null,
                titulo: titulo || 'Sem título',
                streams_total: 0,
                receita_total: 0,
                plataformas: {},
                paises: {}
            };
        }

        porMusica[chave].streams_total += streams;
        porMusica[chave].receita_total += receita;
        porMusica[chave].plataformas[plataforma] =
            (porMusica[chave].plataformas[plataforma] || 0) + streams;
        porMusica[chave].paises[pais] =
            (porMusica[chave].paises[pais] || 0) + streams;
    }

    return { erro: null, porMusica: porMusica };
}

// ============================================================
// HANDLER PRINCIPAL
// ============================================================
module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const params = req.method === 'POST' ? req.body : req.query;
    const { action } = params;

    console.log(`💰 [royalties] ${action}`);

    try {
        // ============================================================
        // 1. IMPORTAR CSV DA ROC NATION
        // ============================================================
        if (action === 'importar') {
            const csv = (req.method === 'POST' ? req.body.csv : params.csv) || '';
            const periodo = params.periodo || new Date().toISOString().slice(0, 7);

            if (!csv) {
                return res.status(200).json({
                    success: false,
                    message: 'CSV obrigatório. Envie via POST (body.csv) ou GET (query.csv)'
                });
            }

            console.log(`💰 [royalties] importando CSV (${csv.length} chars)`);
            const resultado = parseRocNationCSV(csv);

            if (resultado.erro) {
                return res.status(200).json({ success: false, message: resultado.erro });
            }

            const musicas = Object.values(resultado.porMusica);
            if (!musicas.length) {
                return res.status(200).json({ success: false, message: 'Nenhuma música encontrada no CSV' });
            }

            // Salva no KV por período
            const chavePeriodo = 'royalties_' + periodo;
            await Storage.set(chavePeriodo, {
                periodo: periodo,
                importado_em: new Date().toISOString(),
                total_musicas: musicas.length,
                musicas: resultado.porMusica
            });

            // Atualiza índice de períodos
            let periodos = await Storage.get('royalties_periodos') || [];
            if (!periodos.includes(periodo)) {
                periodos.push(periodo);
                await Storage.set('royalties_periodos', periodos);
            }

            // Soma total
            const totalReceita = musicas.reduce((s, m) => s + m.receita_total, 0);
            const totalStreams = musicas.reduce((s, m) => s + m.streams_total, 0);

            // Registra na blockchain
            await addBlockToChain({
                type: 'importacao_royalties',
                periodo: periodo,
                total_musicas: musicas.length,
                total_receita: totalReceita,
                total_streams: totalStreams
            });

            console.log(`💰 [royalties] ${musicas.length} músicas | R$ ${totalReceita.toFixed(2)} | ${totalStreams} streams`);

            return res.status(200).json({
                success: true,
                message: 'Relatório importado com sucesso',
                data: {
                    periodo: periodo,
                    total_musicas: musicas.length,
                    total_streams: totalStreams,
                    total_receita: totalReceita,
                    moeda: 'BRL',
                    musicas: musicas.slice(0, 10) // amostra
                }
            });
        }

        // ============================================================
        // 2. LISTAR PERÍODOS IMPORTADOS
        // ============================================================
        if (action === 'periodos') {
            const periodos = await Storage.get('royalties_periodos') || [];
            const detalhes = [];

            for (const p of periodos) {
                const dados = await Storage.get('royalties_' + p);
                if (dados) {
                    detalhes.push({
                        periodo: p,
                        importado_em: dados.importado_em,
                        total_musicas: dados.total_musicas,
                        total_receita: Object.values(dados.musicas).reduce((s, m) => s + m.receita_total, 0)
                    });
                }
            }

            return res.status(200).json({ success: true, data: detalhes });
        }

        // ============================================================
        // 3. STATUS DE UM PERÍODO
        // ============================================================
        if (action === 'status') {
            const periodo = params.periodo || new Date().toISOString().slice(0, 7);
            const dados = await Storage.get('royalties_' + periodo);

            if (!dados) {
                return res.status(200).json({
                    success: false,
                    message: 'Nenhum relatório importado para o período ' + periodo
                });
            }

            const musicas = Object.values(dados.musicas);
            return res.status(200).json({
                success: true,
                data: {
                    periodo: periodo,
                    importado_em: dados.importado_em,
                    total_musicas: dados.total_musicas,
                    total_receita: musicas.reduce((s, m) => s + m.receita_total, 0),
                    total_streams: musicas.reduce((s, m) => s + m.streams_total, 0)
                }
            });
        }

        // ============================================================
        // 4. DISTRIBUIR ROYALTIES DE UMA MÚSICA
        // ============================================================
        if (action === 'distribuir') {
            const periodo = params.periodo || new Date().toISOString().slice(0, 7);
            const musicaChave = params.musica_chave;
            const percentualInvestidores = parseFloat(params.percentual || '20') / 100;

            if (!musicaChave) {
                return res.status(200).json({ success: false, message: 'musica_chave obrigatória' });
            }

            const dadosPeriodo = await Storage.get('royalties_' + periodo);
            if (!dadosPeriodo) {
                return res.status(200).json({ success: false, message: 'Período não importado' });
            }

            const musica = dadosPeriodo.musicas[musicaChave];
            if (!musica) {
                return res.status(200).json({ success: false, message: 'Música não encontrada no período' });
            }

            // Busca investidores dessa música
            const investidores = await Storage.get('investidores_' + musicaChave) || [];
            if (!investidores.length) {
                return res.status(200).json({
                    success: false,
                    message: 'Nenhum investidor registrado para essa música',
                    data: { musica: musica }
                });
            }

            // Verifica se já distribuiu
            const distKey = 'distribuicao_' + periodo + '_' + musicaChave;
            const jaDistribuiu = await Storage.get(distKey);
            if (jaDistribuiu) {
                return res.status(200).json({
                    success: false,
                    message: 'Royalties já distribuídos para essa música neste período',
                    data: jaDistribuiu
                });
            }

            const parteInvestidores = musica.receita_total * percentualInvestidores;
            const totalAcoes = investidores.reduce((s, i) => s + (i.acoes || 0), 0);

            if (totalAcoes === 0) {
                return res.status(200).json({ success: false, message: 'Total de ações é zero' });
            }

            const distribuicoes = investidores.map(inv => {
                const proporcao = (inv.acoes || 0) / totalAcoes;
                const valor = parteInvestidores * proporcao;
                return {
                    user_id: inv.user_id,
                    acoes: inv.acoes,
                    proporcao: Math.round(proporcao * 10000) / 100,
                    valor: Math.round(valor * 100) / 100
                };
            });

            // Credita no extrato de cada investidor
            for (const d of distribuicoes) {
                const extratoKey = 'extrato_' + d.user_id;
                const extrato = await Storage.get(extratoKey) || [];
                extrato.push({
                    tipo: 'royalty',
                    periodo: periodo,
                    musica_chave: musicaChave,
                    musica_titulo: musica.titulo,
                    valor: d.valor,
                    data: new Date().toISOString()
                });
                await Storage.set(extratoKey, extrato);

                // Atualiza saldo
                const saldoKey = 'saldo_' + d.user_id;
                const saldo = await Storage.get(saldoKey) || { saldo_disponivel: 0, selo_coin: 0 };
                saldo.saldo_disponivel = (saldo.saldo_disponivel || 0) + d.valor;
                await Storage.set(saldoKey, saldo);
            }

            const resumo = {
                periodo: periodo,
                musica_chave: musicaChave,
                musica_titulo: musica.titulo,
                receita_bruta: musica.receita_total,
                streams: musica.streams_total,
                percentual_investidores: percentualInvestidores * 100,
                parte_investidores: Math.round(parteInvestidores * 100) / 100,
                total_acoes: totalAcoes,
                total_investidores: distribuicoes.length,
                distribuicoes: distribuicoes,
                distribuido_em: new Date().toISOString()
            };

            await Storage.set(distKey, resumo);

            // Registra na blockchain
            await addBlockToChain({
                type: 'distribuicao_royalties',
                periodo: periodo,
                musica_chave: musicaChave,
                valor_total: parteInvestidores,
                investidores: distribuicoes.length
            });

            console.log(`💰 [royalties] distribuído R$ ${parteInvestidores.toFixed(2)} para ${distribuicoes.length} investidores`);

            return res.status(200).json({ success: true, data: resumo });
        }

        // ============================================================
        // 5. DISTRIBUIR TODAS AS MÚSICAS DE UM PERÍODO
        // ============================================================
        if (action === 'distribuir_tudo') {
            const periodo = params.periodo || new Date().toISOString().slice(0, 7);
            const percentualInvestidores = parseFloat(params.percentual || '20') / 100;

            const dadosPeriodo = await Storage.get('royalties_' + periodo);
            if (!dadosPeriodo) {
                return res.status(200).json({ success: false, message: 'Período não importado' });
            }

            const resultados = [];
            for (const chave of Object.keys(dadosPeriodo.musicas)) {
                const distKey = 'distribuicao_' + periodo + '_' + chave;
                const jaDistribuiu = await Storage.get(distKey);
                if (jaDistribuiu) {
                    resultados.push({ musica_chave: chave, status: 'já_distribuido' });
                    continue;
                }

                const investidores = await Storage.get('investidores_' + chave) || [];
                if (!investidores.length) {
                    resultados.push({ musica_chave: chave, status: 'sem_investidores' });
                    continue;
                }

                const musica = dadosPeriodo.musicas[chave];
                const parteInvestidores = musica.receita_total * percentualInvestidores;
                const totalAcoes = investidores.reduce((s, i) => s + (i.acoes || 0), 0);
                if (totalAcoes === 0) {
                    resultados.push({ musica_chave: chave, status: 'acoes_zero' });
                    continue;
                }

                const distribuicoes = investidores.map(inv => ({
                    user_id: inv.user_id,
                    acoes: inv.acoes,
                    proporcao: Math.round(((inv.acoes || 0) / totalAcoes) * 10000) / 100,
                    valor: Math.round(parteInvestidores * ((inv.acoes || 0) / totalAcoes) * 100) / 100
                }));

                for (const d of distribuicoes) {
                    const extratoKey = 'extrato_' + d.user_id;
                    const extrato = await Storage.get(extratoKey) || [];
                    extrato.push({
                        tipo: 'royalty',
                        periodo: periodo,
                        musica_chave: chave,
                        musica_titulo: musica.titulo,
                        valor: d.valor,
                        data: new Date().toISOString()
                    });
                    await Storage.set(extratoKey, extrato);

                    const saldoKey = 'saldo_' + d.user_id;
                    const saldo = await Storage.get(saldoKey) || { saldo_disponivel: 0, selo_coin: 0 };
                    saldo.saldo_disponivel = (saldo.saldo_disponivel || 0) + d.valor;
                    await Storage.set(saldoKey, saldo);
                }

                const resumo = {
                    periodo: periodo,
                    musica_chave: chave,
                    musica_titulo: musica.titulo,
                    valor_total: Math.round(parteInvestidores * 100) / 100,
                    total_investidores: distribuicoes.length
                };

                await Storage.set(distKey, resumo);
                resultados.push({ musica_chave: chave, status: 'distribuido', ...resumo });
            }

            return res.status(200).json({
                success: true,
                data: {
                    periodo: periodo,
                    total_musicas: Object.keys(dadosPeriodo.musicas).length,
                    resultados: resultados
                }
            });
        }

        // ============================================================
        // 6. EXTRATO DE ROYALTIES DE UM USUÁRIO
        // ============================================================
        if (action === 'extrato_usuario') {
            const userId = params.user_id;
            if (!userId) return res.status(200).json({ success: false, message: 'user_id obrigatório' });

            const extrato = await Storage.get('extrato_' + userId) || [];
            const royalties = extrato.filter(e => e.tipo === 'royalty');

            const totalRecebido = royalties.reduce((s, r) => s + (r.valor || 0), 0);

            return res.status(200).json({
                success: true,
                data: {
                    user_id: userId,
                    total_recebido: Math.round(totalRecebido * 100) / 100,
                    quantidade: royalties.length,
                    ultimos: royalties.slice(-20).reverse()
                }
            });
        }

        // ============================================================
        // 7. RESUMO GERAL DE ROYALTIES
        // ============================================================
        if (action === 'resumo') {
            const periodos = await Storage.get('royalties_periodos') || [];
            const resumo = [];

            for (const p of periodos) {
                const dados = await Storage.get('royalties_' + p);
                if (!dados) continue;

                const musicas = Object.values(dados.musicas);
                const receitaTotal = musicas.reduce((s, m) => s + m.receita_total, 0);
                const streamsTotal = musicas.reduce((s, m) => s + m.streams_total, 0);

                resumo.push({
                    periodo: p,
                    importado_em: dados.importado_em,
                    total_musicas: dados.total_musicas,
                    total_receita: Math.round(receitaTotal * 100) / 100,
                    total_streams: streamsTotal
                });
            }

            return res.status(200).json({ success: true, data: resumo });
        }

        // ============================================================
        // 8. PING
        // ============================================================
        if (action === 'ping') {
            const periodos = await Storage.get('royalties_periodos') || [];
            return res.status(200).json({
                success: true,
                message: 'pong',
                version: '1.0.0',
                kv_enabled: !!kv,
                periodos_importados: periodos.length
            });
        }

        // ============================================================
        // DEFAULT — resumo (compatível com api.js)
        // ⚠️ Envolvido em `data` para o api.js aceitar.
        // ============================================================
        const periodosDefault = await Storage.get('royalties_periodos') || [];
        const resumoDefault = [];

        for (const p of periodosDefault) {
            const dados = await Storage.get('royalties_' + p);
            if (!dados) continue;
            const musicas = Object.values(dados.musicas);
            resumoDefault.push({
                periodo: p,
                importado_em: dados.importado_em,
                total_musicas: dados.total_musicas,
                total_receita: Math.round(musicas.reduce((s, m) => s + m.receita_total, 0) * 100) / 100,
                total_streams: musicas.reduce((s, m) => s + m.streams_total, 0)
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                message: '💰 PLAY MY ROYALTIES API ONLINE',
                version: '1.0.0',
                kv_enabled: !!kv,
                periodos_importados: periodosDefault.length,
                resumo: resumoDefault,
                acoes_disponiveis: [
                    'ping',
                    'importar (POST csv)',
                    'periodos',
                    'status?periodo=YYYY-MM',
                    'distribuir?periodo=YYYY-MM&musica_chave=XXX&percentual=20',
                    'distribuir_tudo?periodo=YYYY-MM&percentual=20',
                    'extrato_usuario?user_id=XXX',
                    'resumo'
                ]
            }
        });

    } catch (error) {
        console.error('❌ [royalties] Erro:', error);
        return res.status(200).json({ success: false, message: 'Erro interno: ' + error.message });
    }
};
