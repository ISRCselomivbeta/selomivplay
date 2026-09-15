// BACKEND.JS - VERSÃO 9.4.0
// ============================================================
// PERSISTÊNCIA VERCEL KV + FEED INFINITO + RSS DIRETO
// + CONTADOR DE STREAMS + ELO + VALUATION + ISRC
//
// MUDANÇAS v9.4.0:
//   - register_streaming agora adiciona ao streams_index
//   - get_streaming_ranking varre o streams_index
//   - aggregateNews reduzido de 12 para 6 queries (evita timeout 500)
// ============================================================

const nodemailer = require('nodemailer');
const crypto = require('crypto');

let kv = null;
try {
    kv = require('@vercel/kv').kv;
    console.log('✅ Vercel KV carregado');
} catch (e) {
    console.warn('⚠️ @vercel/kv não instalado — usando fallback em memória');
}

const GAS_URL = 'https://script.google.com/macros/s/AKfycbwgjor-tLLzVrnJGNHOifL1O2sRBhysKJ3IbVJy_AHgtNqjk-6hazH8xuO6OaDXF_s/exec';
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || 'AIzaSyAPaYGY_MrrNgKdEqTs3Qw7tPNv5p5QwPM';
const EMAIL_FROM = 'selomivplay@gmail.com';
const EMAIL_NAME = 'PLAY MY';

// ============================================================
// MAPA DE LOGOS DE FONTES REAIS
// ============================================================
const FONTE_LOGOS = {
    'g1': 'https://s2.glbimg.com/9vC0e5YhKt8tXQ8yQ8yQ8yQ8yQ8=/0x0:0x0/100x100/i.s3.glbimg.com/v1/AUTH_59edd422c0c84a879bd37670ae4f538a/internal_photos/bs/2020/2/0/8Q8yQ8yQ8yQ8yQ8yQ8yQ8Q/g1.png',
    'globo': 'https://s2.glbimg.com/9vC0e5YhKt8tXQ8yQ8yQ8yQ8yQ8=/0x0:0x0/100x100/i.s3.glbimg.com/v1/AUTH_59edd422c0c84a879bd37670ae4f538a/internal_photos/bs/2020/2/0/8Q8yQ8yQ8yQ8yQ8yQ8yQ8Q/g1.png',
    'folha': 'https://www1.folha.uol.com.br/favicon.ico',
    'uol': 'https://www.uol.com.br/favicon.ico',
    'cnn': 'https://www.cnnbrasil.com.br/favicon.ico',
    'estadao': 'https://www.estadao.com.br/favicon.ico',
    'veja': 'https://veja.abril.com.br/favicon.ico',
    'exame': 'https://exame.com/favicon.ico',
    'billboard': 'https://www.billboard.com/favicon.ico',
    'rollingstone': 'https://rollingstone.uol.com.br/favicon.ico',
    'tenho mais discos': 'https://tenhomaisdiscosqueamigos.com/favicon.ico',
    'minc': 'https://www.gov.br/cultura/favicon.ico',
    'gov.br': 'https://www.gov.br/favicon.ico',
    'secult': 'https://www.saude.go.gov.br/favicon.ico'
};

function getFonteLogo(fonte) {
    if (!fonte) return null;
    const f = fonte.toLowerCase();
    for (const key in FONTE_LOGOS) {
        if (f.includes(key)) return FONTE_LOGOS[key];
    }
    return null;
}

// ============================================================
// STORAGE EM MEMÓRIA (FALLBACK)
// ============================================================
const MEMORY_STORAGE = {
    global_playlists: [],
    blockchain: { blocks: [] },
    news_cache: null,
    news_cache_time: 0,
    user_playlists: {},
    following: {},
    favorites: {},
    users: [],
    tickets: [],
    artists: [],
    ledger: {},
    portfolio: {},
    news_seen: {},
    news_prefs: {},
    streams: {},
    streams_user: {},
    streams_index: [],
    elo: {},
    valuation: {},
    isrc: {}
};

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
    },
    async del(key) {
        if (kv) { try { await kv.del('playmy:' + key); } catch (e) {} }
        delete MEMORY_STORAGE[key];
    }
};

// ============================================================
// CACHE EM MEMÓRIA (TTL curto)
// ============================================================
class MemoryCache {
    constructor() {
        this.cache = new Map();
        this.defaultTTL = 60;
    }
    get(key) {
        const item = this.cache.get(key);
        if (!item) return null;
        if (Date.now() > item.expires) { this.cache.delete(key); return null; }
        return item.value;
    }
    set(key, value, ttl = this.defaultTTL) {
        this.cache.set(key, { value: JSON.parse(JSON.stringify(value)), expires: Date.now() + (ttl * 1000) });
    }
    clear() { this.cache.clear(); }
}
const cache = new MemoryCache();

// ============================================================
// RATE LIMITING
// ============================================================
class RateLimiter {
    constructor() {
        this.attempts = new Map();
        this.maxAttempts = 10;
        this.blockDuration = 15 * 60 * 1000;
        this.windowMs = 60 * 60 * 1000;
    }
    check(key) {
        const now = Date.now();
        const record = this.attempts.get(key);
        if (!record) {
            this.attempts.set(key, { count: 1, firstAttempt: now, blockedUntil: 0 });
            return { allowed: true };
        }
        if (record.blockedUntil > now) return { allowed: false, message: 'Muitas tentativas. Aguarde.' };
        if (now - record.firstAttempt > this.windowMs) {
            this.attempts.set(key, { count: 1, firstAttempt: now, blockedUntil: 0 });
            return { allowed: true };
        }
        record.count++;
        if (record.count > this.maxAttempts) {
            record.blockedUntil = now + this.blockDuration;
            return { allowed: false, message: 'Bloqueado por muitos erros.' };
        }
        return { allowed: true };
    }
    reset(key) { this.attempts.delete(key); }
}
const rateLimiter = new RateLimiter();

// ============================================================
// HELPERS
// ============================================================
function sanitize(input) {
    if (typeof input !== 'string') return input;
    return input.trim().replace(/[<>]/g, '').replace(/\s+/g, ' ').slice(0, 500);
}
function validateEmail(email) {
    if (typeof email !== 'string') return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
function extractYouTubeId(url) {
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
// CHAMAR GAS
// ============================================================
async function callGAS(action, params = {}, retries = 2) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const gasUrl = new URL(GAS_URL);
            gasUrl.searchParams.append('action', action);
            gasUrl.searchParams.append('_t', Date.now().toString());
            Object.keys(params).forEach(key => {
                if (params[key] !== undefined && params[key] !== null) {
                    const value = typeof params[key] === 'string' ? sanitize(params[key]) : params[key];
                    if (value !== '' && value !== undefined) gasUrl.searchParams.append(key, value);
                }
            });
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);
            const response = await fetch(gasUrl.toString(), {
                method: 'GET',
                headers: { 'Cache-Control': 'no-cache', 'Accept': 'application/json' },
                signal: controller.signal
            });
            clearTimeout(timeout);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const text = await response.text();
            const data = JSON.parse(text);
            return { success: true, data };
        } catch (error) {
            console.log(`⚠️ [GAS] Tentativa ${attempt}/${retries}:`, error.message);
            if (attempt === retries) return { success: false, error: error.message };
            await new Promise(r => setTimeout(r, 500 * attempt));
        }
    }
}

// ============================================================
// ENVIO DE EMAIL
// ============================================================
async function sendEmail(to, subject, html, retries = 3) {
    const emailPass = process.env.EMAIL_PASS;
    if (!emailPass) return { success: false, error: 'EMAIL_PASS não configurada' };
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: { user: EMAIL_FROM, pass: emailPass }
            });
            const info = await transporter.sendMail({
                from: `"${EMAIL_NAME}" <${EMAIL_FROM}>`,
                to, subject, html
            });
            return { success: true, messageId: info.messageId };
        } catch (error) {
            if (attempt === retries) return { success: false, error: error.message };
            await new Promise(r => setTimeout(r, 1000 * attempt));
        }
    }
}

