// ============================================================
// js/share.js — PLAY MY v1.0.0
// Sistema de compartilhamento social
// ============================================================

window.currentShareTrack = null;

window.openShareModal = function () {
    const track = window.currentTrack || (typeof state !== 'undefined' ? state.currentTrack : null);

    if (!track || !track.titulo) {
        if (typeof showToast === 'function') showToast('Nenhuma música tocando', 'warning');
        return;
    }

    window.currentShareTrack = {
        id: track.id,
        titulo: track.titulo,
        artista: track.artista || 'Artista',
        capa: track.link_capa || '/images/logo.png',
        link: generateShareLink(track)
    };

    const cover = document.getElementById('sharePreviewCover');
    const title = document.getElementById('sharePreviewTitle');
    const artist = document.getElementById('sharePreviewArtist');

    if (cover) cover.src = window.currentShareTrack.capa;
    if (title) title.textContent = window.currentShareTrack.titulo;
    if (artist) artist.textContent = window.currentShareTrack.artista;

    const nativeBtn = document.getElementById('shareNativeBtn');
    if (nativeBtn) nativeBtn.style.display = navigator.share ? 'flex' : 'none';

    if (typeof showModal === 'function') showModal('shareModal');
};

function generateShareLink(track) {
    const baseUrl = window.location.origin;
    const params = new URLSearchParams({
        music: track.id,
        title: track.titulo,
        artist: track.artista || 'Artista'
    });
    return `${baseUrl}/?${params.toString()}`;
}

function getShareText(track) {
    return `🎵 Estou ouvindo "${track.titulo}" de ${track.artista} no PLAY MY!\n\n${track.link}`;
}

window.shareNative = async function () {
    const t = window.currentShareTrack;
    if (!t) return;
    try {
        await navigator.share({
            title: `${t.titulo} - ${t.artista} | PLAY MY`,
            text: getShareText(t),
            url: t.link
        });
    } catch (e) {
        if (e.name !== 'AbortError') console.warn('Erro:', e);
    }
};

window.shareWhatsApp = function () {
    const t = window.currentShareTrack;
    if (!t) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(getShareText(t))}`, '_blank', 'noopener');
};

window.shareInstagram = async function () {
    const t = window.currentShareTrack;
    if (!t) return;
    try {
        await navigator.clipboard.writeText(getShareText(t));
        if (typeof showToast === 'function') showToast('Link copiado! Cole no seu Story', 'success', 4000);
        setTimeout(() => {
            const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
            if (isMobile) window.location.href = 'instagram://camera';
            else window.open('https://www.instagram.com/', '_blank');
        }, 1000);
    } catch (e) {
        if (typeof showToast === 'function') showToast('Não foi possível copiar', 'error');
    }
};

window.shareTwitter = function () {
    const t = window.currentShareTrack;
    if (!t) return;
    const text = encodeURIComponent(`🎵 Ouvindo "${t.titulo}" de ${t.artista} no @PLAYMY!`);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(t.link)}`, '_blank', 'noopener');
};

window.shareFacebook = function () {
    const t = window.currentShareTrack;
    if (!t) return;
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(t.link)}`, '_blank', 'noopener');
};

window.shareTelegram = function () {
    const t = window.currentShareTrack;
    if (!t) return;
    window.open(`https://t.me/share/url?url=${encodeURIComponent(t.link)}&text=${encodeURIComponent(getShareText(t))}`, '_blank', 'noopener');
};

window.shareCopyLink = async function () {
    const t = window.currentShareTrack;
    if (!t) return;
    try {
        await navigator.clipboard.writeText(getShareText(t));
        if (typeof showToast === 'function') showToast('✅ Link copiado!', 'success', 3000);
        setTimeout(() => {
            if (typeof closeModal === 'function') closeModal('shareModal');
        }, 1500);
    } catch (e) {
        const ta = document.createElement('textarea');
        ta.value = getShareText(t);
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); if (typeof showToast === 'function') showToast('✅ Link copiado!', 'success'); }
        catch (err) { if (typeof showToast === 'function') showToast('Não foi possível copiar', 'error'); }
        document.body.removeChild(ta);
    }
};

console.log('✅ [share.js] v1.0.0 carregado');
