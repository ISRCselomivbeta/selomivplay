// ============================================================
// js/share-universal.js — PLAY MY v1.2.2
// Compartilhamento universal: TUDO leva ao PLAY MY
//
// MUDANÇAS v1.2.2:
//   - 🔒 BLINDAGEM: nunca deixa link do YouTube vazar
//        (se detectar youtube.com/youtu.be, reconstrói com /s/yt_)
//   - 🔒 BLINDAGEM: força PLAY MY em qualquer link compartilhado
//   - ✅ NADA MAIS MUDOU — todo o resto é idêntico ao v1.2.1
//
// MUDANÇAS v1.2.1:
//   - 🐛 FIX: getCurrentTrackUniversal agora cobre 8 fallbacks
//   - 🐛 FIX: card "Ouvindo" do Discovery agora compartilha OK
//
// MUDANÇAS v1.2.0:
//   - 🆕 shareArtistUniversal(): compartilha link do artista
//   - 🆕 Suporte a ?artist=ID na URL
// ============================================================

(function () {
  'use strict';

  const SHARE_VERSION = '1.2.2';

  function _extractYouTubeId(url) {
    if (!url) return null;
    if (typeof extractYouTubeId === 'function') {
      try { return extractYouTubeId(url); } catch (e) {}
    }
    const m = String(url).match(/[?&]v=([^&]+)/) ||
              String(url).match(/youtu\.be\/([^?]+)/);
    return m ? m[1] : null;
  }

  function _makeYouTubeTrack(obj) {
    if (!obj) return null;
    const vid = _extractYouTubeId(obj.link_youtube) ||
                String(obj.id || '').replace('yt_', '');
    if (!vid) return null;
    return {
      id: 'yt_' + vid,
      titulo: obj.titulo || 'Vídeo do YouTube',
      artista: obj.artista || 'YouTube',
      link_youtube: 'https://www.youtube.com/watch?v=' + vid,
      youtube: true,
      externa: true,
      genero: 'YouTube'
    };
  }

  // ============================================================
  // RESOLVE O TRACK ATUAL — v1.2.2
  // ============================================================
  window.getCurrentTrackUniversal = function () {
    try {
      // Fallback 1: playQueue
      if (window.playQueue &&
          Array.isArray(playQueue.items) &&
          playQueue.items.length > 0 &&
          typeof playQueue.currentIndex === 'number' &&
          playQueue.currentIndex >= 0) {

        const item = playQueue.items[playQueue.currentIndex];
        if (item) {
          if (item.index === -1 && item.youtubeData) {
            return _makeYouTubeTrack({
              id: 'yt_' + item.youtubeData.videoId,
              titulo: item.youtubeData.titulo,
              artista: item.youtubeData.artista,
              link_youtube: 'https://www.youtube.com/watch?v=' + item.youtubeData.videoId
            });
          }
          if (item.type === 'internal' && item.index >= 0 && state.playlist[item.index]) {
            return state.playlist[item.index];
          }
          if (item.type === 'external' && item.index >= 0 &&
              state.externalPlaylist && state.externalPlaylist[item.index]) {
            return state.externalPlaylist[item.index];
          }
        }
      }

      // Fallback 2: _currentYouTubeTrack
      if (state._currentYouTubeTrack) {
        const yt = _makeYouTubeTrack(state._currentYouTubeTrack);
        if (yt) return yt;
      }

      // Fallback 3: _lastYouTubeTrack
      if (state._lastYouTubeTrack) {
        const yt = _makeYouTubeTrack(state._lastYouTubeTrack);
        if (yt) return yt;
      }

      // Fallback 4: currentTrackIndex >= 2000 (YouTube)
      if (typeof state.currentTrackIndex === 'number' &&
          state.currentTrackIndex >= 2000) {
        const yt = _makeYouTubeTrack(state._currentYouTubeTrack) ||
                   _makeYouTubeTrack(state._lastYouTubeTrack);
        if (yt) return yt;
      }

      // Fallback 5: currentTrackIndex 1000-2000 (externa)
      if (typeof state.currentTrackIndex === 'number' &&
          state.currentTrackIndex >= 1000 &&
          state.currentTrackIndex < 2000 &&
          state.externalPlaylist) {
        const extIdx = state.currentTrackIndex - 1000;
        return state.externalPlaylist[extIdx] || null;
      }

      // Fallback 6: currentTrackIndex normal (interna)
      if (typeof state.currentTrackIndex === 'number' &&
          state.currentTrackIndex >= 0 &&
          state.playlist &&
          state.playlist[state.currentTrackIndex]) {
        return state.playlist[state.currentTrackIndex];
      }

      // Fallback 7: window.currentTrack
      if (window.currentTrack) return window.currentTrack;

      // Fallback 8: DOM do player
      try {
        const selectors = [
          '#expandedPlayerTitle',
          '#playerTitle',
          '#pm-player-title',
          '[data-current-title]',
          '.expanded-player-title',
          '.player-title'
        ];
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el && el.textContent && el.textContent.trim()) {
            return {
              id: 'unknown_' + Date.now(),
              titulo: el.textContent.trim(),
              artista: '',
              youtube: false,
              externa: false
            };
          }
        }
      } catch (e) {}

      return null;
    } catch (e) {
      console.warn('[ShareUniversal] erro getCurrentTrackUniversal:', e.message);
      return null;
    }
  };

  // ============================================================
  // DETECTA TIPO
  // ============================================================
  function _detectTrackType(track) {
    if (!track) return 'unknown';
    if (track.id && String(track.id).startsWith('yt_')) return 'youtube';
    if (track.youtube === true) return 'youtube';
    if (track.is_youtube === true) return 'youtube';
    if (track.external_id) return 'externa';
    if (track.externa === true) return 'externa';
    if (track.valor_acao !== undefined && track.valor_acao !== null) return 'interna';
    return 'unknown';
  }

  // ============================================================
  // MONTA LINK — TUDO VAI PRO PLAY MY
  // ============================================================
  function _buildUniversalLink(track) {
    const tipo = _detectTrackType(track);
    const origin = window.location.origin;

    if (tipo === 'youtube') {
      const vid = _extractYouTubeId(track.link_youtube) ||
                  String(track.id || '').replace('yt_', '');
      if (vid) return origin + '/s/yt_' + encodeURIComponent(vid);
      return null;
    }

    // Interna OU externa
    if (track.id && !String(track.id).startsWith('unknown_')) {
      return origin + '/s/' + encodeURIComponent(track.id);
    }

    // Fallback: se só tem titulo
    if (track.titulo) {
      return origin + '/?share=' + encodeURIComponent(track.titulo);
    }

    return null;
  }

  // ============================================================
  // 🆕 v1.2.2 — BLINDAGEM: força link PLAY MY
  // ============================================================
  function _forcePlayMyLink(link, track) {
    // Se link já é do PLAY MY, retorna como está
    if (link &&
        link.indexOf('playmy.com.br') !== -1 &&
        link.indexOf('youtube.com') === -1 &&
        link.indexOf('youtu.be') === -1) {
      return link;
    }

    console.warn('[ShareUniversal] 🚨 link inválido detectado:', link, '— reconstruindo...');

    const origin = window.location.origin;

    // Se é YouTube, reconstrói como /s/yt_XXX
    if (track) {
      const vid = _extractYouTubeId(track.link_youtube) ||
                  String(track.id || '').replace('yt_', '');
      if (vid) {
        return origin + '/s/yt_' + encodeURIComponent(vid);
      }

      // Se tem ID, usa como /s/ID
      if (track.id && !String(track.id).startsWith('unknown_')) {
        return origin + '/s/' + encodeURIComponent(track.id);
      }

      // Se só tem título, usa /?share=titulo
      if (track.titulo) {
        return origin + '/?share=' + encodeURIComponent(track.titulo);
      }
    }

    // Último recurso: home
    return origin;
  }

  // ============================================================
  // MONTA LINK DO ARTISTA
  // ============================================================
  function _buildArtistLink(artistId, nome) {
    if (!artistId) return null;
    const origin = window.location.origin;
    const id = String(artistId).startsWith('artist_')
      ? String(artistId)
      : 'artist_' + String(artistId).toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    return origin + '/s/' + encodeURIComponent(id);
  }

  // ============================================================
  // COMPARTILHAR MÚSICA — v1.2.2 BLINDADO
  // ============================================================
  window.shareMusicUniversal = function (track) {
    if (!track) track = getCurrentTrackUniversal();

    if (!track) {
      if (typeof showToast === 'function') {
        showToast('Nenhuma música para compartilhar', 'warning');
      }
      return;
    }

    if (typeof track === 'string') {
      const found =
        (state.playlist || []).find(m => String(m.id) === String(track)) ||
        (state.externalPlaylist || []).find(m => String(m.id) === String(track));
      if (found) track = found;
      else track = { id: track, titulo: 'Música', artista: '' };
    }

    const tipo = _detectTrackType(track);
    let link = _buildUniversalLink(track);

    // 🆕 v1.2.2 — BLINDAGEM: se link não for PLAY MY, força
    link = _forcePlayMyLink(link, track);

    const capa = track.link_capa ||
                 (track.link_youtube ? 'https://img.youtube.com/vi/' +
                   _extractYouTubeId(track.link_youtube) + '/hqdefault.jpg' : '/images/logo.png');

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

    const cover = document.getElementById('sharePreviewCover');
    const title = document.getElementById('sharePreviewTitle');
    const artist = document.getElementById('sharePreviewArtist');

    if (cover) cover.src = capa;
    if (title) title.textContent = window.currentShareTrack.titulo;
    if (artist) artist.textContent = window.currentShareTrack.artista;

    const nativeBtn = document.getElementById('shareNativeBtn');
    if (nativeBtn) nativeBtn.style.display = navigator.share ? 'flex' : 'none';

    if (typeof showModal === 'function') {
      showModal('shareModal');
    } else {
      const modal = document.getElementById('shareModal');
      if (modal) modal.classList.add('show');
    }
  };

  // ============================================================
  // COMPARTILHAR ARTISTA
  // ============================================================
  window.shareArtistUniversal = function (artistId, nome, avatar) {
    if (!artistId || !nome) {
      if (typeof showToast === 'function') {
        showToast('Artista inválido', 'warning');
      }
      return;
    }

    const link = _buildArtistLink(artistId, nome);
    const capa = avatar || '/images/logo.png';

    window.currentShareTrack = {
      id: artistId,
      titulo: nome,
      artista: 'Artista no PLAY MY',
      capa: capa,
      link: link,
      tipo: 'artista'
    };

    console.log('[ShareUniversal v' + SHARE_VERSION + '] ARTISTA:', nome, '| link:', link);

    const cover = document.getElementById('sharePreviewCover');
    const title = document.getElementById('sharePreviewTitle');
    const artist = document.getElementById('sharePreviewArtist');

    if (cover) cover.src = capa;
    if (title) title.textContent = nome;
    if (artist) artist.textContent = '⭐ Seguir no PLAY MY';

    const nativeBtn = document.getElementById('shareNativeBtn');
    if (nativeBtn) nativeBtn.style.display = navigator.share ? 'flex' : 'none';

    if (typeof showModal === 'function') {
      showModal('shareModal');
    } else {
      const modal = document.getElementById('shareModal');
      if (modal) modal.classList.add('show');
    }
  };

  // ============================================================
  // SOBRESCREVE openShareModal
  // ============================================================
  window.openShareModal = function (track) {
    return shareMusicUniversal(track || null);
  };

  // ============================================================
  // WRAPPER PRA PLAYER
  // ============================================================
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
  // WRAPPER PRA CARDS DE MÚSICA
  // ============================================================
  window.shareMusicUniversalById = function (musicId) {
    if (!musicId) return;

    let track = (state.playlist || []).find(m => String(m.id) === String(musicId));
    if (track) return shareMusicUniversal(track);

    track = (state.externalPlaylist || []).find(m => String(m.id) === String(musicId));
    if (track) return shareMusicUniversal(track);

    if (String(musicId).startsWith('yt_')) {
      const vid = String(musicId).replace('yt_', '');
      track = _makeYouTubeTrack({
        id: 'yt_' + vid,
        titulo: 'Vídeo do YouTube',
        artista: 'YouTube',
        link_youtube: 'https://www.youtube.com/watch?v=' + vid
      });
      if (track) return shareMusicUniversal(track);
    }

    const current = getCurrentTrackUniversal();
    if (current && String(current.id) === String(musicId)) {
      return shareMusicUniversal(current);
    }

    if (typeof showToast === 'function') {
      showToast('Música não encontrada', 'error');
    }
  };

  // ============================================================
  // WRAPPER PRA CARDS DE ARTISTA
  // ============================================================
  window.shareArtistUniversalById = function (artistId) {
    if (!artistId) return;

    const artist = (state.artists || []).find(a => String(a.id) === String(artistId));
    if (artist) {
      return shareArtistUniversal(artist.id, artist.nome, artist.avatar);
    }

    const nome = String(artistId)
      .replace(/^artist_/, '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());

    return shareArtistUniversal(artistId, nome, null);
  };

  // ============================================================
  // FUNÇÕES DE SHARE — SEMPRE PLAY MY
  // ============================================================
  window.shareNative = async function () {
    const t = window.currentShareTrack;
    if (!t || !t.link) return;

    // 🆕 v1.2.2 — blinda antes de compartilhar
    t.link = _forcePlayMyLink(t.link, t);

    try {
      await navigator.share({
        title: t.titulo + (t.artista ? ' — ' + t.artista : ''),
        text: '🎵 ' + t.titulo + '\n' + t.artista + '\n\nOuça no PLAY MY',
        url: t.link
      });
    } catch (e) {
      if (e.name !== 'AbortError') console.warn('shareNative erro:', e);
    }
  };

  window.shareWhatsApp = function () {
    const t = window.currentShareTrack;
    if (!t || !t.link) return;
    t.link = _forcePlayMyLink(t.link, t);
    const texto = '🎵 ' + t.titulo + ' — ' + t.artista + '\n\nOuça no PLAY MY: ' + t.link;
    window.open('https://wa.me/?text=' + encodeURIComponent(texto), '_blank', 'noopener');
  };

  window.shareTwitter = function () {
    const t = window.currentShareTrack;
    if (!t || !t.link) return;
    t.link = _forcePlayMyLink(t.link, t);
    const text = encodeURIComponent(
      '🎵 Ouvindo "' + t.titulo + '" de ' + t.artista + ' no @PLAYMY!'
    );
    window.open(
      'https://twitter.com/intent/tweet?text=' + text + '&url=' + encodeURIComponent(t.link),
      '_blank', 'noopener'
    );
  };

  window.shareFacebook = function () {
    const t = window.currentShareTrack;
    if (!t || !t.link) return;
    t.link = _forcePlayMyLink(t.link, t);
    window.open(
      'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(t.link),
      '_blank', 'noopener'
    );
  };

  window.shareTelegram = function () {
    const t = window.currentShareTrack;
    if (!t || !t.link) return;
    t.link = _forcePlayMyLink(t.link, t);
    const texto = '🎵 ' + t.titulo + ' — ' + t.artista + '\n\nOuça no PLAY MY';
    window.open(
      'https://t.me/share/url?url=' + encodeURIComponent(t.link) +
      '&text=' + encodeURIComponent(texto),
      '_blank', 'noopener'
    );
  };

  window.shareCopyLink = async function () {
    const t = window.currentShareTrack;
    if (!t || !t.link) return;

    // 🆕 v1.2.2 — blinda antes de copiar
    t.link = _forcePlayMyLink(t.link, t);

    try {
      await navigator.clipboard.writeText(t.link);
      if (typeof showToast === 'function') showToast('✅ Link copiado!', 'success', 3000);
      setTimeout(() => {
        if (typeof closeModal === 'function') closeModal('shareModal');
      }, 1500);
    } catch (e) {
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

    t.link = _forcePlayMyLink(t.link, t);

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
  // API pública
  // ============================================================
  window.shareUniversalAPI = {
    version: SHARE_VERSION,
    getCurrentTrack: getCurrentTrackUniversal,
    share: shareMusicUniversal,
    shareById: shareMusicUniversalById,
    shareArtist: shareArtistUniversal,
    shareArtistById: shareArtistUniversalById,
    buildArtistLink: _buildArtistLink,
    forcePlayMyLink: _forcePlayMyLink,
    detectType: _detectTrackType,
    buildLink: _buildUniversalLink
  };

  console.log('✅ [share-universal.js] v' + SHARE_VERSION + ' carregado — TODO link leva ao PLAY MY (blindado)');
})();
