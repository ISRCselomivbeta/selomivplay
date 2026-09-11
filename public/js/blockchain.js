// ============================================================
// BLOCKCHAIN - PLAY MY v8.2
// ============================================================

const Blockchain = {
  generateHash: function(data) {
    return '0x' + Date.now().toString(16) + Math.random().toString(36).substring(2, 10) + (data || '').substring(0, 8);
  }
};

async function loadBlockchainData() {
  const c = document.getElementById('blockchainVisualization'); if (!c) return;
  try {
    const r = await callAPI('get_mining_blocks', { limit: 20 });
    if (r && r.success && r.data && r.data.length) {
      document.getElementById('blockchainContractsCount').textContent = r.data.length;
      document.getElementById('blockchainLastBlock').textContent = r.data.length;
      c.innerHTML = r.data.slice(-5).map((b, i) => '<div class="card" style="width:200px;border-color:rgba(175,82,222,0.5)"><div class="card-header py-2" style="background:rgba(175,82,222,0.15);color:#fff"><small>Bloco #' + (b.block_index || i + 1) + '</small></div><div class="card-body p-2"><small class="blockchain-hash" style="font-size:10px">' + (b.block_hash || '0x').substring(0, 15) + '...</small></div></div>').join('');
    } else c.innerHTML = '<div class="text-muted text-center py-4">Nenhum bloco</div>';
  } catch (e) {}
}

function openBlockchainExplorer() {
  changeSection('blockchain');
  setTimeout(loadBlockchainData, 100);
}

window.loadBlockchainData = loadBlockchainData;
window.openBlockchainExplorer = openBlockchainExplorer;
window.Blockchain = Blockchain;
