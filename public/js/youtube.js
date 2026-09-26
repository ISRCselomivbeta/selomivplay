// ============================================================
// js/youtube.js — PLAY MY v9.2.0
// Integração YouTube: API IFrame, busca, player.
// Depende de: config.js, utils.js, state.js, api.js
//
// MUDANÇAS v9.2.0:
//   - 🚀 REUSO DO PLAYER: se o player já existe, usa loadVideoById()
//        → troca de música instantânea (~0.2s em vez de ~2s)
//        → NÃO destrói o iframe, NÃO pisca, YouTube cacheia melhor
//   - 🆕 prefetchYouTubeVideo(videoId): aquece thumbnail do próximo
//   - 🔧 registrarStreaming alinhado ao stream guard v9.8.4:
//        + timestamp no payload
//        + log 🛡️ quando bloqueado
//   - ✅ Player inicial (1º play) continua criando new YT.Player
//
// MUDANÇAS v9.1.0:
//   - 🔧 Iframe agora vive no container GLOBAL (#youtubePlayerGlobal)
//     fora das seções. A música NÃO pausa ao navegar entre seções.
//
// MUDANÇAS v9.0.0 (A PONTE):
//   - origin: window.location.origin  → YouTube conta a view
//   - enablejsapi: 1                  → API de controle ativa
//   - registrarStreaming()            → avisa o backend
//   - onStateChange PLAYING          → dispara registro
// ============================================================

// ✅ Array global para callbacks
window._ytCallbacks = [];
window._ytIsReady = false;

// ============================================================
// CALLBACK DO YOUTUBE
// ============================================================
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

// ============================================================
// CARREGAMENTO DA API — à prova de balas
// ============================================================
window.loadYouTubeAPI = function (cb) {
  console.log('🎵 [loadYouTubeAPI] YT:', typeof window.YT, '| ready:', window._ytIsReady);

  // ✅ CASO 1: Já está pronto
  if (window.YT && window.YT.Player && (state.youtubeAPILoaded || window._ytIsReady)) {
    console.log('🎵 [loadYouTubeAPI] Já pronto, executando callback');
    state.youtubeAPILoaded = true;
    if (cb) {
      try { cb(); } catch (e) { console.error('❌ Erro:', e); }
    }
    return;
  }

  // ✅ CASO 2: YT existe mas flag false
  if (window.YT && window.YT.Player && !window._ytIsReady) {
    console.log('🎵 [loadYouTubeAPI] ⚡ YT existe! Forçando ready');
    state.youtubeAPILoaded = true;
    window._ytIsReady = true;
    if (cb) {
      try { cb(); } catch (e) { console.error('❌ Erro:', e); }
    }
    return;
  }

  // ✅ CASO 3: Registra callback
  if (cb) {
    window._ytCallbacks.push(cb);
    console.log('🎵 [loadYouTubeAPI] 📝 Callback registrado. Total:', window._ytCallbacks.length);
  }

  // ✅ CASO 4: Script já está no DOM, faz polling
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

  // ✅ CASO 5: Injeta o script
  console.log('🎵 [loadYouTubeAPI] 💉 Injetando script');
  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  tag.async = true;
  tag.onerror = () => console.error('❌ Falha ao carregar YouTube API');
  document.head.appendChild(tag);
};

// ============================================================
// 🆕 v9.2.0 — PREFETCH DE THUMBNAIL
// Aquece a CDN do YouTube com a thumbnail do próximo vídeo.
// Uso: playNext() / playPrevious() podem chamar antes de tocar.
// ============================================================
window.prefetchYouTubeVideo = function (videoId) {
  if (!videoId || typeof videoId !== 'string') return;
  // Evita repetir o mesmo prefetch
  if (window._lastPrefetchId === videoId) return;
  window._lastPrefetchId = videoId;

  try {
    const img = new Image();
    img.decoding = 'async';
    img.loading = 'eager';
    img.src = 'https://img.youtube.com/vi/' + videoId + '/hqdefault.jpg';
    console.log('🖼️ [prefetch] thumbnail:', videoId);
  } catch (e) {
    // silencioso — prefetch é best-effort
  }
};

