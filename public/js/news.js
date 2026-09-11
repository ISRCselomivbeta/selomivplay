// ============================================================
// NEWS FEED - PLAY MY v8.2
// ============================================================

const NEWS_LIKES_KEY = 'miv_news_likes_v1';
const NEWS_MOCK = [
  { id: 'n1', categoria: 'shows', autor: 'PLAY MY News', titulo: 'Turnê mundial de Elzo Henschell bate recorde de vendas em 24h', texto: 'A nova turnê esgotou ingressos em menos de um dia. Com produção internacional, o artista promete surpresas em cada cidade.', imagem: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800', timestamp: new Date(Date.now() - 3600000).toISOString(), likes: 1243 },
  { id: 'n2', categoria: 'negocios', autor: 'PLAY MY Business', titulo: 'SELO COIN valoriza 15% após anúncio de parceria internacional', texto: 'A moeda oficial do PLAY MY teve alta expressiva após o anúncio de integração com grandes players.', imagem: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800', timestamp: new Date(Date.now() - 7200000).toISOString(), likes: 892 },
  { id: 'n3', categoria: 'musica', autor: 'PLAY MY Music', titulo: 'Novo álbum de The Weeknd chega em todas as plataformas', texto: 'O aguardado sucessor de "After Hours" contará com 14 faixas inéditas.', imagem: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800', timestamp: new Date(Date.now() - 10800000).toISOString(), likes: 2156 },
  { id: 'n4', categoria: 'artistas', autor: 'PLAY MY Artistas', titulo: 'Artistas independentes agora podem tokenizar suas músicas', texto: 'Nova funcionalidade permite criar tokens e receber royalties proporcionais.', imagem: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800', timestamp: new Date(Date.now() - 14400000).toISOString(), likes: 1678 },
  { id: 'n5', categoria: 'shows', autor: 'PLAY MY News', titulo: 'Festival PLAY MY acontece em São Paulo em dezembro', texto: 'Três dias de música, arte e tecnologia com mais de 40 artistas.', imagem: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=800', timestamp: new Date(Date.now() - 18000000).toISOString(), likes: 3402 },
  { id: 'n6', categoria: 'negocios', autor: 'PLAY MY Business', titulo: 'Mercado de NFTs musicais movimenta R$ 2 bilhões', texto: 'O setor de ativos digitais musicais continua em expansão.', imagem: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800', timestamp: new Date(Date.now() - 21600000).toISOString(), likes: 756 },
  { id: 'n7', categoria: 'musica', autor: 'PLAY MY Music', titulo: 'Billboard Brasil: os 10 artistas mais ouvidos do mês', texto: 'A lista traz surpresas e consagra novos nomes da cena independente.', imagem: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800', timestamp: new Date(Date.now() - 25200000).toISOString(), likes: 1123 },
  { id: 'n8', categoria: 'artistas', autor: 'PLAY MY Artistas', titulo: 'Entrevista: a nova geração do funk brasileiro', texto: 'Conversamos com cinco artistas que estão redefinindo o gênero.', imagem: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800', timestamp: new Date(Date.now() - 28800000).toISOString(), likes: 987 },
  { id: 'n9', categoria: 'shows', autor: 'PLAY MY News', titulo: 'Rock in Rio anuncia line-up com 20 atrações internacionais', texto: 'O festival mais icônico do Brasil confirma edição histórica.', imagem: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800', timestamp: new Date(Date.now() - 36000000).toISOString(), likes: 4521 },
  { id: 'n10', categoria: 'musica', autor: 'PLAY MY Music', titulo: 'Streaming bate recorde de 5 bilhões de plays semanais', texto: 'A indústria musical digital atinge novo marco histórico.', imagem: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800', timestamp: new Date(Date.now() - 43200000).toISOString(), likes: 2311 },
  { id: 'n11', categoria: 'negocios', autor: 'PLAY MY Business', titulo: 'Grandes gravadoras investem em blockchain musical', texto: 'As principais gravadoras do mundo anunciam parcerias com plataformas Web3.', imagem: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800', timestamp: new Date(Date.now() - 50400000).toISOString(), likes: 567 },
  { id: 'n12', categoria: 'artistas', autor: 'PLAY MY Artistas', titulo: 'Artista brasileiro bate recorde de ouvintes mensais', texto: 'Nova geração da MPB conquista público global.', imagem: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800', timestamp: new Date(Date.now() - 57600000).toISOString(), likes: 1892 }
];

function getNewsLikes() { try { return JSON.parse(localStorage.getItem(NEWS_LIKES_KEY) || '{}'); } catch (e) { return {}; } }
function saveNewsLikes(l) { localStorage.setItem(NEWS_LIKES_KEY, JSON.stringify(l)); }
function isNewsLiked(id) { return !!getNewsLikes()[String(id)]; }

async function loadNewsFeed(force) {
  const c = document.getElementById('newsFeed');
  if (!c) return;
  if (force) { state.news.items = []; state.news.page = 0; state.news.hasMore = true; c.innerHTML = ''; }
  if (state.news.items.length > 0 && state.news.hasMore && !force) { appendNewsPage(); return; }
  state.news.loading = true;
  try {
    const r = await callAPI('get_news', { limit: 50, filter: state.news.filter });
    if (r && r.success && Array.isArray(r.data) && r.data.length > 0) { state.news.items = r.data; }
    else { state.news.items = NEWS_MOCK; }
  } catch (e) { state.news.items = NEWS_MOCK; }
  state.news.loading = false; state.news.page = 0; state.news.hasMore = true;
  c.innerHTML = '';
  appendNewsPage();
  setupInfiniteScroll();
}

function getFilteredNews() {
  const f = state.news.filter;
  if (f === 'all') return state.news.items;
  return state.news.items.filter(n => n.categoria === f);
}

function appendNewsPage() {
  const c = document.getElementById('newsFeed');
  const loader = document.getElementById('newsLoader');
  const end = document.getElementById('newsEnd');
  if (!c) return;
  const all = getFilteredNews();
  const start = state.news.page * 6;
  const endIdx = start + 6;
  if (start >= all.length) {
    state.news.hasMore = false;
    if (loader) loader.style.display = 'none';
    if (end) end.style.display = 'block';
    return;
  }
  const pageItems = all.slice(start, endIdx);
  if (pageItems.length === 0 && start === 0) {
    c.innerHTML = '<div class="empty-state-actionable"><i class="bi bi-newspaper empty-icon"></i><h5 class="text-muted">Nenhuma notícia nesta categoria</h5></div>';
    if (end) end.style.display = 'block';
    return;
  }
  const html = pageItems.map(n => renderNewsCard(n)).join('');
  c.insertAdjacentHTML('beforeend', html);
  state.news.page++;
  if (state.news.page * 6 >= all.length) {
    state.news.hasMore = false;
    if (loader) loader.style.display = 'none';
    if (end) end.style.display = 'block';
  }
}

function renderNewsCard(n) {
  const liked = isNewsLiked(n.id);
  const catClass = 'news-cat-' + (n.categoria || 'musica');
  const catLabel = { musica: '🎵 Música', shows: '🎤 Shows', negocios: '💰 Negócios', artistas: '⭐ Artistas' }[n.categoria] || '📰';
  const avatar = '/images/logo.png';
  return '<div class="news-card" data-news-id="' + n.id + '">' +
    '<div class="news-header">' +
      '<img src="' + avatar + '" class="news-avatar" onerror="this.style.display=\'none\'">' +
      '<div class="news-author-info">' +
        '<div class="news-author">' + (n.autor || 'PLAY MY') + '</div>' +
        '<div class="news-time">' + formatRelativeTime(n.timestamp) + '</div>' +
      '</div>' +
      '<span class="news-category ' + catClass + '">' + catLabel + '</span>' +
    '</div>' +
    (n.imagem ? '<img src="' + n.imagem + '" class="news-image" loading="lazy" onclick="openNewsImage(\'' + n.imagem + '\')" onerror="this.style.display=\'none\'">' : '') +
    '<div class="news-body">' +
      '<div class="news-title">' + (n.titulo || '') + '</div>' +
      '<div class="news-text">' + (n.texto || '') + '</div>' +
    '</div>' +
    '<div class="news-actions">' +
      '<button class="news-action-btn ' + (liked ? 'liked' : '') + '" onclick="toggleNewsLike(\'' + n.id + '\', this)">' +
        '<i class="bi bi-' + (liked ? 'heart-fill' : 'heart') + '"></i>' +
        '<span class="news-like-count">' + ((n.likes || 0) + (liked ? 1 : 0)) + '</span>' +
      '</button>' +
      '<button class="news-action-btn" onclick="shareNews(\'' + n.id + '\', event)">' +
        '<i class="bi bi-share"></i> Compartilhar' +
      '</button>' +
      '<a class="news-action-btn" href="https://www.youtube.com/results?search_query=' + encodeURIComponent(n.titulo) + '" target="_blank" style="text-decoration:none">' +
        '<i class="bi bi-play-circle"></i> Ouvir' +
      '</a>' +
    '</div>' +
  '</div>';
}

function toggleNewsLike(id, btn) {
  const likes = getNewsLikes();
  const sid = String(id);
  const wasLiked = !!likes[sid];
  if (wasLiked) delete likes[sid];
  else likes[sid] = true;
  saveNewsLikes(likes);
  btn.classList.toggle('liked', !wasLiked);
  const icon = btn.querySelector('i');
  if (icon) icon.className = 'bi bi-' + (!wasLiked ? 'heart-fill' : 'heart');
  const countEl = btn.querySelector('.news-like-count');
  if (countEl) { let n = parseInt(countEl.textContent) || 0; countEl.textContent = wasLiked ? Math.max(0, n - 1) : n + 1; }
}

function shareNews(id, ev) {
  ev.stopPropagation();
  const card = document.querySelector('[data-news-id="' + id + '"]');
  const title = card ? card.querySelector('.news-title').textContent : 'PLAY MY Notícia';
  const url = window.location.origin + '?news=' + id;
  const text = title + ' — PLAY MY';
  document.querySelectorAll('.news-share-menu').forEach(m => m.remove());
  const menu = document.createElement('div');
  menu.className = 'news-share-menu';
  menu.innerHTML =
    '<button class="news-share-item" onclick="doShare(\'whatsapp\',\'' + encodeURIComponent(text) + '\',\'' + encodeURIComponent(url) + '\')"><i class="bi bi-whatsapp" style="color:#25d366"></i> WhatsApp</button>' +
    '<button class="news-share-item" onclick="doShare(\'twitter\',\'' + encodeURIComponent(text) + '\',\'' + encodeURIComponent(url) + '\')"><i class="bi bi-twitter-x"></i> X / Twitter</button>' +
    '<button class="news-share-item" onclick="doShare(\'facebook\',\'' + encodeURIComponent(text) + '\',\'' + encodeURIComponent(url) + '\')"><i class="bi bi-facebook" style="color:#1877f2"></i> Facebook</button>' +
    '<button class="news-share-item" onclick="doShare(\'telegram\',\'' + encodeURIComponent(text) + '\',\'' + encodeURIComponent(url) + '\')"><i class="bi bi-telegram" style="color:#0088cc"></i> Telegram</button>' +
    '<button class="news-share-item" onclick="copyShareLink(\'' + url + '\')"><i class="bi bi-link-45deg"></i> Copiar link</button>' +
    (navigator.share ? '<button class="news-share-item" onclick="nativeShare(\'' + encodeURIComponent(text) + '\',\'' + encodeURIComponent(url) + '\')"><i class="bi bi-phone"></i> Mais opções...</button>' : '');
  document.body.appendChild(menu);
  const rect = ev.currentTarget.getBoundingClientRect();
  menu.style.left = Math.max(10, rect.left - 100) + 'px';
  menu.style.top = (rect.bottom + window.scrollY + 8) + 'px';
  setTimeout(() => {
    document.addEventListener('click', function closeMenu(e) {
      if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', closeMenu); }
    });
  }, 100);
}

function doShare(network, text, url) {
  const urls = {
    whatsapp: 'https://wa.me/?text=' + text + '%20' + url,
    twitter: 'https://twitter.com/intent/tweet?text=' + text + '&url=' + url,
    facebook: 'https://www.facebook.com/sharer/sharer.php?u=' + url,
    telegram: 'https://t.me/share/url?url=' + url + '&text=' + text
  };
  if (urls[network]) window.open(urls[network], '_blank', 'noopener,width=600,height=500');
  document.querySelectorAll('.news-share-menu').forEach(m => m.remove());
}
function copyShareLink(url) { navigator.clipboard.writeText(url).then(() => showToast('🔗 Link copiado!', 'success')); document.querySelectorAll('.news-share-menu').forEach(m => m.remove()); }
function nativeShare(text, url) { if (navigator.share) navigator.share({ title: 'PLAY MY', text: decodeURIComponent(text), url: decodeURIComponent(url) }).catch(() => {}); document.querySelectorAll('.news-share-menu').forEach(m => m.remove()); }
function openNewsImage(url) { window.open(url, '_blank'); }

function filterNews(cat, btn) {
  state.news.filter = cat; state.news.page = 0; state.news.hasMore = true;
  document.querySelectorAll('#newsFilters .btn').forEach(b => { b.classList.remove('btn-warning'); b.classList.add('btn-outline-warning'); });
  if (btn) { btn.classList.remove('btn-outline-warning'); btn.classList.add('btn-warning'); }
  const c = document.getElementById('newsFeed'); if (c) c.innerHTML = '';
  const loader = document.getElementById('newsLoader'); if (loader) loader.style.display = 'none';
  const end = document.getElementById('newsEnd'); if (end) end.style.display = 'none';
  appendNewsPage();
  setupInfiniteScroll();
}

let newsScrollSetup = false;
function setupInfiniteScroll() {
  if (newsScrollSetup) return;
  newsScrollSetup = true;
  window.addEventListener('scroll', () => {
    const section = document.getElementById('newsSection');
    if (!section || !section.classList.contains('active')) return;
    const scrollY = window.scrollY + window.innerHeight;
    const docH = document.documentElement.scrollHeight;
    if (scrollY >= docH - 400 && state.news.hasMore && !state.news.loading) {
      const loader = document.getElementById('newsLoader');
      if (loader) loader.style.display = 'block';
      setTimeout(() => { appendNewsPage(); if (loader) loader.style.display = 'none'; }, 400);
    }
  });
}

window.loadNewsFeed = loadNewsFeed;
window.filterNews = filterNews;
window.toggleNewsLike = toggleNewsLike;
window.shareNews = shareNews;
window.doShare = doShare;
window.copyShareLink = copyShareLink;
window.nativeShare = nativeShare;
window.openNewsImage = openNewsImage;
window.renderNewsCard = renderNewsCard;
window.appendNewsPage = appendNewsPage;
window.setupInfiniteScroll = setupInfiniteScroll;
