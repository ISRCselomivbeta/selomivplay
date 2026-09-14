// ============================================================
// api/isrc.js — PLAY MY v1.0.0
// Busca automática de ISRC + validação + vínculo com YouTube.
//
// O ISRC (International Standard Recording Code) é obrigatório
// para ofertar a música na IPO do PLAY MY.
//
// Formato: CC-XXX-YY-NNNNN (12 caracteres)
//   CC  = país (2 letras)
//   XXX = registrante (3 caracteres)
//   YY  = ano (2 dígitos)
//   NNNNN = designação (5 dígitos)
// ============================================================

let kv = null;
try {
    kv = require('@vercel/kv').kv;
    console.log('✅ [isrc] Vercel KV carregado');
} catch (e) {
    console.warn('⚠️ [isrc] KV não instalado — usando fallback');
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
// VALIDAR FORMATO DO ISRC
// ============================================================
function validarISRC(isrc) {
    if (!isrc || typeof isrc !== 'string') return false;

    const limpo = isrc.replace(/[-\s]/g, '').toUpperCase();

    if (limpo.length !== 12) return false;

    // Formato: 2 letras + 3 alfanuméricos + 2 dígitos + 5 dígitos
    const regex = /^[A-Z]{2}[A-Z0-9]{3}[0-9]{2}[0-9]{5}$/;
    return regex.test(limpo);
}

// ============================================================
// NORMALIZAR ISRC (remove hífens, uppercase)
// ============================================================
function normalizarISRC(isrc) {
    if (!isrc) return null;
    return isrc.replace(/[-\s]/g, '').toUpperCase();
}

// ============================================================
// FORMATAR ISRC PARA EXIBIÇÃO (CC-XXX-YY-NNNNN)
// ============================================================
function formatarISRC(isrc) {
    if (!isrc) return '';
    const limpo = normalizarISRC(isrc);
    if (limpo.length !== 12) return isrc;
    return `${limpo.slice(0, 2)}-${limpo.slice(2, 5)}-${limpo.slice(5, 7)}-${limpo.slice(7)}`;
}

// ============================================================
// EXTRAIR VIDEO ID DO YOUTUBE
// ============================================================
function extrairVideoId(url) {
    if (!url || typeof url !== 'string') return null;
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
        /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
        /youtu\.be\/([^&\n?#]+)/,
        /youtube\.com\/shorts\/([^&\n?#]+)/
    ];
    for (let p of patterns) {
        const m = url.match(p);
        if (m && m[1] && m[1].length === 11) return m[1];
    }
    return null;
}

// ============================================================
// BUSCAR INFO DO YOUTUBE (título, artista, capa, views)
// ============================================================
async function buscarInfoYouTube(videoId) {
    if (!videoId) return null;
    try {
        const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoId}&key=${YOUTUBE_API_KEY}`;
        const r = await fetch(url);
        const j = await r.json();
        if (!j.items || !j.items[0]) return null;
        const v = j.items[0];
        return {
            video_id: videoId,
            titulo: v.snippet.title,
            canal: v.snippet.channelTitle,
            descricao: v.snippet.description || '',
            link_youtube: 'https://www.youtube.com/watch?v=' + videoId,
            link_capa: v.snippet.thumbnails.high.url,
            views: parseInt(v.statistics.viewCount || 0),
            likes: parseInt(v.statistics.likeCount || 0),
            comments: parseInt(v.statistics.commentCount || 0),
            publicado_em: v.snippet.publishedAt
        };
    } catch (e) {
        console.warn('[isrc] YouTube falhou:', e.message);
        return null;
    }
}

// ============================================================
// BUSCAR ISRC NO MUSICBRAINZ
// ============================================================
async function buscarIsrcMusicBrainz(titulo, artista) {
    const resultados = [];

    try {
        const query = artista
            ? `recording:"${titulo}" AND artist:"${artista}"`
            : `recording:"${titulo}"`;

        const url = `https://musicbrainz.org/ws/2/recording/?query=${encodeURIComponent(query)}&fmt=json&limit=10`;

        const r = await fetch(url, {
            headers: {
                'User-Agent': 'PLAYMY/1.0 (contato@playmy.com.br)',
                'Accept': 'application/json'
            }
        });

        if (!r.ok) {
            console.warn('[isrc] MusicBrainz HTTP', r.status);
            return resultados;
        }

        const data = await r.json();

        if (data.recordings) {
            for (const rec of data.recordings) {
                if (rec.isrcs && rec.isrcs.length) {
                    for (const isrc of rec.isrcs) {
                        const artistas = (rec['artist-credit'] || [])
                            .map(a => a.name || (a.artist && a.artist.name) || '')
                            .filter(Boolean)
                            .join(', ');

                        resultados.push({
                            isrc: normalizarISRC(isrc),
                            isrc_formatado: formatarISRC(isrc),
                            titulo: rec.title,
                            artista: artistas,
                            duracao_ms: rec.length || null,
                            score: rec.score || 0,
                            fonte: 'musicbrainz',
                            mb_id: rec.id
                        });
                    }
                }
            }
        }
    } catch (e) {
        console.warn('[isrc] MusicBrainz erro:', e.message);
    }

    return resultados;
}

// ============================================================
// BUSCA COMBINADA (MusicBrainz + fallback)
// ============================================================
async function buscarIsrc(titulo, artista, videoId) {
    let tituloBusca = titulo || '';
    let artistaBusca = artista || '';

    // Se tem vídeo do YouTube, usa como base
    if (videoId) {
        const info = await buscarInfoYouTube(videoId);
        if (info) {
            tituloBusca = tituloBusca || info.titulo;
            artistaBusca = artistaBusca || info.canal;
        }
    }

    if (!tituloBusca) {
        return {
            success: false,
            message: 'Título não identificado',
            isrcs: []
        };
    }

    // Limpa título do YouTube (remove "(Official Video)", "[HD]", etc.)
    tituloBusca = tituloBusca
        .replace(/\(official.*?\)/gi, '')
        .replace(/\[official.*?\]/gi, '')
        .replace(/\(clipe.*?\)/gi, '')
        .replace(/\(áudio.*?\)/gi, '')
        .replace(/\(audio.*?\)/gi, '')
        .replace(/\(lyric.*?\)/gi, '')
        .replace(/\(hd.*?\)/gi, '')
        .replace(/\[hd\]/gi, '')
        .replace(/oficial/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

    // Busca no MusicBrainz
    const isrcs = await buscarIsrcMusicBrainz(tituloBusca, artistaBusca);

    // Remove duplicatas
    const unicos = {};
    for (const item of isrcs) {
        const key = item.isrc;
        if (!unicos[key] || (item.score || 0) > (unicos[key].score || 0)) {
            unicos[key] = item;
        }
    }

    const lista = Object.values(unicos).sort((a, b) => (b.score || 0) - (a.score || 0));

    return {
        success: true,
        titulo_consultado: tituloBusca,
        artista_consultado: artistaBusca,
        isrcs: lista.slice(0, 10),
        total: lista.length,
        fonte: 'musicbrainz'
    };
}

// ============================================================
// VINCULAR ISRC A UMA MÚSICA (registra no KV)
// ============================================================
async function vincularIsrc(music_id, isrc, video_id, dados_extras) {
    const isrcNormalizado = normalizarISRC(isrc);

    // Verifica se ISRC já está vinculado a outra música
    const isrcKey = 'isrc_' + isrcNormalizado;
    const existente = await getKV(isrcKey);
    if (existente && existente.music_id !== music_id) {
        return {
            success: false,
            message: 'Este ISRC já está vinculado a outra música',
            conflito: existente
        };
    }

    // Registra o vínculo
    const vinculo = {
        music_id: music_id,
        isrc: isrcNormalizado,
        isrc_formatado: formatarISRC(isrcNormalizado),
        video_id: video_id || null,
        titulo: dados_extras && dados_extras.titulo || null,
        artista: dados_extras && dados_extras.artista || null,
        vinculado_em: new Date().toISOString()
    };

    await setKV(isrcKey, vinculo);

    // Adiciona ao índice de ISRCs
    let idx = await getKV('isrc_index') || [];
    if (!idx.includes(isrcNormalizado)) {
        idx.push(isrcNormalizado);
        await setKV('isrc_index', idx);
    }

    console.log(`🔗 [isrc] ${isrcNormalizado} vinculado à música ${music_id}`);
    return { success: true, data: vinculo };
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
    const { action, isrc, music_id, titulo, artista, link_youtube, video_id } = params;

    console.log(`🎵 [isrc] ${action}`);

    try {
        // ============================================================
        // 1. VALIDAR ISRC
        // ============================================================
        if (action === 'validar') {
            if (!isrc) {
                return res.status(200).json({ success: false, message: 'isrc obrigatório' });
            }

            const valido = validarISRC(isrc);
            const normalizado = normalizarISRC(isrc);

            return res.status(200).json({
                success: true,
                data: {
                    isrc_original: isrc,
                    isrc_normalizado: normalizado,
                    isrc_formatado: formatarISRC(normalizado),
                    valido: valido,
                    formato_esperado: 'CC-XXX-YY-NNNNN (12 caracteres)'
                }
            });
        }

        // ============================================================
        // 2. BUSCAR ISRC AUTOMATICAMENTE
        // ============================================================
        if (action === 'buscar') {
            let videoId = video_id;
            if (link_youtube && !videoId) {
                videoId = extrairVideoId(link_youtube);
            }

            if (!titulo && !videoId) {
                return res.status(200).json({
                    success: false,
                    message: 'Informe título ou link do YouTube'
                });
            }

            const resultado = await buscarIsrc(titulo, artista, videoId);

            return res.status(200).json(resultado);
        }

        // ============================================================
        // 3. VINCULAR ISRC A UMA MÚSICA
        // ============================================================
        if (action === 'vincular') {
            if (!music_id || !isrc) {
                return res.status(200).json({
                    success: false,
                    message: 'music_id e isrc obrigatórios'
                });
            }

            if (!validarISRC(isrc)) {
                return res.status(200).json({
                    success: false,
                    message: 'ISRC inválido. Formato esperado: CC-XXX-YY-NNNNN'
                });
            }

            let vid = video_id;
            if (link_youtube && !vid) vid = extrairVideoId(link_youtube);

            const resultado = await vincularIsrc(music_id, isrc, vid, {
                titulo: titulo,
                artista: artista
            });

            return res.status(200).json(resultado);
        }

        // ============================================================
        // 4. VER VÍNCULO DE UM ISRC
        // ============================================================
        if (action === 'ver') {
            if (!isrc) {
                return res.status(200).json({ success: false, message: 'isrc obrigatório' });
            }

            const normalizado = normalizarISRC(isrc);
            const vinculo = await getKV('isrc_' + normalizado);

            return res.status(200).json({
                success: true,
                data: vinculo || {
                    isrc: normalizado,
                    vinculado: false,
                    message: 'ISRC não vinculado a nenhuma música ainda'
                }
            });
        }

        // ============================================================
        // 5. LISTAR TODOS OS ISRCs VINCULADOS
        // ============================================================
        if (action === 'listar') {
            const idx = await getKV('isrc_index') || [];
            const lista = [];

            for (const codigo of idx) {
                const v = await getKV('isrc_' + codigo);
                if (v) lista.push(v);
            }

            return res.status(200).json({
                success: true,
                data: {
                    total: lista.length,
                    isrcs: lista
                }
            });
        }

        // ============================================================
        // 6. INFO COMPLETA (ISRC + YouTube + Música)
        // ============================================================
        if (action === 'info') {
            if (!link_youtube && !isrc && !music_id) {
                return res.status(200).json({
                    success: false,
                    message: 'Informe link_youtube, isrc ou music_id'
                });
            }

            let videoId = video_id;
            if (link_youtube) videoId = extrairVideoId(link_youtube);

            // Info do YouTube
            let infoYt = null;
            if (videoId) infoYt = await buscarInfoYouTube(videoId);

            // Vínculo de ISRC
            let vinculoIsrc = null;
            if (isrc) {
                const normalizado = normalizarISRC(isrc);
                vinculoIsrc = await getKV('isrc_' + normalizado);
            }

            // Busca automática de ISRC se não tiver
            let isrcsEncontrados = [];
            if (!vinculoIsrc && infoYt) {
                const busca = await buscarIsrc(infoYt.titulo, infoYt.canal, videoId);
                isrcsEncontrados = busca.isrcs || [];
            }

            return res.status(200).json({
                success: true,
                data: {
                    youtube: infoYt,
                    isrc_vinculado: vinculoIsrc,
                    isrcs_encontrados: isrcsEncontrados
                }
            });
        }

        // ============================================================
        // 7. DEFAULT
        // ============================================================
        return res.status(200).json({
            success: true,
            message: '🎵 PLAY MY ISRC API',
            version: '1.0.0',
            acoes: [
                '?action=validar&isrc=BR-ABC-26-00001',
                '?action=buscar&titulo=X&artista=Y',
                '?action=buscar&link_youtube=https://...',
                '?action=vincular&music_id=X&isrc=Y&link_youtube=Z',
                '?action=ver&isrc=X',
                '?action=listar',
                '?action=info&link_youtube=X'
            ]
        });

    } catch (e) {
        console.error('❌ [isrc] Erro:', e);
        return res.status(200).json({ success: false, message: e.message });
    }
};
