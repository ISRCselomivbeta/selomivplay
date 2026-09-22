// BACKEND.JS - VERSÃO 9.7.6
// ============================================================
// PERSISTÊNCIA VERCEL KV + FEED INFINITO + RSS DIRETO
// + CONTADOR DE STREAMS + ELO + VALUATION + ISRC
// + COMPATIBILIDADE TOTAL COM GAS 7.0.1
// + VENDA DIRETA AO MERCADO (sell_to_market)
// + VENDA P2P COM EMAIL (create_trade robusto)
// + IMAGENS REAIS NOS FEEDS (G1, UOL, Rolling Stone)
//
// MUDANÇAS v9.7.6:
//   - ✅ FIX: fetchNewsFromDirectRSS adicionada (estava faltando)
//   - ✅ FIX: aggregateNews duplicada removida
//   - ✅ FIX: extração de imagem do RSS (enclosure, media:content, media:thumbnail, img)
//
// MUDANÇAS v9.7.5:
//   - ✅ FIX: add_music_to_playlist salva KV ANTES do GAS (não perde mais)
//   - ✅ FIX: remove_music_from_global_playlist salva KV ANTES do GAS
//   - ✅ FIX: add_music_to_global_playlist mantém metadata de YouTube
// ============================================================

// ============================================================
// CARREGAMENTO PROTEGIDO DE DEPENDÊNCIAS
// ============================================================
let nodemailer = null;
try {
    nodemailer = require('nodemailer');
    console.log('✅ nodemailer carregado');
} catch (e) {
    console.warn('⚠️ nodemailer não disponível — email cairá para fallback GAS:', e.message);
}

const crypto = require('crypto');

let kv = null;
try {
    kv = require('@vercel/kv').kv;
    console.log('✅ Vercel KV carregado');
} catch (e) {
    console.warn('⚠️ @vercel/kv não instalado — usando fallback em memória');
}

const GAS_URL = process.env.GAS_URL || 'https://script.google.com/macros/s/AKfycbwgjor-tLLzVrnJGNHOifL1O2sRBhysKJ3IbVJy_AHgtNqjk-6hazH8xuO6OaDXF_s/exec';
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || 'AIzaSyAPaYGY_MrrNgKdEqTs3Qw7tPNv5p5QwPM';
const EMAIL_FROM = 'selomivplay@gmail.com';
const EMAIL_NAME = 'PLAY MY';

// ============================================================
// AÇÕES QUE EXISTEM NO GAS 7.0.1
// ============================================================
const GAS_ACTIONS = new Set([
    'health', 'ping', 'login', 'register', 'confirm_email', 'resend_confirmation',
    'get_musicas', 'get_music_details', 'get_saldo', 'get_carteira', 'get_extrato',
    'get_top_investments', 'get_playlists', 'create_playlist', 'toggle_favorite',
    'get_artist_data', 'upload_music', 'update_music', 'pause_music', 'delete_music',
    'get_external_musicas', 'suggest_external_music', 'buy_external', 'buy',
    'request_withdrawal', 'add_balance', 'get_withdrawals', 'get_user_profile',
    'update_profile', 'get_stats', 'get_global_playlists', 'create_global_playlist',
    'add_music_to_global_playlist', 'remove_music_from_global_playlist',
    'get_artists', 'get_following', 'toggle_follow', 'get_tickets', 'create_ticket',
    'redeem_ticket', 'search_youtube', 'search_isrc', 'get_youtube_earnings',
    'get_youtube_stats', 'register_streaming', 'get_streaming_stats', 'get_mining_blocks',
    'get_mining_stats', 'get_mining_ranking',
    'request_password_reset', 'verify_reset_token', 'reset_password',
    'reset_password_by_email',
    'create_trade', 'get_trades', 'accept_trade', 'decline_trade', 'cancel_trade',
    'process_trade', 'get_trade_details',
    'create_pix_payment', 'check_pix_payment', 'get_user_pix_payments',
    'register_interaction', 'get_recommendations',
    'add_transaction', 'transfer_shares',
    'get_news', 'mark_news_seen', 'track_news_interaction',
    'calcular_elo', 'ver_elo', 'get_elo_ranking', 'atualizar_todos_elos',
    'calcular_valuation', 'ver_valuation', 'valuation_catalogo',
    'validar_isrc', 'buscar_isrc', 'vincular_isrc', 'ver_isrc', 'listar_isrcs',
    'add_block'
]);

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
    users_all: [],
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
    isrc: {},
    trades_all: [],
    carteira: {},
    extrato: {},
    musicas_all: [],
    extrato_all: []
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

