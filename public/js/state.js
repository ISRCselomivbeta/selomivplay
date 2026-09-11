// ============================================================
// STATE.JS - Estado global PLAY MY
// ============================================================

const state = {
    currentUser: null,
    userBalance: 0,
    playlist: [],
    externalPlaylist: [],
    portfolioAssets: [],
    ledgerData: [],
    topInvestments: [],
    userPlaylists: [],
    favoriteMusicIds: [],
    streamingHistory: [],
    recommendations: [],
    currentTrackIndex: -1,
    isPlaying: false,
    youtubePlayer: null,
    youtubeAPILoaded: false,
    currentVolume: 80,
    isShuffle: false,
    isRepeat: false,
    lastVolume: 80,
    currentInvestTrack: null,
    currentExternalTrack: null,
    blockchain: {
        enabled: true,
        contracts: [],
        transactions: [],
        lastBlock: 0
    },
    streamingTimer: null,
    streamingProgress: 0,
    streamingTrackId: null,
    streamingLastReward: 0,
    isBuffering: false,
    playerReady: false,
    streamingStats: null,
    progressInterval: null
};

// Fila de reprodução
const playQueue = {
    items: [],
    currentIndex: -1,

    async addWithSimilar(track, type, index) {
        if (!state.isRepeat) this.items = [];
        const mainItem = { type, index, track, trackId: track.id, addedAt: Date.now() };
        this.items.push(mainItem);
        this.currentIndex = this.items.length - 1;
        if (track.link_youtube && type === 'external') {
            await this.findAndAddSimilar(track);
        }
        this.playCurrent();
        return this.items.length;
    },

    async findAndAddSimilar(track) {
        try {
            const videoId = extractYouTubeId(track.link_youtube);
            if (!videoId) return;
            const searchQuery = `${track.artista || ''} ${track.titulo || ''} música`;
            const result = await callAPI('search_youtube', { query: searchQuery, limit: 3 });
            if (result.success && result.data) {
                const similares = result.data.filter(item => item.id !== track.id).slice(0, 3);
                similares.forEach(similar => {
                    const exists = this.items.some(item =>
                        item.trackId === similar.id ||
                        (item.track.link_youtube === similar.link_youtube)
                    );
                    if (!exists) {
                        let externalIndex = state.externalPlaylist.findIndex(m => m.id === similar.id);
                        if (externalIndex === -1) {
                            state.externalPlaylist.push(similar);
                            externalIndex = state.externalPlaylist.length - 1;
                        }
                        this.items.push({
                            type: 'external',
                            index: externalIndex,
                            track: similar,
                            trackId: similar.id,
                            isSimilar: true,
                            addedAt: Date.now()
                        });
                    }
                });
                if (similares.length > 0) {
                    showToast(`🎵 +${similares.length} músicas similares adicionadas`, 'info');
                }
            }
        } catch (error) {
            console.error('Erro ao buscar similares:', error);
        }
    },

    playCurrent() {
        if (this.currentIndex < 0 || this.currentIndex >= this.items.length) return;
        const current = this.items[this.currentIndex];
        if (current.type === 'internal') playTrack(current.index);
        else playExternalTrack(current.index);
        this.updateQueueDisplay();
    },

    playNext() {
        if (this.currentIndex < this.items.length - 1) {
            this.currentIndex++;
            this.playCurrent();
        } else {
            if (state.isRepeat) {
                this.currentIndex = 0;
                this.playCurrent();
            } else {
                showToast('Fim da fila de reprodução', 'info');
                state.isPlaying = false;
                updatePlayerIcons();
            }
        }
    },

    playPrevious() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.playCurrent();
        }
    },

    shuffle() {
        if (this.items.length <= 1) return;
        const current = this.items[this.currentIndex];
        const others = this.items.filter((_, i) => i !== this.currentIndex);
        for (let i = others.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [others[i], others[j]] = [others[j], others[i]];
        }
        this.items = [current, ...others];
        this.currentIndex = 0;
        this.updateQueueDisplay();
        showToast('🎲 Fila embaralhada', 'success');
    },

    updateQueueDisplay() {
        const queueInfo = document.querySelector('.queue-info');
        if (queueInfo) {
            queueInfo.innerHTML = `<i class="bi bi-music-note-beamed"></i> ${this.currentIndex + 1} de ${this.items.length}`;
        }
    },

    clear() {
        this.items = [];
        this.currentIndex = -1;
        this.updateQueueDisplay();
    }
};

