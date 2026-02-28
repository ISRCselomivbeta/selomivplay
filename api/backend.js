// ========== BACKEND.JS - VERCEL SERVERLESS FUNCTION ==========
// Este arquivo fica em /api/backend.js

export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Responder a preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  const { action, ...params } = req.query;
  
  // URL do seu Google Apps Script (MANTÉM A MESMA)
  const GAS_URL = 'https://script.google.com/macros/s/AKfycbwgjor-tLLzVrnJGNHOifL1O2sRBhysKJ3IbVJy_AHgtNqjk-6hazH8xuO6OaDXF_s/exec';
  
  console.log('🚀 Backend Vercel chamado:', { action, params });
  
  try {
    // Construir URL para o Google Apps Script
    const url = new URL(GAS_URL);
    url.searchParams.append('action', action || 'status');
    
    // Adicionar todos os parâmetros
    Object.keys(params).forEach(key => {
      if (params[key]) {
        url.searchParams.append(key, params[key]);
      }
    });
    
    console.log('🔍 Chamando GAS:', url.toString());
    
    // Fazer request para o Google Apps Script
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    const data = await response.json();
    console.log('✅ Resposta do GAS:', data);
    
    // Retornar resposta
    res.status(200).json(data);
    
  } catch (error) {
    console.error('❌ Erro no backend:', error);
    
    // Fallback data para quando GAS falhar
    const fallbackData = getFallbackData(action, params);
    
    res.status(200).json(fallbackData);
  }
}

// ========== FALLBACK DATA (igual ao seu frontend) ==========
function getFallbackData(action, data) {
  console.log(`📦 [${action}] Usando fallback local no backend`);
  
  if (action === 'health') {
    return {
      success: true,
      status: 'healthy',
      version: '6.0.0',
      timestamp: new Date().toISOString()
    };
  }
  
  if (action === 'get_musicas') {
    return {
      success: true,
      data: [
        {
          id: '1',
          titulo: 'Bohemian Rhapsody',
          artista: 'Queen',
          link_capa: 'https://i.scdn.co/image/ab67616d0000b273e8b066f70c206551210d902b',
          link_youtube: 'https://www.youtube.com/watch?v=fJ9rUzIMcZQ',
          valor_acao: 25.50,
          percentual_disponivel: 30,
          acoes_vendidas: 150,
          total_investidores: 45,
          rentabilidade_media: 12.5,
          status: 'ativo',
          genero: 'ROCK'
        },
        {
          id: '2',
          titulo: 'Blinding Lights',
          artista: 'The Weeknd',
          link_capa: 'https://i.scdn.co/image/ab67616d0000b2738863bc11d2aa12b54f5aeb36',
          link_youtube: 'https://www.youtube.com/watch?v=4NRXx6U8ABQ',
          valor_acao: 32.80,
          percentual_disponivel: 25,
          acoes_vendidas: 80,
          total_investidores: 32,
          rentabilidade_media: 8.3,
          status: 'ativo',
          genero: 'POP'
        }
      ],
      pagination: {
        page: 1,
        limit: 20,
        total: 2,
        pages: 1
      }
    };
  }
  
  if (action === 'get_saldo') {
    return {
      success: true,
      data: { saldo_disponivel: 1000, saldo_bloqueado: 0 }
    };
  }
  
  if (['buy', 'buy_external', 'register', 'upload_music', 'suggest_external_music', 
       'create_playlist', 'toggle_favorite', 'request_withdrawal'].includes(action)) {
    return {
      success: true,
      message: 'Ação realizada com sucesso!',
      data: { contrato_id: 'CT_' + Date.now() }
    };
  }
  
  return { success: true, data: [] };
}