// ============================================================
// 🆕 REGISTRAR STREAMING — A PONTE (alinhado ao stream guard v9.8.4)
// ============================================================
window.registrarStreaming = function (videoId) {
  const user = window.state && window.state.currentUser;
  if (!user || !user.id) {
    console.log('🎵 [registrarStreaming] usuário não logado — não registra');
    return;
  }

  // Evita registrar 2x o mesmo vídeo em menos de 30s (defesa local)
  const agora = Date.now();
  if (window._ultimoStream && window._ultimoStream.id === videoId &&
      (agora - window._ultimoStream.ts) < 30000) {
    console.log('🎵 [registrarStreaming] duplicado local (<30s), ignorando');
    return;
  }
  window._ultimoStream = { id: videoId, ts: agora };

  console.log('🎵 [registrarStreaming] ✅ registrando stream:', videoId);

  if (typeof window.callAPI === 'function') {
    window.callAPI('register_streaming', {
      music_id: videoId,
      user_id: user.id,
      duration: 30,
      // 🆕 v9.2.0 — timestamp para auditoria do backend
      timestamp: new Date().toISOString()
    }).then(r => {
      if (r && r.success) {
        console.log('🎵 [registrarStreaming] backend OK:', r.data);
      } else if (r && r.blocked) {
        // 🛡️ Stream guard do backend rejeitou
        console.log('🛡️ [registrarStreaming] bloqueado pelo guard:', r.reason || r.message);
      }
    }).catch(e => {
      console.warn('🎵 [registrarStreaming] erro:', e.message);
    });
  }
};

// ============================================================
// BUSCA DIRETA
// ============================================================
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

// ============================================================
// 🆕 v9.2.0 — INICIALIZAÇÃO DO PLAYER COM REUSO INTELIGENTE
// ------------------------------------------------------------
// 1º play  → new YT.Player (cria o iframe)
// Próximos → state.youtubePlayer.loadVideoById(videoId) (instantâneo)
// ============================================================
window.initializeYouTubePlayer = function (videoId) {
  console.log('🎵 [initializeYouTubePlayer] videoId:', videoId);

  if (typeof YT === 'undefined' || !YT.Player) {
    console.warn('⚠️ YT não disponível ainda. Aguardando...');
    loadYouTubeAPI(() => {
      console.log('🎵 [initializeYouTubePlayer] YT ficou pronto, tentando de novo');
      initializeYouTubePlayer(videoId);
    });
    return;
  }

  // 🆕 Container GLOBAL (fora das seções) — não pausa a música
  const el = document.getElementById('youtubePlayerGlobal');
  if (!el) {
    console.error('❌ #youtubePlayerGlobal NÃO existe — adicione no index.html');
    return;
  }

  const loading = document.getElementById('playerLoadingExpanded');

  // ============================================================
  // 🆕 v9.2.0 — REUSO: se o player já existe, apenas troca o vídeo
  // ============================================================
  if (state.youtubePlayer && typeof state.youtubePlayer.loadVideoById === 'function') {
    console.log('🚀 [initializeYouTubePlayer] REUSO — loadVideoById:', videoId);
    if (loading) loading.style.display = 'flex';

    try {
      state.youtubePlayer.loadVideoById(videoId);
      // Não precisa reconfigurar onReady/onStateChange — já estão ativos
      state.playerReady = true;
      return;
    } catch (e) {
      console.warn('⚠️ loadVideoById falhou, recriando player:', e.message);
      // Cai no fluxo de criação abaixo
      try { state.youtubePlayer.destroy(); } catch (_) {}
      state.youtubePlayer = null;
    }
  }

  // ============================================================
  // PRIMEIRO PLAY — cria o player do zero
  // ============================================================
  el.innerHTML = '';
  if (loading) loading.style.display = 'flex';

  if (state.youtubePlayer && state.youtubePlayer.destroy) {
    try { state.youtubePlayer.destroy(); } catch (e) {}
  }
  state.youtubePlayer = null;

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
        enablejsapi: 1,
        origin: window.location.origin
      },
      events: {
        onReady: function (e) {
          console.log('✅ [YT.Player] onReady!');
          state.playerReady = true;
          try { e.target.setVolume(state.currentVolume); } catch (x) {}
          if (loading) loading.style.display = 'none';

          try {
            e.target.playVideo();
            console.log('🎵 [YT.Player] playVideo() chamado');
          } catch (x) {
            console.warn('⚠️ playVideo falhou:', x);
          }

          if (state.progressInterval) clearInterval(state.progressInterval);
          state.progressInterval = setInterval(updatePlayerProgress, 1000);

          // Se o player expandido estiver aberto, move o iframe pra dentro dele
          if (typeof window._moveYouTubeToExpandedIfOpen === 'function') {
            window._moveYouTubeToExpandedIfOpen();
          }
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
            window.registrarStreaming(videoId);
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

// ============================================================
// PROGRESSO
// ============================================================
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

// ============================================================
// LOG DE CARREGAMENTO
// ============================================================
console.log('✅ [youtube.js] v9.2.0 carregado — iframe global + reuso de player + prefetch');