// Controle de requisições
const requestControl = {
    lastSaldo: 0,
    lastStreaming: 0,
    lastExtrato: 0,
    lastReset: Date.now(),
    saldoCount: 0,
    streamingCount: 0,
    extratoCount: 0,
    MIN_INTERVAL: 30000,
    MAX_REQUESTS_PER_HOUR: 100
};

function canMakeRequest(type) {
    const now = Date.now();
    const last = requestControl[`last${type}`];
    const count = requestControl[`${type.toLowerCase()}Count`];
    if (now - requestControl.lastReset > 3600000) {
        requestControl.saldoCount = 0;
        requestControl.streamingCount = 0;
        requestControl.extratoCount = 0;
        requestControl.lastReset = now;
    }
    if (now - last < requestControl.MIN_INTERVAL) return false;
    if (count > requestControl.MAX_REQUESTS_PER_HOUR) return false;
    return true;
}

function registerRequest(type) {
    requestControl[`last${type}`] = Date.now();
    requestControl[`${type.toLowerCase()}Count`]++;
}

// Sistema ELO
const ELO = {
    CONFIG: {
        BASE_RATING: 1400,
        K_FACTOR: 32,
        K_HIGH: 48,
        K_LOW: 24,
        DECAY_DAYS: 30,
        DECAY_PERCENT: 0.05,
        WEIGHTS: { INVESTMENT: 0.35, SHARES_SOLD: 0.25, INVESTORS: 0.20, RETURNS: 0.15, EXTERNAL: 0.05 }
    },
    calculateExpected: function(ratingA, ratingB) {
        return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
    },
    getKFactor: function(expectedA, actualA) {
        const surprise = Math.abs(actualA - expectedA);
        if (surprise > 0.3) return this.CONFIG.K_HIGH;
        else if (surprise < 0.1) return this.CONFIG.K_LOW;
        else return this.CONFIG.K_FACTOR;
    },
    updateRating: function(ratingA, ratingB, actualA, kFactor = null) {
        const expectedA = this.calculateExpected(ratingA, ratingB);
        const k = kFactor || this.getKFactor(expectedA, actualA);
        const newRatingA = ratingA + k * (actualA - expectedA);
        const newRatingB = ratingB + k * ((1 - actualA) - (1 - expectedA));
        return {
            newRatingA: Math.max(100, Math.min(3000, Math.round(newRatingA))),
            newRatingB: Math.max(100, Math.min(3000, Math.round(newRatingB)))
        };
    },
    calculateMusicScore: function(music) {
        if (!music) return this.CONFIG.BASE_RATING;
        const w = this.CONFIG.WEIGHTS;
        const normalize = (v, min, max) => {
            if (v <= min) return 0;
            if (v >= max) return 1;
            return (v - min) / (max - min);
        };
        const investmentScore = normalize(music.valor_total_investido || 0, 0, 1000000) * 1000;
        const sharesScore = normalize(music.acoes_vendidas || 0, 0, 10000) * 1000;
        const investorsScore = normalize(music.total_investidores || 0, 0, 1000) * 1000;
        const returnsScore = normalize(music.rentabilidade_media || 0, 0, 50) * 1000;
        const externalBonus = music.is_external ? 50 : 0;
        const score = (investmentScore * w.INVESTMENT + sharesScore * w.SHARES_SOLD + investorsScore * w.INVESTORS + returnsScore * w.RETURNS) + externalBonus;
        return Math.round(this.CONFIG.BASE_RATING + score);
    },
    compareMusic: function(musicA, musicB, result) {
        const ratingA = musicA.elo_rating || this.CONFIG.BASE_RATING;
        const ratingB = musicB.elo_rating || this.CONFIG.BASE_RATING;
        const updated = this.updateRating(ratingA, ratingB, result);
        musicA.elo_rating = updated.newRatingA;
        musicB.elo_rating = updated.newRatingB;
        return { musicA, musicB };
    },
    updateCompleteRanking: function(musics) {
        if (!musics || musics.length === 0) return musics;
        musics.forEach(music => {
            if (!music.elo_rating) music.elo_rating = this.calculateMusicScore(music);
        });
        return musics.sort((a, b) => (b.elo_rating || 0) - (a.elo_rating || 0));
    },
    getRatingLevel: function(rating) {
        if (rating >= 2600) return '⚜️ Lenda';
        if (rating >= 2400) return '👑 Mestre';
        if (rating >= 2200) return '💎 Diamante';
        if (rating >= 2000) return '🥇 Platina';
        if (rating >= 1800) return '🥈 Ouro';
        if (rating >= 1600) return '🥉 Prata';
        if (rating >= 1400) return '🔰 Bronze';
        return '🆚 Iniciante';
    },
    getRatingColor: function(rating) {
        if (rating >= 2400) return '#ffd700';
        if (rating >= 2000) return '#c0c0c0';
        if (rating >= 1600) return '#cd7f32';
        return '#6c757d';
    },
    getTrend: function(music) {
        if (!music.elo_history || music.elo_history.length < 2) return '➡️ Estável';
        const last = music.elo_history[music.elo_history.length - 1];
        const prev = music.elo_history[music.elo_history.length - 2];
        if (last.newRating > prev.newRating) return '📈 Subindo';
        if (last.newRating < prev.newRating) return '📉 Descendo';
        return '➡️ Estável';
    },
    applyRatingDecay: function(musics) {
        const now = new Date();
        return musics.map(music => {
            if (!music.elo_rating) return music;
            const lastUpdate = music.last_rating_update ? new Date(music.last_rating_update) : now;
            const daysDiff = (now - lastUpdate) / (1000 * 60 * 60 * 24);
            if (daysDiff > this.CONFIG.DECAY_DAYS) {
                const decayMultiplier = 1 - (this.CONFIG.DECAY_PERCENT * Math.floor(daysDiff / this.CONFIG.DECAY_DAYS));
                music.elo_rating = Math.max(this.CONFIG.BASE_RATING, Math.round(music.elo_rating * decayMultiplier));
                music.last_rating_update = now.toISOString();
            }
            return music;
        });
    }
};

// Blockchain simplificado
const Blockchain = {
    generateHash: function(data) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 15);
        return '0x' + timestamp.toString(16) + random + (data || '').substring(0, 8);
    },
    createContract: function(investment) {
        const contract = {
            id: 'CT_' + Date.now(),
            hash: this.generateHash(investment.music_id + investment.user_id),
            timestamp: new Date().toISOString(),
            music_id: investment.music_id,
            user_id: investment.user_id,
            quantidade: investment.quantidade,
            valor_total: investment.valor_total,
            status: 'active',
            previousHash: state.blockchain.lastBlock ? state.blockchain.contracts[state.blockchain.contracts.length - 1].hash : '0x0'
        };
        state.blockchain.contracts.push(contract);
        state.blockchain.lastBlock++;
        return contract;
    },
    verifyContract: function(contractId) {
        const contract = state.blockchain.contracts.find(c => c.id === contractId);
        if (!contract) return false;
        const index = state.blockchain.contracts.indexOf(contract);
        if (index > 0) {
            const prevContract = state.blockchain.contracts[index - 1];
            return contract.previousHash === prevContract.hash;
        }
        return true;
    }
};
