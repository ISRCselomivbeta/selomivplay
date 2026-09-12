// ============================================================
// PLAY MY v8.5 — FIX.JS
// Correções sobre o monolítico sem alterá-lo
// Carregue DEPOIS do <script> principal do index.html
// ============================================================

(function() {
  'use strict';

  console.log('🔧 [FIX] Carregando correções...');

  // ============================================================
  // FIX 1: LOGO 404 → fallback para SVG inline
  // ============================================================
  const LOGO_FALLBACK = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><rect width="120" height="120" rx="27" fill="%2334c759"/><text x="50%" y="50%" text-anchor="middle" dy=".35em" font-family="-apple-system,sans-serif" font-size="48" font-weight="700" fill="%23fff">PM</text></svg>';

  function fixAllLogos() {
    // Substitui todas as imagens que apontam para /images/logo.png
    document.querySelectorAll('img[src*="/images/logo.png"]').forEach(function(img) {
      // Se já falhou, substitui direto
      if (img.complete && img.naturalWidth === 0) {
        img.src = LOGO_FALLBACK;
        return;
      }
      // Senão, adiciona handler de erro
      img.addEventListener('error', function() {
        if (this.src !== LOGO_FALLBACK) {
          this.src = LOGO_FALLBACK;
        }
      }, { once: true });
    });

    // Aplica fallback também em outros elementos que possam usar a logo
    document.querySelectorAll('[style*="/images/logo.png"]').forEach(function(el) {
      el.style.backgroundImage = 'url("' + LOGO_FALLBACK + '")';
    });
  }

  // Aplica assim que o DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fixAllLogos);
  } else {
    fixAllLogos();
  }

  // Re-aplica após 2s (caso imagens sejam criadas dinamicamente)
  setTimeout(fixAllLogos, 2000);
  setTimeout(fixAllLogos, 5000);

  // Observa mutações no DOM para pegar imagens criadas dinamicamente
  if (window.MutationObserver) {
    const observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(m) {
        m.addedNodes.forEach(function(node) {
          if (node.nodeType === 1) {
            if (node.tagName === 'IMG' && node.src && node.src.includes('/images/logo.png')) {
              node.addEventListener('error', function() {
                if (this.src !== LOGO_FALLBACK) this.src = LOGO_FALLBACK;
              }, { once: true });
            }
            if (node.querySelectorAll) {
              node.querySelectorAll('img[src*="/images/logo.png"]').forEach(function(img) {
                img.addEventListener('error', function() {
                  if (this.src !== LOGO_FALLBACK) this.src = LOGO_FALLBACK;
                }, { once: true });
              });
            }
          }
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ============================================================
  // FIX 2: PLAYER YOUTUBE OCULTO PERSISTENTE
  // Cria um container oculto onde o player pode rodar
  // ============================================================
  function createHiddenPlayer() {
    if (document.getElementById('ytHiddenPlayer')) return; // já existe
    const div = document.createElement('div');
    div.id = 'ytHiddenPlayer';
    div.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0.01;pointer-events:none;bottom:0;left:0;z-index:-1;overflow:hidden';
    div.innerHTML = '<div id="youtubePlayerHidden"></div>';
    document.body.appendChild(div);
    console.log('🔧 [FIX] Container oculto do player criado');
  }

  createHiddenPlayer();

  // ============================================================
  // FIX 3: SUBSTITUIR initializeYouTubePlayer
  // Aguarda o monolítico carregar e substitui a função
  // ============================================================
  function patchYouTubePlayer() {
    if (typeof window.initializeYouTubePlayer !== 'function') {
      // Tenta de novo em 500ms (monolítico ainda não carregou)
      setTimeout(patchYouTubePlayer, 500);
      return;
    }

    // Guarda referência original
    const original = window.initializeYouTubePlayer;

    // Substitui pela versão corrigida
    window.initializeYouTubePlayer = function(videoId) {
      if (!videoId) return;
      console.log('🔧 [FIX] Inicializando player para:', videoId);

      const container = document.getElementById('youtubePlayerHidden');
      if (!container) {
        console.warn('🔧 [FIX] Container oculto não existe, criando...');
        createHiddenPlayer();
        return window.initializeYouTubePlayer(videoId);
      }

      // Limpa container
      container.innerHTML = '';

      // Cria div do player
      const div = document.createElement('div');
      div.id = 'ytp-fix-' + Date.now();
      container.appendChild(div);

      // Destrói player anterior
      if (window.state && window.state.youtubePlayer && window.state.youtubePlayer.destroy) {
        try { window.state.youtubePlayer.destroy(); } catch (e) {}
      }

      // Carrega API se necessário
      if (typeof YT === 'undefined' || !YT.Player) {
        if (typeof window.loadYouTubeAPI === 'function') {
          window.loadYouTubeAPI(function() {
            window.initializeYouTubePlayer(videoId);
          });
        } else {
          setTimeout(function() { window.initializeYouTubePlayer(videoId); }, 500);
        }
        return;
      }

      // Cria o player
      window.state.youtubePlayer = new YT.Player(div.id, {
        width: '1',
        height: '1',
        videoId: videoId,
        playerVars: {
          autoplay: 1,
          controls: 0,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          enablejsapi: 1,
          origin: window.location.origin,
          mute: 0
        },
        events: {
          onReady: function(e) {
            window.state.playerReady = true;
            const l = document.getElementById('playerLoadingExpanded');
            if (l) l.style.display = 'none';
            try { e.target.setVolume(window.state.currentVolume || 80); } catch (x) {}
            try { e.target.playVideo(); } catch (x) {}
            if (window.state.progressInterval) clearInterval(window.state.progressInterval);
            if (typeof window.updatePlayerProgress === 'function') {
              window.state.progressInterval = setInterval(window.updatePlayerProgress, 1000);
            }
            console.log('✅ [FIX] Player YouTube pronto');
          },
          onStateChange: function(e) {
            const l = document.getElementById('playerLoadingExpanded');
            if (e.data === YT.PlayerState.PLAYING) {
              window.state.isPlaying = true;
              if (l) l.style.display = 'none';
              console.log('▶️ [FIX] Tocando');
            } else if (e.data === YT.PlayerState.PAUSED) {
              window.state.isPlaying = false;
            } else if (e.data === YT.PlayerState.BUFFERING) {
              if (l) l.style.display = 'flex';
            } else if (e.data === YT.PlayerState.ENDED) {
              window.state.isPlaying = false;
              if (l) l.style.display = 'none';
              if (window.playQueue && window.playQueue.playNext) window.playQueue.playNext();
            } else if (e.data === YT.PlayerState.CUED) {
              window.state.playerReady = true;
              if (l) l.style.display = 'none';
            }
            if (typeof window.updatePlayerIcons === 'function') window.updatePlayerIcons();
          },
          onError: function(e) {
            console.error('❌ [FIX] Erro no player:', e.data);
            const errors = {
              2: 'ID do vídeo inválido',
              5: 'Erro de HTML5',
              100: 'Vídeo não encontrado ou removido',
              101: 'Vídeo não permite reprodução externa',
              150: 'Vídeo não permite reprodução externa'
            };
            if (typeof window.showToast === 'function') {
              window.showToast(errors[e.data] || 'Erro ao carregar vídeo', 'warning', 4000);
            }
          }
        }
      });
    };

    console.log('✅ [FIX] initializeYouTubePlayer substituído');
  }

  // Aplica o patch
  patchYouTubePlayer();

  // ============================================================
  // FIX 4: SEARCH YOUTUBE ROBUSTA COM FALLBACKS
  // ============================================================
  const YT_API_KEY = 'AIzaSyAPaYGY_MrrNgKdEqTs3Qw7tPNv5p5QwPM';

  async function robustSearchYouTube(query) {
    console.log('🎥 [FIX] Buscando YouTube:', query);

    // Tentativa 1: backend Vercel
    try {
      const url = 'https://selomivplay-seyv.vercel.app/api/backend?action=search_youtube&query=' + encodeURIComponent(query) + '&limit=15';
      const r = await fetch(url, { signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined });
      if (r.ok) {
        const json = await r.json();
        if (json && json.success && Array.isArray(json.data) && json.data.length > 0) {
          console.log('✅ [FIX] YouTube via Vercel:', json.data.length, 'resultados');
          return json.data.map(normalizeYtResult);
        }
      }
    } catch (e) { console.warn('⚠️ [FIX] Vercel search_youtube falhou:', e.message); }

    // Tentativa 2: GAS
    try {
      const url = 'https://script.google.com/macros/s/AKfycbwgjor-tLLzVrnJGNHOifL1O2sRBhysKJ3IbVJy_AHgtNqjk-6hazH8xuO6OaDXF_s/exec?action=search_youtube&query=' + encodeURIComponent(query) + '&limit=15';
      const r = await fetch(url, { signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined });
      if (r.ok) {
        const json = await r.json();
        if (json && json.success && Array.isArray(json.data) && json.data.length > 0) {
          console.log('✅ [FIX] YouTube via GAS:', json.data.length, 'resultados');
          return json.data.map(normalizeYtResult);
        }
      }
    } catch (e) { console.warn('⚠️ [FIX] GAS search_youtube falhou:', e.message); }

    // Tentativa 3: YouTube API direta (fallback crítico)
    try {
      const url = 'https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=15&q=' + encodeURIComponent(query + ' música') + '&key=' + YT_API_KEY;
      const r = await fetch(url, { signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined });
      if (r.ok) {
        const json = await r.json();
        if (json.items && json.items.length > 0) {
          console.log('✅ [FIX] YouTube via API direta:', json.items.length, 'resultados');
          return json.items.map(function(item) {
            return {
              id: 'yt_' + item.id.videoId,
              titulo: item.snippet.title,
              artista: item.snippet.channelTitle,
              link_capa: item.snippet.thumbnails.high.url,
              link_youtube: 'https://www.youtube.com/watch?v=' + item.id.videoId,
              is_youtube: true
            };
          });
        }
      }
    } catch (e) { console.warn('⚠️ [FIX] YouTube API direta falhou:', e.message); }

    console.warn('❌ [FIX] Todas as tentativas de busca YouTube falharam');
    return [];
  }

  function normalizeYtResult(item) {
    if (!item) return null;
    return {
      id: item.id || ('yt_' + (item.link_youtube || '').split('v=')[1] || Date.now()),
      titulo: item.titulo || item.title || '',
      artista: item.artista || item.channelTitle || '',
      link_capa: item.link_capa || item.thumbnail || '',
      link_youtube: item.link_youtube || '',
      is_youtube: true
    };
  }

  // Substitui a função searchYouTubeDirect
  function patchSearchYouTubeDirect() {
    if (typeof window.searchYouTubeDirect !== 'function') {
      setTimeout(patchSearchYouTubeDirect, 500);
      return;
    }

    window.searchYouTubeDirect = async function(query) {
      return robustSearchYouTube(query);
    };

    console.log('✅ [FIX] searchYouTubeDirect substituído');
  }

  patchSearchYouTubeDirect();

  // ============================================================
  // FIX 5: PERFORMSEARCH com YouTube SEMPRE
  // ============================================================
  function patchPerformSearch() {
    if (typeof window.performSearch !== 'function') {
      setTimeout(patchPerformSearch, 500);
      return;
    }

    window.performSearch = async function() {
      const input = document.getElementById('searchInput');
      if (!input) return;
      const q = input.value.trim();
      if (!q) {
        if (typeof window.showToast === 'function') window.showToast('Digite uma busca', 'warning');
        return;
      }

      const c = document.getElementById('searchResults');
      if (!c) return;
      c.style.display = 'block';
      c.innerHTML = '<div class="p-4 text-center text-muted"><div class="spinner-border spinner-border-sm text-success me-2"></div>Buscando...</div>';

      const ql = q.toLowerCase();
      const playlist = (window.state && window.state.playlist) || [];
      const externalPlaylist = (window.state && window.state.externalPlaylist) || [];

      const internal = playlist.filter(function(i) {
        return i && (
          ((i.titulo || '').toLowerCase().includes(ql)) ||
          ((i.artista || '').toLowerCase().includes(ql))
        );
      });
      const external = externalPlaylist.filter(function(i) {
        return i && (
          ((i.titulo || '').toLowerCase().includes(ql)) ||
          ((i.artista || '').toLowerCase().includes(ql))
        );
      });

      // SEMPRE busca no YouTube
      const ytResults = await robustSearchYouTube(q);

      const all = [].concat(
        internal.map(function(x) { return Object.assign({}, x, { _type: 'internal' }); }),
        external.map(function(x) { return Object.assign({}, x, { _type: 'external' }); }),
        ytResults.map(function(x) { return Object.assign({}, x, { _type: 'youtube' }); })
      );

      if (!all.length) {
        c.innerHTML = '<div class="p-4 text-center text-muted">Nenhum resultado para "' + q + '"</div>';
        return;
      }

      c.innerHTML = '<div class="p-2">' + all.slice(0, 40).map(function(item) {
        if (!item) return '';
        const isYT = item._type === 'youtube';
        const isExt = item._type === 'external';
        let cover = (item.link_capa && item.link_capa.startsWith('http')) ? item.link_capa : '';
        if (!cover && item.link_youtube) {
          const match = item.link_youtube.match(/(?:v=|youtu\.be\/)([^&\n?#]+)/);
          if (match && match[1]) cover = 'https://img.youtube.com/vi/' + match[1] + '/hqdefault.jpg';
        }
        if (!cover) cover = LOGO_FALLBACK;

        const badge = isYT
          ? '<span class="search-result-badge" style="background:rgba(255,59,48,.18);color:var(--apple-red)">▶ YT</span>'
          : (isExt ? '<span class="search-result-badge">🌐</span>' : '<span class="search-result-badge normal">🔷</span>');

        let clickAction;
        if (isYT) {
          const vid = String(item.id).replace('yt_', '');
          clickAction = 'window._fixPlayYoutube(\'' + vid + '\')';
        } else {
          clickAction = 'window.playSearchResult(\'' + item._type + '\', \'' + item.id + '\')';
        }

        return '<div class="search-result-item" onclick="' + clickAction + '">' +
          '<img src="' + cover + '" class="search-result-cover" onerror="this.src=\'' + LOGO_FALLBACK + '\'">' +
          '<div class="search-result-info">' +
          '<div class="search-result-title">' + (item.titulo || '') + '</div>' +
          '<div class="search-result-artist">' + (item.artista || '') + '</div>' +
          '</div>' + badge + '</div>';
      }).join('') + '</div>';
    };

    console.log('✅ [FIX] performSearch substituído');
  }

  patchPerformSearch();

  // ============================================================
  // FIX 6: PLAY SEARCH RESULT — YouTube direto
  // ============================================================
  window._fixPlayYoutube = function(vid) {
    if (!vid) return;
    console.log('▶️ [FIX] Tocando YouTube:', vid);

    // Fecha resultados
    const c = document.getElementById('searchResults');
    if (c) c.style.display = 'none';
    const input = document.getElementById('searchInput');
    if (input) input.value = '';

    // Atualiza UI do player
    const ps = document.getElementById('playerSpotify');
    if (ps) ps.style.display = 'flex';
    const pt = document.getElementById('playerTitle');
    if (pt) pt.textContent = 'YouTube';
    const pa = document.getElementById('playerArtist');
    if (pa) pa.textContent = 'Vídeo do YouTube';
    const art = document.getElementById('playerAlbumArt');
    if (art) art.src = 'https://img.youtube.com/vi/' + vid + '/hqdefault.jpg';

    // Inicializa o player
    if (window.state) {
      window.state.currentTrackIndex = 2000;
      window.state.isPlaying = true;
    }

    // Chama a função original (que foi patcheada pelo FIX 3)
    if (typeof window.initializeYouTubePlayer === 'function') {
      window.initializeYouTubePlayer(vid);
    }

    if (typeof window.updatePlayerIcons === 'function') window.updatePlayerIcons();
    if (typeof window.showToast === 'function') window.showToast('▶️ Tocando do YouTube', 'success');
  };

  // ============================================================
  // FIX 7: PLAYTRACK — sempre inicializar player oculto
  // ============================================================
  function patchPlayTrack() {
    if (typeof window.playTrack !== 'function') {
      setTimeout(patchPlayTrack, 500);
      return;
    }

    const original = window.playTrack;

    window.playTrack = function(index) {
      const t = window.state && window.state.playlist ? window.state.playlist[index] : null;
      if (!t) return;

      console.log('🎵 [FIX] Tocando track:', t.titulo);

      // Chama o original (que faz a UI)
      try { original.call(this, index); } catch (e) { console.warn('Erro no playTrack original:', e); }

      // Garante que o player seja inicializado no container oculto
      if (t.link_youtube) {
        const match = t.link_youtube.match(/(?:v=|youtu\.be\/)([^&\n?#]+)/);
        if (match && match[1]) {
          setTimeout(function() {
            if (typeof window.initializeYouTubePlayer === 'function') {
              window.initializeYouTubePlayer(match[1]);
            }
          }, 100);
        }
      }
    };

    console.log('✅ [FIX] playTrack patcheado');
  }

  patchPlayTrack();

  // ============================================================
  // FIX 8: PLAYEXTERNALTRACK — sempre inicializar player oculto
  // ============================================================
  function patchPlayExternalTrack() {
    if (typeof window.playExternalTrack !== 'function') {
      setTimeout(patchPlayExternalTrack, 500);
      return;
    }

    const original = window.playExternalTrack;

    window.playExternalTrack = function(index) {
      const t = window.state && window.state.externalPlaylist ? window.state.externalPlaylist[index] : null;
      if (!t) return;

      console.log('🎵 [FIX] Tocando track externa:', t.titulo);

      try { original.call(this, index); } catch (e) { console.warn('Erro no playExternalTrack original:', e); }

      if (t.link_youtube) {
        const match = t.link_youtube.match(/(?:v=|youtu\.be\/)([^&\n?#]+)/);
        if (match && match[1]) {
          setTimeout(function() {
            if (typeof window.initializeYouTubePlayer === 'function') {
              window.initializeYouTubePlayer(match[1]);
            }
          }, 100);
        }
      }
    };

    console.log('✅ [FIX] playExternalTrack patcheado');
  }

  patchPlayExternalTrack();

  // ============================================================
  // FIX 9: IMAGENS DE MÚSICA COM FALLBACK
  // ============================================================
  function patchCoverUrl() {
    if (typeof window.getCoverUrl !== 'function') {
      setTimeout(patchCoverUrl, 500);
      return;
    }

    const original = window.getCoverUrl;

    window.getCoverUrl = function(track, isExternal) {
      if (!track) return isExternal ? LOGO_FALLBACK : LOGO_FALLBACK;

      // Se tem capa customizada, usa
      if (track.link_capa && track.link_capa.startsWith('http')) {
        return track.link_capa;
      }

      // Tenta extrair do YouTube
      if (track.link_youtube) {
        const match = track.link_youtube.match(/(?:v=|youtu\.be\/)([^&\n?#]+)/);
        if (match && match[1]) {
          return 'https://img.youtube.com/vi/' + match[1] + '/hqdefault.jpg';
        }
      }

      return LOGO_FALLBACK;
    };

    console.log('✅ [FIX] getCoverUrl patcheado');
  }

  patchCoverUrl();

  // ============================================================
  // FIX 10: CORRIGIR ELEMENTOS ESPECÍFICOS DA UI
  // ============================================================
  function fixExpandedPlayerElements() {
    // Corrige atributos onerror das imagens do player expandido
    const expandedArt = document.getElementById('expandedAlbumArt');
    if (expandedArt) {
      expandedArt.addEventListener('error', function() {
        this.src = LOGO_FALLBACK;
      }, { once: true });
    }

    const playerArt = document.getElementById('playerAlbumArt');
    if (playerArt) {
      playerArt.addEventListener('error', function() {
        this.src = LOGO_FALLBACK;
      }, { once: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fixExpandedPlayerElements);
  } else {
    fixExpandedPlayerElements();
  }

  // ============================================================
  // FIX 11: REGISTRAR SERVICE WORKER MANUALMENTE (se não registrado)
  // ============================================================
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistration().then(function(reg) {
      if (!reg) {
        navigator.serviceWorker.register('/sw.js').catch(function(e) {
          console.warn('⚠️ [FIX] Service Worker não registrado:', e.message);
        });
      }
    });
  }

  // ============================================================
  // FIX 12: EXPOR API DE DEBUG
  // ============================================================
  window._fix = {
    version: '8.5.0-fix',
    clearCache: function() {
      if ('caches' in window) {
        caches.keys().then(function(keys) {
          keys.forEach(function(k) { caches.delete(k); });
        });
      }
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' });
      }
      console.log('🗑️ [FIX] Cache limpo. Recarregue a página.');
    },
    testYouTube: function(query) {
      return robustSearchYouTube(query || 'test');
    },
    reload: function() {
      window.location.reload(true);
    }
  };

  // ============================================================
  // FIX 13: GARANTIR QUE A LOGO DO PWA FUNCIONE
  // ============================================================
  function fixManifestIcons() {
    const links = document.querySelectorAll('link[rel*="icon"], link[rel="apple-touch-icon"]');
    links.forEach(function(link) {
      link.addEventListener('error', function() {
        this.href = LOGO_FALLBACK;
      }, { once: true });
    });
  }
  fixManifestIcons();

  // ============================================================
  // FIX 14: SOBREPOR TÍTULOS VAZIOS (evita "Untitled")
  // ============================================================
  if (!document.title || document.title.trim() === '') {
    document.title = 'PLAY MY | Música sem limites';
  }

  // ============================================================
  // LOG FINAL
  // ============================================================
  console.log('✅ [FIX] Todas as correções aplicadas (v8.5.0-fix)');
  console.log('💡 Dica: window._fix.testYouTube("the weeknd") para testar busca');

})();
