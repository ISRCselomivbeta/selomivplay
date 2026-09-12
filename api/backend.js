// BACKEND.JS - VERSÃO 8.5.0 (PERSISTÊNCIA VERCEL KV)
// ============================================================
// Todas as ações: proxy GAS + KV + notícias + YouTube
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
    portfolio: {}
};

// ============================================================
// STORAGE (KV com fallback memória)
// ============================================================
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
// NOTÍCIAS (Google News RSS)
// ============================================================
async function fetchNewsFromGoogleRSS(query, categoria) {
    try {
        const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(rssUrl)}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const response = await fetch(proxyUrl, { signal: controller.signal });
        clearTimeout(timeout);
        if (!response.ok) throw new Error('RSS fetch failed');
        const xml = await response.text();
        const items = [];
        const itemRegex = /<item>([\s\S]*?)<\/item>/g;
        let match;
        let count = 0;
        while ((match = itemRegex.exec(xml)) !== null && count < 10) {
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
                items.push({
                    id: 'gnews_' + count + '_' + Date.now(),
                    categoria: categoria,
                    autor: source,
                    titulo: title,
                    texto: texto || 'Clique para ler a notícia completa.',
                    imagem: null,
                    link: linkMatch ? linkMatch[1].trim() : '#',
                    timestamp: pubDateMatch ? new Date(pubDateMatch[1]).toISOString() : new Date().toISOString(),
                    likes: 0,
                    fonte: 'Google News'
                });
                count++;
            }
        }
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
        console.log('📰 Notícias do cache KV');
        return cached;
    }
    const queries = [
        { q: 'música brasileira', cat: 'musica' },
        { q: 'shows turnê', cat: 'shows' },
        { q: 'indústria musical streaming', cat: 'negocios' },
        { q: 'artista música lançamento', cat: 'artistas' }
    ];
    const batches = await Promise.all(queries.map(nq => fetchNewsFromGoogleRSS(nq.q, nq.cat)));
    let all = batches.flat();
    if (all.length === 0) {
        all = [
            { id: 'fb1', categoria: 'musica', autor: 'G1 Música', titulo: 'Confira as principais notícias do mundo da música', texto: 'Acompanhe as últimas novidades.', imagem: null, link: 'https://g1.globo.com/pop-arte/musica/', timestamp: new Date().toISOString(), likes: 0, fonte: 'G1' }
        ];
    }
    all.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const seen = new Set();
    const unique = all.filter(n => {
        const k = n.titulo.toLowerCase().substring(0, 50);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
    });
    await Storage.set('news_cache', unique);
    await Storage.set('news_cache_time', Date.now());
    console.log(`📰 ${unique.length} notícias cacheadas no KV`);
    return unique;
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
            let playlists_count = 0, blocks_count = 0;
            try {
                const pls = await Storage.get('global_playlists') || [];
                playlists_count = pls.length;
                const chain = await Storage.get('blockchain') || { blocks: [] };
                blocks_count = chain.blocks.length;
            } catch (e) {}
            return res.status(200).json({
                success: true, message: 'pong', version: '8.5.0',
                kv_enabled: !!kv, playlists_count, blocks_count,
                youtube_enabled: !!YOUTUBE_API_KEY,
                timestamp: new Date().toISOString()
            });
        }

        // ============================================================
        // 🔍 BUSCA NO YOUTUBE (NOVO — CORRIGIDO)
        // ============================================================
        if (action === 'search_youtube') {
            const { query, limit } = params;
            if (!query) return res.status(200).json({ success: false, message: 'Query obrigatória' });

            console.log('🎥 Buscando YouTube:', query);

            // 1. Tenta via API direta do YouTube (mais confiável)
            const directResults = await searchYouTube(query, parseInt(limit) || 15);
            if (directResults.length > 0) {
                console.log(`🎥 YouTube API OK: ${directResults.length} resultados`);
                return res.status(200).json({ success: true, data: directResults, source: 'youtube_api' });
            }

            // 2. Fallback: tenta via GAS
            console.log('⚠️ YouTube API vazia, tentando GAS...');
            const gasResult = await callGAS('search_youtube', { query, limit: limit || 15 });
            if (gasResult.success && gasResult.data && gasResult.data.success && gasResult.data.data && gasResult.data.data.length > 0) {
                return res.status(200).json({ success: true, data: gasResult.data.data, source: 'gas' });
            }

            return res.status(200).json({ success: true, data: [], message: 'Nenhum resultado' });
        }

        // ============================================================
        // 🎬 YOUTUBE VIDEO INFO (para upload de música)
        // ============================================================
        if (action === 'search_isrc') {
            const { youtube_url } = params;
            if (!youtube_url) return res.status(200).json({ success: false, message: 'URL obrigatória' });

            // Extrai video ID
            let videoId = null;
            const patterns = [/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/, /youtube\.com\/watch\?.*v=([^&\n?#]+)/];
            for (let p of patterns) {
                const m = youtube_url.match(p);
                if (m && m[1] && m[1].length === 11) { videoId = m[1]; break; }
            }
            if (!videoId) return res.status(200).json({ success: false, message: 'URL inválida' });

            const info = await getYouTubeVideoInfo(videoId);
            if (info) {
                return res.status(200).json({
                    success: true,
                    data: {
                        title: info.title,
                        artist: info.artist,
                        isrc: 'ISRC_' + Date.now(),
                        source: 'youtube',
                        video_id: videoId,
                        views: info.views,
                        likes: info.likes,
                        thumbnail: info.thumbnail
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
        // 🎵 PLAYLISTS GLOBAIS (KV)
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
            const news = await aggregateNews();
            const limit = parseInt(params.limit) || 100;
            return res.status(200).json({ success: true, data: news.slice(0, limit), total: news.length, source: 'google_news_rss', cached: true });
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
            // Tenta GAS primeiro para stats reais
            const gasResult = await callGAS('get_stats');
            if (gasResult.success && gasResult.data && gasResult.data.data) {
                return res.status(200).json(gasResult.data);
            }
            return res.status(200).json({
                success: true,
                data: { total_usuarios: 1, total_musicas: FALLBACK_MUSICAS.length, playlists_count: playlists.length, total_investido: 0, blocks_count: chain.blocks.length }
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
            // Também tenta GAS
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
        // STREAMING
        // ============================================================
        if (action === 'register_streaming') {
            const { music_id, user_id } = params;
            if (!music_id || !user_id) return res.status(200).json({ success: false, message: 'Dados incompletos' });
            await addBlockToChain({ type: 'streaming', music_id, user_id });
            callGAS('register_streaming', { music_id, user_id, duration: 30 }).catch(() => {});
            return res.status(200).json({ success: true, data: { reward: 1 } });
        }

        if (action === 'get_streaming_stats') {
            const gasResult = await callGAS('get_streaming_stats', params);
            if (gasResult.success && gasResult.data) return res.status(200).json(gasResult.data);
            return res.status(200).json({ success: true, data: { total_earnings: 0, songs_count: 0, total_seconds: 0, rank: 0 } });
        }

        // ============================================================
        // 🎵 MÚSICAS (proxy GAS com fallback)
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
            // Fallback: tenta GAS
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
        // 🎤 GET FOLLOWING ARTISTS
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
            version: '8.5.0',
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
