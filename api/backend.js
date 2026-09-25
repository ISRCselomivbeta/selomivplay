// BACKEND.JS - VERSÃO 9.8.2
// ============================================================
// PERSISTÊNCIA VERCEL KV + FEED INFINITO + RSS DIRETO
// + CONTADOR DE STREAMS + ELO + VALUATION + ISRC
// + COMPATIBILIDADE TOTAL COM GAS 7.0.1
// + VENDA DIRETA AO MERCADO (sell_to_market)
// + VENDA P2P COM EMAIL (create_trade robusto)
// + IMAGENS REAIS NOS FEEDS (extração agressiva + og:image)
//
// 🔒 v9.8.2 — MELHORIAS DE IMAGEM E ROBUSTEZ
//   - ✅ FIX: getFonteLogo com URLs reais (antes eram fake)
//   - ✅ FIX: extração de imagem em 8 formatos (igual ao front)
//   - ✅ FIX: enriquecimento og:image para notícias sem imagem
//   - ✅ FIX: get_trades com fallback multi-formato
//   - ✅ FIX: create_trade valida posse antes de chamar GAS
//   - ✅ FIX: content-type aceita text/plain (Google News)
//   - ✅ ADD: feeds diretos faltantes (Omelete, Papelpop, Popline, G1 Pop Arte)
//   - ✅ ADD: log de timeout no aggregateNews
//
// 🔒 v9.8.1 — 100% DROP-IN (SEM BLOQUEIO)
//   - ✅ ADMIN_REQUIRED_ACTIONS vazio → nada bloqueia
//   - ✅ Sessão server-side pronta, mas dormente
//   - ✅ Compatibilidade total com frontend atual
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

// ============================================================
// 🔒 v9.8.1 — CONFIGURAÇÃO DE SEGURANÇA
// ============================================================
const SESSION_SECRET = process.env.SESSION_SECRET
    || crypto.createHash('sha256').update('playmy-fallback-' + (process.env.GAS_URL || 'dev')).digest('hex');

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias
const SESSION_PREFIX = 'session_';

// Compatibilidade: aceita user_id do body quando não há sessão.
// Padrão: LIGADO. Defina COMPAT_ALLOW_BODY_USER_ID=false para forçar sessão.
const COMPAT_ALLOW_BODY_USER_ID = process.env.COMPAT_ALLOW_BODY_USER_ID !== 'false';

// Ações que exigem autenticação (mesmo em modo compat).
// Mantidas aqui para o dia em que o frontend enviar sessão.
// Com COMPAT_ALLOW_BODY_USER_ID=true (padrão), NADA é bloqueado.
const AUTH_REQUIRED_ACTIONS = new Set([
    'get_saldo', 'get_carteira', 'get_extrato', 'get_user_profile',
    'get_playlists', 'get_following',
    'buy', 'sell_to_market', 'buy_external', 'request_withdrawal',
    'create_trade', 'accept_trade', 'decline_trade', 'cancel_trade',
    'confirm_investment', 'confirm_external_investment',
    'create_pix_payment', 'check_pix_payment',
    'create_playlist', 'add_music_to_playlist', 'remove_music_from_playlist',
    'toggle_follow', 'toggle_favorite', 'update_profile',
    'register_streaming', 'create_ticket', 'redeem_ticket',
    'mark_news_seen', 'track_news_interaction'
]);

// 🔒 v9.8.1 — VAZIO de propósito. Nada exige admin.
// Quando o painel admin enviar sessão real, descomente:
// 'add_block', 'get_admin_stats'
const ADMIN_REQUIRED_ACTIONS = new Set([
]);

// ============================================================
// KV — suporta REDIS_URL (node-redis) OU @vercel/kv
// ============================================================
let kv = null;
let kvReady = null;
let kvMode = 'none';

if (process.env.REDIS_URL) {
    try {
        const { createClient } = require('redis');
        kv = createClient({ url: process.env.REDIS_URL });
        kv.on('error', (err) => console.warn('⚠️ Redis error:', err.message));
        kvReady = kv.connect()
            .then(() => {
                kvMode = 'redis';
                console.log('✅ Redis (REDIS_URL) conectado');
            })
            .catch((e) => {
                console.warn('⚠️ Redis connect falhou:', e.message);
                kv = null;
                kvMode = 'none';
            });
    } catch (e) {
        console.warn('⚠️ node-redis não instalado:', e.message);
        kv = null;
    }
}

if (!kv) {
    try {
        const vk = require('@vercel/kv').kv;
        if (vk) {
            kv = {
                get: (k) => vk.get(k),
                set: (k, v) => vk.set(k, v),
                del: (k) => vk.del(k)
            };
            kvReady = Promise.resolve();
            kvMode = 'vercel-kv';
            console.log('✅ @vercel/kv carregado');
        }
    } catch (e) {}
}

if (!kv) {
    console.warn('⚠️ Nenhum KV disponível — usando fallback em memória');
}

// ============================================================
// GAS_URL com fallback hard-coded
// ============================================================
const GAS_URL_FALLBACK = 'https://script.google.com/macros/s/AKfycbwgjor-tLLzVrnJGNHOifL1O2sRBhysKJ3IbVJy_AHgtNqjk-6hazH8xuO6OaDXF_s/exec';
const GAS_URL = process.env.GAS_URL || GAS_URL_FALLBACK;

if (!process.env.GAS_URL) {
    console.warn('⚠️ [GAS_URL] env var não configurada no Vercel — usando fallback hard-coded');
} else {
    console.log('✅ [GAS_URL] env var configurada no Vercel');
}

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
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
// MAPA DE LOGOS DE FONTES REAIS (v9.8.2 — URLs corrigidas)
// ============================================================
const FONTE_LOGOS = {
    'g1': 'https://s2.glbimg.com/favicon.ico',
    'globo': 'https://s2.glbimg.com/favicon.ico',
    'ge': 'https://s2.glbimg.com/favicon.ico',
    'folha': 'https://www1.folha.uol.com.br/favicon.ico',
    'uol': 'https://www.uol.com.br/favicon.ico',
    'cnn': 'https://www.cnnbrasil.com.br/favicon.ico',
    'estadao': 'https://www.estadao.com.br/favicon.ico',
    'veja': 'https://veja.abril.com.br/favicon.ico',
    'exame': 'https://exame.com/favicon.ico',
    'billboard': 'https://www.billboard.com/favicon.ico',
    'rollingstone': 'https://rollingstone.uol.com.br/favicon.ico',
    'rolling stone': 'https://rollingstone.uol.com.br/favicon.ico',
    'tenhomaisdiscos': 'https://tenhomaisdiscosqueamigos.com/favicon.ico',
    'tenho mais discos': 'https://tenhomaisdiscosqueamigos.com/favicon.ico',
    'omelete': 'https://www.omelete.com.br/favicon.ico',
    'papelpop': 'https://www.papelpop.com/favicon.ico',
    'popline': 'https://portalpopline.com.br/favicon.ico',
    'minc': 'https://www.gov.br/cultura/favicon.ico',
    'gov.br': 'https://www.gov.br/favicon.ico',
    'secult': 'https://www.saude.go.gov.br/favicon.ico'
};

function getFonteLogo(fonte) {
    if (!fonte) return null;
    const f = fonte.toLowerCase().trim();
    // Match exato primeiro
    if (FONTE_LOGOS[f]) return FONTE_LOGOS[f];
    // Match parcial
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
    extrato_all: [],
    sessions: {}
};

const Storage = {
    async _ensure() {
        if (kvReady) { try { await kvReady; } catch (e) {} }
    },
    async get(key) {
        await this._ensure();
        if (kv) {
            try {
                const raw = await kv.get('playmy:' + key);
                if (raw !== null && raw !== undefined) {
                    if (typeof raw === 'string') {
                        try { return JSON.parse(raw); } catch (_) { return raw; }
                    }
                    return raw;
                }
            } catch (e) { console.warn('KV get error:', e.message); }
        }
        return MEMORY_STORAGE[key] !== undefined ? MEMORY_STORAGE[key] : null;
    },
    async set(key, value) {
        await this._ensure();
        if (kv) {
            try {
                const payload = (typeof value === 'string') ? value : JSON.stringify(value);
                await kv.set('playmy:' + key, payload);
                return true;
            } catch (e) { console.warn('KV set error:', e.message); }
        }
        MEMORY_STORAGE[key] = value;
        return true;
    },
    async del(key) {
        await this._ensure();
        if (kv) { try { await kv.del('playmy:' + key); } catch (e) {} }
        delete MEMORY_STORAGE[key];
    }
};

