// ========== BACKEND.JS - VERCEL SERVERLESS FUNCTION ==========
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
  
  // SUA URL DO GOOGLE APPS SCRIPT
  const GAS_URL = 'https://script.google.com/macros/s/AKfycbwgjor-tLLzVrnJGNHOifL1O2sRBhysKJ3IbVJy_AHgtNqjk-6hazH8xuO6OaDXF_s/exec'; // 🔴 COLOQUE SUA URL
  
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
 // 🔴 COLOQUE O CÓDIGO AQUI - LOG DETALHADO
    console.log('📊 Dados retornados:', {
      action: action,
      success: data.success,
      data_size: JSON.stringify(data).length,
      timestamp: new Date().toISOString()
    });
    // 🔴 FIM DO CÓDIGO    
    // Retornar a resposta do GAS (sem modificar)
    res.status(200).json(data);
    
  } catch (error) {
    console.error('❌ Erro no backend:', error);
    
    // Fallback APENAS para health check
    if (action === 'health') {
      res.status(200).json({
        success: true,
        status: 'healthy',
        version: '6.0.0',
        timestamp: new Date().toISOString()
      });
    } else {
      // Para qualquer outra ação, retornar erro
      res.status(200).json({
        success: false,
        message: 'Erro de conexão com o servidor',
        error: error.toString()
      });
    }
  }
}
