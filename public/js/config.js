// ============================================================
// CONFIG.JS - Configurações globais PLAY MY
// ============================================================

const CONFIG = {
    API_URL: '/api/backend',
    DEV_MODE: false,
    VERSION: '7.1.0',
    MERCADO_PAGO_LINK: 'https://link.mercadopago.com.br/selomiv',
    BLOCKCHAIN_ENABLED: true,
    YOUTUBE_API_KEY: 'AIzaSyAPaYGY_MrrNgKdEqTs3Qw7tPNv5p5QwPM'
};

const PLACEHOLDERS = {
    MIV_56: 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'56\' height=\'56\' viewBox=\'0 0 56 56\'%3E%3Crect width=\'56\' height=\'56\' fill=\'%231a1e24\'/%3E%3Ccircle cx=\'28\' cy=\'28\' r=\'24\' fill=\'%2300ff88\' stroke=\'%23ffffff\' stroke-width=\'2\'/%3E%3Ctext x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\' font-family=\'Arial, sans-serif\' font-size=\'18\' font-weight=\'bold\' fill=\'%23000000\'%3ESM%3C/text%3E%3C/svg%3E',
    MIV_300: 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'300\' height=\'300\' viewBox=\'0 0 300 300\'%3E%3Crect width=\'300\' height=\'300\' fill=\'%231a1e24\'/%3E%3Ccircle cx=\'150\' cy=\'150\' r=\'130\' fill=\'%2300ff88\' stroke=\'%23ffffff\' stroke-width=\'4\'/%3E%3Ctext x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\' font-family=\'Arial, sans-serif\' font-size=\'60\' font-weight=\'bold\' fill=\'%23000000\'%3ESELO%3C/text%3E%3Ctext x=\'50%25\' y=\'65%25\' text-anchor=\'middle\' dy=\'.3em\' font-family=\'Arial, sans-serif\' font-size=\'40\' font-weight=\'bold\' fill=\'%23000000\'%3EMIV%3C/text%3E%3C/svg%3E',
    EXT_56: 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'56\' height=\'56\' viewBox=\'0 0 56 56\'%3E%3Crect width=\'56\' height=\'56\' fill=\'%231a1e24\'/%3E%3Ccircle cx=\'28\' cy=\'28\' r=\'24\' fill=\'%23ff6b6b\' stroke=\'%23ffffff\' stroke-width=\'2\'/%3E%3Ctext x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\' font-family=\'Arial, sans-serif\' font-size=\'18\' font-weight=\'bold\' fill=\'%23ffffff\'%3EEXT%3C/text%3E%3C/svg%3E',
    EXT_300: 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'300\' height=\'300\' viewBox=\'0 0 300 300\'%3E%3Crect width=\'300\' height=\'300\' fill=\'%231a1e24\'/%3E%3Ccircle cx=\'150\' cy=\'150\' r=\'130\' fill=\'%23ff6b6b\' stroke=\'%23ffffff\' stroke-width=\'4\'/%3E%3Ctext x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\' font-family=\'Arial, sans-serif\' font-size=\'50\' font-weight=\'bold\' fill=\'%23ffffff\'%3EBOLSA%3C/text%3E%3Ctext x=\'50%25\' y=\'65%25\' text-anchor=\'middle\' dy=\'.3em\' font-family=\'Arial, sans-serif\' font-size=\'40\' font-weight=\'bold\' fill=\'%23ffffff\'%3EEXTERNA%3C/text%3E%3C/svg%3E',
    PLAYLIST: 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'60\' height=\'60\' viewBox=\'0 0 60 60\'%3E%3Crect width=\'60\' height=\'60\' fill=\'%2300ff88\'/%3E%3Ctext x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\' font-family=\'Arial, sans-serif\' font-size=\'32\' font-weight=\'bold\' fill=\'%23000000\'%3E%E2%99%AB%3C/text%3E%3C/svg%3E'
};

// Funções auxiliares de capa
async function getMusicCover(track) {
    if (track.link_capa && typeof track.link_capa === 'string' && track.link_capa.trim() !== '') {
        if (track.link_capa.startsWith('http')) return track.link_capa.trim();
    }
    if (track.link_youtube) {
        const videoId = extractYouTubeId(track.link_youtube);
        if (videoId) return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    }
    return track.is_external ? PLACEHOLDERS.EXT_300 : PLACEHOLDERS.MIV_300;
}

function getMusicCoverSync(track) {
    if (track.link_capa && typeof track.link_capa === 'string' && track.link_capa.trim() !== '') {
        return track.link_capa.trim();
    }
    if (track.link_youtube) {
        const videoId = extractYouTubeId(track.link_youtube);
        if (videoId) return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    }
    return track.is_external ? PLACEHOLDERS.EXT_300 : PLACEHOLDERS.MIV_300;
}