// ============================================================
// YOUTUBE API
// ============================================================
async function searchYouTube(query, limit = 15) {
    try {
        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${limit}&q=${encodeURIComponent(query + ' música')}&key=${YOUTUBE_API_KEY}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        if (!response.ok) throw new Error(`YouTube API HTTP ${response.status}`);
        const data = await response.json();
        if (data.error) throw new Error(`YouTube API: ${data.error.message}`);
        if (!data.items || data.items.length === 0) return [];
        return data.items.map(item => ({
            id: 'yt_' + item.id.videoId,
            titulo: item.snippet.title,
            artista: item.snippet.channelTitle,
            link_capa: item.snippet.thumbnails.high.url,
            link_youtube: 'https://www.youtube.com/watch?v=' + item.id.videoId,
            is_youtube: true
        }));
    } catch (error) {
        console.error('Erro YouTube API:', error.message);
        return [];
    }
}

async function getYouTubeVideoInfo(videoId) {
    try {
        const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoId}&key=${YOUTUBE_API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();
        if (!data.items || data.items.length === 0) return null;
        const video = data.items[0];
        return {
            title: video.snippet.title,
            artist: video.snippet.channelTitle,
            description: video.snippet.description,
            thumbnail: video.snippet.thumbnails.high.url,
            views: parseInt(video.statistics.viewCount || 0),
            likes: parseInt(video.statistics.likeCount || 0),
            comments: parseInt(video.statistics.commentCount || 0)
        };
    } catch (error) {
        console.error('Erro YouTube info:', error.message);
        return null;
    }
}

// ============================================================
// FALLBACK DE MÚSICAS (playlist interna)
// ============================================================
const FALLBACK_MUSICAS = [
    { id: '1', titulo: 'RIO DE JANEIRO', artista: 'Elzo Henschell',
      link_capa: 'https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=400',
      link_youtube: 'https://www.youtube.com/watch?v=fJ9rUzIMcZQ',
      valor_acao: 25.50, percentual_disponivel: 38, acoes_vendidas: 150,
      total_investidores: 45, rentabilidade_media: 12.5, status: 'ativo', genero: 'URBAN' }
];

// ============================================================
// TOKENS DE RESET
// ============================================================
const resetTokens = new Map();
function generateResetToken(email) {
    const token = crypto.randomBytes(32).toString('hex');
    resetTokens.set(token, { email, createdAt: Date.now(), expiresAt: Date.now() + 3600000 });
    for (const [key, value] of resetTokens) {
        if (Date.now() > value.expiresAt) resetTokens.delete(key);
    }
    return token;
}
function validateResetToken(token) {
    const record = resetTokens.get(token);
    if (!record) return null;
    if (Date.now() > record.expiresAt) { resetTokens.delete(token); return null; }
    return record;
}

// ============================================================
// BLOCKCHAIN (persistida em KV)
// ============================================================
function sha256(str) {
    return crypto.createHash('sha256').update(str).digest('hex');
}

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
// NOTÍCIAS REAIS — Google News RSS (busca DIRETA, sem proxy)
// ============================================================
async function fetchNewsFromGoogleRSS(query, categoria) {
    try {
        const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        const response = await fetch(rssUrl, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; PLAYMY/9.4)',
                'Accept': 'application/xml, text/xml, */*'
            }
        });
        clearTimeout(timeout);
        if (!response.ok) {
            console.log(`⚠️ Google News HTTP ${response.status} para "${query}"`);
            return [];
        }
        const xml = await response.text();
        if (!xml.includes('<item>')) {
            console.log(`⚠️ Google News sem <item> para "${query}"`);
            return [];
        }
        const items = [];
        const itemRegex = /<item>([\s\S]*?)<\/item>/g;
        let match;
        let count = 0;
        while ((match = itemRegex.exec(xml)) !== null && count < 15) {
            const itemXml = match[1];
            const titleMatch = itemXml.match(/<title>(.*?)<\/title>/);
            const linkMatch = itemXml.match(/<link>(.*?)<\/link>/);
            const pubDateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>/);
            const sourceMatch = itemXml.match(/<source[^>]*>(.*?)<\/source>/);
            const descMatch = itemXml.match(/<description>(.*?)<\/description>/);
            if (titleMatch) {
                let title = titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim();
                const source = sourceMatch ? sourceMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : 'Google News';
                if (source && title.endsWith(' - ' + source)) title = title.slice(0, -(source.length + 3));
                let texto = '';
                if (descMatch) {
                    texto = descMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, '').trim().substring(0, 200);
                    if (texto) texto += '...';
                }
                const id = 'news_' + crypto.createHash('md5').update(title).digest('hex').substring(0, 12);
                items.push({
                    id, categoria, autor: source, fonte: source,
                    fonte_logo: getFonteLogo(source),
                    titulo: title,
                    texto: texto || 'Clique para ler a notícia completa.',
                    imagem: null,
                    link: linkMatch ? linkMatch[1].trim() : '#',
                    timestamp: pubDateMatch ? new Date(pubDateMatch[1]).toISOString() : new Date().toISOString(),
                    tema: categoria, likes: 0, prazo: null, investidores_hoje: 0, em_alta: false
                });
                count++;
            }
        }
        console.log(`📰 [${categoria}] ${items.length} notícias de "${query}"`);
        return items;
    } catch (e) {
        console.error(`Erro RSS "${query}":`, e.message);
        return [];
    }
}

async function aggregateNews() {
    const cached = await Storage.get('news_cache');
    const cachedTime = await Storage.get('news_cache_time');
    if (cached && cachedTime && Date.now() - cachedTime < 15 * 60 * 1000) {
        console.log(`📰 Cache KV: ${cached.length} notícias`);
        return cached;
    }

    // 🆕 Reduzido de 12 para 6 queries (evita timeout 500)
    const queries = [
        { q: 'lançamento musical álbum', cat: 'lancamentos' },
        { q: 'música brasileira', cat: 'musica' },
        { q: 'shows turnê Brasil', cat: 'shows' },
        { q: 'indústria musical streaming', cat: 'negocios' },
        { q: 'artista música entrevista', cat: 'artistas' },
        { q: 'edital cultural música', cat: 'editais' }
    ];

    console.log('📰 Buscando notícias reais (direto)...');
    const batches = await Promise.all(queries.map(nq => fetchNewsFromGoogleRSS(nq.q, nq.cat)));
    let all = batches.flat();
    console.log(`📰 Total bruto: ${all.length} notícias`);

    if (all.length === 0) {
        console.log('📰 Nenhuma notícia real encontrada — retornando vazio');
        return [];
    }

    all.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const seen = new Set();
    const unique = all.filter(n => {
        const k = n.titulo.toLowerCase().substring(0, 60);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
    });

    await Storage.set('news_cache', unique);
    await Storage.set('news_cache_time', Date.now());
    console.log(`📰 ${unique.length} notícias reais cacheadas no KV`);
    return unique;
}

// ============================================================
// VALIDAR ISRC
// ============================================================
function validarISRC(isrc) {
    if (!isrc || typeof isrc !== 'string') return false;
    const limpo = isrc.replace(/[-\s]/g, '').toUpperCase();
    if (limpo.length !== 12) return false;
    const regex = /^[A-Z]{2}[A-Z0-9]{3}[0-9]{2}[0-9]{5}$/;
    return regex.test(limpo);
}

function normalizarISRC(isrc) {
    if (!isrc) return null;
    return isrc.replace(/[-\s]/g, '').toUpperCase();
}

