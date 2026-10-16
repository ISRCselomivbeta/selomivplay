/**
 * /api/youtube-stats.js
 * 
 * Vercel Function — retorna dados públicos de um vídeo do YouTube.
 * 
 * Entrada:  GET /api/youtube-stats?videoId=XXXXXXXXXXX
 * Saída:    { videoId, title, channel, views, publishedAt, thumbnail }
 * 
 * Segurança:
 *   - A chave da YouTube Data API v3 fica em process.env.YOUTUBE_API_KEY
 *   - Nunca é exposta ao cliente
 * 
 * Cache:
 *   - 1 hora via Cache-Control (s-maxage)
 *   - Reduz consumo de quota (a API do YouTube tem limite de 10.000 unidades/dia)
 *   - Cada chamada de "videos.list" custa 1 unidade
 */

export default async function handler(req, res) {
  // ---------- 1. Validar método ----------
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // ---------- 2. Validar parâmetro ----------
  const { videoId } = req.query;

  if (!videoId || typeof videoId !== 'string') {
    return res.status(400).json({ error: 'Parâmetro videoId é obrigatório' });
  }

  // Validação do formato: 11 caracteres alfanuméricos, hífen ou underscore
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).json({ error: 'videoId inválido' });
  }

  // ---------- 3. Validar chave de API ----------
  const API_KEY = process.env.YOUTUBE_API_KEY;

  if (!API_KEY) {
    console.error('[youtube-stats] YOUTUBE_API_KEY não configurada');
    return res.status(500).json({ error: 'Configuração do servidor incompleta' });
  }

  // ---------- 4. Chamar YouTube Data API v3 ----------
  try {
    const apiUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
    apiUrl.searchParams.set('id', videoId);
    apiUrl.searchParams.set('part', 'snippet,statistics');
    apiUrl.searchParams.set('key', API_KEY);

    const ytResponse = await fetch(apiUrl.toString(), {
      headers: { 'Accept': 'application/json' }
    });

    // Tratar erros da API do YouTube
    if (!ytResponse.ok) {
      const errorBody = await ytResponse.text();
      console.error('[youtube-stats] YouTube API error:', ytResponse.status, errorBody);

      if (ytResponse.status === 403) {
        return res.status(503).json({ error: 'Quota da API do YouTube excedida' });
      }
      return res.status(502).json({ error: 'Falha ao consultar YouTube' });
    }

    const data = await ytResponse.json();

    // ---------- 5. Validar resposta ----------
    if (!data.items || data.items.length === 0) {
      return res.status(404).json({ error: 'Vídeo não encontrado ou indisponível' });
    }

    const video = data.items[0];
    const snippet = video.snippet || {};
    const stats = video.statistics || {};

    // ---------- 6. Montar resposta ----------
    const result = {
      videoId,
      title: snippet.title || null,
      channel: snippet.channelTitle || null,
      channelId: snippet.channelId || null,
      views: parseInt(stats.viewCount || '0', 10),
      likes: stats.likeCount ? parseInt(stats.likeCount, 10) : null,
      comments: stats.commentCount ? parseInt(stats.commentCount, 10) : null,
      publishedAt: snippet.publishedAt || null,
      thumbnail: snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || null,
      // Nunca incluir receita — a API pública não fornece esse dado
      revenue: null,
      revenueNote: 'Receita não está disponível via API pública. Requer autorização do titular do canal.'
    };

    // ---------- 7. Cache ----------
    // s-maxage: 1 hora no CDN da Vercel
    // stale-while-revalidate: serve cache antigo enquanto atualiza em background
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    return res.status(200).json(result);

  } catch (err) {
    console.error('[youtube-stats] erro inesperado:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
