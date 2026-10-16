/**
 * youtube-audit.js
 * Módulo de análise de audiência e receita a partir de link do YouTube.
 * 
 * Dependências: window.PM.api (para chamadas ao backend)
 * Expõe: window.PM.youtubeAudit
 * 
 * Fluxo:
 *   1. Usuário cola link do YouTube
 *   2. Extrai videoId
 *   3. Chama /api/youtube-stats (dados públicos)
 *   4. Chama /api/ai-audit (análise + projeção)
 *   5. Renderiza painel com histórico vs. projeção
 * 
 * Regra central: dados públicos e receita confirmada NUNCA são somados.
 * Estimativas são sempre rotuladas como estimativas.
 */

(function () {
  'use strict';

  window.PM = window.PM || {};

  // ---------- Configuração ----------
  const CONFIG = {
    endpointStats: '/api/youtube-stats',
    endpointAudit: '/api/ai-audit',
    cacheTTL: 1000 * 60 * 60, // 1h para dados públicos
    maxRetries: 2,
    retryDelay: 1500
  };

  // ---------- Estado interno do módulo ----------
  const state = {
    lastVideoId: null,
    lastResult: null,
    loading: false,
    cache: new Map() // videoId -> { data, timestamp }
  };

  // ---------- Utilitários ----------

  /**
   * Extrai o videoId de qualquer formato de URL do YouTube.
   * Suporta:
   *   - https://www.youtube.com/watch?v=VIDEOID
   *   - https://youtu.be/VIDEOID
   *   - https://www.youtube.com/embed/VIDEOID
   *   - https://www.youtube.com/shorts/VIDEOID
   *   - https://music.youtube.com/watch?v=VIDEOID
   */
  function extractVideoId(input) {
    if (!input || typeof input !== 'string') return null;
    const trimmed = input.trim();

    // Se já for um ID puro (11 caracteres)
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

    const patterns = [
      /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
      /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
      /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
      /(?:music\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/
    ];

    for (const pattern of patterns) {
      const match = trimmed.match(pattern);
      if (match && match[1]) return match[1];
    }
    return null;
  }

  /**
   * Verifica cache antes de chamar o backend.
   */
  function getFromCache(videoId) {
    const entry = state.cache.get(videoId);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CONFIG.cacheTTL) {
      state.cache.delete(videoId);
      return null;
    }
    return entry.data;
  }

  function setCache(videoId, data) {
    state.cache.set(videoId, { data, timestamp: Date.now() });
  }

  /**
   * Fetch com retry e timeout.
   */
  async function fetchWithRetry(url, options = {}, retries = CONFIG.maxRetries) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeout);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    } catch (err) {
      clearTimeout(timeout);
      if (retries > 0) {
        await new Promise(r => setTimeout(r, CONFIG.retryDelay));
        return fetchWithRetry(url, options, retries - 1);
      }
      throw err;
    }
  }

  // ---------- Chamadas ao backend ----------

  /**
   * Busca dados públicos do vídeo (título, canal, views, data).
   * NUNCA retorna receita — apenas o que é publicamente visível.
   */
  async function fetchPublicStats(videoId) {
    const cached = getFromCache(videoId);
    if (cached && cached.public) return cached.public;

    const data = await fetchWithRetry(
      `${CONFIG.endpointStats}?videoId=${encodeURIComponent(videoId)}`
    );

    // Validação mínima do formato esperado
    if (!data || typeof data.views !== 'number') {
      throw new Error('Resposta inválida do servidor');
    }

    return {
      videoId,
      title: data.title || 'Sem título',
      channel: data.channel || 'Canal desconhecido',
      views: data.views,
      publishedAt: data.publishedAt || null,
      thumbnail: data.thumbnail || null
    };
  }

  /**
   * Envia dados públicos + (opcional) relatório financeiro para análise.
   * O backend retorna findings, histórico confirmado e projeção.
   */
  async function fetchAudit(publicData, financialData = null) {
    const payload = {
      videoId: publicData.videoId,
      publicData,
      financialData // pode ser null
    };

    return await fetchWithRetry(CONFIG.endpointAudit, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }

  // ---------- Renderização ----------

  /**
   * Formata número com separador de milhar (pt-BR).
   */
  function formatNumber(n) {
    if (typeof n !== 'number' || isNaN(n)) return '—';
    return n.toLocaleString('pt-BR');
  }

  /**
   * Formata valor em USD.
   */
  function formatUSD(n) {
    if (typeof n !== 'number' || isNaN(n)) return '—';
    return 'US$ ' + n.toFixed(2).replace('.', ',');
  }

  /**
   * Cria o container do painel se não existir.
   */
  function ensurePanel() {
    let panel = document.getElementById('yt-audit-panel');
    if (panel) return panel;

    panel = document.createElement('div');
    panel.id = 'yt-audit-panel';
    panel.className = 'yt-audit-panel';
    panel.innerHTML = `
      <div class="yt-audit-header">
        <h3>Análise de audiência e receita</h3>
        <button type="button" class="yt-audit-close" aria-label="Fechar">×</button>
      </div>
      <div class="yt-audit-body">
        <div class="yt-audit-input-row">
          <input
            type="text"
            id="yt-audit-input"
            placeholder="Cole o link do YouTube ou o ID do vídeo"
            autocomplete="off"
          />
          <button type="button" id="yt-audit-btn">Analisar</button>
        </div>
        <div id="yt-audit-result" class="yt-audit-result"></div>
      </div>
    `;

    document.body.appendChild(panel);

    // Listeners
    panel.querySelector('.yt-audit-close').addEventListener('click', () => {
      panel.classList.remove('open');
    });

    const input = panel.querySelector('#yt-audit-input');
    const btn = panel.querySelector('#yt-audit-btn');

    btn.addEventListener('click', () => runAnalysis(input.value));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') runAnalysis(input.value);
    });

    return panel;
  }

  /**
   * Renderiza o resultado no painel.
   */
  function renderResult(container, publicData, audit) {
    const confirmed = audit.financial_confirmed || null;
    const estimates = audit.estimates || null;
    const findings = audit.findings || [];

    let html = '';

    // --- Bloco 1: dados públicos ---
    html += `
      <div class="yt-audit-block">
        <h4>Dados públicos</h4>
        <div class="yt-audit-row"><span>Título</span><strong>${escapeHtml(publicData.title)}</strong></div>
        <div class="yt-audit-row"><span>Canal</span><strong>${escapeHtml(publicData.channel)}</strong></div>
        <div class="yt-audit-row"><span>Visualizações</span><strong>${formatNumber(publicData.views)}</strong></div>
      </div>
    `;

    // --- Bloco 2: histórico confirmado ---
    if (confirmed) {
      html += `
        <div class="yt-audit-block yt-audit-confirmed">
          <h4>Histórico confirmado</h4>
          <div class="yt-audit-row"><span>Receita bruta</span><strong>${formatUSD(confirmed.gross)}</strong></div>
          <div class="yt-audit-row"><span>Receita líquida</span><strong>${formatUSD(confirmed.net)}</strong></div>
          <div class="yt-audit-row"><span>Fonte</span><strong>${escapeHtml(confirmed.source || '—')}</strong></div>
          <p class="yt-audit-note">Valores reportados pelo titular ou distribuidora.</p>
        </div>
      `;
    } else {
      html += `
        <div class="yt-audit-block yt-audit-no-confirmed">
          <h4>Histórico confirmado</h4>
          <p class="yt-audit-note">Nenhum relatório financeiro fornecido. Não há receita confirmada para este vídeo.</p>
        </div>
      `;
    }

    // --- Bloco 3: projeção ---
    if (estimates) {
      const isSimulation = !confirmed;
      html += `
        <div class="yt-audit-block yt-audit-estimate">
          <h4>${isSimulation ? 'Simulação' : 'Projeção'}</h4>
          ${isSimulation ? '<p class="yt-audit-warning">Esta é uma simulação baseada em premissas. Não representa receita efetiva.</p>' : ''}
          ${estimates.quarterly_projection ? estimates.quarterly_projection.map(q => `
            <div class="yt-audit-row">
              <span>${escapeHtml(q.period)}</span>
              <strong>${formatUSD(q.value)}</strong>
            </div>
          `).join('') : '<p class="yt-audit-note">Projeção indisponível.</p>'}
        </div>
      `;
    }

    // --- Bloco 4: findings ---
    if (findings.length > 0) {
      html += `
        <div class="yt-audit-block">
          <h4>Recomendações</h4>
          ${findings.map(f => `
            <div class="yt-audit-finding yt-audit-${escapeHtml(f.severity || 'info')}">
              <strong>${escapeHtml(f.issue)}</strong>
              <p>${escapeHtml(f.recommendation)}</p>
            </div>
          `).join('')}
        </div>
      `;
    }

    container.innerHTML = html;
  }

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function showLoading(container, message = 'Analisando...') {
    container.innerHTML = `<div class="yt-audit-loading">${escapeHtml(message)}</div>`;
  }

  function showError(container, message) {
    container.innerHTML = `<div class="yt-audit-error">${escapeHtml(message)}</div>`;
  }

  // ---------- Fluxo principal ----------

  async function runAnalysis(inputValue) {
    const panel = ensurePanel();
    const container = panel.querySelector('#yt-audit-result');

    const videoId = extractVideoId(inputValue);
    if (!videoId) {
      showError(container, 'Link inválido. Cole uma URL do YouTube ou o ID de 11 caracteres.');
      return;
    }

    if (state.loading) return;
    state.loading = true;
    state.lastVideoId = videoId;

    try {
      showLoading(container, 'Buscando dados públicos...');

      const publicData = await fetchPublicStats(videoId);

      showLoading(container, 'Analisando audiência e receita...');

      const audit = await fetchAudit(publicData, null);

      state.lastResult = { publicData, audit };
      renderResult(container, publicData, audit);

    } catch (err) {
      console.error('[youtube-audit] erro:', err);
      showError(container, 'Não foi possível concluir a análise. Tente novamente.');
    } finally {
      state.loading = false;
    }
  }

  // ---------- API pública do módulo ----------

  const youtubeAudit = {
    /**
     * Abre o painel (usado por botões externos).
     */
    open() {
      const panel = ensurePanel();
      panel.classList.add('open');
    },

    /**
     * Analisa diretamente um link (usado programaticamente).
     */
    async analyze(url) {
      const panel = ensurePanel();
      panel.classList.add('open');
      return runAnalysis(url);
    },

    /**
     * Retorna o último resultado (útil para debug ou integração).
     */
    getLastResult() {
      return state.lastResult;
    },

    /**
     * Limpa o cache interno.
     */
    clearCache() {
      state.cache.clear();
    },

    // Expõe utilitários para testes
    _extractVideoId: extractVideoId
  };

  window.PM.youtubeAudit = youtubeAudit;

  // Registro no logger, se existir
  if (window.pmLogger && typeof window.pmLogger.log === 'function') {
    window.pmLogger.log('✅ [youtube-audit.js] carregado — análise de audiência e receita');
  } else {
    console.log('✅ [youtube-audit.js] carregado');
  }

})();
