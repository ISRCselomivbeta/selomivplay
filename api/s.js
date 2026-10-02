// ============================================================
// api/s.js — PLAY MY
// Rota canônica /s/:id — HTML com Open Graph dinâmico
// ============================================================

const FALLBACK_ORIGIN = 'https://playmy.com.br';
const FALLBACK_LOGO   = 'https://playmy.com.br/images/logo.png';

module.exports = async (req, res) => {
    // /s/123  →  rewrite manda ?id=123
    // /api/s?id=123  →  query direto
    const musicId =
        (req.query && req.query.id) ||
        (req.url || '').split('?')[0].split('/').filter(Boolean).pop() ||
        'unknown';

    // Base absoluta: prefere env var explícita, cai no domínio de produção
    const origin =
        process.env.PUBLIC_SITE_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : FALLBACK_ORIGIN);

    let musica = null;
    try {
        const r = await fetch(`${origin}/api/backend?action=get_musicas`, {
            headers: { 'Accept': 'application/json' }
        });
        const j = await r.json();
        if (j && j.success && Array.isArray(j.data)) {
            musica = j.data.find(m => String(m.id) === String(musicId)) || null;
        }
    } catch (e) {
        console.warn('[s.js] fetch falhou:', e.message);
    }

    const titulo    = (musica && musica.titulo)    || 'PLAY MY';
    const artista   = (musica && musica.artista)   || 'Música sem limites';
    const capa      = (musica && musica.link_capa) || FALLBACK_LOGO;
    const descricao = `${artista} — ouça no PLAY MY`;
    const canonical = `${origin}/s/${encodeURIComponent(musicId)}`;
    const appUrl    = `${origin}/?music=${encodeURIComponent(musicId)}`;

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(titulo)} — ${esc(artista)} | PLAY MY</title>
<meta name="description" content="${esc(descricao)}">

<meta property="og:type" content="music.song">
<meta property="og:site_name" content="PLAY MY">
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(descricao)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(capa)}">
<meta property="og:image:width" content="512">
<meta property="og:image:height" content="512">
<meta property="og:locale" content="pt_BR">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(titulo)}">
<meta name="twitter:description" content="${esc(descricao)}">
<meta name="twitter:image" content="${esc(capa)}">

<link rel="canonical" href="${esc(canonical)}">
<style>
  body{background:#000;color:#fff;font-family:-apple-system,sans-serif;
       display:flex;align-items:center;justify-content:center;height:100vh;
       margin:0;text-align:center;padding:20px}
  h1{font-size:20px;margin:0 0 8px}
  p{color:#8e8e93;margin:4px 0}
  a{color:#34c759;font-weight:700;text-decoration:none}
</style>
</head>
<body>
  <div>
    <h1>${esc(titulo)}</h1>
    <p>${esc(artista)}</p>
    <p><a href="${esc(appUrl)}">▶ Abrir no PLAY MY</a></p>
  </div>
  <script>
    // Crawlers OG leem o HTML e saem; usuário real é redirecionado.
    setTimeout(function(){ window.location.replace(${JSON.stringify(appUrl)}); }, 100);
  </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
    return res.status(200).send(html);
};

function esc(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
