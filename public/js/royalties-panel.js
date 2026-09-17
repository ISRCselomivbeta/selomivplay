// ============================================================
// js/royalties-panel.js — PLAY MY v1.0.0
// Painel admin de royalties
// ============================================================

window.loadRoyaltiesPanel = async function () {
    const container = document.getElementById('royaltiesPanelContent');
    if (!container) return;

    container.innerHTML = '<div class="text-center p-4"><div class="spinner-border"></div></div>';

    try {
        const r = await callAPI('royalties_resumo');
        if (!r || !r.success) {
            container.innerHTML = '<p class="text-muted">Nenhum royalty importado</p>';
            return;
        }

        const periodos = r.data || [];
        if (!periodos.length) {
            container.innerHTML = `
                <div class="empty-state-actionable">
                    <i class="bi bi-cash-stack empty-icon" style="color:var(--apple-green)"></i>
                    <h5 class="text-muted">Nenhum relatório importado</h5>
                    <p class="text-muted small">Importe um CSV da ROC Nation para começar.</p>
                </div>
            `;
            return;
        }

        let html = '';
        periodos.forEach(p => {
            html += `
                <div class="royalty-card" style="background:var(--apple-bg-card);border:0.5px solid var(--apple-separator);border-radius:var(--radius-lg);padding:16px;margin-bottom:12px">
                    <div style="display:flex;justify-content:space-between;align-items:center">
                        <div>
                            <div style="color:#fff;font-weight:700;font-size:16px">${p.periodo}</div>
                            <div style="color:var(--apple-label-2);font-size:12px">
                                🎵 ${p.total_musicas} músicas • ▶️ ${p.total_streams} streams
                            </div>
                        </div>
                        <div style="text-align:right">
                            <div style="color:var(--apple-green);font-weight:700;font-size:18px">
                                R$ ${(p.total_receita || 0).toFixed(2)}
                            </div>
                            <button class="btn btn-sm btn-outline-success mt-2" 
                                    onclick="distribuirRoyalties('${p.periodo}')">
                                <i class="bi bi-send"></i> Distribuir
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    } catch (e) {
        console.error('Erro:', e);
        container.innerHTML = '<p class="text-danger">Erro ao carregar royalties</p>';
    }
};

window.distribuirRoyalties = async function (periodo) {
    if (!confirm(`Distribuir royalties do período ${periodo}?`)) return;

    try {
        const r = await callAPI('distribuir_tudo', {
            periodo: periodo,
            percentual: 20
        });

        if (r && r.success) {
            showToast('✅ Royalties distribuídos!', 'success');
            await loadRoyaltiesPanel();
        } else {
            showToast(r.message || 'Erro ao distribuir', 'error');
        }
    } catch (e) {
        showToast('Erro ao distribuir', 'error');
    }
};

console.log('✅ [royalties-panel.js] v1.0.0 carregado');