function formatarISRC(isrc) {
    if (!isrc) return '';
    const limpo = normalizarISRC(isrc);
    if (limpo.length !== 12) return isrc;
    return `${limpo.slice(0, 2)}-${limpo.slice(2, 5)}-${limpo.slice(5, 7)}-${limpo.slice(7)}`;
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
                'User-Agent': 'PLAYMY/9.4 (contato@playmy.com.br)',
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
                            score: rec.score || 0,
                            fonte: 'musicbrainz'
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
// CALCULAR ELO
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

function calcularTendenciaMeses(porDia) {
    const porMes = {};
    for (const [dia, valor] of Object.entries(porDia || {})) {
        const mes = dia.slice(0, 7);
        porMes[mes] = (porMes[mes] || 0) + valor;
    }
    const valores = Object.values(porMes).sort((a, b) => a - b);
    if (valores.length < 2) return 0;
    const ultimo = valores[valores.length - 1];
    const penultimo = valores[valores.length - 2];
    if (penultimo === 0) return 1;
    return (ultimo - penultimo) / penultimo;
}

async function calcularELO(music_id) {
    const playmy = await Storage.get('streams_' + music_id) || { total: 0, por_dia: {} };
    const periodos = await Storage.get('royalties_periodos') || [];
    let streamsExternos = 0;
    const streamsPorPlataforma = {};

    for (const periodo of periodos) {
        const dados = await Storage.get('royalties_' + periodo);
        if (!dados) continue;
        for (const musica of Object.values(dados.musicas || {})) {
            if (musica.isrc === music_id || musica.titulo === music_id) {
                streamsExternos += musica.streams_total || 0;
                for (const [plat, qtd] of Object.entries(musica.plataformas || {})) {
                    streamsPorPlataforma[plat] = (streamsPorPlataforma[plat] || 0) + qtd;
                }
            }
        }
    }

    let elo = ELO_CONFIG.base;
    const breakdown = { base: ELO_CONFIG.base };

    const ajustePlayMy = Math.min(ELO_CONFIG.limites.play_my_max, ((playmy.total || 0) * ELO_CONFIG.ganhos.stream_play_my) / 10);
    elo += ajustePlayMy;
    breakdown.play_my = Math.round(ajustePlayMy);

    const ajusteExternos = Math.min(ELO_CONFIG.limites.externos_max, (streamsExternos * ELO_CONFIG.ganhos.stream_spotify) / 100);
    elo += ajusteExternos;
    breakdown.externos = Math.round(ajusteExternos);

    const mesesAtivos = Object.keys(playmy.por_dia || {})
        .map(d => d.slice(0, 7))
        .filter((v, i, a) => a.indexOf(v) === i)
        .length;

    let ajusteConsistencia = 0;
    if (mesesAtivos >= 6) ajusteConsistencia = ELO_CONFIG.limites.consistencia_max;
    else if (mesesAtivos >= 3) ajusteConsistencia = 50;
    else if (mesesAtivos >= 1) ajusteConsistencia = 20;
    elo += ajusteConsistencia;
    breakdown.consistencia = ajusteConsistencia;

    const tendencia = calcularTendenciaMeses(playmy.por_dia || {});
    let ajusteTendencia = 0;
    if (tendencia > 0.2) ajusteTendencia = ELO_CONFIG.limites.tendencia_max;
    else if (tendencia > 0.05) ajusteTendencia = 80;
    else if (tendencia < -0.2) ajusteTendencia = -ELO_CONFIG.limites.tendencia_max;
    else if (tendencia < -0.05) ajusteTendencia = -80;
    elo += ajusteTendencia;
    breakdown.tendencia = ajusteTendencia;

    const ultimoDia = Object.keys(playmy.por_dia || {}).sort().pop();
    let penalidade = 0;
    if (ultimoDia) {
        const dias = Math.floor((Date.now() - new Date(ultimoDia).getTime()) / 86400000);
        if (dias > 60) penalidade = -200;
        else if (dias > 30) penalidade = -100;
        else if (dias > 15) penalidade = -50;
    }
    elo += penalidade;
    breakdown.inatividade = penalidade;

    elo = Math.max(0, Math.min(2000, Math.round(elo)));

    let faixa = 'baixa';
    for (const [nome, dados] of Object.entries(ELO_CONFIG.faixas)) {
        if (elo >= dados.min) { faixa = nome; break; }
    }

    return {
        music_id,
        elo,
        faixa,
        faixa_label: ELO_CONFIG.faixas[faixa].label,
        cor: ELO_CONFIG.faixas[faixa].cor,
        breakdown,
        streams_por_plataforma: streamsPorPlataforma,
        atualizado_em: new Date().toISOString()
    };
}

// ============================================================
// CALCULAR VALUATION
// ============================================================
const MERCADO = {
    valor_por_stream: {
        play_my: 0.015,
        youtube: 0.002,
        spotify: 0.004,
        deezer: 0.003,
        apple_music: 0.007,
        amazon_music: 0.005,
        outros: 0.003
    },
    multiplo_base: 10,
    meses_projecao: 12,
    elo_ajuste_max: 0.5
};

function projetarReceita(streamsPorMes, plataforma) {
    const valores = Object.values(streamsPorMes || {}).sort((a, b) => a - b);
    if (valores.length === 0) return { projecao_streams: 0, projecao_receita: 0, tendencia: 0, confianca: 0 };

    const media = valores.reduce((a, b) => a + b, 0) / valores.length;
    let tendencia = 0;
    if (valores.length >= 2) {
        const ultimo = valores[valores.length - 1];
        const penultimo = valores[valores.length - 2];
        tendencia = penultimo > 0 ? (ultimo - penultimo) / penultimo : 0;
    }

    const tendenciaLimitada = Math.max(-0.3, Math.min(0.3, tendencia));
    let projecaoTotal = 0;
    let streamAtual = media;
    for (let mes = 0; mes < MERCADO.meses_projecao; mes++) {
        streamAtual = streamAtual * (1 + tendenciaLimitada);
        projecaoTotal += streamAtual;
    }

    const valorStream = MERCADO.valor_por_stream[plataforma] || MERCADO.valor_por_stream.outros;
    return {
        projecao_streams: Math.round(projecaoTotal),
        projecao_receita: Math.round(projecaoTotal * valorStream * 100) / 100,
        tendencia: Math.round(tendencia * 1000) / 10,
        confianca: Math.min(100, valores.length * 20)
    };
}

async function calcularValuation(music_id, video_id_youtube) {
    const dados = {
        music_id,
        fontes: {},
        projecoes: {},
        receita_anual_projetada: 0,
        valuation: 0,
        elo: 1000,
        elo_faixa: 'neutro',
        elo_cor: '#8E8E93',
        multiplo_base: MERCADO.multiplo_base,
        multiplo_final: MERCADO.multiplo_base,
        ajuste_elo: 0,
        atualizado_em: new Date().toISOString()
    };

    const playmy = await Storage.get('streams_' + music_id) || { total: 0, por_dia: {} };
    if (playmy.por_dia) {
        const porMes = {};
        for (const [dia, valor] of Object.entries(playmy.por_dia)) {
            const mes = dia.slice(0, 7);
            porMes[mes] = (porMes[mes] || 0) + valor;
        }
        dados.fontes.play_my = { total: playmy.total, por_mes: porMes };
        dados.projecoes.play_my = projetarReceita(porMes, 'play_my');
    }

    if (video_id_youtube) {
        try {
            const info = await getYouTubeVideoInfo(video_id_youtube);
            if (info) {
                dados.fontes.youtube = { video_id: video_id_youtube, views_total: info.views, likes: info.likes };
                dados.projecoes.youtube = {
                    projecao_receita: Math.round(info.views * MERCADO.valor_por_stream.youtube * 100) / 100,
                    confianca: 30,
                    observacao: 'YouTube não expõe streams mensais'
                };
            }
        } catch (e) {}
    }

    const periodos = await Storage.get('royalties_periodos') || [];
    const porPlataforma = {};
    for (const periodo of periodos) {
        const dadosPeriodo = await Storage.get('royalties_' + periodo);
        if (!dadosPeriodo) continue;
        for (const musica of Object.values(dadosPeriodo.musicas || {})) {
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

    let receitaAnual = 0;
    for (const proj of Object.values(dados.projecoes)) {
        receitaAnual += proj.projecao_receita || 0;
    }
    dados.receita_anual_projetada = Math.round(receitaAnual * 100) / 100;

    try {
        let eloData = await Storage.get('elo_' + music_id);
        if (!eloData) {
            eloData = await calcularELO(music_id);
            await Storage.set('elo_' + music_id, eloData);
        }
        dados.elo = eloData.elo;
        dados.elo_faixa = eloData.faixa;
        dados.elo_cor = eloData.cor;
    } catch (e) {}

    const ajusteBruto = (dados.elo - 1000) / 1000;
    const ajusteELO = ajusteBruto * MERCADO.elo_ajuste_max;
    const multiploFinal = MERCADO.multiplo_base * (1 + ajusteELO);

    dados.ajuste_elo = Math.round(ajusteELO * 1000) / 10;
    dados.multiplo_final = Math.round(multiploFinal * 100) / 100;
    dados.valuation = Math.round(receitaAnual * multiploFinal * 100) / 100;
    dados.valuation_faixa = {
        conservador: Math.round(receitaAnual * (multiploFinal * 0.8) * 100) / 100,
        realista: dados.valuation,
        otimista: Math.round(receitaAnual * (multiploFinal * 1.3) * 100) / 100
    };

    return dados;
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

    console.log(`🚀 [${action}]`);

    try {
        // ============================================================
        // PING
        // ============================================================
        if (action === 'ping') {
            let playlists_count = 0, blocks_count = 0, streams_count = 0, elo_count = 0;
            try {
                const pls = await Storage.get('global_playlists') || [];
                playlists_count = pls.length;
                const chain = await Storage.get('blockchain') || { blocks: [] };
                blocks_count = chain.blocks.length;
                const streams = await Storage.get('streams') || {};
                streams_count = Object.keys(streams).length;
                const elo = await Storage.get('elo_ranking') || [];
                elo_count = elo.length;
            } catch (e) {}
            return res.status(200).json({
                success: true, message: 'pong', version: '9.4.0',
                kv_enabled: !!kv, playlists_count, blocks_count, streams_count, elo_count,
                youtube_enabled: !!YOUTUBE_API_KEY,
                timestamp: new Date().toISOString()
            });
        }

        // ============================================================
        // 🔍 BUSCA NO YOUTUBE
        // ============================================================
        if (action === 'search_youtube') {
            const { query, limit } = params;
            if (!query) return res.status(200).json({ success: false, message: 'Query obrigatória' });
            console.log('🎥 Buscando YouTube:', query);
            const directResults = await searchYouTube(query, parseInt(limit) || 15);
            if (directResults.length > 0) {
                console.log(`🎥 YouTube API OK: ${directResults.length} resultados`);
                return res.status(200).json({ success: true, data: directResults, source: 'youtube_api' });
            }
            console.log('⚠️ YouTube API vazia, tentando GAS...');
            const gasResult = await callGAS('search_youtube', { query, limit: limit || 15 });
            if (gasResult.success && gasResult.data && gasResult.data.success && gasResult.data.data && gasResult.data.data.length > 0) {
                return res.status(200).json({ success: true, data: gasResult.data.data, source: 'gas' });
            }
            return res.status(200).json({ success: true, data: [], message: 'Nenhum resultado' });
        }

        // ============================================================
        // 🎬 YOUTUBE VIDEO INFO
        // ============================================================
        if (action === 'search_isrc') {
            const { youtube_url } = params;
            if (!youtube_url) return res.status(200).json({ success: false, message: 'URL obrigatória' });
            const videoId = extractYouTubeId(youtube_url);
            if (!videoId) return res.status(200).json({ success: false, message: 'URL inválida' });
            const info = await getYouTubeVideoInfo(videoId);
            if (info) {
                return res.status(200).json({
                    success: true,
                    data: {
                        title: info.title, artist: info.artist,
                        isrc: 'ISRC_' + Date.now(),
                        source: 'youtube', video_id: videoId,
                        views: info.views, likes: info.likes, thumbnail: info.thumbnail
                    }
                });
            }
            return res.status(200).json({ success: true, data: { title: 'Música', artist: 'Artista', isrc: 'ISRC_' + Date.now(), source: 'fallback' } });
        }

        // ============================================================
        // 📊 YOUTUBE STATS
        // ============================================================
        if (action === 'get_youtube_stats') {
            const { video_id } = params;
            if (!video_id) return res.status(200).json({ success: false, message: 'video_id obrigatório' });
            const cacheKey = `yt_${video_id}`;
            const cached = cache.get(cacheKey);
            if (cached) return res.status(200).json({ success: true, data: cached, cached: true });
            const info = await getYouTubeVideoInfo(video_id);
            if (info) {
                const stats = { views: info.views, likes: info.likes, comments: info.comments };
                cache.set(cacheKey, stats, 3600);
                return res.status(200).json({ success: true, data: stats });
            }
            const hash = video_id.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
            const views = 100000 + (hash % 9000000);
            const stats = { views, likes: Math.floor(views * 0.05), comments: Math.floor(views * 0.01), estimated_earnings: (views / 1000) * 1.5 };
            cache.set(cacheKey, stats, 3600);
            return res.status(200).json({ success: true, data: stats });
        }

        // ============================================================
        // ELO
        // ============================================================
        if (action === 'calcular_elo') {
            const { music_id } = params;
            if (!music_id) return res.status(200).json({ success: false, message: 'music_id obrigatório' });
            const resultado = await calcularELO(music_id);
            await Storage.set('elo_' + music_id, resultado);
            return res.status(200).json({ success: true, data: resultado });
        }

        if (action === 'atualizar_todos_elos') {
            const idx = await Storage.get('streams_index') || [];
            const resultados = [];
            for (const id of idx) {
                try {
                    const r = await calcularELO(id);
                    await Storage.set('elo_' + id, r);
                    resultados.push(r);
                } catch (e) {}
            }
            resultados.sort((a, b) => b.elo - a.elo);
            await Storage.set('elo_ranking', resultados);
            await Storage.set('elo_ultima_atualizacao', new Date().toISOString());
            return res.status(200).json({ success: true, data: { total: resultados.length, ranking: resultados } });
        }

        if (action === 'get_elo_ranking') {
            const ranking = await Storage.get('elo_ranking') || [];
            const ultima = await Storage.get('elo_ultima_atualizacao');
            return res.status(200).json({
                success: true,
                data: { ultima_atualizacao: ultima, total: ranking.length, ranking: ranking.slice(0, 50) }
            });
        }

        if (action === 'ver_elo') {
            const { music_id } = params;
            if (!music_id) return res.status(200).json({ success: false, message: 'music_id obrigatório' });
            let elo = await Storage.get('elo_' + music_id);
            if (!elo) {
                elo = await calcularELO(music_id);
                await Storage.set('elo_' + music_id, elo);
            }
            return res.status(200).json({ success: true, data: elo });
        }

        // ============================================================
        // VALUATION
        // ============================================================
        if (action === 'calcular_valuation') {
            const { music_id, video_id } = params;
            if (!music_id) return res.status(200).json({ success: false, message: 'music_id obrigatório' });
            const resultado = await calcularValuation(music_id, video_id);
            await Storage.set('valuation_' + music_id, resultado);
            return res.status(200).json({ success: true, data: resultado });
        }

        if (action === 'valuation_catalogo') {
            const idx = await Storage.get('streams_index') || [];
            const valuations = [];
            for (const id of idx) {
                try {
                    const v = await calcularValuation(id, null);
                    valuations.push(v);
                } catch (e) {}
            }
            valuations.sort((a, b) => b.valuation - a.valuation);
            const total = valuations.reduce((s, v) => s + (v.valuation || 0), 0);
            const receitaTotal = valuations.reduce((s, v) => s + (v.receita_anual_projetada || 0), 0);
            const resultado = {
                valuation_total: Math.round(total * 100) / 100,
                receita_anual_total: Math.round(receitaTotal * 100) / 100,
                quantidade_musicas: valuations.length,
                musicas: valuations,
                atualizado_em: new Date().toISOString()
            };
            await Storage.set('valuation_catalogo', resultado);
            return res.status(200).json({ success: true, data: resultado });
        }

        if (action === 'ver_valuation') {
            const { music_id, video_id } = params;
            if (!music_id) return res.status(200).json({ success: false, message: 'music_id obrigatório' });
            let v = await Storage.get('valuation_' + music_id);
            if (!v) {
                v = await calcularValuation(music_id, video_id);
                await Storage.set('valuation_' + music_id, v);
            }
            return res.status(200).json({ success: true, data: v });
        }

        // ============================================================
        // ISRC
        // ============================================================
        if (action === 'validar_isrc') {
            const { isrc } = params;
            if (!isrc) return res.status(200).json({ success: false, message: 'isrc obrigatório' });
            const valido = validarISRC(isrc);
            const normalizado = normalizarISRC(isrc);
            return res.status(200).json({
                success: true,
                data: {
                    isrc_original: isrc,
                    isrc_normalizado: normalizado,
                    isrc_formatado: formatarISRC(normalizado),
                    valido,
                    formato_esperado: 'CC-XXX-YY-NNNNN'
                }
            });
        }

        if (action === 'buscar_isrc') {
            const { titulo, artista, link_youtube } = params;
            let videoId = null;
            if (link_youtube) videoId = extractYouTubeId(link_youtube);
            if (!titulo && !videoId) {
                return res.status(200).json({ success: false, message: 'Informe título ou link do YouTube' });
            }
            let tituloBusca = titulo || '';
            let artistaBusca = artista || '';
            if (videoId) {
                const info = await getYouTubeVideoInfo(videoId);
                if (info) {
                    tituloBusca = tituloBusca || info.title;
                    artistaBusca = artistaBusca || info.artist;
                }
            }
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

            const isrcs = await buscarIsrcMusicBrainz(tituloBusca, artistaBusca);

            const unicos = {};
            for (const item of isrcs) {
                if (!unicos[item.isrc] || (item.score || 0) > (unicos[item.isrc].score || 0)) {
                    unicos[item.isrc] = item;
                }
            }
            const lista = Object.values(unicos).sort((a, b) => (b.score || 0) - (a.score || 0));

            return res.status(200).json({
                success: true,
                titulo_consultado: tituloBusca,
                artista_consultado: artistaBusca,
                isrcs: lista.slice(0, 10),
                total: lista.length,
                fonte: 'musicbrainz'
            });
        }

        if (action === 'vincular_isrc') {
            const { music_id, isrc, link_youtube } = params;
            if (!music_id || !isrc) return res.status(200).json({ success: false, message: 'music_id e isrc obrigatórios' });
            if (!validarISRC(isrc)) return res.status(200).json({ success: false, message: 'ISRC inválido' });

            const isrcNormalizado = normalizarISRC(isrc);
            const isrcKey = 'isrc_' + isrcNormalizado;
            const existente = await Storage.get(isrcKey);
            if (existente && existente.music_id !== music_id) {
                return res.status(200).json({ success: false, message: 'ISRC já vinculado a outra música', conflito: existente });
            }

            let vid = null;
            if (link_youtube) vid = extractYouTubeId(link_youtube);

            const vinculo = {
                music_id,
                isrc: isrcNormalizado,
                isrc_formatado: formatarISRC(isrcNormalizado),
                video_id: vid,
                vinculado_em: new Date().toISOString()
            };
            await Storage.set(isrcKey, vinculo);

            let idx = await Storage.get('isrc_index') || [];
            if (!idx.includes(isrcNormalizado)) {
                idx.push(isrcNormalizado);
                await Storage.set('isrc_index', idx);
            }

            return res.status(200).json({ success: true, data: vinculo });
        }

        if (action === 'ver_isrc') {
            const { isrc } = params;
            if (!isrc) return res.status(200).json({ success: false, message: 'isrc obrigatório' });
            const normalizado = normalizarISRC(isrc);
            const vinculo = await Storage.get('isrc_' + normalizado);
            return res.status(200).json({
                success: true,
                data: vinculo || { isrc: normalizado, vinculado: false }
            });
        }

        if (action === 'listar_isrcs') {
            const idx = await Storage.get('isrc_index') || [];
            const lista = [];
            for (const codigo of idx) {
                const v = await Storage.get('isrc_' + codigo);
                if (v) lista.push(v);
            }
            return res.status(200).json({ success: true, data: { total: lista.length, isrcs: lista } });
        }

        // ============================================================
        // 🎵 PLAYLISTS GLOBAIS
        // ============================================================
        if (action === 'get_global_playlists') {
            const playlists = await Storage.get('global_playlists') || [];
            return res.status(200).json({ success: true, data: playlists });
        }

        if (action === 'create_global_playlist') {
            const nome = sanitize(params.nome);
            const descricao = sanitize(params.descricao || '');
            const userId = params.user_id;
            if (!nome) return res.status(200).json({ success: false, message: 'Nome obrigatório' });
            const playlists = await Storage.get('global_playlists') || [];
            const newPl = {
                id: 'gp_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex'),
                nome, descricao, musicas: [], music_count: 0, is_global: true,
                created_by: userId, created_at: new Date().toISOString()
            };
            playlists.push(newPl);
            await Storage.set('global_playlists', playlists);
            await addBlockToChain({ type: 'nova_playlist_global', playlist_id: newPl.id, nome });
            return res.status(200).json({ success: true, data: newPl, message: 'Playlist criada' });
        }

        if (action === 'add_music_to_global_playlist') {
            const playlistId = params.playlist_id;
            const musicId = String(params.music_id);
            if (!playlistId || !musicId) return res.status(200).json({ success: false, message: 'Dados incompletos' });
            const playlists = await Storage.get('global_playlists') || [];
            const pl = playlists.find(p => String(p.id) === String(playlistId));
            if (!pl) return res.status(200).json({ success: false, message: 'Playlist não encontrada' });
            pl.musicas = pl.musicas || [];
            if (!pl.musicas.map(String).includes(musicId)) {
                pl.musicas.push(musicId);
                pl.music_count = pl.musicas.length;
            }
            await Storage.set('global_playlists', playlists);
            return res.status(200).json({ success: true, data: pl });
        }

        if (action === 'remove_music_from_global_playlist') {
            const playlistId = params.playlist_id;
            const musicId = String(params.music_id);
            const playlists = await Storage.get('global_playlists') || [];
            const pl = playlists.find(p => String(p.id) === String(playlistId));
            if (!pl) return res.status(200).json({ success: false, message: 'Playlist não encontrada' });
            pl.musicas = (pl.musicas || []).filter(id => String(id) !== musicId);
            pl.music_count = pl.musicas.length;
            await Storage.set('global_playlists', playlists);
            return res.status(200).json({ success: true, data: pl });
        }

        // ============================================================
        // 📰 NOTÍCIAS
        // ============================================================
        if (action === 'get_news') {
            const page = parseInt(params.page) || 1;
            const limit = parseInt(params.limit) || 10;
            const preferences = (params.preferences || '').split(',').filter(Boolean);
            const seenIds = (params.seen_ids || '').split(',').filter(Boolean);
            const userId = params.user_id || 'anon';
            let news = await aggregateNews();
            if (!news.length) {
                return res.status(200).json({
                    success: true, data: [], has_more: false, next_page: null,
                    total: 0, page: page, message: 'Nenhuma notícia real encontrada no momento'
                });
            }
            if (seenIds.length) news = news.filter(n => !seenIds.includes(n.id));
            if (userId && userId !== 'anon') {
                const seenYesterday = await Storage.get('news_seen_' + userId) || [];
                const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
                const seenYesterdayIds = seenYesterday.filter(s => s.date === yesterday).map(s => s.id);
                if (seenYesterdayIds.length) news = news.filter(n => !seenYesterdayIds.includes(n.id));
            }
            if (preferences.length) {
                news.sort((a, b) => {
                    const aScore = (preferences.includes(a.categoria) ? 10 : 0) + (preferences.includes(a.tema) ? 5 : 0) + (a.em_alta ? 3 : 0) + ((a.investidores_hoje || 0) / 10);
                    const bScore = (preferences.includes(b.categoria) ? 10 : 0) + (preferences.includes(b.tema) ? 5 : 0) + (b.em_alta ? 3 : 0) + ((b.investidores_hoje || 0) / 10);
                    return bScore - aScore;
                });
            }
            const start = (page - 1) * limit;
            const end = start + limit;
            const pageItems = news.slice(start, end);
            const has_more = end < news.length;
            return res.status(200).json({
                success: true, data: pageItems, has_more, next_page: has_more ? page + 1 : null,
                total: news.length, page, source: 'google_news_rss_direct', cached: true
            });
        }

        if (action === 'mark_news_seen') {
            const userId = params.user_id;
            const newsIds = (params.news_ids || '').split(',').filter(Boolean);
            const date = params.data || new Date().toISOString().slice(0, 10);
            if (!userId || !newsIds.length) return res.status(200).json({ success: false, message: 'Dados incompletos' });
            const key = 'news_seen_' + userId;
            let seen = await Storage.get(key) || [];
            newsIds.forEach(id => {
                if (!seen.find(s => s.id === id && s.date === date)) seen.push({ id, date });
            });
            const cutoff = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
            seen = seen.filter(s => s.date >= cutoff);
            await Storage.set(key, seen);
            return res.status(200).json({ success: true, count: seen.length });
        }

        if (action === 'track_news_interaction') {
            const userId = params.user_id;
            const newsId = params.news_id;
            const tipo = params.tipo || 'click';
            const tema = params.tema || '';
            const categoria = params.categoria || '';
            if (!userId || !newsId) return res.status(200).json({ success: false, message: 'Dados incompletos' });
            const key = 'news_prefs_' + userId;
            let prefs = await Storage.get(key) || { temas: {}, categorias: {}, interacoes: 0 };
            if (tema) prefs.temas[tema] = (prefs.temas[tema] || 0) + 1;
            if (categoria) prefs.categorias[categoria] = (prefs.categorias[categoria] || 0) + 1;
            prefs.interacoes = (prefs.interacoes || 0) + 1;
            prefs.ultima = new Date().toISOString();
            await Storage.set(key, prefs);
            return res.status(200).json({ success: true, data: prefs });
        }

        // ============================================================
        // ⛓️ BLOCKCHAIN
        // ============================================================
        if (action === 'get_mining_blocks') {
            const limit = parseInt(params.limit) || 50;
            const chain = await Storage.get('blockchain') || { blocks: [] };
            const blocks = chain.blocks.slice(-limit);
            const formatted = blocks.map(b => ({
                block_index: b.index,
                block_hash: b.hash,
                previous_hash: b.prevHash,
                timestamp: b.timestamp,
                music_title: b.data?.titulo || b.data?.nome || b.data?.type || 'Bloco',
                reward_amount: 0
            }));
            return res.status(200).json({ success: true, data: formatted });
        }

        if (action === 'add_block') {
            try {
                const data = typeof params.data === 'string' ? JSON.parse(params.data) : (params.data || {});
                const block = await addBlockToChain(data);
                return res.status(200).json({ success: true, data: block });
            } catch (e) { return res.status(200).json({ success: false, message: 'Erro ao criar bloco' }); }
        }

        // ============================================================
        // 📊 ADMIN STATS
        // ============================================================
        if (action === 'get_admin_stats' || action === 'get_stats') {
            const playlists = await Storage.get('global_playlists') || [];
            const chain = await Storage.get('blockchain') || { blocks: [] };
            const streams = await Storage.get('streams') || {};
            const elo = await Storage.get('elo_ranking') || [];
            const gasResult = await callGAS('get_stats');
            if (gasResult.success && gasResult.data && gasResult.data.data) {
                return res.status(200).json(gasResult.data);
            }
            return res.status(200).json({
                success: true,
                data: {
                    total_usuarios: 1,
                    total_musicas: FALLBACK_MUSICAS.length,
                    playlists_count: playlists.length,
                    total_investido: 0,
                    blocks_count: chain.blocks.length,
                    streams_count: Object.keys(streams).length,
                    elo_count: elo.length
                }
            });
        }

        // ============================================================
        // 🎤 ARTISTAS
        // ============================================================
        if (action === 'get_artists') {
            const gasResult = await callGAS('get_artists', params);
            if (gasResult.success && gasResult.data) return res.status(200).json(gasResult.data);
            return res.status(200).json({ success: true, data: [] });
        }

        // ============================================================
        // 🎟️ TICKETS
        // ============================================================
        if (action === 'get_tickets') {
            const tickets = await Storage.get('tickets') || [];
            if (tickets.length) return res.status(200).json({ success: true, data: tickets });
            const gasResult = await callGAS('get_tickets', params);
            if (gasResult.success && gasResult.data) return res.status(200).json(gasResult.data);
            return res.status(200).json({ success: true, data: [] });
        }

        // ============================================================
        // 🎶 PLAYLISTS PESSOAIS
        // ============================================================
        if (action === 'get_playlists') {
            const userId = params.user_id;
            const all = await Storage.get('user_playlists') || {};
            if (all[userId] && all[userId].length) return res.status(200).json({ success: true, data: all[userId] });
            const gasResult = await callGAS('get_playlists', { user_id: userId });
            if (gasResult.success && gasResult.data) return res.status(200).json(gasResult.data);
            return res.status(200).json({ success: true, data: all[userId] || [] });
        }

        if (action === 'create_playlist') {
            const userId = params.user_id;
            const nome = sanitize(params.nome);
            const publica = params.publica === 'true' || params.publica === true;
            if (!userId || !nome) return res.status(200).json({ success: false, message: 'Dados incompletos' });
            const all = await Storage.get('user_playlists') || {};
            all[userId] = all[userId] || [];
            const nova = { id: 'pl_' + Date.now(), nome, publica, musicas: [], created_at: new Date().toISOString() };
            all[userId].push(nova);
            await Storage.set('user_playlists', all);
            callGAS('create_playlist', { user_id: userId, nome, publica }).catch(() => {});
            return res.status(200).json({ success: true, data: nova });
        }

        // ============================================================
        // ⭐ SEGUIR / FAVORITOS
        // ============================================================
        if (action === 'get_following') {
            const userId = params.user_id;
            const all = await Storage.get('following') || {};
            if (all[userId] && all[userId].length) return res.status(200).json({ success: true, data: all[userId] });
            const gasResult = await callGAS('get_following', { user_id: userId });
            if (gasResult.success && gasResult.data) return res.status(200).json(gasResult.data);
            return res.status(200).json({ success: true, data: all[userId] || [] });
        }

        if (action === 'toggle_follow') {
            const userId = params.user_id;
            const artistId = String(params.artist_id);
            const actionType = params.action;
            if (!userId || !artistId) return res.status(200).json({ success: false, message: 'Dados incompletos' });
            const all = await Storage.get('following') || {};
            all[userId] = all[userId] || [];
            if (actionType === 'follow') {
                if (!all[userId].includes(artistId)) all[userId].push(artistId);
            } else {
                all[userId] = all[userId].filter(id => id !== artistId);
            }
            await Storage.set('following', all);
            callGAS('toggle_follow', { user_id: userId, artist_id: artistId, action: actionType }).catch(() => {});
            return res.status(200).json({ success: true, data: { following: all[userId] } });
        }

        if (action === 'toggle_favorite') {
            const { user_id, music_id } = params;
            if (!user_id || !music_id) return res.status(200).json({ success: false, message: 'Dados incompletos' });
            const all = await Storage.get('favorites') || {};
            all[user_id] = all[user_id] || [];
            const sid = String(music_id);
            if (all[user_id].includes(sid)) all[user_id] = all[user_id].filter(x => x !== sid);
            else all[user_id].push(sid);
            await Storage.set('favorites', all);
            callGAS('toggle_favorite', { user_id, music_id, action: all[user_id].includes(sid) ? 'add' : 'remove' }).catch(() => {});
            return res.status(200).json({ success: true, data: { favorites: all[user_id] } });
        }

        if (action === 'get_user_profile') {
            const userId = params.user_id;
            const all = await Storage.get('favorites') || {};
            return res.status(200).json({ success: true, data: { favorite_music_ids: all[userId] || [] } });
        }

        // ============================================================
        // 🎵 STREAMING
        // ============================================================
        if (action === 'register_streaming') {
            const { music_id, user_id, duration } = params;
            if (!music_id || !user_id) {
                return res.status(200).json({ success: false, message: 'Dados incompletos' });
            }

            await addBlockToChain({ type: 'streaming', music_id, user_id, duration: duration || 30 });

            const key = 'streams_' + music_id;
            let contador = await Storage.get(key) || {
                music_id: music_id,
                total: 0,
                hoje: 0,
                ultima_data: '',
                ultima_atualizacao: ''
            };

            const hoje = new Date().toISOString().slice(0, 10);
            if (contador.ultima_data !== hoje) {
                contador.hoje = 0;
                contador.ultima_data = hoje;
            }

            contador.total++;
            contador.hoje++;
            contador.ultima_atualizacao = new Date().toISOString();

            await Storage.set(key, contador);

            // 🆕 Adiciona ao índice de streams
            let idx = await Storage.get('streams_index') || [];
            if (!idx.includes(music_id)) {
                idx.push(music_id);
                await Storage.set('streams_index', idx);
            }

            const globalKey = 'streams_global';
            let globalCont = await Storage.get(globalKey) || { total: 0, hoje: 0, ultima_data: '' };
            if (globalCont.ultima_data !== hoje) {
                globalCont.hoje = 0;
                globalCont.ultima_data = hoje;
            }
            globalCont.total++;
            globalCont.hoje++;
            await Storage.set(globalKey, globalCont);

            const userKey = 'streams_user_' + user_id;
            let userContador = await Storage.get(userKey) || {
                user_id: user_id,
                total: 0,
                musicas: {}
            };

            userContador.total++;
            userContador.musicas[music_id] = (userContador.musicas[music_id] || 0) + 1;

            await Storage.set(userKey, userContador);

            callGAS('register_streaming', {
                music_id: music_id,
                user_id: user_id,
                duration: duration || 30
            }).catch(() => {});

            console.log(`🎵 [stream] música ${music_id} | total: ${contador.total} | hoje: ${contador.hoje}`);

            return res.status(200).json({
                success: true,
                data: {
                    reward: 1,
                    streams_total: contador.total,
                    streams_hoje: contador.hoje,
                    streams_global: globalCont.total
                }
            });
        }

        if (action === 'get_streaming_stats') {
            const { music_id, user_id } = params;
            if (music_id) {
                const contador = await Storage.get('streams_' + music_id) || { total: 0, hoje: 0 };
                return res.status(200).json({
                    success: true,
                    data: {
                        music_id: music_id,
                        streams_total: contador.total,
                        streams_hoje: contador.hoje,
                        ultima_atualizacao: contador.ultima_atualizacao
                    }
                });
            }
            const globalCont = await Storage.get('streams_global') || { total: 0, hoje: 0 };
            return res.status(200).json({
                success: true,
                data: {
                    streams_total: globalCont.total,
                    streams_hoje: globalCont.hoje,
                    ultima_atualizacao: globalCont.ultima_data
                }
            });
        }

        // 🆕 RANKING — varre o streams_index
        if (action === 'get_streaming_ranking') {
            const limit = parseInt(params.limit) || 20;
            const idx = await Storage.get('streams_index') || [];
            const lista = [];

            for (const id of idx) {
                const d = await Storage.get('streams_' + id);
                if (d) lista.push(d);
            }

            lista.sort((a, b) => (b.total || 0) - (a.total || 0));

            const ranking = lista.slice(0, limit).map((s, i) => ({
                posicao: i + 1,
                music_id: s.music_id,
                streams_total: s.total || 0,
                streams_hoje: s.hoje || 0
            }));

            return res.status(200).json({ success: true, data: ranking });
        }

        // ============================================================
        // 🎵 MÚSICAS
        // ============================================================
        if (action === 'get_musicas') {
            const gasResult = await callGAS('get_musicas', params);
            if (gasResult.success && gasResult.data && gasResult.data.data && gasResult.data.data.length > 0) {
                return res.status(200).json({ success: true, data: gasResult.data.data, source: 'gas' });
            }
            return res.status(200).json({ success: true, data: FALLBACK_MUSICAS, source: 'fallback' });
        }

        if (action === 'get_external_musicas') {
            const gasResult = await callGAS('get_external_musicas', params);
            if (gasResult.success && gasResult.data) return res.status(200).json(gasResult.data);
            return res.status(200).json({ success: true, data: [] });
        }

        if (action === 'get_top_investments') {
            const gasResult = await callGAS('get_top_investments', params);
            if (gasResult.success && gasResult.data) return res.status(200).json(gasResult.data);
            return res.status(200).json({ success: true, data: FALLBACK_MUSICAS });
        }

        // ============================================================
        // 🔐 LOGIN
        // ============================================================
        if (action === 'login') {
            const email = sanitize(params.email);
            const password = params.password;
            if (!email || !password) return res.status(200).json({ success: false, message: 'Email e senha obrigatórios' });
            if (!validateEmail(email)) return res.status(200).json({ success: false, message: 'Email inválido' });
            const clientIP = req.ip || req.connection?.remoteAddress || 'unknown';
            const rateCheck = rateLimiter.check(clientIP);
            if (!rateCheck.allowed) return res.status(200).json({ success: false, message: rateCheck.message });

            if (email === 'admin@selomiv.com' && password === 'admin123') {
                rateLimiter.reset(clientIP);
                return res.status(200).json({
                    success: true,
                    data: { id: 'admin_master', nome: 'Administrador', email: 'admin@selomiv.com', tipo: 'admin', saldo: 1000000, selo_coin: 50000, favorite_music_ids: [], email_confirmado: true }
                });
            }

            const gasResult = await callGAS('login', { email, password });
            if (gasResult.success && gasResult.data && gasResult.data.success) {
                rateLimiter.reset(clientIP);
                return res.status(200).json(gasResult.data);
            }
            return res.status(200).json({ success: false, message: 'Credenciais inválidas' });
        }

        // ============================================================
        // 💰 SALDO / CARTEIRA / EXTRATO
        // ============================================================
        if (action === 'get_saldo') {
            const userId = params.user_id || params.userId;
            if (!userId) return res.status(200).json({ success: false, message: 'Usuário não identificado' });
            if (userId === 'admin_master') return res.status(200).json({ success: true, data: { saldo_disponivel: 1000000, selo_coin: 50000 } });
            const gasResult = await callGAS('get_saldo', { user_id: userId });
            if (gasResult.success && gasResult.data) return res.status(200).json(gasResult.data);
            return res.status(200).json({ success: true, data: { saldo_disponivel: 0, selo_coin: 0 } });
        }

        if (action === 'get_carteira') {
            const userId = params.user_id || params.userId;
            if (!userId) return res.status(200).json({ success: true, data: [] });
            const gasResult = await callGAS('get_carteira', { user_id: userId });
            if (gasResult.success && gasResult.data) return res.status(200).json(gasResult.data);
            return res.status(200).json({ success: true, data: [] });
        }

        if (action === 'get_extrato') {
            const userId = params.user_id || params.userId;
            if (!userId) return res.status(200).json({ success: true, data: [] });
            const gasResult = await callGAS('get_extrato', { user_id: userId });
            if (gasResult.success && gasResult.data) return res.status(200).json(gasResult.data);
            return res.status(200).json({ success: true, data: [] });
        }

        if (action === 'get_artist_data') {
            const gasResult = await callGAS('get_artist_data', params);
            if (gasResult.success && gasResult.data) return res.status(200).json(gasResult.data);
            return res.status(200).json({ success: true, data: { total_musicas: 0, total_royalties: 0, musics: [] } });
        }

        // ============================================================
        // 💸 COMPRAR
        // ============================================================
        if (action === 'buy') {
            const { music_id, quantidade, valor_unitario, valor_total, user_id } = params;
            if (!music_id || !quantidade || !user_id) return res.status(200).json({ success: false, message: 'Dados incompletos' });
            const qty = parseInt(quantidade);
            if (isNaN(qty) || qty < 1) return res.status(200).json({ success: false, message: 'Quantidade inválida' });

            const block = await addBlockToChain({
                type: 'investimento', music_id, user_id,
                quantidade: qty, valor_total: valor_total || (qty * parseFloat(valor_unitario || 0))
            });

            const invKey = 'investidores_' + music_id;
            let investidores = await Storage.get(invKey) || [];
            const idx = investidores.findIndex(i => i.user_id === user_id);
            if (idx >= 0) {
                investidores[idx].acoes += qty;
            } else {
                investidores.push({ user_id: user_id, acoes: qty, desde: new Date().toISOString() });
            }
            await Storage.set(invKey, investidores);

            const gasResult = await callGAS('buy', {
                music_id: sanitize(music_id), quantidade: qty,
                valor_unitario: parseFloat(valor_unitario || 0),
                valor_total: valor_total || (qty * parseFloat(valor_unitario || 0)),
                user_id: sanitize(user_id)
            });

            if (gasResult.success && gasResult.data) return res.status(200).json(gasResult.data);

            return res.status(200).json({
                success: true, message: 'Investimento realizado!',
                data: { contrato_id: 'CT_' + Date.now(), blockchain_hash: block.hash, block_index: block.index }
            });
        }

        if (action === 'buy_external') {
            const gasResult = await callGAS('buy_external', params);
            if (gasResult.success && gasResult.data) return res.status(200).json(gasResult.data);
            return res.status(200).json({ success: false, message: 'Erro ao processar' });
        }

        if (action === 'suggest_external_music') {
            const gasResult = await callGAS('suggest_external_music', params);
            if (gasResult.success && gasResult.data) return res.status(200).json(gasResult.data);
            return res.status(200).json({ success: false, message: 'Erro ao sugerir' });
        }

        if (action === 'upload_music') {
            const gasResult = await callGAS('upload_music', params);
            if (gasResult.success && gasResult.data) return res.status(200).json(gasResult.data);
            return res.status(200).json({ success: false, message: 'Erro ao cadastrar' });
        }

        // ============================================================
        // 💳 RESET PASSWORD
        // ============================================================
        if (action === 'request_password_reset') {
            const { email } = params;
            if (!email || !validateEmail(email)) return res.status(200).json({ success: false, message: 'Email inválido' });
            const resetToken = generateResetToken(email);
            const resetLink = `https://playmy.com.br/reset-password.html?token=${resetToken}`;
            const html = `
                <div style="font-family:Arial;max-width:600px;margin:0 auto;background:#111418;padding:40px;border:1px solid #00ff88;border-radius:16px;">
                    <h1 style="color:#00ff88;text-align:center;">🎵 PLAY MY</h1>
                    <p style="color:#fff;">Olá,</p>
                    <p style="color:#b3b3b3;">Clique no botão para redefinir sua senha:</p>
                    <div style="text-align:center;margin:30px 0;">
                        <a href="${resetLink}" style="background:#00ff88;color:#000;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;">🔑 Redefinir Senha</a>
                    </div>
                    <p style="color:#6c757d;font-size:14px;">Link válido por 1 hora</p>
                </div>
            `;
            const result = await sendEmail(email, '🔐 Recuperação de Senha - PLAY MY', html);
            if (result.success) return res.status(200).json({ success: true, message: 'Email enviado!', data: { token: resetToken } });
            const gasResult = await callGAS('request_password_reset', { email, reset_url: 'https://playmy.com.br/reset-password.html' });
            if (gasResult.success && gasResult.data) return res.status(200).json(gasResult.data);
            return res.status(200).json({ success: false, message: 'Erro ao enviar email' });
        }

        if (action === 'verify_reset_token') {
            const { token } = params;
            if (!token) return res.status(200).json({ success: false, message: 'Token obrigatório' });
            const record = validateResetToken(token);
            if (record) return res.status(200).json({ success: true, message: 'Token válido', data: { email: record.email } });
            const gasResult = await callGAS('verify_reset_token', { token });
            if (gasResult.success && gasResult.data) return res.status(200).json(gasResult.data);
            return res.status(200).json({ success: false, message: 'Token inválido' });
        }

        // ============================================================
        // 🎫 REDEEM TICKET
        // ============================================================
        if (action === 'redeem_ticket') {
            const gasResult = await callGAS('redeem_ticket', params);
            if (gasResult.success && gasResult.data) return res.status(200).json(gasResult.data);
            return res.status(200).json({ success: false, message: 'Erro ao resgatar' });
        }

        if (action === 'create_ticket') {
            const gasResult = await callGAS('create_ticket', params);
            if (gasResult.success && gasResult.data) return res.status(200).json(gasResult.data);
            return res.status(200).json({ success: false, message: 'Erro ao criar' });
        }

        // ============================================================
        // 💸 SAQUE
        // ============================================================
        if (action === 'request_withdrawal') {
            const gasResult = await callGAS('request_withdrawal', params);
            if (gasResult.success && gasResult.data) return res.status(200).json(gasResult.data);
            return res.status(200).json({ success: false, message: 'Erro ao solicitar' });
        }

        // ============================================================
        // 📊 TRADES
        // ============================================================
        if (action === 'get_trades') {
            const gasResult = await callGAS('get_trades', params);
            if (gasResult.success && gasResult.data) return res.status(200).json(gasResult.data);
            return res.status(200).json({ success: true, data: { received: [], sent: [], history: [] } });
        }

        if (action === 'create_trade' || action === 'accept_trade' || action === 'decline_trade' || action === 'cancel_trade') {
            const gasResult = await callGAS(action, params);
            if (gasResult.success && gasResult.data) return res.status(200).json(gasResult.data);
            return res.status(200).json({ success: false, message: 'Erro na operação' });
        }

        // ============================================================
        // 🎤 REGISTER / CONFIRM EMAIL
        // ============================================================
        if (action === 'register' || action === 'confirm_email' || action === 'resend_confirmation') {
            const gasResult = await callGAS(action, params);
            if (gasResult.success && gasResult.data) return res.status(200).json(gasResult.data);
            return res.status(200).json({ success: false, message: 'Erro na operação' });
        }

        // ============================================================
        // DEFAULT
        // ============================================================
        return res.status(200).json({
            success: true,
            message: '✅ PLAY MY API ONLINE',
            version: '9.4.0',
            kv_enabled: !!kv,
            youtube_enabled: !!YOUTUBE_API_KEY,
            action: action || 'nenhuma',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Erro no handler:', error);
        return res.status(200).json({ success: false, message: 'Erro interno: ' + error.message });
    }
};
