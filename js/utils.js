// ============================================================
// UTILS.JS - Funções Utilitárias
// ============================================================

// ===== FORMATAÇÃO =====
function formatCurrency(value) {
    if (value === null || value === undefined || isNaN(value)) value = 0;
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(Number(value));
}

function formatDate(dateString) {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        return dateString;
    }
}

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

// ===== YOUTUBE ID EXTRACTOR =====
function extractYouTubeId(url) {
    if (!url || typeof url !== 'string') return null;
    
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
        /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
        /youtu\.be\/([^&\n?#]+)/,
        /youtube\.com\/shorts\/([^&\n?#]+)/
    ];
    
    for (let pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1] && match[1].length === 11) {
            return match[1];
        }
    }
    return null;
}

// ===== LOADING =====
function showLoading(message = 'Carregando...') {
    const loading = document.getElementById('loadingScreen');
    if (loading) {
        loading.style.display = 'flex';
        const msg = document.getElementById('loadingMessage');
        if (msg) msg.textContent = message;
    }
}

function hideLoading() {
    const loading = document.getElementById('loadingScreen');
    if (loading) loading.style.display = 'none';
}

// ===== TOAST =====
function showToast(message, type = 'success', duration = 3000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toastId = 'toast_' + Date.now();
    const toast = document.createElement('div');
    toast.id = toastId;
    toast.className = `toast ${type}`;
    
    let icon = 'bi-info-circle';
    if (type === 'success') icon = 'bi-check-circle';
    if (type === 'error') icon = 'bi-exclamation-circle';
    if (type === 'warning') icon = 'bi-exclamation-triangle';
    
    toast.innerHTML = `
        <i class="bi ${icon} toast-icon"></i>
        <div class="toast-message">${message}</div>
        <button class="btn btn-sm btn-link text-white p-0" onclick="this.closest('.toast').remove()">
            <i class="bi bi-x"></i>
        </button>
    `;
    
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ===== MODAL =====
function showModal(modalId) { 
    const modal = document.getElementById(modalId); 
    if (modal) { 
        modal.classList.add('show'); 
        document.body.style.overflow = 'hidden'; 
    } 
}

function closeModal(modalId) { 
    const modal = document.getElementById(modalId); 
    if (modal) { 
        modal.classList.remove('show'); 
        document.body.style.overflow = 'auto'; 
    } 
}

// ===== SIDEBAR =====
function toggleSidebar() { 
    document.getElementById('sidebar')?.classList.toggle('open'); 
}

// ===== EXPORT =====
// Exportar para uso global
if (typeof window !== 'undefined') {
    window.formatCurrency = formatCurrency;
    window.formatDate = formatDate;
    window.formatTime = formatTime;
    window.formatNumber = formatNumber;
    window.extractYouTubeId = extractYouTubeId;
    window.showLoading = showLoading;
    window.hideLoading = hideLoading;
    window.showToast = showToast;
    window.showModal = showModal;
    window.closeModal = closeModal;
    window.toggleSidebar = toggleSidebar;
}
