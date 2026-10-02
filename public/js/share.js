// ============================================================
// js/share.js — PLAY MY v2.0.0
// Compartilhamento estilo Spotify (link canônico + preview OG)
//
// MUDANÇAS v2.0.0:
//   - 🎯 Link canônico /s/<id> (igual Spotify /track/<id>)
//   - 🔗 Remove duplicação de link no texto compartilhado
//   - 🖼️ Preview OG rica (imagem + título + artista)
//   - 📱 Instagram Stories via clipboard + intent
//   - ✅ Fallback universal se navigator.share falhar
//
// Compatível com:
//   - Desktop: navegador abre a URL
//   - Android: intent nativo
//   - iOS: share sheet nativo
// ============================================================

window.currentShareTrack = null;

// ============================================================
// HELPER — monta URL canônica /s/<id>
// ============================================================
function _shareBuildCanonicalUrl(track) {
    const origin = window.location.origin;
    const id = track.id ? encodeURIComponent(track.id) : 'unknown';
    return `${origin}/s/${id}`;
}

// ============================================================
// HELPER — texto curto (SEM duplicar link)
// WhatsApp/Facebook/Telegram já adicionam o link automaticamente
// ============================================================
function _shareShortText(track) {
    return `🎵 ${track.titulo} — ${track.artista}\n\nOuça no PLAY MY`;
}

// ============================================================
// HELPER — texto completo (quando precisa do link no corpo)
// ============================================================
function _shareFullText(track) {
    return `🎵 Estou ouvindo "${track.titulo}" de ${track.artista} no PLAY MY!\n\n${track.link}`;
}

// ============================================================
// ABRIR MODAL DE COMPARTILHAMENTO
// ============================================================
window.openShareModal = function () {
    // Fonte do track: window.currentTrack OU state.currentTrack
    // OU a música atualmente tocando em state.playlist[state.currentTrackIndex]
    let track = window.currentTrack;

    if (!track && typeof state !== 'undefined') {
        track = state.currentTrack;

        if (!track && state.playlist && Array.isArray(state.playlist)
            && typeof state.currentTrackIndex === 'number'
            && state.currentTrackIndex >= 0) {
            track = state.playlist[state.currentTrackIndex];
        }
    }

    if (!track || !track.titulo) {
        if (typeof showToast === 'function') showToast('Nenhuma música tocando', 'warning');
        return;
    }

    window.currentShareTrack = {
        id: track.id,
        titulo: track.titulo,
        artista: track.artista || 'Artista',
        capa: track.link_capa || '/images/logo.png',
        link: _shareBuildCanonicalUrl(track)
    };

    const cover = document.getElementById('sharePreviewCover');
    const title = document.getElementById('sharePreviewTitle');
    const artist = document.getElementById('sharePreviewArtist');

    if (cover) cover.src = window.currentShareTrack.capa;
    if (title) title.textContent = window.currentShareTrack.titulo;
    if (artist) artist.textContent = window.currentShareTrack.artista;

    // Mostra botão nativo só se o navegador suportar
    const nativeBtn = document.getElementById('shareNativeBtn');
    if (nativeBtn) nativeBtn.style.display = navigator.share ? 'flex' : 'none';

    if (typeof showModal === 'function') showModal('shareModal');
};

// ============================================================
// COMPARTILHAMENTO NATIVO (share sheet do SO)
// ============================================================
window.shareNative = async function () {
    const t = window.currentShareTrack;
    if (!t) return;
    try {
        await navigator.share({
            title: `${t.titulo} — ${t.artista}`,
            text: _shareShortText(t),
            url: t.link
        });
    } catch (e) {
        if (e.name !== 'AbortError') console.warn('Erro:', e);
    }
};

// ============================================================
// WHATSAPP
// ============================================================
window.shareWhatsApp = function () {
    const t = window.currentShareTrack;
    if (!t) return;
    // whatsapp: o link fica em URL separado, texto curto
    const url = `https://wa.me/?text=${encodeURIComponent(_shareFullText(t))}`;
    window.open(url, '_blank', 'noopener');
};

// ============================================================
// INSTAGRAM (Stories / Direct)
// ============================================================
window.shareInstagram = async function () {
    const t = window.currentShareTrack;
    if (!t) return;

    // Instagram não tem "share intent" público no browser.
    // Estratégia Spotify-like:
    //   1) Copia o link
    //   2) Abre o Instagram (Stories se mobile)
    //   3) Usuário cola o link manualmente no sticker

    try {
        await navigator.clipboard.writeText(t.link);
    } catch (e) {
        // fallback antigo
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

    // Abre Instagram
    setTimeout(() => {
        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        if (isMobile) {
            // Tenta abrir Stories; se falhar, cai no app principal
            window.location.href = 'instagram://story-camera';
            setTimeout(() => {
                window.location.href = 'instagram://app';
            }, 800);
        } else {
            window.open('https://www.instagram.com/', '_blank', 'noopener');
        }
    }, 1200);
};

// ============================================================
// TWITTER / X
// ============================================================
window.shareTwitter = function () {
    const t = window.currentShareTrack;
    if (!t) return;
    const text = encodeURIComponent(`🎵 Ouvindo "${t.titulo}" de ${t.artista} no @PLAYMY!`);
    const url = `https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(t.link)}`;
    window.open(url, '_blank', 'noopener');
};

// ============================================================
// FACEBOOK
// ============================================================
window.shareFacebook = function () {
    const t = window.currentShareTrack;
    if (!t) return;
    // Facebook: só passa a URL (ele lê OG tags)
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(t.link)}`;
    window.open(url, '_blank', 'noopener');
};

// ============================================================
// TELEGRAM
// ============================================================
window.shareTelegram = function () {
    const t = window.currentShareTrack;
    if (!t) return;
    const url = `https://t.me/share/url?url=${encodeURIComponent(t.link)}&text=${encodeURIComponent(_shareShortText(t))}`;
    window.open(url, '_blank', 'noopener');
};

// ============================================================
// COPIAR LINK
// ============================================================
window.shareCopyLink = async function () {
    const t = window.currentShareTrack;
    if (!t) return;

    try {
        await navigator.clipboard.writeText(t.link);
        if (typeof showToast === 'function') showToast('✅ Link copiado!', 'success', 3000);
        setTimeout(() => {
            if (typeof closeModal === 'function') closeModal('shareModal');
        }, 1500);
    } catch (e) {
        // fallback universal
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

console.log('✅ [share.js] v2.0.0 carregado — compartilhamento estilo Spotify');
