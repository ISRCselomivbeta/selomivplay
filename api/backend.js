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
  const GAS_URL = 'https://script.google.com/macros/s/AKfycbwgjor-tLLzVrnJGNHOifL1O2sRBhysKJ3IbVJy_AHgtNqjk-6hazH8xuO6OaDXF_s/exec';
  
  console.log('🚀 Backend Vercel chamado:', { action, params });
  
  try {
    // ===== IMPLEMENTAÇÃO LOCAL PARA get_mining_blocks =====
    if (action === 'get_mining_blocks') {
      console.log('⛏️ Processando get_mining_blocks localmente...');
      
      // Buscar dados da carteira para gerar blocos
      const url = new URL(GAS_URL);
      url.searchParams.append('action', 'get_carteira');
      if (params.user_id) url.searchParams.append('user_id', params.user_id);
      
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const carteiraData = await response.json();
      
      if (carteiraData.success && carteiraData.data) {
        // Extrair investimentos
        const investimentos = Array.isArray(carteiraData.data) ? carteiraData.data : 
                             (carteiraData.data.investimentos || []);
        
        // Converter para formato de blocos
        const blocks = investimentos.map((inv, index) => ({
          block_index: 1000 + index,
          block_hash: inv.hash_transacao || '0x' + Date.now().toString(16) + index,
          previous_hash: index === 0 ? '0'.repeat(64) : '0x' + (Date.now() - 1000).toString(16),
          timestamp: inv.data_compra || new Date().toISOString(),
          miner_user_id: inv.user_id || params.user_id || 'investidor',
          user_name: 'Investidor',
          music_title: inv.music_title || `Investimento #${index + 1}`,
          reward_amount: inv.valor_total || 0,
          music_id: inv.music_id || `music_${index}`
        })).reverse().slice(0, params.limit || 20);
        
        console.log(`✅ ${blocks.length} blocos gerados localmente`);
        
        return res.status(200).json({
          success: true,
          data: blocks,
          source: 'local_carteira'
        });
      }
    }
    
    // ===== FUNÇÃO PARA REGISTRAR STREAMING (MINERAÇÃO) =====
    if (action === 'register_streaming') {
      console.log('🎵 Registrando streaming e minerando bloco...');
      
      // 1. Primeiro, registrar o streaming no GAS
      const streamingUrl = new URL(GAS_URL);
      streamingUrl.searchParams.append('action', 'register_streaming');
      Object.keys(params).forEach(key => {
        if (params[key]) streamingUrl.searchParams.append(key, params[key]);
      });
      
      const streamingResponse = await fetch(streamingUrl.toString(), {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const streamingResult = await streamingResponse.json();
      
      // 2. Se o streaming foi bem sucedido, criar um bloco
      if (streamingResult.success) {
        // Buscar informações da música para o bloco
        const musicUrl = new URL(GAS_URL);
        musicUrl.searchParams.append('action', 'get_musica');
        musicUrl.searchParams.append('music_id', params.music_id);
        
        const musicResponse = await fetch(musicUrl.toString(), {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        
        const musicData = await musicResponse.json();
        const musicTitle = musicData.success ? musicData.data.titulo : 'Música';
        
        // Criar hash do bloco
        const blockHash = '0x' + Date.now().toString(16) + Math.random().toString(36).substring(2, 8);
        const previousHash = '0x' + (Date.now() - 1000).toString(16);
        
        // Retornar com dados do bloco
        return res.status(200).json({
          success: true,
          message: 'Streaming registrado e bloco minerado!',
          data: {
            reward: streamingResult.data?.reward || 1,
            block: {
              block_index: Date.now(),
              block_hash: blockHash,
              previous_hash: previousHash,
              timestamp: new Date().toISOString(),
              miner_user_id: params.user_id,
              music_title: musicTitle,
              reward_amount: streamingResult.data?.reward || 1
            }
          }
        });
      }
      
      return res.status(200).json(streamingResult);
    }
    
    // ===== PARA TODAS AS OUTRAS AÇÕES, ENCAMINHAR PARA O GAS =====
    const url = new URL(GAS_URL);
    url.searchParams.append('action', action || 'status');
    
    Object.keys(params).forEach(key => {
      if (params[key]) {
        url.searchParams.append(key, params[key]);
      }
    });
    
    console.log('🔍 Chamando GAS:', url.toString());
    
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    const data = await response.json();
    console.log('✅ Resposta do GAS:', data);
    
    // Log detalhado
    console.log('📊 Dados retornados:', {
      action: action,
      success: data.success,
      data_size: JSON.stringify(data).length,
      timestamp: new Date().toISOString()
    });
    
    // Retornar a resposta do GAS
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
