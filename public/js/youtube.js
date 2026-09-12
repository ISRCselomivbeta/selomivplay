// ============================================================
// js/youtube.js — PLAY MY v8.5.0
// Integração YouTube: API IFrame, busca, player.
// Depende de: config.js, utils.js, state.js, api.js
// DEVE carregar DEPOIS de api.js e ANTES de player.js.
// ============================================================

// ============ BUSCA DIRETA (via backend proxy) ============
// ⚠️ SEGURANÇA: A chave da API do YouTube fica APENAS no backend.
// O frontend chama /api/backend?action=search_youtube
window.searchYouTubeDirect = async function (query) {
  console.log('🎥 Buscando YouTube:', query);

  try {
    const r = await callAPI('search_youtube', { query, limit: 15 });

    if (r && r.success && r.data && r.data.length) {
      console.log('🎥 YouTube OK:', r.data.length, 'resultados');

      return r.data.map(item => ({
        id: item.id || ('yt_' + (item.link_youtube || '').split('v=')[1]),
        titulo: item.titulo || item.title || '',
        artista: item.artista || item.channelTitle || '',
        link_capa: item.link_capa || item.thumbnail || '',
        link_youtube: item.link_youtube || '',
        is_youtube: true
      }));
    }
  } catch (e) {
    console.warn('⚠️ search_youtube falhou:', e.message);
  }

  return [];
};

// ============ CARREGAMENTO DA API IFrame ============
// Carrega o script https://www.youtube.com/iframe_api apenas uma vez.
// Quando pronto, chama o callback fornecido.
window.loadYouTubeAPI = function (cb) {
  // Já carregada e pronta
  if (window.YT && window.YT.Player && state.youtubeAPILoaded) {
    if (cb) cb();
    return;
  }

  // Guarda callback para quando a API estiver pronta
  window.onYouTubeIframeAPIReady = function () {
    state.youtubeAPILoaded = true;
    if (cb) cb();
  };

  // Se o script ainda não foi injetado, injeta
  if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  }
};

// ============ INICIALIZAÇÃO DO PLAYER ============
window.initializeYouTubePlayer = function (videoId) {
  const el = document.getElementById('youtubePlayerExpanded');
  if (!el) {
    console.warn('⚠️ Elemento #youtubePlayerExpanded não encontrado');
    return;
  }

  // Limpa container e esconde loading
  el.innerHTML = '';
  const loading = document.getElementById('playerLoadingExpanded');
  if (loading) loading.style.display = 'none';

  // Cria div única para o player
  const divId = 'ytp-' + Date.now();
  const div = document.createElement('div');
  div.id = divId;
  el.appendChild(div);

  // Destroi player antigo
  if (state.youtubePlayer && state.youtubePlayer.destroy) {
    try { state.youtubePlayer.destroy(); } catch (e) {}
  }

  // Se YT não estiver pronto, tenta de novo
  if (typeof YT === 'undefined' || !YT.Player) {
    loadYouTubeAPI(() => initializeYouTubePlayer(videoId));
    return;
  }

  // Cria o player
  state.youtubePlayer = new YT.Player(divId, {
    width: '100%',
    height: '100%',
    videoId,
    playerVars: {
      autoplay: 1,
      controls: 1,
      modestbranding: 1,
      rel: 0,
      playsinline: 1
    },
    events: {
      onReady: function (e) {
        state.playerReady = true;
        try { e.target.setVolume(state.currentVolume); } catch (x) {}

        if (state.isPlaying) {
          try { e.target.playVideo(); } catch (x) {}
        }

        // Inicia loop de progresso
        if (state.progressInterval) clearInterval(state.progressInterval);
        state.progressInterval = setInterval(updatePlayerProgress, 1000);
      },
      onStateChange: function (e) {
        if (e.data === YT.PlayerState.PLAYING) {
          state.isPlaying = true;
          const loading = document.getElementById('playerLoadingExpanded');
          if (loading) loading.style.display = 'none';
        } else if (e.data === YT.PlayerState.PAUSED) {
          state.isPlaying = false;
        } else if (e.data === YT.PlayerState.ENDED) {
          state.isPlaying = false;
          if (typeof playQueue !== 'undefined' && playQueue.playNext) {
            playQueue.playNext();
          }
        }
        // updatePlayerIcons está em player.js (será migrado)
        if (typeof window.updatePlayerIcons === 'function') {
          window.updatePlayerIcons();
        }
      }
    }
  });
};

// ============ PROGRESSO DO PLAYER ============
window.updatePlayerProgress = function () {
  if (!state.youtubePlayer || !state.youtubePlayer.getCurrentTime) return;

  try {
    const c = state.youtubePlayer.getCurrentTime();
    const d = state.youtubePlayer.getDuration();

    if (d > 0) {
      const p = (c / d) * 100;

      // Barra do player inferior
      const b = document.getElementById('playerProgressBar');
      if (b) b.style.width = p + '%';

      const cc = document.getElementById('currentTimeDisplay');
      if (cc) cc.textContent = formatTime(c);

      const t = document.getElementById('totalTimeDisplay');
      if (t) t.textContent = formatTime(d);

      // Barra do player expandido
      const eb = document.getElementById('expandedProgressBar');
      if (eb) eb.style.width = p + '%';

      const ec = document.getElementById('expandedCurrentTime');
      if (ec) ec.textContent = formatTime(c);

      const et = document.getElementById('expandedTotalTime');
      if (et) et.textContent = formatTime(d);
    }
  } catch (e) {
    // silencioso — o player pode estar em transição
  }
};

// ============ LOG DE CARREGAMENTO ============
console.log('✅ [youtube.js] carregado — busca, API IFrame e player prontos');
