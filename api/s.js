// ============================================================
// api/s.js — PLAY MY
// Rota canônica de compartilhamento /s/:id
// Serve HTML com Open Graph tags dinâmicas
// ============================================================

module.exports = async (req, res) => {
    // Extrai o ID da URL: /s/123 → id = "123"
    const segments = (req.url || '').split('/').filter(Boolean);
    const musicId = segments[segments.length - 1] || 'unknown';

    // Busca dados da música no backend principal
    // (chamada server-side, rápida, com cache)
    let musica = null;
    try {
        const baseUrl = process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : 'https://playmy.com.br';
        const r = await fetch(`${baseUrl}/api/backend?action=get_musicas`);
        const j = await r.json();
        if (j && j.success && Array.isArray(j.data)) {
            musica = j.data.find(m => String(m.id) === String(musicId));
        }
    } catch (e) {
        console.warn('[s.js] falha ao buscar musica:', e.message);
    }

    // Fallback se não achar
    const titulo   = (musica && musica.titulo)   || 'PLAY MY';
    const artista  = (musica && musica.artista)  || 'Música sem limites';
    const capa     = (musica && musica.link_capa) || 'https://playmy.com.br/images/logo.png';
    const descricao = `${artista} — ouça no PLAY MY`;
    const canonicalUrl = `https://playmy.com.br/s/${musicId}`;
    const appUrl = `https://playmy.com.br/?music=${encodeURIComponent(musicId)}`;

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(titulo)} — ${escapeHtml(artista)} | PLAY MY</title>
<meta name="description" content="${escapeHtml(descricao)}">

<!-- Open Graph (WhatsApp / Facebook / LinkedIn) -->
<meta property="og:type" content="music.song">
<meta property="og:site_name" content="PLAY MY">
<meta property="og:title" content="${escapeHtml(titulo)}">
<meta property="og:description" content="${escapeHtml(descricao)}">
<meta property="og:url" content="${canonicalUrl}">
<meta property="og:image" content="${escapeHtml(capa)}">
<meta property="og:image:width" content="512">
<meta property="og:image:height" content="512">
<meta property="og:locale" content="pt_BR">
<meta property="music:musician" content="${escapeHtml(artista)}">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(titulo)}">
<meta name="twitter:description" content="${escapeHtml(descricao)}">
<meta name="twitter:image" content="${escapeHtml(capa)}">

<!-- Canonical -->
<link rel="canonical" href="${canonicalUrl}">

<!-- Redirect para o app (com delay para OG crawlers lerem) -->
<meta http-equiv="refresh" content="0; url=${appUrl}">
<style>
  body { background:#000; color:#fff; font-family:-apple-system,sans-serif;
         display:flex; align-items:center; justify-content:center;
         height:100vh; margin:0; text-align:center; padding:20px; }
  h1 { font-size:20px; margin-bottom:8px; }
  p  { color:#8e8e93; }
  a  { color:#34c759; font-weight:700; text-decoration:none; }
</style>
</head>
<body>
  <div>
    <h1>${escapeHtml(titulo)}</h1>
    <p>${escapeHtml(artista)}</p>
    <p><a href="${appUrl}">▶ Abrir no PLAY MY</a></p>
  </div>
  <script>
    // Redireciona usuários reais; OG crawlers leem o HTML e saem
    setTimeout(() => { window.location.replace(${JSON.stringify(appUrl)}); }, 100);
  </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
    return res.status(200).send(html);
};

function escapeHtml(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
