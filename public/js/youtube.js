// ============================================================
// js/youtube.js — PLAY MY v8.6.0
// Integração YouTube: API IFrame, busca, player.
// Depende de: config.js, utils.js, state.js, api.js
// ============================================================

window._ytReadyCallbacks = [];

window.onYouTubeIframeAPIReady = function () {
  console.log('🎵 [YouTube] API PRONTA! Executando callbacks...');
  state.youtubeAPILoaded = true;

  const callbacks = window._ytReadyCallbacks.slice();
  window._ytReadyCallbacks = [];

  callbacks.forEach((cb, i) => {
    try {
      console.log(`🎵 [YouTube] Executando callback ${i + 1}/${callbacks.length}`);
      cb();
    } catch (e) {
      console.error('❌ [YouTube] Erro no callback:', e);
    }
  });
};

window.loadYouTubeAPI = function (cb) {
  console.log('🎵 [loadYouTubeAPI] YT:', typeof window.YT, '| loaded:', state.youtubeAPILoaded);

  if (window.YT && window.YT.Player && state.youtubeAPILoaded) {
    console.log('🎵 [loadYouTubeAPI] Já carregada');
    if (cb) {
      try { cb(); } catch (e) { console.error('❌ Erro no callback:', e); }
    }
    return;
  }

  if (cb) window._ytReadyCallbacks.push(cb);

  if (document.querySelector('script[src*="youtube.com/iframe_api"]')) {
    console.log('🎵 [loadYouTubeAPI] Script já no DOM');
    return;
  }

  console.log('🎵 [loadYouTubeAPI] Injetando script...');
  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  tag.async = true;
  tag.onerror = function () {
    console.error('❌ [loadYouTubeAPI] Falha ao carregar script do YouTube');
  };
  document.head.appendChild(tag);
};

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

window.initializeYouTubePlayer = function (videoId) {
  console.log('🎵 [initializeYouTubePlayer] videoId:', videoId);

  const el = document.getElementById('youtubePlayerExpanded');
  if (!el) {
    console.error('❌ #youtubePlayerExpanded NÃO existe');
    return;
  }

  el.innerHTML = '';
  const loading = document.getElementById('playerLoadingExpanded');
  if (loading) loading.style.display = 'flex';

  if (state.youtubePlayer && state.youtubePlayer.destroy) {
    try { state.youtubePlayer.destroy(); } catch (e) {}
  }
  state.youtubePlayer = null;

  const divId = 'ytp-' + Date.now();
  const div = document.createElement('div');
  div.id = divId;
  el.appendChild(div);

  if (typeof YT === 'undefined' || !YT.Player) {
    console.warn('⚠️ YT não disponível, aguardando...');
    loadYouTubeAPI(() => initializeYouTubePlayer(videoId));
    return;
  }

  console.log('🎵 [initializeYouTubePlayer] Criando YT.Player...');

  try {
    state.youtubePlayer = new YT.Player(divId, {
      width: '100%',
      height: '100%',
      videoId: videoId,
      playerVars: {
        autoplay: 1,
        controls: 1,
        modestbranding: 1,
        rel: 0,
        playsinline: 1,
        enablejsapi: 1
      },
      events: {
        onReady: function (e) {
          console.log('✅ [YT.Player] onReady!');
          state.playerReady = true;
          try { e.target.setVolume(state.currentVolume); } catch (x) {}
          if (loading) loading.style.display = 'none';
          if (state.isPlaying) {
            try { e.target.playVideo(); } catch (x) {}
          }
          if (state.progressInterval) clearInterval(state.progressInterval);
          state.progressInterval = setInterval(updatePlayerProgress, 1000);
        },
        onStateChange: function (e) {
          console.log('🎵 [YT.Player] Estado:', e.data);
          if (e.data === 1) {
            state.isPlaying = true;
            if (loading) loading.style.display = 'none';
          } else if (e.data === 2) {
            state.isPlaying = false;
          } else if (e.data === 0) {
            state.isPlaying = false;
            if (typeof playQueue !== 'undefined' && playQueue.playNext) {
              playQueue.playNext();
            }
          }
          if (typeof updatePlayerIcons === 'function') updatePlayerIcons();
        },
        onError: function (e) {
          console.error('❌ [YT.Player] Erro:', e.data);
          const msgs = {
            2: 'ID inválido',
            5: 'Erro HTML5',
            100: 'Vídeo não encontrado',
            101: 'Incorporação não permitida',
            150: 'Incorporação não permitida'
          };
          if (typeof showToast === 'function') {
            showToast('Erro YouTube: ' + (msgs[e.data] || 'Desconhecido'), 'error');
          }
          if (loading) loading.style.display = 'none';
        }
      }
    });
  } catch (error) {
    console.error('❌ Erro ao criar player:', error);
    if (loading) loading.style.display = 'none';
    if (typeof showToast === 'function') {
      showToast('Erro ao carregar player', 'error');
    }
  }
};

window.updatePlayerProgress = function () {
  if (!state.youtubePlayer || !state.youtubePlayer.getCurrentTime) return;
  try {
    const c = state.youtubePlayer.getCurrentTime();
    const d = state.youtubePlayer.getDuration();
    if (d > 0) {
      const p = (c / d) * 100;
      const b = document.getElementById('playerProgressBar');
      if (b) b.style.width = p + '%';
      const cc = document.getElementById('currentTimeDisplay');
      if (cc) cc.textContent = formatTime(c);
      const t = document.getElementById('totalTimeDisplay');
      if (t) t.textContent = formatTime(d);
      const eb = document.getElementById('expandedProgressBar');
      if (eb) eb.style.width = p + '%';
      const ec = document.getElementById('expandedCurrentTime');
      if (ec) ec.textContent = formatTime(c);
      const et = document.getElementById('expandedTotalTime');
      if (et) et.textContent = formatTime(d);
    }
  } catch (e) {}
};

console.log('✅ [youtube.js] carregado — v8.6.0');
