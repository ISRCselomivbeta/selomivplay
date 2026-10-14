// ============================================================
// js/share-universal.js — PLAY MY v1.0.0
// Compartilhamento universal: interna + YouTube + externa + queue
//
// MUDANÇAS v1.0.0:
//   - 🆕 getCurrentTrackUniversal(): resolve o track atual de QUALQUER modo
//   - 🆕 openShareModal(track?): aceita track opcional
//   - 🆕 shareMusicUniversal(track): função principal
//   - 🆕 Detecta tipo (interna / youtube / externa) e monta link correto
//   - 🆕 Corrige bug do share.js quebrava com YouTube (index 2000)
//
// Compatível com: share.js v2.0.0 (mantém shareWhatsApp, shareTwitter, etc.)
// DEVE carregar DEPOIS de share.js
// ============================================================

(function () {
  'use strict';

  const SHARE_VERSION = '1.0.0';

  // ============================================================
  // HELPER — Extrai YouTube ID
  // ============================================================
  function _extractYouTubeId(url) {
    if (!url) return null;
    if (typeof extractYouTubeId === 'function') {
      try { return extractYouTubeId(url); } catch (e) {}
    }
    const m = String(url).match(/[?&]v=([^&]+)/) ||
              String(url).match(/youtu\.be\/([^?]+)/);
    return m ? m[1] : null;
  }

  // ============================================================
  // 🆕 RESOLVE O TRACK ATUAL (corrige bug do share.js)
  // ============================================================
  window.getCurrentTrackUniversal = function () {
    try {
      // 1. playQueue ativo? (playlist global ou user playlist com YouTube)
      if (window.playQueue &&
          Array.isArray(playQueue.items) &&
          playQueue.items.length > 0 &&
          typeof playQueue.currentIndex === 'number' &&
          playQueue.currentIndex >= 0) {

        const item = playQueue.items[playQueue.currentIndex];
        if (item) {
          // Item YouTube na queue (index -1 + youtubeData)
          if (item.index === -1 && item.youtubeData) {
            const vid = item.youtubeData.videoId;
            return {
              id: 'yt_' + vid,
              titulo: item.youtubeData.titulo || 'Vídeo do YouTube',
              artista: item.youtubeData.artista || 'YouTube',
              link_youtube: 'https://www.youtube.com/watch?v=' + vid,
              youtube: true,
              externa: true,
              genero: 'YouTube'
            };
          }
          // Item interno da queue
          if (item.type === 'internal' && item.index >= 0 && state.playlist[item.index]) {
            return state.playlist[item.index];
          }
          // Item externo da queue
          if (item.type === 'external' && item.index >= 0 &&
              state.externalPlaylist && state.externalPlaylist[item.index]) {
            return state.externalPlaylist[item.index];
          }
        }
      }

      // 2. Index >= 2000 = YouTube puro (busca)
      if (typeof state.currentTrackIndex === 'number' &&
          state.currentTrackIndex >= 2000) {
        return state._currentYouTubeTrack || null;
      }

      // 3. Index >= 1000 e < 2000 = externa
      if (typeof state.currentTrackIndex === 'number' &&
          state.currentTrackIndex >= 1000 &&
          state.currentTrackIndex < 2000 &&
          state.externalPlaylist) {
        const extIdx = state.currentTrackIndex - 1000;
        return state.externalPlaylist[extIdx] || null;
      }

      // 4. Linear normal (interna)
      if (typeof state.currentTrackIndex === 'number' &&
          state.currentTrackIndex >= 0 &&
          state.playlist &&
          state.playlist[state.currentTrackIndex]) {
        return state.playlist[state.currentTrackIndex];
      }

      // 5. Fallback: window.currentTrack (compatibilidade)
      return window.currentTrack || null;
    } catch (e) {
      console.warn('[ShareUniversal] erro getCurrentTrackUniversal:', e.message);
      return null;
    }
  };

  // ============================================================
  // 🆕 DETECTA TIPO DO TRACK
  // ============================================================
  function _detectTrackType(track) {
    if (!track) return 'unknown';

    // YouTube puro (id começa com yt_)
    if (track.id && String(track.id).startsWith('yt_')) return 'youtube';
    if (track.youtube === true) return 'youtube';
    if (track.is_youtube === true) return 'youtube';

    // Externa (tem external_id ou está no externalPlaylist)
    if (track.external_id) return 'externa';
    if (track.externa === true) return 'externa';

    // Interna (tem valor_acao)
    if (track.valor_acao !== undefined && track.valor_acao !== null) return 'interna';

    return 'unknown';
  }

  // ============================================================
  // 🆕 MONTA O LINK UNIVERSAL
  // ============================================================
  function _buildUniversalLink(track) {
    const tipo = _detectTrackType(track);
    const origin = window.location.origin;

    if (tipo === 'youtube') {
      const vid = _extractYouTubeId(track.link_youtube) ||
                  String(track.id || '').replace('yt_', '');
      if (vid) return 'https://www.youtube.com/watch?v=' + vid;
      return null;
    }

    // Interna OU externa → mesmo link ?music=ID
    return origin + '/?music=' + encodeURIComponent(track.id);
  }

  // ============================================================
  // 🆕 MONTA O TEXTO
  // ============================================================
  function _buildUniversalText(track, tipo) {
    const titulo = track.titulo || 'Música';
    const artista = track.artista || '';

    if (tipo === 'youtube') {
      return '🎵 ' + titulo + (artista ? ' — ' + artista : '') + '\n\nOuça no YouTube';
    }

    return '🎵 ' + titulo + (artista ? '\n' + artista : '') + '\n\nOuça no PLAY MY';
  }

  // ============================================================
  // 🆕 FUNÇÃO PRINCIPAL — compartilha qualquer track
  // ============================================================
  window.shareMusicUniversal = function (track) {
    // Se não recebeu track, tenta resolver o atual
    if (!track) track = getCurrentTrackUniversal();

    if (!track) {
      if (typeof showToast === 'function') {
        showToast('Nenhuma música para compartilhar', 'warning');
      }
      return;
    }

    // Normaliza: se for string (ID), tenta achar o objeto
    if (typeof track === 'string') {
      const found =
        (state.playlist || []).find(m => String(m.id) === String(track)) ||
        (state.externalPlaylist || []).find(m => String(m.id) === String(track));
      if (found) track = found;
      else track = { id: track, titulo: 'Música', artista: '' };
    }

    const tipo = _detectTrackType(track);
    const link = _buildUniversalLink(track);
    const texto = _buildUniversalText(track, tipo);
    const capa = track.link_capa ||
                 (track.link_youtube ? 'https://img.youtube.com/vi/' +
                   _extractYouTubeId(track.link_youtube) + '/hqdefault.jpg' : '/images/logo.png');

    // Atualiza o currentShareTrack (pros botões do modal funcionarem)
    window.currentShareTrack = {
      id: track.id,
      titulo: track.titulo || 'Música',
      artista: track.artista || 'Artista',
      capa: capa,
      link: link,
      tipo: tipo
    };

    console.log('[ShareUniversal v' + SHARE_VERSION + '] tipo:', tipo,
                '| link:', link, '| título:', track.titulo);

    // Atualiza o modal
    const cover = document.getElementById('sharePreviewCover');
    const title = document.getElementById('sharePreviewTitle');
    const artist = document.getElementById('sharePreviewArtist');

    if (cover) cover.src = capa;
    if (title) title.textContent = window.currentShareTrack.titulo;
    if (artist) artist.textContent = window.currentShareTrack.artista;

    // Mostra botão nativo se o navegador suportar
    const nativeBtn = document.getElementById('shareNativeBtn');
    if (nativeBtn) nativeBtn.style.display = navigator.share ? 'flex' : 'none';

    // Abre o modal
    if (typeof showModal === 'function') {
      showModal('shareModal');
    } else {
      const modal = document.getElementById('shareModal');
      if (modal) modal.classList.add('show');
    }
  };

  // ============================================================
  // 🆕 SOBRESCREVE openShareModal (compatibilidade total)
  // ============================================================
  // Aceita 0 argumentos (resolve o atual) OU 1 argumento (track)
  window.openShareModal = function (track) {
    return shareMusicUniversal(track || null);
  };

  // ============================================================
  // 🆕 WRAPPER PRA PLAYER
  // ============================================================
  // Botão do player chama isso — resolve o track atual automaticamente
  window.openShareFromPlayer = function () {
    const track = getCurrentTrackUniversal();
    if (!track) {
      if (typeof showToast === 'function') {
        showToast('Nenhuma música tocando', 'warning');
      }
      return;
    }
    shareMusicUniversal(track);
  };

  // ============================================================
  // 🆕 WRAPPER PRA CARDS (marketplace / discovery)
  // ============================================================
  window.shareMusicUniversalById = function (musicId) {
    if (!musicId) return;

    // Tenta interna
    let track = (state.playlist || []).find(m => String(m.id) === String(musicId));
    if (track) return shareMusicUniversal(track);

    // Tenta externa
    track = (state.externalPlaylist || []).find(m => String(m.id) === String(musicId));
    if (track) return shareMusicUniversal(track);

    // Tenta YouTube puro
    if (String(musicId).startsWith('yt_')) {
      const vid = String(musicId).replace('yt_', '');
      track = {
        id: 'yt_' + vid,
        titulo: 'Vídeo do YouTube',
        artista: 'YouTube',
        link_youtube: 'https://www.youtube.com/watch?v=' + vid,
        youtube: true,
        externa: true
      };
      return shareMusicUniversal(track);
    }

    if (typeof showToast === 'function') {
      showToast('Música não encontrada', 'error');
    }
  };

  // ============================================================
  // 🆕 FIX EM share.js — shareNative, shareWhatsApp, etc.
  // ============================================================
  // As funções abaixo sobrescrevem as do share.js v2.0.0 pra
  // garantirem que sempre usam o currentShareTrack atualizado.
  // (O share.js já faz isso, mas com o link canônico /s/<id>.
  //  Agora usamos o link universal — YouTube direto ou ?music=ID.)
  //
  // Se preferir manter o link canônico /s/<id>, comenta esse bloco.

  window.shareNative = async function () {
    const t = window.currentShareTrack;
    if (!t || !t.link) return;
    try {
      await navigator.share({
        title: t.titulo + (t.artista ? ' — ' + t.artista : ''),
        text: t.tipo === 'youtube'
          ? '🎵 ' + t.titulo + '\n\nOuça no YouTube'
          : '🎵 ' + t.titulo + '\n' + t.artista + '\n\nOuça no PLAY MY',
        url: t.link
      });
    } catch (e) {
      if (e.name !== 'AbortError') console.warn('shareNative erro:', e);
    }
  };

  window.shareWhatsApp = function () {
    const t = window.currentShareTrack;
    if (!t || !t.link) return;
    const texto = t.tipo === 'youtube'
      ? '🎵 ' + t.titulo + ' — ' + t.artista + '\n\nOuça no YouTube: ' + t.link
      : '🎵 ' + t.titulo + ' — ' + t.artista + '\n\nOuça no PLAY MY: ' + t.link;
    window.open('https://wa.me/?text=' + encodeURIComponent(texto), '_blank', 'noopener');
  };

  window.shareTwitter = function () {
    const t = window.currentShareTrack;
    if (!t || !t.link) return;
    const text = encodeURIComponent(
      t.tipo === 'youtube'
        ? '🎵 Ouvindo "' + t.titulo + '" de ' + t.artista + ' no YouTube!'
        : '🎵 Ouvindo "' + t.titulo + '" de ' + t.artista + ' no @PLAYMY!'
    );
    window.open(
      'https://twitter.com/intent/tweet?text=' + text + '&url=' + encodeURIComponent(t.link),
      '_blank', 'noopener'
    );
  };

  window.shareFacebook = function () {
    const t = window.currentShareTrack;
    if (!t || !t.link) return;
    window.open(
      'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(t.link),
      '_blank', 'noopener'
    );
  };

  window.shareTelegram = function () {
    const t = window.currentShareTrack;
    if (!t || !t.link) return;
    const texto = t.tipo === 'youtube'
      ? '🎵 ' + t.titulo + ' — ' + t.artista + '\n\nOuça no YouTube'
      : '🎵 ' + t.titulo + ' — ' + t.artista + '\n\nOuça no PLAY MY';
    window.open(
      'https://t.me/share/url?url=' + encodeURIComponent(t.link) +
      '&text=' + encodeURIComponent(texto),
      '_blank', 'noopener'
    );
  };

  window.shareCopyLink = async function () {
    const t = window.currentShareTrack;
    if (!t || !t.link) return;

    try {
      await navigator.clipboard.writeText(t.link);
      if (typeof showToast === 'function') showToast('✅ Link copiado!', 'success', 3000);
      setTimeout(() => {
        if (typeof closeModal === 'function') closeModal('shareModal');
      }, 1500);
    } catch (e) {
      // fallback antigo
      const ta = document.createElement('textarea');
      ta.value = t.link;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        if (typeof showToast === 'function') showToast('✅ Link copiado!', 'success');
        setTimeout(() => {
          if (typeof closeModal === 'function') closeModal('shareModal');
        }, 1500);
      } catch (err) {
        if (typeof showToast === 'function') showToast('Não foi possível copiar', 'error');
      }
      document.body.removeChild(ta);
    }
  };

  window.shareInstagram = async function () {
    const t = window.currentShareTrack;
    if (!t || !t.link) return;

    try {
      await navigator.clipboard.writeText(t.link);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = t.link;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (_) {}
      document.body.removeChild(ta);
    }

    if (typeof showToast === 'function') {
      showToast('Link copiado! Cole no seu Story', 'success', 4000);
    }

    setTimeout(() => {
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (isMobile) {
        window.location.href = 'instagram://story-camera';
        setTimeout(() => { window.location.href = 'instagram://app'; }, 800);
      } else {
        window.open('https://www.instagram.com/', '_blank', 'noopener');
      }
    }, 1200);
  };

  // ============================================================
  // 🆕 API pública
  // ============================================================
  window.shareUniversalAPI = {
    version: SHARE_VERSION,
    getCurrentTrack: getCurrentTrackUniversal,
    share: shareMusicUniversal,
    shareById: shareMusicUniversalById,
    detectType: _detectTrackType,
    buildLink: _buildUniversalLink
  };

  console.log('✅ [share-universal.js] v' + SHARE_VERSION + ' carregado — compartilhamento universal (interna + YouTube + externa)');
})();
