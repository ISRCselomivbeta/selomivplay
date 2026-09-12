// ============================================================
// CARREGAMENTO DA API — v8.6.2 (à prova de balas)
// ============================================================

window._ytCallbacks = [];
window._ytIsReady = false;

window.onYouTubeIframeAPIReady = function () {
  console.log('🎵 [YouTube] ✅ API PRONTA!');
  state.youtubeAPILoaded = true;
  window._ytIsReady = true;

  const callbacks = window._ytCallbacks.slice();
  window._ytCallbacks = [];
  console.log('🎵 [YouTube] Executando', callbacks.length, 'callbacks');

  callbacks.forEach((cb, i) => {
    try {
      console.log(`🎵 [YouTube] Callback ${i + 1}/${callbacks.length}`);
      cb();
    } catch (e) {
      console.error('❌ Erro no callback:', e);
    }
  });
};

window.loadYouTubeAPI = function (cb) {
  console.log('🎵 [loadYouTubeAPI] YT:', typeof window.YT, '| ready:', window._ytIsReady);

  // ✅ Se já está pronto → executa imediatamente
  if (window.YT && window.YT.Player && (state.youtubeAPILoaded || window._ytIsReady)) {
    console.log('🎵 [loadYouTubeAPI] Já pronto, executando callback');
    state.youtubeAPILoaded = true;
    if (cb) {
      try { cb(); } catch (e) { console.error('❌ Erro:', e); }
    }
    return;
  }

  // ✅ Se YT existe mas flag está false → força
  if (window.YT && window.YT.Player && !window._ytIsReady) {
    console.log('🎵 [loadYouTubeAPI] ⚡ YT existe! Forçando ready');
    state.youtubeAPILoaded = true;
    window._ytIsReady = true;
    if (cb) {
      try { cb(); } catch (e) { console.error('❌ Erro:', e); }
    }
    return;
  }

  // ✅ Registra callback
  if (cb) {
    window._ytCallbacks.push(cb);
    console.log('🎵 [loadYouTubeAPI] 📝 Callback registrado. Total:', window._ytCallbacks.length);
  }

  // ✅ Se script já está no DOM, faz polling
  if (document.querySelector('script[src*="youtube.com/iframe_api"]')) {
    console.log('🎵 [loadYouTubeAPI] 🔄 Script no DOM, polling...');
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (window.YT && window.YT.Player) {
        clearInterval(interval);
        console.log('🎵 [loadYouTubeAPI] ✅ YT detectado (polling)');
        state.youtubeAPILoaded = true;
        window._ytIsReady = true;
        const cbs = window._ytCallbacks.slice();
        window._ytCallbacks = [];
        cbs.forEach(fn => {
          try { fn(); } catch (e) { console.error('❌ Erro:', e); }
        });
      }
      if (attempts >= 40) {
        clearInterval(interval);
        console.error('❌ [loadYouTubeAPI] Timeout 20s');
      }
    }, 500);
    return;
  }

  // ✅ Injeta o script
  console.log('🎵 [loadYouTubeAPI] 💉 Injetando script');
  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  tag.async = true;
  tag.onerror = () => console.error('❌ Falha ao carregar YouTube API');
  document.head.appendChild(tag);
};

// ============================================================
// INICIALIZAÇÃO DO PLAYER — v8.6.2 (auto-recuperação)
// ============================================================
window.initializeYouTubePlayer = function (videoId) {
  console.log('🎵 [initializeYouTubePlayer] videoId:', videoId);

  // ✅ Se YT ainda não está pronto, espera e tenta de novo
  if (typeof YT === 'undefined' || !YT.Player) {
    console.warn('⚠️ YT não disponível ainda. Aguardando...');
    loadYouTubeAPI(() => {
      console.log('🎵 [initializeYouTubePlayer] YT ficou pronto, tentando de novo');
      initializeYouTubePlayer(videoId);
    });
    return;
  }

  const el = document.getElementById('youtubePlayerExpanded');
  if (!el) {
    console.error('❌ #youtubePlayerExpanded NÃO existe');
    return;
  }

  el.innerHTML = '';
  const loading = document.getElementById('playerLoadingExpanded');
  if (loading) loading.style.display = 'flex';

  // Destroi player antigo
  if (state.youtubePlayer && state.youtubePlayer.destroy) {
    try { state.youtubePlayer.destroy(); } catch (e) {}
  }
  state.youtubePlayer = null;

  // Cria div
  const divId = 'ytp-' + Date.now();
  const div = document.createElement('div');
  div.id = divId;
  el.appendChild(div);

  console.log('🎵 [initializeYouTubePlayer] Criando YT.Player para:', videoId);

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

          // ✅ FORÇA PLAY
          try {
            e.target.playVideo();
            console.log('🎵 [YT.Player] playVideo() chamado');
          } catch (x) {
            console.warn('⚠️ playVideo falhou:', x);
          }

          if (state.progressInterval) clearInterval(state.progressInterval);
          state.progressInterval = setInterval(updatePlayerProgress, 1000);
        },

        onStateChange: function (e) {
          console.log('🎵 [YT.Player] Estado:', e.data,
            e.data === 1 ? '(PLAYING)' :
            e.data === 2 ? '(PAUSED)' :
            e.data === 3 ? '(BUFFERING)' :
            e.data === 0 ? '(ENDED)' : '');

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
            showToast('Erro YouTube: ' + (msgs[e.data] || 'Erro ' + e.data), 'error');
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
