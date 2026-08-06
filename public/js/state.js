// ============================================================
// STATE.JS - Estado Global da Aplicação
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
    progressInterval: null,
    recommendations: [],
    streamingHistory: []
};

// ===== FILA DE REPRODUÇÃO =====
const playQueue = {
    items: [],
    currentIndex: -1,
    
    add(item) {
        this.items.push(item);
        this.currentIndex = this.items.length - 1;
    },
    
    playCurrent() {
        if (this.currentIndex < 0 || this.currentIndex >= this.items.length) return;
        const current = this.items[this.currentIndex];
        if (current.type === 'internal') {
            playTrack(current.index);
        } else {
            playExternalTrack(current.index);
        }
        this.updateQueueDisplay();
    },
    
    playNext() {
        if (this.currentIndex < this.items.length - 1) {
            this.currentIndex++;
            this.playCurrent();
        } else if (state.isRepeat) {
            this.currentIndex = 0;
            this.playCurrent();
        } else {
            showToast('Fim da fila de reprodução', 'info');
            state.isPlaying = false;
            updatePlayerIcons();
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
            queueInfo.innerHTML = `
                <i class="bi bi-music-note-beamed"></i>
                ${this.currentIndex + 1} de ${this.items.length}
            `;
        }
    },
    
    clear() {
        this.items = [];
        this.currentIndex = -1;
        this.updateQueueDisplay();
    }
};

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.state = state;
    window.playQueue = playQueue;
}
