// ============================================================
// js/blockchain.js — PLAY MY v8.5.0
// Blockchain Explorer: visualização de blocos, hashes, cadeia.
// Depende de: config.js, utils.js, state.js, api.js
// DEVE carregar DEPOIS de trades.js e ANTES de news.js.
// ============================================================

// ============================================================
// ABRIR EXPLORER (navega para seção e carrega dados)
// ============================================================
window.openBlockchainExplorer = function () {
  // Navega para a seção
  if (typeof changeSection === 'function') {
    changeSection('blockchain');
  }
  // Carrega dados
  loadBlockchainData();
};

// ============================================================
// CARREGAR DADOS DA BLOCKCHAIN
// ============================================================
window.loadBlockchainData = async function () {
  const viz = document.getElementById('blockchainVisualization');
  if (!viz) return;

  // Estado de loading
  viz.innerHTML =
    '<div class="text-center p-4">' +
      '<div class="spinner-border text-success"></div>' +
    '</div>';

  try {
    const r = await callAPI('get_mining_blocks', { limit: 30 });

    if (r && r.success && r.data && r.data.length) {
      // Atualiza contadores
      const blocksCountEl = document.getElementById('blockchainBlocksCount');
      if (blocksCountEl) blocksCountEl.textContent = r.data.length;

      const lastBlockEl = document.getElementById('blockchainLastBlock');
      if (lastBlockEl) {
        lastBlockEl.textContent = r.data[0] ? (r.data[0].block_index || 0) : 0;
      }

      // Renderiza blocos
      viz.innerHTML = r.data.map(b => {
        const hash = (b.block_hash || '0x').substring(0, 30) + '...';
        const timestamp = b.timestamp
          ? new Date(b.timestamp).toLocaleString('pt-BR')
          : '';

        return '<div class="card" style="width:220px;border-color:rgba(175,82,222,0.5);background:var(--apple-bg-card);padding:12px;border-radius:12px">' +
          '<div style="color:var(--apple-purple);font-weight:700;font-size:13px">' +
            '<i class="bi bi-link-45deg"></i> Bloco #' + (b.block_index || 0) +
          '</div>' +
          '<div class="blockchain-hash mt-2" style="font-size:10px">' + hash + '</div>' +
          '<div class="text-muted mt-1" style="font-size:11px">' + (b.music_title || 'Bloco') + '</div>' +
          '<div class="text-muted" style="font-size:10px">' + timestamp + '</div>' +
        '</div>';
      }).join('');
    } else {
      // Estado vazio
      viz.innerHTML =
        '<div class="empty-state-actionable">' +
          '<i class="bi bi-link-45deg empty-icon"></i>' +
          '<h5 class="text-muted">Nenhum bloco ainda</h5>' +
          '<p class="text-muted">Os blocos aparecem após investimentos</p>' +
        '</div>';
    }
  } catch (e) {
    console.error('Erro ao carregar blockchain:', e);
    viz.innerHTML =
      '<div class="text-center text-muted p-4">Erro ao carregar</div>';
  }
};

// ============================================================
// LOG DE CARREGAMENTO
// ============================================================
console.log('✅ [blockchain.js] carregado — explorer pronto');
