// ============================================================
// api/n.js — PLAY MY
// Rota canônica /n/:id — HTML com Open Graph dinâmico para notícias
// ============================================================

const FALLBACK_ORIGIN = 'https://playmy.com.br';
const FALLBACK_LOGO   = 'https://playmy.com.br/images/logo.png';

module.exports = async (req, res) => {
    const newsId =
        (req.query && req.query.id) ||
        (req.url || '').split('?')[0].split('/').filter(Boolean).pop() ||
        'unknown';

    const origin =
        process.env.PUBLIC_SITE_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : FALLBACK_ORIGIN);

    // ------------------------------------------------------------
    // Busca notícia no backend
    // ------------------------------------------------------------
    let noticia = null;
    try {
        const r = await fetch(`${origin}/api/backend?action=get_news&page=1&limit=100&user_id=anon`, {
            headers: { 'Accept': 'application/json' }
        });
        const j = await r.json();

        if (j && j.success && Array.isArray(j.data)) {
            // Match exato pelo ID
            noticia = j.data.find(n => String(n.id) === String(newsId)) || null;

            // Fallback: tenta decodificar e comparar por título
            if (!noticia && newsId && newsId !== 'unknown') {
                const decoded = decodeURIComponent(newsId).toLowerCase();
                noticia = j.data.find(n => {
                    if (!n.titulo) return false;
                    const t = String(n.titulo).toLowerCase();
                    return t.indexOf(decoded) !== -1 || decoded.indexOf(t.substring(0, 20)) !== -1;
                }) || null;
            }
        }
    } catch (e) {
        console.warn('[n.js] fetch falhou:', e.message);
    }

    if (!noticia) {
        console.log('[n.js] ⚠️ notícia não encontrada para id:', newsId);
    } else {
        console.log('[n.js] ✅ notícia encontrada:', (noticia.titulo || '').substring(0, 50));
    }

    // ------------------------------------------------------------
    // Dados para OG
    // ------------------------------------------------------------
    const titulo    = (noticia && noticia.titulo)   || 'PLAY MY Notícias';
    const texto     = (noticia && noticia.texto)    || 'Leia no PLAY MY';
    const fonte     = (noticia && noticia.fonte)    || 'PLAY MY';
    const capa      = (noticia && noticia.imagem)   || FALLBACK_LOGO;
    const descricao = texto.substring(0, 160) || `${fonte} — leia no PLAY MY`;
    const canonical = `${origin}/n/${encodeURIComponent(newsId)}`;
    const appUrl    = `${origin}/?news=${encodeURIComponent(newsId)}`;

    // ------------------------------------------------------------
    // Valida a capa — se for placeholder/inútil, usa logo
    // ------------------------------------------------------------
    let capaFinal = FALLBACK_LOGO;

    if (capa && capa.indexOf('http') === 0) {
        const ehGoogleGenerica = capa.indexOf('lh3.googleusercontent.com') !== -1;
        const ehGoogleNews     = capa.indexOf('news.google.com') !== -1;
        const temExtensao      = /\.(jpg|jpeg|png|webp|gif)(\?|#|$)/i.test(capa);

        // Aceita: URL com extensão válida OU URL do Google que NÃO é genérica
        if ((temExtensao && !ehGoogleGenerica && !ehGoogleNews) ||
            (ehGoogleGenerica === false && ehGoogleNews === false && temExtensao)) {
            capaFinal = capa;
        }
    }

    console.log('[n.js] capa:', capaFinal.substring(0, 80));

    // ------------------------------------------------------------
    // HTML com OG
    // ------------------------------------------------------------
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(titulo)} | PLAY MY</title>
<meta name="description" content="${esc(descricao)}">

<meta property="og:type" content="article">
<meta property="og:site_name" content="PLAY MY">
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(descricao)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(capaFinal)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="pt_BR">
<meta property="article:section" content="${esc(fonte)}">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(titulo)}">
<meta name="twitter:description" content="${esc(descricao)}">
<meta name="twitter:image" content="${esc(capaFinal)}">

<link rel="canonical" href="${esc(canonical)}">
<style>
  body{background:#000;color:#fff;font-family:-apple-system,sans-serif;
       display:flex;align-items:center;justify-content:center;height:100vh;
       margin:0;text-align:center;padding:20px}
  h1{font-size:20px;margin:0 0 8px}
  p{color:#8e8e93;margin:4px 0}
  a{color:#ffcc00;font-weight:700;text-decoration:none}
</style>
</head>
<body>
  <div>
    <h1>${esc(titulo)}</h1>
    <p>${esc(fonte)}</p>
    <p><a href="${esc(appUrl)}">▶ Ler no PLAY MY</a></p>
  </div>
  <script>
    // Redireciona usuários reais; crawlers OG leem o HTML e saem.
    setTimeout(function(){
      window.location.replace(${JSON.stringify(appUrl)});
    }, 100);
  </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
    return res.status(200).send(html);
};

// ------------------------------------------------------------
// Escape HTML para OG tags
// ------------------------------------------------------------
function esc(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