function csvToArray(csv) {
    if (!csv) return [];
    if (Array.isArray(csv)) return csv;
    return String(csv).split(',').map(s => s.trim()).filter(Boolean);
}
function arrayToCsv(arr) {
    if (!arr) return '';
    if (typeof arr === 'string') return arr;
    return arr.filter(Boolean).join(',');
}
function normalizePlaylistFromGAS(pl) {
    if (!pl) return pl;
    const musicas = csvToArray(pl.musicas);
    return {
        id: pl.id || pl.playlist_id,
        nome: pl.nome || pl.name || '',
        descricao: pl.descricao || pl.description || '',
        musicas: musicas,
        music_count: musicas.length,
        is_global: true,
        created_by: pl.admin_id || pl.user_id || pl.created_by || '',
        created_at: pl.created_at || new Date().toISOString()
    };
}
function normalizePlaylistFromKV(pl) {
    if (!pl) return pl;
    const musicas = Array.isArray(pl.musicas) ? pl.musicas : csvToArray(pl.musicas);
    return {
        id: pl.id,
        nome: pl.nome,
        descricao: pl.descricao || '',
        musicas: musicas,
        music_count: pl.music_count || musicas.length,
        is_global: pl.is_global !== undefined ? pl.is_global : true,
        created_by: pl.created_by || '',
        created_at: pl.created_at || new Date().toISOString()
    };
}

// ============================================================
// CHAMAR GAS — timeout 6s + 1 retry
// ============================================================
async function callGAS(action, params = {}, retries = 1) {
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
            const timeout = setTimeout(() => controller.abort(), 6000);
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
            await new Promise(r => setTimeout(r, 300 * attempt));
        }
    }
}

function unwrapGAS(gasResult) {
    if (!gasResult || !gasResult.success) {
        return { success: false, message: gasResult?.error || 'GAS falhou', _via: 'gas_error' };
    }
    const inner = gasResult.data || {};
    if (inner.success === false) {
        return { success: false, message: inner.message || 'GAS retornou erro', _via: 'gas_error' };
    }
    return {
        success: true,
        data: inner.data !== undefined ? inner.data : inner,
        message: inner.message,
        _via: 'gas',
        _raw: inner
    };
}

// ============================================================
// ENVIO DE EMAIL
// ============================================================
async function sendEmail(to, subject, html, retries = 3) {
    if (!nodemailer) {
        console.warn('⚠️ [email] nodemailer indisponível');
        return { success: false, error: 'nodemailer indisponível' };
    }
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
// FALLBACK DE MÚSICAS
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
async function generateResetToken(email) {
    const token = crypto.randomBytes(32).toString('hex');
    const record = {
        email,
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000
    };
    await Storage.set('reset_token_' + token, record);
    return token;
}

async function validateResetToken(token) {
    const record = await Storage.get('reset_token_' + token);
    if (!record) return null;
    if (Date.now() > record.expiresAt) {
        await Storage.del('reset_token_' + token);
        return null;
    }
    return record;
}

// ============================================================
// BLOCKCHAIN
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
// NOTÍCIAS — GOOGLE NEWS RSS
// ============================================================
async function fetchNewsFromGoogleRSS(query, categoria) {
    try {
        const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        const response = await fetch(rssUrl, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; PLAYMY/9.7.6)',
                'Accept': 'application/xml, text/xml, */*'
            }
        });
        clearTimeout(timeout);

        if (!response.ok) return [];
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('xml') && !contentType.includes('rss') && !contentType.includes('html')) return [];

        const xml = await response.text();
        if (!xml.includes('<item>')) return [];

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

                const encMatch = itemXml.match(/<enclosure[^>]*url="([^"]+)"/);
                const mediaMatch = itemXml.match(/<media:content[^>]*url="([^"]+)"/);
                const mediaThumbMatch = itemXml.match(/<media:thumbnail[^>]*url="([^"]+)"/);
                const imgInDescMatch = itemXml.match(/<img[^>]*src="([^"]+)"/);
                const imagemReal = (encMatch && encMatch[1]) ||
                                   (mediaMatch && mediaMatch[1]) ||
                                   (mediaThumbMatch && mediaThumbMatch[1]) ||
                                   (imgInDescMatch && imgInDescMatch[1]) ||
                                   null;

                const id = 'news_' + crypto.createHash('md5').update(title).digest('hex').substring(0, 12);
                items.push({
                    id, categoria, autor: source, fonte: source,
                    fonte_logo: getFonteLogo(source),
                    titulo: title,
                    texto: texto || 'Clique para ler a notícia completa.',
                    imagem: imagemReal,
                    link: linkMatch ? linkMatch[1].trim() : '#',
                    timestamp: pubDateMatch ? new Date(pubDateMatch[1]).toISOString() : new Date().toISOString(),
                    tema: categoria, likes: 0, prazo: null, investidores_hoje: 0, em_alta: false
                });
                count++;
            }
        }
        return items;
    } catch (e) {
        return [];
    }
}