// ============================================================
// 🔒 v9.8.1 — SESSÃO SERVER-SIDE (dormente até o frontend usar)
// ============================================================
function _b64url(buf) {
    return Buffer.from(buf).toString('base64')
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function _b64urlDecode(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    return Buffer.from(str, 'base64');
}
function _sign(payload) {
    return _b64url(crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest());
}

async function createSession(userId, role = 'user', meta = {}) {
    const raw = crypto.randomBytes(32);
    const tokenId = _b64url(raw);
    const payload = tokenId;
    const sig = _sign(payload);
    const token = payload + '.' + sig;

    const record = {
        user_id: String(userId),
        role: String(role || 'user'),
        created_at: Date.now(),
        expires_at: Date.now() + SESSION_TTL_MS,
        ip: meta.ip || null,
        ua: meta.ua || null
    };
    await Storage.set(SESSION_PREFIX + tokenId, record);
    return { token, expires_at: record.expires_at };
}

async function validateSession(token) {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [payload, sig] = parts;
    const expected = _sign(payload);
    try {
        const a = Buffer.from(sig);
        const b = Buffer.from(expected);
        if (a.length !== b.length) return null;
        if (!crypto.timingSafeEqual(a, b)) return null;
    } catch (e) { return null; }

    const record = await Storage.get(SESSION_PREFIX + payload);
    if (!record) return null;
    if (Date.now() > record.expires_at) {
        await Storage.del(SESSION_PREFIX + payload);
        return null;
    }
    return record;
}

async function revokeSession(token) {
    if (!token || typeof token !== 'string') return false;
    const parts = token.split('.');
    if (parts.length !== 2) return false;
    await Storage.del(SESSION_PREFIX + parts[0]);
    return true;
}

// ============================================================
// 🔒 v9.8.1 — AUTORIZAÇÃO CENTRAL (dormente)
// ============================================================
function _extractToken(req, params) {
    const auth = req.headers && (req.headers.authorization || req.headers.Authorization);
    if (auth && typeof auth === 'string') {
        const m = auth.match(/^Bearer\s+(.+)$/i);
        if (m) return m[1].trim();
    }
    const cookie = req.headers && req.headers.cookie;
    if (cookie && typeof cookie === 'string') {
        const m = cookie.match(/(?:^|;\s*)session_token=([^;]+)/);
        if (m) return decodeURIComponent(m[1]);
    }
    if (params && params.session_token) return String(params.session_token);
    return null;
}

async function requireAuth(req, params, opts = {}) {
    const token = _extractToken(req, params);
    if (token) {
        const session = await validateSession(token);
        if (session) {
            return {
                ok: true,
                session,
                user_id: session.user_id,
                role: session.role || 'user',
                _compat: false
            };
        }
    }

    if (COMPAT_ALLOW_BODY_USER_ID && opts.allowCompat !== false) {
        const bodyUserId = params && (params.user_id || params.userId);
        if (bodyUserId) {
            console.warn(`⚠️ [requireAuth] usando user_id do body (compat) — action=${opts.action || '?'}`);
            const role = (String(bodyUserId) === 'admin_master') ? 'admin' : 'user';
            return {
                ok: true,
                session: null,
                user_id: String(bodyUserId),
                role,
                _compat: true
            };
        }
    }

    return { ok: false, message: 'Não autenticado' };
}

function requireRole(auth, roles) {
    if (!auth || !auth.ok) return false;
    const list = Array.isArray(roles) ? roles : [roles];
    return list.includes(auth.role);
}

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
// 🔒 v9.8.1 — PASSWORD HASHING (scrypt, nativo)
// ============================================================
const SCRYPT_N = 16384, SCRYPT_R = 8, SCRYPT_P = 1, SCRYPT_KEYLEN = 64;

function hashPasswordScrypt(password) {
    const salt = crypto.randomBytes(16);
    const hash = crypto.scryptSync(String(password), salt, SCRYPT_KEYLEN, {
        N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P
    });
    return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

function verifyPasswordScrypt(password, stored) {
    if (!stored || typeof stored !== 'string') return false;
    const parts = stored.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
    const N = parseInt(parts[1]), r = parseInt(parts[2]), p = parseInt(parts[3]);
    const salt = Buffer.from(parts[4], 'base64');
    const expected = Buffer.from(parts[5], 'base64');
    try {
        const actual = crypto.scryptSync(String(password), salt, expected.length, { N, r, p });
        return crypto.timingSafeEqual(actual, expected);
    } catch (e) { return false; }
}

function hashPasswordSHA256(password) {
    return crypto.createHash('sha256').update(String(password)).digest('hex');
}

function verifyPasswordAny(password, user) {
    if (!user) return { ok: false, needsRehash: false };
    if (user.senha_hash && user.senha_hash.startsWith('scrypt$')) {
        return { ok: verifyPasswordScrypt(password, user.senha_hash), needsRehash: false };
    }
    if (user.senha_hash) {
        const ok = user.senha_hash === hashPasswordSHA256(password);
        if (ok) return { ok: true, needsRehash: true, newHash: hashPasswordScrypt(password) };
        return { ok: false, needsRehash: false };
    }
    if (user.senha) {
        const ok = user.senha === password;
        if (ok) return { ok: true, needsRehash: true, newHash: hashPasswordScrypt(password) };
        return { ok: false, needsRehash: false };
    }
    return { ok: false, needsRehash: false };
}

// ============================================================
// CHAMAR GAS — timeout 15s + 1 retry
// ============================================================
async function callGAS(action, params = {}, retries = 1) {
    if (!GAS_URL) {
        console.error('[callGAS] GAS_URL não configurada — impossível chamar GAS');
        return { success: false, error: 'GAS_URL não configurada no servidor' };
    }

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
            const timeout = setTimeout(() => controller.abort(), 15000);
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

    let payload;
    if (inner.data !== undefined) {
        payload = inner.data;
    } else if (Array.isArray(inner)) {
        payload = inner;
    } else {
        const possibleKeys = ['musicas', 'items', 'list', 'result', 'data'];
        for (const key of possibleKeys) {
            if (Array.isArray(inner[key])) {
                payload = inner[key];
                break;
            }
        }
        if (payload === undefined) payload = inner;
    }

    return {
        success: true,
        data: payload,
        pagination: inner.pagination,
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
        expiresAt: Date.now() + 3600000,
        used: false
    };
    await Storage.set('reset_token_' + token, record);
    return token;
}

async function validateResetToken(token) {
    const record = await Storage.get('reset_token_' + token);
    if (!record) return null;
    if (record.used) return null;
    if (Date.now() > record.expiresAt) {
        await Storage.del('reset_token_' + token);
        return null;
    }
    return record;
}

async function consumeResetToken(token) {
    const record = await Storage.get('reset_token_' + token);
    if (!record) return null;
    record.used = true;
    record.usedAt = Date.now();
    await Storage.set('reset_token_' + token, record);
    setTimeout(() => { Storage.del('reset_token_' + token).catch(() => {}); }, 3600000);
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
// 🆕 v9.8.2 — EXTRAÇÃO AGRESSIVA DE IMAGEM (8 formatos)
// ============================================================
function extractImageFromItem(itemXml, ceMatch, dsMatch) {
    const candidates = [
        itemXml.match(/<enclosure[^>]*url=["']([^"']+)["']/i),
        itemXml.match(/<media:content[^>]*url=["']([^"']+)["']/i),
        itemXml.match(/<media:thumbnail[^>]*url=["']([^"']+)["']/i),
        itemXml.match(/<media:group>[\s\S]*?<media:content[^>]*url=["']([^"']+)["']/i),
        itemXml.match(/<img[^>]*src=["']([^"']+)["']/i),
        (ceMatch && ceMatch[1] && ceMatch[1].match(/<img[^>]*src=["']([^"']+)["']/i)),
        (dsMatch && dsMatch[1] && dsMatch[1].match(/<img[^>]*src=["']([^"']+)["']/i)),
        (ceMatch && ceMatch[1] && ceMatch[1].match(/property=["']og:image["'][^>]*content=["']([^"']+)["']/i))
    ];
    for (const c of candidates) {
        if (c && c[1]) {
            const url = c[1];
            if (url && url.indexOf('http') === 0 &&
                url.indexOf('feedburner') === -1 &&
                url.indexOf('pixel') === -1 &&
                !/\.(gif|svg)$/i.test(url.split('?')[0])) {
                return url;
            }
        }
    }
    return null;
}

// ============================================================
// 🆕 v9.8.2 — ENRIQUECER COM og:image (para notícias sem imagem)
// ============================================================
async function enrichWithOgImage(items) {
    const semImagem = items.filter(n =>
        (!n.imagem || n.imagem === '') && n.link && n.link.indexOf('http') === 0
    ).slice(0, 8);

    if (!semImagem.length) return items;

    console.log(`[news] 🔍 enriquecendo ${semImagem.length} notícias com og:image...`);

    const promises = semImagem.map(n => {
        return new Promise(resolve => {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 6000);
            fetch(n.link, {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; PLAYMY/9.8.2)',
                    'Accept': 'text/html'
                }
            })
                .then(r => { clearTimeout(timer); return r.text(); })
                .then(html => {
                    const m = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                              html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i) ||
                              html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i);
                    if (m && m[1] && m[1].indexOf('http') === 0) {
                        n.imagem = m[1];
                    }
                    resolve(n);
                })
                .catch(() => { clearTimeout(timer); resolve(n); });
        });
    });

    await Promise.allSettled(promises);
    return items;
}

// ============================================================
// NOTÍCIAS — GOOGLE NEWS RSS (v9.8.2 — extração agressiva)
// ============================================================
async function fetchNewsFromGoogleRSS(query, categoria) {
    try {
        const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        const response = await fetch(rssUrl, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; PLAYMY/9.8.2)',
                'Accept': 'application/xml, text/xml, */*'
            }
        });
        clearTimeout(timeout);

        if (!response.ok) return [];
        const contentType = response.headers.get('content-type') || '';
        // 🆕 v9.8.2 — aceita text/plain também (Google News às vezes manda)
        if (!contentType.includes('xml') && !contentType.includes('rss') &&
            !contentType.includes('html') && !contentType.includes('text/plain')) return [];

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
            const ceMatch = itemXml.match(/<content:encoded>([\s\S]*?)<\/content:encoded>/);
            if (titleMatch) {
                let title = titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim();
                const source = sourceMatch ? sourceMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : 'Google News';
                if (source && title.endsWith(' - ' + source)) title = title.slice(0, -(source.length + 3));
                let texto = '';
                if (descMatch) {
                    texto = descMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, '').trim().substring(0, 200);
                    if (texto) texto += '...';
                }

                // 🆕 v9.8.2 — extração agressiva
                const imagemReal = extractImageFromItem(itemXml, ceMatch, descMatch);

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
// NOTÍCIAS — FEEDS DIRETOS (v9.8.2 — extração agressiva)
// ============================================================
async function fetchNewsFromDirectRSS(rssUrl, categoria, fonte) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        const response = await fetch(rssUrl, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; PLAYMY/9.8.2)',
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
            const ceMatch = itemXml.match(/<content:encoded>([\s\S]*?)<\/content:encoded>/);

            if (titleMatch) {
                let title = titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim();
                let texto = '';
                if (descMatch) {
                    texto = descMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, '').trim().substring(0, 200);
                    if (texto) texto += '...';
                }

                // 🆕 v9.8.2 — extração agressiva
                const imagemReal = extractImageFromItem(itemXml, ceMatch, descMatch);

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
// AGREGADOR DE NOTÍCIAS (v9.8.2 — feeds extras + og:image)
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

    // 🆕 v9.8.2 — feeds diretos expandidos (paridade com o frontend)
    const RSS_DIRETOS = [
        { url: 'https://g1.globo.com/rss/g1/pop-arte/musica/', cat: 'musica', fonte: 'G1' },
        { url: 'https://g1.globo.com/rss/g1/pop-arte/', cat: 'musica', fonte: 'G1' },
        { url: 'https://rss.uol.com.br/feed/musica.xml', cat: 'musica', fonte: 'UOL' },
        { url: 'https://rollingstone.uol.com.br/rss/', cat: 'musica', fonte: 'Rolling Stone' },
        { url: 'https://tenhomaisdiscosqueamigos.com/feed/', cat: 'musica', fonte: 'Tenho Mais Discos' },
        { url: 'https://www.omelete.com.br/feed', cat: 'musica', fonte: 'Omelete' },
        { url: 'https://www.papelpop.com/feed/', cat: 'musica', fonte: 'Papelpop' },
        { url: 'https://portalpopline.com.br/feed/', cat: 'musica', fonte: 'Popline' }
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
        // 🆕 v9.8.2 — log de timeout
        console.warn('[news] ⏱️ aggregateNews timeout (8s) — usando cache stale');
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

    // 🆕 v9.8.2 — enriquecer com og:image as que ficaram sem imagem
    await enrichWithOgImage(unique);

    await Storage.set('news_cache', unique);
    await Storage.set('news_cache_time', Date.now());
    return unique;
}

// ============================================================
// ISRC
// ============================================================
function validarISRC(isrc) {
    if (!isrc || typeof isrc !== 'string') return false;
    const limpo = isrc.replace(/[-\s]/g, '').toUpperCase();
    if (limpo.length !== 12) return false;
    return /^[A-Z]{2}[A-Z0-9]{3}[0-9]{2}[0-9]{5}$/.test(limpo);
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

async function buscarIsrcMusicBrainz(titulo, artista) {
    const resultados = [];
    try {
        const query = artista
            ? `recording:"${titulo}" AND artist:"${artista}"`
            : `recording:"${titulo}"`;
        const url = `https://musicbrainz.org/ws/2/recording/?query=${encodeURIComponent(query)}&fmt=json&limit=10`;
        const r = await fetch(url, {
            headers: {
                'User-Agent': 'PLAYMY/9.8.2 (contato@playmy.com.br)',
                'Accept': 'application/json'
            }
        });
        if (!r.ok) return resultados;
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
    } catch (e) {}
    return resultados;
}

// ============================================================
// ELO + VALUATION
// ============================================================
const ELO_CONFIG = {
    base: 1000,
    k_fator: 32,
    ganhos: { stream_play_my: 2, view_youtube: 1, stream_spotify: 3, stream_deezer: 3, stream_apple: 3, investimento: 5, trade_aceito: 10, curtida: 1, compartilhamento: 2 },
    limites: { play_my_max: 300, externos_max: 400, consistencia_max: 100, tendencia_max: 150 },
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
        music_id, elo, faixa,
        faixa_label: ELO_CONFIG.faixas[faixa].label,
        cor: ELO_CONFIG.faixas[faixa].cor,
        breakdown, streams_por_plataforma: streamsPorPlataforma,
        atualizado_em: new Date().toISOString()
    };
}

const MERCADO = {
    valor_por_stream: { play_my: 0.015, youtube: 0.002, spotify: 0.004, deezer: 0.003, apple_music: 0.007, amazon_music: 0.005, outros: 0.003 },
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
        music_id, fontes: {}, projecoes: {},
        receita_anual_projetada: 0, valuation: 0,
        elo: 1000, elo_faixa: 'neutro', elo_cor: '#8E8E93',
        multiplo_base: MERCADO.multiplo_base, multiplo_final: MERCADO.multiplo_base,
        ajuste_elo: 0, atualizado_em: new Date().toISOString()
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
// HELPERS DE ESCRITA
// ============================================================
async function writeThrough(gasAction, gasParams, kvUpdateFn) {
    const gasResult = await callGAS(gasAction, gasParams);
    const unwrapped = unwrapGAS(gasResult);

    if (!unwrapped.success) {
        console.warn(`⚠️ [writeThrough] GAS falhou em "${gasAction}":`, gasResult.error);
        return { success: false, error: gasResult.error, message: unwrapped.message, _via: 'gas_error' };
    }

    if (typeof kvUpdateFn === 'function') {
        try {
            await kvUpdateFn(unwrapped.data);
        } catch (e) {
            console.warn(`⚠️ [writeThrough] KV update falhou em "${gasAction}":`, e.message);
        }
    }

    return { success: true, data: unwrapped.data, _via: 'gas' };
}

async function invalidateCache(keys) {
    for (const key of keys) {
        cache.cache.delete('cache_' + key);
        try { await Storage.del('cache_' + key); } catch (e) {}
    }
}

// ============================================================
// VENDA DIRETA AO MERCADO
// ============================================================
async function processSellToMarket(userId, musicId, quantidade, precoUnitario, valorTotal) {
    const SPLIT = { artista: 0.70, plataforma: 0.20, fundo: 0.10 };

    const carteira = await Storage.get('carteira_' + userId) || [];
    const ativo = carteira.find(a => String(a.music_id) === String(musicId) && a.status === 'ativo');
    if (!ativo) return { success: false, message: 'Você não possui essa música' };
    if (ativo.quantidade < quantidade) return { success: false, message: 'Quantidade maior que o disponível' };

    ativo.quantidade -= quantidade;
    if (ativo.quantidade === 0) ativo.status = 'em_venda';
    await Storage.set('carteira_' + userId, carteira);

    const users = await Storage.get('users_all') || [];
    const vendedor = users.find(u => u.id === userId);
    if (vendedor) {
        vendedor.saldo = (vendedor.saldo || 0) + valorTotal;
        await Storage.set('users_all', users);
    }

    const extrato = await Storage.get('extrato_all') || [];
    extrato.push({
        id: 'ext_' + Date.now(),
        user_id: userId, tipo: 'VENDA', categoria: 'VENDA_DE_ACAO',
        descricao: `Venda de ${quantidade} ações ao mercado`,
        valor: valorTotal,
        saldo_antes: (vendedor?.saldo || 0) - valorTotal,
        saldo_apos: vendedor?.saldo || 0,
        status: 'concluido',
        detalhes: { music_id: musicId, quantidade, preco_unitario: precoUnitario },
        created_at: new Date().toISOString()
    });
    await Storage.set('extrato_all', extrato);

    const musicas = await Storage.get('musicas_all') || [];
    const musica = musicas.find(m => String(m.id) === String(musicId));
    if (musica) {
        musica.acoes_disponiveis = (musica.acoes_disponiveis || 0) + quantidade;
        await Storage.set('musicas_all', musicas);
    }

    const block = await addBlockToChain({
        type: 'venda_mercado', music_id: musicId, user_id: userId,
        quantidade, valor_total: valorTotal
    });

    callGAS('add_transaction', {
        user_id: userId, tipo: 'VENDA', valor: valorTotal,
        descricao: `Venda ao mercado — ${quantidade} ações`,
        referencia: block.hash
    }).catch(() => {});

    return {
        success: true,
        data: {
            contrato_id: 'VD_' + Date.now(),
            blockchain_hash: block.hash,
            quantidade_vendida: quantidade,
            valor_total: valorTotal,
            novo_saldo: vendedor?.saldo || 0,
            split: {
                artista: Math.round(valorTotal * SPLIT.artista * 100) / 100,
                plataforma: Math.round(valorTotal * SPLIT.plataforma * 100) / 100,
                fundo: Math.round(valorTotal * SPLIT.fundo * 100) / 100
            }
        },
        message: `Venda realizada! +R$ ${valorTotal.toFixed(2)} no saldo`,
        _via: 'local'
    };
}

// ============================================================
// 🔒 SEGURANÇA — migração one-shot de senhas
// ============================================================
(async function migrateSenhasToHash() {
    try {
        const users = await Storage.get('users_all') || [];
        if (!Array.isArray(users) || !users.length) return;

        let mudou = false;
        for (const u of users) {
            if (u && u.senha) {
                if (!u.senha_hash) {
                    u.senha_hash = hashPasswordScrypt(u.senha);
                }
                delete u.senha;
                mudou = true;
            }
        }

        if (mudou) {
            await Storage.set('users_all', users);
            console.log(`🔒 [migração] ${users.length} usuários migrados (senha texto plano → scrypt)`);
        }
    } catch (e) {
        console.warn('⚠️ [migração] falha:', e.message);
    }
})();

// ============================================================
// HANDLER PRINCIPAL — v9.8.2
// ============================================================
module.exports = async (req, res) => {
    if (req.method === 'OPTIONS') return res.status(200).end();

    const params = req.method === 'POST' ? (req.body || {}) : (req.query || {});
    const { action } = params;

    console.log(`🚀 [${action}]`);

    try {
        // ============================================================
        // 🔒 v9.8.1 — AUTORIZAÇÃO CENTRAL (dormente)
        // Em modo compat (padrão), NADA é bloqueado.
        // ============================================================
        let auth = null;
        const needsAuth = action && AUTH_REQUIRED_ACTIONS.has(action);
        const needsAdmin = action && ADMIN_REQUIRED_ACTIONS.has(action);

        if (needsAuth || needsAdmin) {
            auth = await requireAuth(req, params, { action });
            if (!auth.ok) {
                return res.status(200).json({ success: false, message: 'Não autenticado', _auth: 'required' });
            }
            if (needsAdmin && !requireRole(auth, 'admin')) {
                return res.status(200).json({ success: false, message: 'Acesso negado', _auth: 'forbidden' });
            }
        }

        // ============================================================
        // PING
        // ============================================================
        if (action === 'ping') {
            let gasPing = false;
            try {
                const gasResult = await callGAS('ping');
                gasPing = unwrapGAS(gasResult).success;
            } catch (e) {}

            return res.status(200).json({
                success: true,
                message: 'pong',
                version: '9.8.2',
                kv_enabled: !!kv,
                kv_mode: kvMode,
                redis_url_set: !!process.env.REDIS_URL,
                nodemailer_enabled: !!nodemailer,
                youtube_enabled: !!YOUTUBE_API_KEY,
                gas_ping: gasPing,
                gas_url_source: process.env.GAS_URL ? 'env' : 'fallback',
                session_secret_set: !!process.env.SESSION_SECRET,
                compat_allow_body_user_id: COMPAT_ALLOW_BODY_USER_ID,
                auth_required_count: AUTH_REQUIRED_ACTIONS.size,
                admin_required_count: ADMIN_REQUIRED_ACTIONS.size,
                timestamp: new Date().toISOString()
            });
        }

        // ============================================================
        // 🔒 SESSÃO — logout / check
        // ============================================================
        if (action === 'logout') {
            const token = _extractToken(req, params);
            if (token) await revokeSession(token);
            return res.status(200).json({ success: true, message: 'Sessão encerrada' });
        }

        if (action === 'session_check') {
            const token = _extractToken(req, params);
            if (!token) return res.status(200).json({ success: false, message: 'Sem sessão' });
            const s = await validateSession(token);
            if (!s) return res.status(200).json({ success: false, message: 'Sessão inválida ou expirada' });
            return res.status(200).json({
                success: true,
                data: { user_id: s.user_id, role: s.role, expires_at: s.expires_at }
            });
        }

        // ============================================================
        // LOGIN
        // ============================================================
        if (action === 'login') {
            const email = sanitize(params.email);
            const password = params.password;
            if (!email || !password) return res.status(200).json({ success: false, message: 'Email e senha obrigatórios' });
            if (!validateEmail(email)) return res.status(200).json({ success: false, message: 'Email inválido' });

            const clientIP = req.ip || (req.connection && req.connection.remoteAddress) || 'unknown';
            const rateCheck = rateLimiter.check('login:' + clientIP);
            if (!rateCheck.allowed) return res.status(200).json({ success: false, message: rateCheck.message });

            const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
            const ADMIN_PASS_HASH = process.env.ADMIN_PASS_HASH;

            if (ADMIN_EMAIL && ADMIN_PASS_HASH && email === ADMIN_EMAIL) {
                let adminOk = false;
                if (ADMIN_PASS_HASH.startsWith('scrypt$')) {
                    adminOk = verifyPasswordScrypt(password, ADMIN_PASS_HASH);
                } else {
                    adminOk = hashPasswordSHA256(password) === ADMIN_PASS_HASH;
                }
                if (adminOk) {
                    rateLimiter.reset('login:' + clientIP);
                    const session = await createSession('admin_master', 'admin', { ip: clientIP, ua: req.headers['user-agent'] });
                    console.log('✅ [login] admin autenticado via env');
                    return res.status(200).json({
                        success: true,
                        data: {
                            id: 'admin_master',
                            nome: 'Administrador',
                            email: ADMIN_EMAIL,
                            tipo: 'admin',
                            saldo: 1000000,
                            selo_coin: 50000,
                            favorite_music_ids: [],
                            email_confirmado: true
                        },
                        session_token: session.token,
                        expires_at: session.expires_at,
                        _via: 'env'
                    });
                }
            }

            const users = await Storage.get('users_all') || [];
            let user = users.find(u => u.email === email);

            if (user) {
                const v = verifyPasswordAny(password, user);
                if (v.ok) {
                    if (v.needsRehash && v.newHash) {
                        user.senha_hash = v.newHash;
                        delete user.senha;
                        user.password_algo = 'scrypt';
                        user.password_updated_at = new Date().toISOString();
                        await Storage.set('users_all', users);
                        console.log(`🔒 [login] senha migrada para scrypt: ${email}`);
                    }
                    rateLimiter.reset('login:' + clientIP);
                    console.log('✅ [login] via KV (cache)');
                    const { senha, senha_hash, ...userSafe } = user;
                    const role = (user.id === 'admin_master' || user.tipo === 'admin') ? 'admin' : 'user';
                    const session = await createSession(user.id, role, { ip: clientIP, ua: req.headers['user-agent'] });
                    return res.status(200).json({
                        success: true, data: userSafe,
                        session_token: session.token, expires_at: session.expires_at,
                        _via: 'kv'
                    });
                }
            }

            const gasResult = await callGAS('login', { email, password });
            const unwrapped = unwrapGAS(gasResult);

            if (unwrapped.success && unwrapped.data) {
                rateLimiter.reset('login:' + clientIP);

                const gasUser = unwrapped.data;
                const existingIdx = users.findIndex(u => u.email === email);
                const newScryptHash = hashPasswordScrypt(password);

                if (existingIdx >= 0) {
                    const { senha: _oldSenha, ...rest } = users[existingIdx];
                    users[existingIdx] = { ...rest, ...gasUser, senha_hash: newScryptHash, password_algo: 'scrypt' };
                } else {
                    const { senha: _gasSenha, ...gasSafe } = gasUser;
                    users.push({ ...gasSafe, senha_hash: newScryptHash, password_algo: 'scrypt' });
                }
                await Storage.set('users_all', users);
                console.log('🔄 [login] usuário sincronizado do GAS para o KV:', email);

                const { senha, senha_hash, ...gasUserSafe } = gasUser;
                const role = (gasUser.id === 'admin_master' || gasUser.tipo === 'admin') ? 'admin' : 'user';
                const session = await createSession(gasUser.id, role, { ip: clientIP, ua: req.headers['user-agent'] });
                return res.status(200).json({
                    success: true, data: gasUserSafe,
                    session_token: session.token, expires_at: session.expires_at,
                    _via: 'gas', _synced: true
                });
            }

            return res.status(200).json({ success: false, message: 'Credenciais inválidas' });
        }

        // ============================================================
        // RESET PASSWORD
        // ============================================================
        if (action === 'request_password_reset') {
            const { email } = params;
            if (!email || !validateEmail(email)) {
                return res.status(200).json({ success: true, message: 'Se o email existir, enviaremos instruções.' });
            }

            const rl = rateLimiter.check('reset:' + email.toLowerCase());
            if (!rl.allowed) {
                return res.status(200).json({ success: true, message: 'Se o email existir, enviaremos instruções.' });
            }

            const resetToken = await generateResetToken(email);
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
            if (result.success) {
                return res.status(200).json({ success: true, message: 'Se o email existir, enviaremos instruções.' });
            }

            const gasResult = await callGAS('request_password_reset', { email });
            const unwrapped = unwrapGAS(gasResult);
            if (unwrapped.success) return res.status(200).json({ success: true, data: unwrapped.data });
            return res.status(200).json({ success: true, message: 'Se o email existir, enviaremos instruções.' });
        }

        if (action === 'verify_reset_token') {
            const { token } = params;
            if (!token) return res.status(200).json({ success: false, message: 'Token obrigatório' });

            const record = await validateResetToken(token);
            if (record) {
                return res.status(200).json({ success: true, message: 'Token válido', data: { email: record.email } });
            }

            const gasResult = await callGAS('verify_reset_token', { token });
            const unwrapped = unwrapGAS(gasResult);
            if (unwrapped.success) return res.status(200).json({ success: true, data: unwrapped.data });
            return res.status(200).json({ success: false, message: 'Token inválido ou expirado' });
        }

        if (action === 'reset_password') {
            const { token, new_password, confirm_password } = params;

            if (!token || !new_password) {
                return res.status(200).json({ success: false, message: 'Token e nova senha obrigatórios' });
            }
            if (new_password.length < 6) {
                return res.status(200).json({ success: false, message: 'Senha deve ter no mínimo 6 caracteres' });
            }
            if (new_password !== confirm_password) {
                return res.status(200).json({ success: false, message: 'Senhas não coincidem' });
            }

            const rl = rateLimiter.check('reset_use:' + token);
            if (!rl.allowed) {
                return res.status(200).json({ success: false, message: 'Muitas tentativas. Aguarde.' });
            }

            let record = await validateResetToken(token);

            if (!record) {
                const gasVerify = await callGAS('verify_reset_token', { token });
                const gasUnwrapped = unwrapGAS(gasVerify);
                if (gasUnwrapped.success && gasUnwrapped.data) {
                    record = { email: gasUnwrapped.data.email, _via_gas: true };
                }
            }

            if (!record) {
                return res.status(200).json({ success: false, message: 'Token inválido ou expirado' });
            }

            const gasResult = await callGAS('reset_password_by_email', {
                email: record.email,
                new_password: new_password
            });
            const unwrapped = unwrapGAS(gasResult);

            if (!unwrapped.success) {
                return res.status(200).json({
                    success: false,
                    message: 'Erro ao atualizar senha. Tente novamente.',
                    error: gasResult.error
                });
            }

            try {
                const users = await Storage.get('users_all') || [];
                const user = users.find(u => u.email === record.email);
                if (user) {
                    user.senha_hash = hashPasswordScrypt(new_password);
                    delete user.senha;
                    user.password_algo = 'scrypt';
                    user.password_updated_at = new Date().toISOString();
                    user.updated_at = new Date().toISOString();
                    await Storage.set('users_all', users);
                }
            } catch (e) {}

            if (!record._via_gas) {
                await consumeResetToken(token);
            }

            try {
                await callGAS('reset_password', { token, new_password, confirm_password });
            } catch (e) {}

            try {
                await addBlockToChain({
                    type: 'password_reset',
                    email: record.email,
                    timestamp: new Date().toISOString()
                });
            } catch (e) {}

            return res.status(200).json({
                success: true,
                message: 'Senha atualizada com sucesso!',
                _via: 'gas'
            });
        }

        // ============================================================
        // SEARCH YOUTUBE
        // ============================================================
        if (action === 'search_youtube') {
            const { query, limit } = params;
            if (!query) return res.status(200).json({ success: false, message: 'Query obrigatória' });
            const directResults = await searchYouTube(query, parseInt(limit) || 15);
            if (directResults.length > 0) {
                return res.status(200).json({ success: true, data: directResults, source: 'youtube_api' });
            }
            const gasResult = await callGAS('search_youtube', { query, limit: limit || 15 });
            const unwrapped = unwrapGAS(gasResult);
            if (unwrapped.success && Array.isArray(unwrapped.data) && unwrapped.data.length > 0) {
                return res.status(200).json({ success: true, data: unwrapped.data, source: 'gas' });
            }
            return res.status(200).json({ success: true, data: [], message: 'Nenhum resultado' });
        }

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
                        isrc: 'ISRC_' + Date.now(), source: 'youtube',
                        video_id: videoId, views: info.views, likes: info.likes,
                        thumbnail: info.thumbnail
                    }
                });
            }
            return res.status(200).json({ success: true, data: { title: 'Música', artist: 'Artista', isrc: 'ISRC_' + Date.now(), source: 'fallback' } });
        }

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
                    isrc_original: isrc, isrc_normalizado: normalizado,
                    isrc_formatado: formatarISRC(normalizado), valido,
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
                music_id, isrc: isrcNormalizado,
                isrc_formatado: formatarISRC(isrcNormalizado),
                video_id: vid, vinculado_em: new Date().toISOString()
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
        // PLAYLISTS GLOBAIS
        // ============================================================
        if (action === 'get_global_playlists') {
            const cachedL1 = cache.get('global_playlists');
            if (cachedL1) return res.status(200).json({ success: true, data: cachedL1, _via: 'cache' });

            let playlists = await Storage.get('global_playlists') || [];

            if (playlists.length === 0) {
                const gasResult = await callGAS('get_global_playlists', params);
                const unwrapped = unwrapGAS(gasResult);
                if (unwrapped.success && Array.isArray(unwrapped.data)) {
                    playlists = unwrapped.data.map(normalizePlaylistFromGAS);
                    await Storage.set('global_playlists', playlists);
                    cache.set('global_playlists', playlists, 300);
                    return res.status(200).json({ success: true, data: playlists, _via: 'gas' });
                }
            }

            const normalized = playlists.map(normalizePlaylistFromKV);
            cache.set('global_playlists', normalized, 300);
            return res.status(200).json({ success: true, data: normalized, _via: 'kv' });
        }

        if (action === 'create_global_playlist') {
            const nome = sanitize(params.nome);
            const descricao = sanitize(params.descricao || '');
            const userId = auth ? auth.user_id : params.user_id;
            if (!nome) return res.status(200).json({ success: false, message: 'Nome obrigatório' });

            const newId = 'gp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
            const playlists = await Storage.get('global_playlists') || [];
            const newPl = {
                id: newId,
                nome, descricao,
                musicas: [], music_count: 0,
                is_global: true,
                created_by: userId,
                created_at: new Date().toISOString()
            };
            playlists.push(newPl);
            await Storage.set('global_playlists', playlists);
            cache.cache.delete('global_playlists');

            callGAS('create_global_playlist', { nome, descricao, user_id: userId })
                .then(gasResult => {
                    const unwrapped = unwrapGAS(gasResult);
                    if (unwrapped.success && unwrapped.data && unwrapped.data.id) {
                        Storage.get('global_playlists').then(list => {
                            const pl = list.find(p => p.id === newId);
                            if (pl) {
                                pl.id = unwrapped.data.id;
                                Storage.set('global_playlists', list);
                            }
                        });
                    }
                })
                .catch(() => {});

            addBlockToChain({ type: 'nova_playlist_global', nome }).catch(() => {});

            return res.status(200).json({
                success: true,
                data: { id: newId, nome, descricao, musicas: [], music_count: 0 },
                message: 'Playlist criada',
                _via: 'kv'
            });
        }

        if (action === 'add_music_to_global_playlist') {
            const playlistId = params.playlist_id;
            const musicId = String(params.music_id);
            let musicData = null;
            try {
                musicData = params.music_data
                    ? (typeof params.music_data === 'string' ? JSON.parse(params.music_data) : params.music_data)
                    : null;
            } catch (e) {
                musicData = null;
            }
            if (!playlistId || !musicId) return res.status(200).json({ success: false, message: 'Dados incompletos' });

            const playlists = await Storage.get('global_playlists') || [];
            const pl = playlists.find(p => String(p.id) === String(playlistId));
            if (!pl) {
                return res.status(200).json({ success: false, message: 'Playlist não encontrada' });
            }
            pl.musicas = pl.musicas || [];
            if (!pl.musicas.map(String).includes(musicId)) {
                pl.musicas.push(musicId);
            }
            pl.music_count = pl.musicas.length;

            if (musicData) {
                pl.music_metadata = pl.music_metadata || {};
                pl.music_metadata[musicId] = musicData;
            }

            await Storage.set('global_playlists', playlists);
            cache.cache.delete('global_playlists');

            callGAS('add_music_to_global_playlist', {
                playlist_id: playlistId,
                music_id: musicId,
                music_data: musicData ? JSON.stringify(musicData) : ''
            }).catch(() => {});

            return res.status(200).json({
                success: true,
                data: { playlist_id: playlistId, music_id: musicId, musicas: pl.musicas },
                _via: 'kv'
            });
        }

        if (action === 'remove_music_from_global_playlist') {
            const playlistId = params.playlist_id;
            const musicId = String(params.music_id);
            if (!playlistId || !musicId) {
                return res.status(200).json({ success: false, message: 'Dados incompletos' });
            }

            const playlists = await Storage.get('global_playlists') || [];
            const pl = playlists.find(p => String(p.id) === String(playlistId));
            if (pl) {
                pl.musicas = (pl.musicas || []).filter(id => String(id) !== musicId);
                pl.music_count = pl.musicas.length;
                if (pl.music_metadata && pl.music_metadata[musicId]) {
                    delete pl.music_metadata[musicId];
                }
                await Storage.set('global_playlists', playlists);
                cache.cache.delete('global_playlists');
            }

            callGAS('remove_music_from_global_playlist', {
                playlist_id: playlistId,
                music_id: musicId
            }).catch(() => {});

            return res.status(200).json({
                success: true,
                data: { playlist_id: playlistId, music_id: musicId, removed: true },
                _via: 'kv'
            });
        }

        // ============================================================
        // PLAYLISTS PESSOAIS
        // ============================================================
        if (action === 'get_playlists') {
            const userId = auth ? auth.user_id : params.user_id;
            if (!userId) return res.status(200).json({ success: false, message: 'user_id obrigatório' });

            const all = await Storage.get('user_playlists') || {};
            if (all[userId] && all[userId].length) {
                return res.status(200).json({ success: true, data: all[userId], _via: 'kv' });
            }

            const gasResult = await callGAS('get_playlists', { user_id: userId });
            const unwrapped = unwrapGAS(gasResult);
            if (unwrapped.success) {
                const playlists = Array.isArray(unwrapped.data) ? unwrapped.data : [];
                all[userId] = playlists;
                await Storage.set('user_playlists', all);
                return res.status(200).json({ success: true, data: playlists, _via: 'gas' });
            }

            return res.status(200).json({ success: true, data: [], _via: 'local' });
        }

        if (action === 'create_playlist') {
            const userId = auth ? auth.user_id : params.user_id;
            const nome = sanitize(params.nome);
            const publica = params.publica === 'true' || params.publica === true;
            if (!userId || !nome) return res.status(200).json({ success: false, message: 'Dados incompletos' });

            const newId = 'pl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
            const all = await Storage.get('user_playlists') || {};
            all[userId] = all[userId] || [];
            const nova = {
                id: newId,
                nome, publica,
                musicas: [],
                created_at: new Date().toISOString()
            };
            all[userId].push(nova);
            await Storage.set('user_playlists', all);

            callGAS('create_playlist', { user_id: userId, nome, publica }).catch(() => {});

            return res.status(200).json({
                success: true,
                data: { id: newId, nome, publica, musicas: [] },
                _via: 'kv'
            });
        }

        if (action === 'add_music_to_playlist') {
            const userId = auth ? auth.user_id : params.user_id;
            const playlistId = params.playlist_id;
            const musicId = String(params.music_id);
            let musicData = null;
            try {
                musicData = params.music_data
                    ? (typeof params.music_data === 'string' ? JSON.parse(params.music_data) : params.music_data)
                    : null;
            } catch (e) {
                musicData = null;
            }

            if (!userId || !playlistId || !musicId) {
                return res.status(200).json({ success: false, message: 'Dados incompletos' });
            }

            const all = await Storage.get('user_playlists') || {};
            all[userId] = all[userId] || [];
            const pl = all[userId].find(p => String(p.id) === String(playlistId));
            if (!pl) {
                return res.status(200).json({ success: false, message: 'Playlist não encontrada' });
            }
            pl.musicas = pl.musicas || [];
            if (!pl.musicas.map(String).includes(musicId)) {
                pl.musicas.push(musicId);
            }
            if (musicData) {
                pl.music_metadata = pl.music_metadata || {};
                pl.music_metadata[musicId] = musicData;
            }
            await Storage.set('user_playlists', all);

            callGAS('add_music_to_playlist', {
                user_id: userId, playlist_id: playlistId, music_id: musicId,
                music_data: musicData ? JSON.stringify(musicData) : ''
            }).catch(() => {});

            return res.status(200).json({
                success: true,
                data: { playlist_id: playlistId, music_id: musicId, musicas: pl.musicas },
                _via: 'kv'
            });
        }

        if (action === 'remove_music_from_playlist') {
            const userId = auth ? auth.user_id : params.user_id;
            const playlistId = params.playlist_id;
            const musicId = String(params.music_id);

            if (!userId || !playlistId || !musicId) {
                return res.status(200).json({ success: false, message: 'Dados incompletos' });
            }

            const all = await Storage.get('user_playlists') || {};
            all[userId] = all[userId] || [];
            const pl = all[userId].find(p => String(p.id) === String(playlistId));
            if (pl) {
                pl.musicas = (pl.musicas || []).filter(id => String(id) !== musicId);
                if (pl.music_metadata && pl.music_metadata[musicId]) {
                    delete pl.music_metadata[musicId];
                }
                await Storage.set('user_playlists', all);
            }

            callGAS('remove_music_from_playlist', {
                user_id: userId, playlist_id: playlistId, music_id: musicId
            }).catch(() => {});

            return res.status(200).json({ success: true, data: { removed: true }, _via: 'kv' });
        }

        // ============================================================
        // SEGUIR / FAVORITOS
        // ============================================================
        if (action === 'get_following') {
            const userId = auth ? auth.user_id : params.user_id;
            if (!userId) return res.status(200).json({ success: true, data: [] });

            const all = await Storage.get('following') || {};
            if (all[userId] && all[userId].length) {
                return res.status(200).json({ success: true, data: all[userId], _via: 'kv' });
            }

            const gasResult = await callGAS('get_following', { user_id: userId });
            const unwrapped = unwrapGAS(gasResult);
            if (unwrapped.success) {
                all[userId] = unwrapped.data;
                await Storage.set('following', all);
                return res.status(200).json({ success: true, data: unwrapped.data, _via: 'gas' });
            }

            return res.status(200).json({ success: true, data: [], _via: 'local' });
        }

        if (action === 'toggle_follow') {
            const userId = auth ? auth.user_id : params.user_id;
            const artistId = String(params.artist_id);
            const actionType = params.action;
            if (!userId || !artistId) return res.status(200).json({ success: false, message: 'Dados incompletos' });

            await callGAS('toggle_follow', { user_id: userId, artist_id: artistId, action: actionType });

            const all = await Storage.get('following') || {};
            all[userId] = all[userId] || [];
            if (actionType === 'follow') {
                if (!all[userId].includes(artistId)) all[userId].push(artistId);
            } else {
                all[userId] = all[userId].filter(id => id !== artistId);
            }
            await Storage.set('following', all);

            return res.status(200).json({ success: true, data: { following: all[userId] } });
        }

        if (action === 'toggle_favorite') {
            const userId = auth ? auth.user_id : params.user_id;
            const { music_id } = params;
            if (!userId || !music_id) return res.status(200).json({ success: false, message: 'Dados incompletos' });

            const all = await Storage.get('favorites') || {};
            all[userId] = all[userId] || [];
            const sid = String(music_id);
            let actionType;
            if (all[userId].includes(sid)) {
                all[userId] = all[userId].filter(x => x !== sid);
                actionType = 'remove';
            } else {
                all[userId].push(sid);
                actionType = 'add';
            }
            await Storage.set('favorites', all);

            await callGAS('toggle_favorite', { user_id: userId, music_id, action: actionType });

            return res.status(200).json({ success: true, data: { favorites: all[userId] } });
        }

        if (action === 'get_user_profile') {
            const userId = auth ? auth.user_id : params.user_id;
            const all = await Storage.get('favorites') || {};
            return res.status(200).json({ success: true, data: { favorite_music_ids: all[userId] || [] } });
        }

        // ============================================================
        // STREAMING
        // ============================================================
        if (action === 'register_streaming') {
            const userId = auth ? auth.user_id : params.user_id;
            const { music_id, duration } = params;
            if (!music_id || !userId) return res.status(200).json({ success: false, message: 'Dados incompletos' });

            await addBlockToChain({ type: 'streaming', music_id, user_id: userId, duration: duration || 30 });

            const key = 'streams_' + music_id;
            let contador = await Storage.get(key) || { music_id, total: 0, hoje: 0, ultima_data: '', ultima_atualizacao: '' };
            const hoje = new Date().toISOString().slice(0, 10);
            if (contador.ultima_data !== hoje) { contador.hoje = 0; contador.ultima_data = hoje; }
            contador.total++;
            contador.hoje++;
            contador.ultima_atualizacao = new Date().toISOString();
            await Storage.set(key, contador);

            let idx = await Storage.get('streams_index') || [];
            if (!idx.includes(music_id)) { idx.push(music_id); await Storage.set('streams_index', idx); }

            const globalKey = 'streams_global';
            let globalCont = await Storage.get(globalKey) || { total: 0, hoje: 0, ultima_data: '' };
            if (globalCont.ultima_data !== hoje) { globalCont.hoje = 0; globalCont.ultima_data = hoje; }
            globalCont.total++; globalCont.hoje++;
            await Storage.set(globalKey, globalCont);

            const userKey = 'streams_user_' + userId;
            let userContador = await Storage.get(userKey) || { user_id: userId, total: 0, musicas: {} };
            userContador.total++;
            userContador.musicas[music_id] = (userContador.musicas[music_id] || 0) + 1;
            await Storage.set(userKey, userContador);

            callGAS('register_streaming', { music_id, user_id: userId, duration: duration || 30 }).catch(() => {});

            return res.status(200).json({
                success: true,
                data: { reward: 1, streams_total: contador.total, streams_hoje: contador.hoje, streams_global: globalCont.total }
            });
        }

        if (action === 'get_streaming_stats') {
            const { music_id } = params;
            if (music_id) {
                const contador = await Storage.get('streams_' + music_id) || { total: 0, hoje: 0 };
                return res.status(200).json({
                    success: true,
                    data: { music_id, streams_total: contador.total, streams_hoje: contador.hoje, ultima_atualizacao: contador.ultima_atualizacao }
                });
            }
            const globalCont = await Storage.get('streams_global') || { total: 0, hoje: 0 };
            return res.status(200).json({
                success: true,
                data: { streams_total: globalCont.total, streams_hoje: globalCont.hoje, ultima_atualizacao: globalCont.ultima_data }
            });
        }

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
                posicao: i + 1, music_id: s.music_id, streams_total: s.total || 0, streams_hoje: s.hoje || 0
            }));
            return res.status(200).json({ success: true, data: ranking });
        }

        // ============================================================
        // MÚSICAS — ROBUSTO
        // ============================================================
        if (action === 'get_musicas') {
            const cachedL1 = cache.get('musicas');
            if (cachedL1) return res.status(200).json({ success: true, data: cachedL1, _via: 'cache' });

            const gasResult = await callGAS('get_musicas', params);
            const unwrapped = unwrapGAS(gasResult);

            let musicas = null;

            if (unwrapped.success) {
                if (Array.isArray(unwrapped.data)) {
                    musicas = unwrapped.data;
                } else if (unwrapped.data && Array.isArray(unwrapped.data.data)) {
                    musicas = unwrapped.data.data;
                } else if (unwrapped._raw && Array.isArray(unwrapped._raw.data)) {
                    musicas = unwrapped._raw.data;
                } else if (unwrapped._raw && Array.isArray(unwrapped._raw.musicas)) {
                    musicas = unwrapped._raw.musicas;
                }
            }

            if (musicas && musicas.length > 0) {
                cache.set('musicas', musicas, 300);
                console.log(`✅ [get_musicas] ${musicas.length} músicas via GAS`);
                return res.status(200).json({ success: true, data: musicas, _via: 'gas', total: musicas.length });
            }

            console.warn('⚠️ [get_musicas] GAS não retornou array válido:', JSON.stringify(gasResult).substring(0, 200));
            return res.status(200).json({ success: true, data: FALLBACK_MUSICAS, source: 'fallback' });
        }

        if (action === 'get_external_musicas') {
            const gasResult = await callGAS('get_external_musicas', params);
            const unwrapped = unwrapGAS(gasResult);
            if (unwrapped.success) return res.status(200).json({ success: true, data: unwrapped.data });
            return res.status(200).json({ success: true, data: [] });
        }

        if (action === 'get_top_investments') {
            const gasResult = await callGAS('get_top_investments', params);
            const unwrapped = unwrapGAS(gasResult);
            if (unwrapped.success) return res.status(200).json({ success: true, data: unwrapped.data });
            return res.status(200).json({ success: true, data: FALLBACK_MUSICAS });
        }

        // ============================================================
        // SALDO / CARTEIRA / EXTRATO
        // ============================================================
        if (action === 'get_saldo') {
            const userId = auth ? auth.user_id : (params.user_id || params.userId);
            if (!userId) return res.status(200).json({ success: false, message: 'Usuário não identificado' });
            if (userId === 'admin_master') {
                return res.status(200).json({ success: true, data: { saldo_disponivel: 1000000, selo_coin: 50000 } });
            }
            const gasResult = await callGAS('get_saldo', { user_id: userId });
            const unwrapped = unwrapGAS(gasResult);
            if (unwrapped.success) return res.status(200).json({ success: true, data: unwrapped.data });
            return res.status(200).json({ success: true, data: { saldo_disponivel: 0, selo_coin: 0 } });
        }

        if (action === 'get_carteira') {
            const userId = auth ? auth.user_id : (params.user_id || params.userId);
            if (!userId) return res.status(200).json({ success: true, data: [] });
            const gasResult = await callGAS('get_carteira', { user_id: userId });
            const unwrapped = unwrapGAS(gasResult);
            if (unwrapped.success) return res.status(200).json({ success: true, data: unwrapped.data });
            return res.status(200).json({ success: true, data: [] });
        }

        if (action === 'get_extrato') {
            const userId = auth ? auth.user_id : (params.user_id || params.userId);
            if (!userId) return res.status(200).json({ success: true, data: [] });
            const gasResult = await callGAS('get_extrato', { user_id: userId });
            const unwrapped = unwrapGAS(gasResult);
            if (unwrapped.success) return res.status(200).json({ success: true, data: unwrapped.data });
            return res.status(200).json({ success: true, data: [] });
        }

        if (action === 'get_artist_data') {
            const gasResult = await callGAS('get_artist_data', params);
            const unwrapped = unwrapGAS(gasResult);
            if (unwrapped.success) return res.status(200).json({ success: true, data: unwrapped.data });
            return res.status(200).json({ success: true, data: { total_musicas: 0, total_royalties: 0, musics: [] } });
        }

        // ============================================================
        // COMPRAR
        // ============================================================
        if (action === 'buy') {
            const userId = auth ? auth.user_id : params.user_id;
            const { music_id, quantidade, valor_unitario, valor_total } = params;
            if (!music_id || !quantidade || !userId) return res.status(200).json({ success: false, message: 'Dados incompletos' });
            const qty = parseInt(quantidade);
            if (isNaN(qty) || qty < 1) return res.status(200).json({ success: false, message: 'Quantidade inválida' });

            const block = await addBlockToChain({
                type: 'investimento', music_id, user_id: userId,
                quantidade: qty, valor_total: valor_total || (qty * parseFloat(valor_unitario || 0))
            });

            const invKey = 'investidores_' + music_id;
            let investidores = await Storage.get(invKey) || [];
            const idx = investidores.findIndex(i => i.user_id === userId);
            if (idx >= 0) investidores[idx].acoes += qty;
            else investidores.push({ user_id: userId, acoes: qty, desde: new Date().toISOString() });
            await Storage.set(invKey, investidores);

            const gasResult = await callGAS('buy', {
                music_id: sanitize(music_id), quantidade: qty,
                valor_unitario: parseFloat(valor_unitario || 0),
                valor_total: valor_total || (qty * parseFloat(valor_unitario || 0)),
                user_id: sanitize(userId)
            });

            const unwrapped = unwrapGAS(gasResult);
            if (unwrapped.success) {
                cache.cache.delete('musicas');
                return res.status(200).json({
                    success: true, data: unwrapped.data,
                    message: unwrapped.message || 'Investimento realizado!',
                    blockchain_hash: block.hash, _via: 'gas'
                });
            }

            return res.status(200).json({
                success: false,
                message: 'Não foi possível processar a compra. Tente novamente.',
                error: gasResult.error || 'backend indisponível',
                _via: 'gas_error'
            });
        }

        // ============================================================
        // VENDER AO MERCADO
        // ============================================================
        if (action === 'sell_to_market') {
            const userId = auth ? auth.user_id : params.user_id;
            const { music_id, quantidade, preco_unitario, valor_total } = params;
            if (!music_id || !quantidade || !userId) {
                return res.status(200).json({ success: false, message: 'Dados incompletos' });
            }
            const q = parseInt(quantidade);
            const preco = parseFloat(preco_unitario || 0);
            const total = parseFloat(valor_total || (q * preco));

            if (q < 1 || preco < 0.01 || total < 0.01) {
                return res.status(200).json({ success: false, message: 'Quantidade ou preço inválidos' });
            }

            try {
                const result = await processSellToMarket(userId, music_id, q, preco, total);
                return res.status(200).json(result);
            } catch (e) {
                console.error('❌ Erro em sell_to_market:', e);
                return res.status(200).json({ success: false, message: 'Erro ao processar venda: ' + e.message });
            }
        }

        if (action === 'buy_external') {
            const userId = auth ? auth.user_id : params.user_id;
            const gasResult = await callGAS('buy_external', { ...params, user_id: userId });
            const unwrapped = unwrapGAS(gasResult);
            if (unwrapped.success) return res.status(200).json({ success: true, data: unwrapped.data });
            return res.status(200).json({ success: false, message: 'Erro ao processar' });
        }

        if (action === 'suggest_external_music') {
            const gasResult = await callGAS('suggest_external_music', params);
            const unwrapped = unwrapGAS(gasResult);
            if (unwrapped.success) return res.status(200).json({ success: true, data: unwrapped.data });
            return res.status(200).json({ success: false, message: 'Erro ao sugerir' });
        }

        if (action === 'upload_music') {
            const gasResult = await callGAS('upload_music', params);
            const unwrapped = unwrapGAS(gasResult);
            if (unwrapped.success) {
                cache.cache.delete('musicas');
                return res.status(200).json({ success: true, data: unwrapped.data });
            }
            return res.status(200).json({ success: false, message: 'Erro ao cadastrar' });
        }

        // ============================================================
        // TICKETS
        // ============================================================
        if (action === 'get_tickets') {
            const tickets = await Storage.get('tickets') || [];
            if (tickets.length) return res.status(200).json({ success: true, data: tickets });
            const gasResult = await callGAS('get_tickets', params);
            const unwrapped = unwrapGAS(gasResult);
            if (unwrapped.success) return res.status(200).json({ success: true, data: unwrapped.data, _via: 'gas' });
            return res.status(200).json({ success: true, data: [] });
        }

        if (action === 'redeem_ticket') {
            const userId = auth ? auth.user_id : params.user_id;
            const gasResult = await callGAS('redeem_ticket', { ...params, user_id: userId });
            const unwrapped = unwrapGAS(gasResult);
            if (unwrapped.success) return res.status(200).json({ success: true, data: unwrapped.data });
            return res.status(200).json({ success: false, message: 'Erro ao resgatar' });
        }

        if (action === 'create_ticket') {
            const userId = auth ? auth.user_id : params.user_id;
            const gasResult = await callGAS('create_ticket', { ...params, user_id: userId });
            const unwrapped = unwrapGAS(gasResult);
            if (unwrapped.success) return res.status(200).json({ success: true, data: unwrapped.data });
            return res.status(200).json({ success: false, message: 'Erro ao criar' });
        }

        // ============================================================
        // SAQUE
        // ============================================================
        if (action === 'request_withdrawal') {
            const userId = auth ? auth.user_id : params.user_id;
            const gasResult = await callGAS('request_withdrawal', { ...params, user_id: userId });
            const unwrapped = unwrapGAS(gasResult);
            if (unwrapped.success) return res.status(200).json({ success: true, data: unwrapped.data });
            return res.status(200).json({ success: false, message: 'Erro ao solicitar' });
        }

        // ============================================================
        // TRADES
        // ============================================================
        if (action === 'get_trades') {
            const userId = auth ? auth.user_id : params.user_id;
            const gasResult = await callGAS('get_trades', { ...params, user_id: userId });
            const unwrapped = unwrapGAS(gasResult);
            if (unwrapped.success) {
                const data = unwrapped.data || {};
                // 🆕 v9.8.2 — fallback multi-formato
                const received = data.received || data.recebidas || data.trades_received || [];
                const sent = data.sent || data.enviadas || data.trades_sent || [];
                const history = data.history || data.historico || data.trades_history || [];
                return res.status(200).json({
                    success: true,
                    data: {
                        received: Array.isArray(received) ? received : [],
                        sent: Array.isArray(sent) ? sent : [],
                        history: Array.isArray(history) ? history : []
                    },
                    _via: 'gas'
                });
            }
            return res.status(200).json({ success: true, data: { received: [], sent: [], history: [] } });
        }

        if (action === 'create_trade') {
            const sellerId = auth ? auth.user_id : (params.seller_id || params.user_id);
            const buyerEmail = params.buyer_email;
            const musicId = params.music_id;
            const quantity = parseInt(params.quantity);
            const price = parseFloat(params.price);
            const total = parseFloat(params.total || (quantity * price));
            const message = params.message || '';

            if (!sellerId || !buyerEmail || !musicId || !quantity || !price) {
                return res.status(200).json({ success: false, message: 'Preencha todos os campos: comprador, música, quantidade e preço' });
            }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail)) {
                return res.status(200).json({ success: false, message: 'Email do comprador inválido' });
            }
            if (quantity < 1) {
                return res.status(200).json({ success: false, message: 'Quantidade deve ser maior que zero' });
            }
            if (price < 0.01) {
                return res.status(200).json({ success: false, message: 'Preço deve ser maior que zero' });
            }

            // 🆕 v9.8.2 — valida posse antes de chamar GAS
            try {
                const carteira = await Storage.get('carteira_' + sellerId) || [];
                const ativo = carteira.find(a =>
                    String(a.music_id) === String(musicId) && a.status === 'ativo'
                );
                if (ativo && ativo.quantidade < quantity) {
                    return res.status(200).json({
                        success: false,
                        message: `Você só possui ${ativo.quantidade} ações dessa música`
                    });
                }
                if (!ativo && carteira.length > 0) {
                    // Se tem carteira mas não tem esse ativo, avisa
                    return res.status(200).json({
                        success: false,
                        message: 'Você não possui ações dessa música'
                    });
                }
                // Se carteira vazia (KV pode não ter ainda), deixa o GAS validar
            } catch (e) {
                // silencioso — deixa o GAS validar
            }

            const gasResult = await callGAS('create_trade', {
                seller_id: sellerId, buyer_email: buyerEmail, music_id: musicId,
                quantity: quantity, price: price, total: total, message: message
            });

            const unwrapped = unwrapGAS(gasResult);

            if (unwrapped.success) {
                try {
                    const trades = await Storage.get('trades_all') || [];
                    trades.push({
                        id: unwrapped.data?.trade_id || ('trade_' + Date.now()),
                        seller_id: sellerId, buyer_email: buyerEmail, music_id: musicId,
                        quantity: quantity, price: price, total: total, message: message,
                        status: 'pending', created_at: new Date().toISOString()
                    });
                    await Storage.set('trades_all', trades);
                } catch (e) {
                    console.warn('⚠️ [create_trade] KV update falhou:', e.message);
                }

                try {
                    await addBlockToChain({
                        type: 'trade_oferta', trade_id: unwrapped.data?.trade_id,
                        seller_id: sellerId, buyer_email: buyerEmail, music_id: musicId,
                        quantity: quantity, total: total
                    });
                } catch (e) {}

                return res.status(200).json({
                    success: true, data: unwrapped.data,
                    message: 'Oferta enviada para ' + buyerEmail, _via: 'gas'
                });
            }

            return res.status(200).json({
                success: false,
                message: unwrapped.message || 'Não foi possível enviar a oferta. Tente novamente.',
                error: gasResult.error
            });
        }

        if (action === 'accept_trade' || action === 'decline_trade' || action === 'cancel_trade') {
            const userId = auth ? auth.user_id : params.user_id;
            const gasResult = await callGAS(action, { ...params, user_id: userId });
            const unwrapped = unwrapGAS(gasResult);
            if (unwrapped.success) {
                cache.cache.delete('musicas');
                cache.cache.delete('global_playlists');
                return res.status(200).json({ success: true, data: unwrapped.data, _via: 'gas' });
            }
            return res.status(200).json({
                success: false, message: 'Não foi possível processar a operação.', error: gasResult.error
            });
        }

        // ============================================================
        // REGISTER / CONFIRM EMAIL
        // ============================================================
        if (action === 'register' || action === 'confirm_email' || action === 'resend_confirmation') {
            const gasResult = await callGAS(action, params);
            const unwrapped = unwrapGAS(gasResult);
            if (unwrapped.success) return res.status(200).json({ success: true, data: unwrapped.data });
            return res.status(200).json({ success: false, message: 'Erro na operação' });
        }

        // ============================================================
        // BLOCKCHAIN
        // ============================================================
        if (action === 'get_mining_blocks') {
            const limit = parseInt(params.limit) || 50;
            const chain = await Storage.get('blockchain') || { blocks: [] };
            const blocks = chain.blocks.slice(-limit);
            const formatted = blocks.map(b => ({
                block_index: b.index, block_hash: b.hash, previous_hash: b.prevHash,
                timestamp: b.timestamp,
                music_title: b.data?.titulo || b.data?.nome || b.data?.type || 'Bloco',
                reward_amount: b.data?.valor_total || 0
            }));
            return res.status(200).json({ success: true, data: formatted });
        }

        if (action === 'add_block') {
            try {
                const data = typeof params.data === 'string' ? JSON.parse(params.data) : (params.data || {});
                const block = await addBlockToChain(data);
                callGAS('add_block', { data: JSON.stringify(data) }).catch(() => {});
                return res.status(200).json({ success: true, data: block });
            } catch (e) { return res.status(200).json({ success: false, message: 'Erro ao criar bloco' }); }
        }

        // ============================================================
        // ADMIN STATS
        // ============================================================
        if (action === 'get_admin_stats' || action === 'get_stats') {
            const gasResult = await callGAS('get_stats');
            const unwrapped = unwrapGAS(gasResult);
            if (unwrapped.success) return res.status(200).json({ success: true, data: unwrapped.data, _via: 'gas' });

            const playlists = await Storage.get('global_playlists') || [];
            const chain = await Storage.get('blockchain') || { blocks: [] };
            const streams = await Storage.get('streams') || {};
            const elo = await Storage.get('elo_ranking') || [];
            return res.status(200).json({
                success: true,
                data: {
                    total_usuarios: 1, total_musicas: FALLBACK_MUSICAS.length,
                    playlists_count: playlists.length, total_investido: 0,
                    blocks_count: chain.blocks.length,
                    streams_count: Object.keys(streams).length,
                    elo_count: elo.length
                },
                _via: 'local'
            });
        }

        // ============================================================
        // ARTISTAS
        // ============================================================
        if (action === 'get_artists') {
            const gasResult = await callGAS('get_artists', params);
            const unwrapped = unwrapGAS(gasResult);
            if (unwrapped.success) {
                let artists = unwrapped.data;
                if (!Array.isArray(artists)) {
                    if (artists && Array.isArray(artists.artists)) artists = artists.artists;
                    else if (artists && Array.isArray(artists.data)) artists = artists.data;
                    else artists = [];
                }
                return res.status(200).json({ success: true, data: artists, _via: 'gas' });
            }
            return res.status(200).json({ success: true, data: [] });
        }

        // ============================================================
        // NOTÍCIAS
        // ============================================================
        if (action === 'get_news') {
            const page = parseInt(params.page) || 1;
            const limit = parseInt(params.limit) || 10;
            const preferences = (params.preferences || '').split(',').filter(Boolean);
            const seenIds = (params.seen_ids || '').split(',').filter(Boolean);
            const userId = auth ? auth.user_id : (params.user_id || 'anon');

            const cachedBefore = await Storage.get('news_cache');
            const cachedTimeBefore = await Storage.get('news_cache_time');
            const wasCached = !!(cachedBefore && cachedTimeBefore && Date.now() - cachedTimeBefore < 15 * 60 * 1000);

            let news = await aggregateNews();
            if (!news.length) {
                return res.status(200).json({
                    success: true, data: [], has_more: false, next_page: null,
                    total: 0, page, cached: wasCached, message: 'Sem notícias no momento'
                });
            }

            if (seenIds.length) news = news.filter(n => !seenIds.includes(n.id));
            if (userId && userId !== 'anon') {
                const seenYesterday = await Storage.get('news_seen_' + userId) || [];
                const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
                const seenIds2 = seenYesterday.filter(s => s.date === yesterday).map(s => s.id);
                if (seenIds2.length) news = news.filter(n => !seenIds2.includes(n.id));
            }

            if (preferences.length) {
                news.sort((a, b) => {
                    const aScore = (preferences.includes(a.categoria) ? 10 : 0) + (preferences.includes(a.tema) ? 5 : 0);
                    const bScore = (preferences.includes(b.categoria) ? 10 : 0) + (preferences.includes(b.tema) ? 5 : 0);
                    return bScore - aScore;
                });
            }

            const start = (page - 1) * limit;
            const end = start + limit;
            const pageItems = news.slice(start, end);
            const has_more = end < news.length;

            return res.status(200).json({
                success: true, data: pageItems, has_more,
                next_page: has_more ? page + 1 : null,
                total: news.length, page, cached: wasCached
            });
        }

        if (action === 'mark_news_seen') {
            const userId = auth ? auth.user_id : params.user_id;
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
            callGAS('mark_news_seen', { user_id: userId, news_ids: newsIds.join(','), data: date }).catch(() => {});
            return res.status(200).json({ success: true, count: seen.length });
        }

        if (action === 'track_news_interaction') {
            const userId = auth ? auth.user_id : params.user_id;
            const newsId = params.news_id;
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
            callGAS('track_news_interaction', { user_id: userId, news_id: newsId, tema, categoria }).catch(() => {});
            return res.status(200).json({ success: true, data: prefs });
        }

        // ============================================================
        // DEFAULT
        // ============================================================
        return res.status(200).json({
            success: true,
            message: '✅ PLAY MY API ONLINE',
            version: '9.8.2',
            kv_enabled: !!kv,
            nodemailer_enabled: !!nodemailer,
            youtube_enabled: !!YOUTUBE_API_KEY,
            action: action || 'nenhuma',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Erro no handler:', error);
        return res.status(200).json({ success: false, message: 'Erro interno: ' + error.message });
    }
};
