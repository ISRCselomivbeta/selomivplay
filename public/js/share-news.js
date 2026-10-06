// ============================================================
// js/share-news.js — PLAY MY v1.0.1
// Compartilhamento de notícias (link canônico /n/<id> + preview OG)
// Depende de: news-unified.js (window.__pmNewsItems), modals.js
// Carrega DEPOIS de news-unified.js e ANTES de app.js
// ============================================================

const SHARE_NEWS_PRODUCTION_DOMAIN = 'https://playmy.com.br';

function _shareNewsBuildCanonicalUrl(newsId) {
    return `${SHARE_NEWS_PRODUCTION_DOMAIN}/n/${encodeURIComponent(newsId)}`;
}

function _shareNewsShortText(noticia) {
    return `📰 ${noticia.titulo}\n\nLeia no PLAY MY`;
}

function _shareNewsFullText(noticia) {
    return `📰 ${noticia.titulo} — ${noticia.fonte}\n\n${noticia.link}`;
}

window.openNewsShareModal = function (newsId) {
    let noticia = null;

    // 1) Busca no array exposto pelo news-unified.js
    if (window.__pmNewsItems && Array.isArray(window.__pmNewsItems)) {
        noticia = window.__pmNewsItems.find(n => String(n.id) === String(newsId));
    }

    // 2) Fallback: pega do DOM
    if (!noticia) {
        const article = document.querySelector(`article[data-news-id="${newsId}"]`);
        if (article) {
            const img = article.querySelector('img');
            const tituloEl = article.querySelector('div[style*="font-weight:700"]');
            noticia = {
                id: newsId,
                titulo: tituloEl ? tituloEl.textContent : 'Notícia',
                fonte: 'PLAY MY',
                imagem: img ? img.src : null
            };
        }
    }

    if (!noticia) {
        if (typeof showToast === 'function') showToast('Notícia não encontrada', 'warning');
        return;
    }

    window.currentShareNews = {
        id: noticia.id,
        titulo: noticia.titulo,
        fonte: noticia.fonte || 'PLAY MY',
        imagem: noticia.imagem || '/images/logo.png',
        link: _shareNewsBuildCanonicalUrl(noticia.id)
    };

    const cover = document.getElementById('shareNewsPreviewCover');
    const title = document.getElementById('shareNewsPreviewTitle');
    const fonte = document.getElementById('shareNewsPreviewFonte');

    if (cover) cover.src = window.currentShareNews.imagem;
    if (title) title.textContent = window.currentShareNews.titulo;
    if (fonte) fonte.textContent = window.currentShareNews.fonte;

    const nativeBtn = document.getElementById('shareNewsNativeBtn');
    if (nativeBtn) nativeBtn.style.display = navigator.share ? 'flex' : 'none';

    if (typeof showModal === 'function') showModal('shareNewsModal');
};

window.shareNewsNative = async function () {
    const n = window.currentShareNews;
    if (!n) return;
    try {
        await navigator.share({
            title: n.titulo,
            text: _shareNewsShortText(n),
            url: n.link
        });
    } catch (e) {
        if (e.name !== 'AbortError') console.warn('Erro:', e);
    }
};

window.shareNewsWhatsApp = function () {
    const n = window.currentShareNews;
    if (!n) return;
    const url = `https://wa.me/?text=${encodeURIComponent(_shareNewsFullText(n))}`;
    window.open(url, '_blank', 'noopener');
};

window.shareNewsTwitter = function () {
    const n = window.currentShareNews;
    if (!n) return;
    const text = encodeURIComponent(`📰 ${n.titulo}`);
    const url = `https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(n.link)}`;
    window.open(url, '_blank', 'noopener');
};

window.shareNewsFacebook = function () {
    const n = window.currentShareNews;
    if (!n) return;
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(n.link)}`;
    window.open(url, '_blank', 'noopener');
};

window.shareNewsTelegram = function () {
    const n = window.currentShareNews;
    if (!n) return;
    const url = `https://t.me/share/url?url=${encodeURIComponent(n.link)}&text=${encodeURIComponent(_shareNewsShortText(n))}`;
    window.open(url, '_blank', 'noopener');
};

window.shareNewsCopyLink = async function () {
    const n = window.currentShareNews;
    if (!n) return;

    try {
        await navigator.clipboard.writeText(n.link);
        if (typeof showToast === 'function') showToast('✅ Link copiado!', 'success', 3000);
        setTimeout(() => {
            if (typeof closeModal === 'function') closeModal('shareNewsModal');
        }, 1500);
    } catch (e) {
        const ta = document.createElement('textarea');
        ta.value = n.link;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try {
            document.execCommand('copy');
            if (typeof showToast === 'function') showToast('✅ Link copiado!', 'success');
            setTimeout(() => {
                if (typeof closeModal === 'function') closeModal('shareNewsModal');
            }, 1500);
        } catch (err) {
            if (typeof showToast === 'function') showToast('Não foi possível copiar', 'error');
        }
        document.body.removeChild(ta);
    }
};

console.log('✅ [share-news.js] v1.0.1 carregado');