// ============================================================
// NOTÍCIAS — FEEDS DIRETOS (G1, UOL, Rolling Stone, Tenho Mais Discos)
// ✅ ESTA É A FUNÇÃO QUE FALTAVA
// ============================================================
async function fetchNewsFromDirectRSS(rssUrl, categoria, fonte) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        const response = await fetch(rssUrl, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; PLAYMY/9.7.6)',
                'Accept': 'application/xml, text/xml, */*'
            }
        });
        clearTimeout(timeout);

        if (!response.ok) return [];
        const xml = await response.text();
        if (!xml.includes('<item>')) return [];

        const items = [];
        const itemRegex = /<item>([\s\S]*?)<\/item>/g;
        let match;
        let count = 0;
        while ((match = itemRegex.exec(xml)) !== null && count < 10) {
            const itemXml = match[1];
            const titleMatch = itemXml.match(/<title>(.*?)<\/title>/);
            const linkMatch = itemXml.match(/<link>(.*?)<\/link>/);
            const pubDateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>/);
            const descMatch = itemXml.match(/<description>(.*?)<\/description>/);

            if (titleMatch) {
                let title = titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim();
                let texto = '';
                if (descMatch) {
                    texto = descMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, '').trim().substring(0, 200);
                    if (texto) texto += '...';
                }

                const encMatch = itemXml.match(/<enclosure[^>]*url="([^"]+)"/);
                const mediaMatch = itemXml.match(/<media:content[^>]*url="([^"]+)"/);
                const mediaThumbMatch = itemXml.match(/<media:thumbnail[^>]*url="([^"]+)"/);
                const imgInDescMatch = itemXml.match(/<img[^>]*src="([^"]+)"/);
                const imagemReal = (encMatch && encMatch[1]) ||
                                   (mediaMatch && mediaMatch[1]) ||
                                   (mediaThumbMatch && mediaThumbMatch[1]) ||
                                   (imgInDescMatch && imgInDescMatch[1]) ||
                                   null;

                const id = 'news_' + crypto.createHash('md5').update(title).digest('hex').substring(0, 12);
                items.push({
                    id, categoria, autor: fonte, fonte: fonte,
                    fonte_logo: getFonteLogo(fonte),
                    titulo: title,
                    texto: texto || 'Clique para ler a notícia completa.',
                    imagem: imagemReal,
                    link: linkMatch ? linkMatch[1].trim() : '#',
                    timestamp: pubDateMatch ? new Date(pubDateMatch[1]).toISOString() : new Date().toISOString(),
                    tema: categoria, likes: 0, prazo: null, investidores_hoje: 0, em_alta: false
                });
                count++;
            }
        }
        return items;
    } catch (e) {
        return [];
    }
}

// ============================================================
// AGREGADOR DE NOTÍCIAS
// ============================================================
async function aggregateNews() {
    const cached = await Storage.get('news_cache');
    const cachedTime = await Storage.get('news_cache_time');
    if (cached && cachedTime && Date.now() - cachedTime < 15 * 60 * 1000) {
        return cached;
    }

    const queries = [
        { q: 'lançamento musical álbum', cat: 'lancamentos' },
        { q: 'música brasileira', cat: 'musica' },
        { q: 'shows turnê Brasil', cat: 'shows' },
        { q: 'indústria musical streaming', cat: 'negocios' },
        { q: 'artista música entrevista', cat: 'artistas' },
        { q: 'edital cultural música', cat: 'editais' }
    ];

    const RSS_DIRETOS = [
        { url: 'https://g1.globo.com/rss/g1/pop-arte/musica/', cat: 'musica', fonte: 'G1' },
        { url: 'https://rss.uol.com.br/feed/musica.xml', cat: 'musica', fonte: 'UOL' },
        { url: 'https://rollingstone.uol.com.br/rss/', cat: 'musica', fonte: 'Rolling Stone' },
        { url: 'https://tenhomaisdiscosqueamigos.com/feed/', cat: 'musica', fonte: 'Tenho Mais Discos' }
    ];

    const batchesPromise = Promise.allSettled([
        ...queries.map(nq => fetchNewsFromGoogleRSS(nq.q, nq.cat)),
        ...RSS_DIRETOS.map(r => fetchNewsFromDirectRSS(r.url, r.cat, r.fonte))
    ]);

    const timeoutPromise = new Promise(resolve =>
        setTimeout(() => resolve('__timeout__'), 8000)
    );

    const result = await Promise.race([batchesPromise, timeoutPromise]);

    if (result === '__timeout__') {
        const stale = await Storage.get('news_cache');
        return stale || [];
    }

    let all = [];
    for (const b of result) {
        if (b.status === 'fulfilled' && Array.isArray(b.value)) all.push(...b.value);
    }

    if (all.length === 0) {
        await Storage.set('news_cache', []);
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
    return unique;
}
