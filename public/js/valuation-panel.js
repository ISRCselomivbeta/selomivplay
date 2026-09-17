// ============================================================
// js/valuation-panel.js — PLAY MY v1.0.1
// Painel visual de valuation artístico.
// Mostra: valuation do catálogo, por música, ELO, receita projetada.
//
// MUDANÇAS v1.0.1:
//   - CORRIGIDO: proteção contra data undefined em valuation_catalogo
//   - CORRIGIDO: Array.isArray() em musicas
// ============================================================

(function () {
    'use strict';

    // ============================================================
    // CARREGAR PAINEL DE VALUATION
    // ============================================================
    window.loadValuationPanel = async function () {
        var c = document.getElementById('valuationPanelContent');
        if (!c) return;

        c.innerHTML =
            '<div style="text-align:center;padding:40px">' +
                '<div class="spinner-border text-warning"></div>' +
                '<p class="text-muted mt-2">Calculando valuation do catálogo...</p>' +
            '</div>';

        try {
            var r = await callAPI('valuation_catalogo');

            if (!r || !r.success) {
                c.innerHTML = '<div class="text-muted text-center p-4">Erro ao calcular valuation</div>';
                return;
            }

            // ✅ PROTEÇÃO: data pode ser undefined ou não ter musicas
            var d = (r && r.data) ? r.data : {};
            var musicas = Array.isArray(d.musicas) ? d.musicas : [];
            var valuationTotal = d.valuation_total || 0;
            var quantidadeMusicas = d.quantidade_musicas || 0;
            var receitaAnualTotal = d.receita_anual_total || 0;

            // ============================================================
            // CABEÇALHO — Valuation Total
            // ============================================================
            var html =
                '<div style="background:linear-gradient(135deg,rgba(52,199,89,0.15),rgba(0,122,255,0.15));' +
                    'border-radius:16px;padding:24px;margin-bottom:24px;border:1px solid rgba(52,199,89,0.3)">' +
                    '<h6 style="color:var(--apple-label-2);text-transform:uppercase;font-size:11px;' +
                        'font-weight:600;margin-bottom:8px;letter-spacing:1px">VALUATION DO CATÁLOGO</h6>' +
                    '<div style="font-size:42px;font-weight:800;color:var(--apple-green);line-height:1.1">' +
                        formatarMoeda(valuationTotal) +
                    '</div>' +
                    '<div style="color:var(--apple-label-2);font-size:13px;margin-top:12px">' +
                        '<i class="bi bi-music-note-beamed"></i> ' + quantidadeMusicas + ' músicas' +
                        ' • <i class="bi bi-graph-up"></i> Receita anual: ' + formatarMoeda(receitaAnualTotal) +
                    '</div>' +
                '</div>';

            // ============================================================
            // TOP 3 — PÓDIO
            // ============================================================
            if (musicas.length >= 1) {
                html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:24px">';

                for (var i = 0; i < Math.min(3, musicas.length); i++) {
                    var m = musicas[i];
                    var medalha = ['🥇', '🥈', '🥉'][i];
                    var corBorda = ['#FFD700', '#C0C0C0', '#CD7F32'][i];

                    html += '<div style="background:var(--apple-bg-card);border:1px solid ' + corBorda + '40;' +
                        'border-radius:12px;padding:16px;position:relative">' +
                        '<div style="font-size:28px;margin-bottom:8px">' + medalha + '</div>' +
                        '<div style="color:#fff;font-weight:700;font-size:14px;margin-bottom:4px;' +
                            'white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' +
                            (m.music_id || 'Música') +
                        '</div>' +
                        '<div style="color:var(--apple-green);font-size:20px;font-weight:800">' +
                            formatarMoeda(m.valuation || 0) +
                        '</div>' +
                        '<div style="color:var(--apple-label-2);font-size:11px;margin-top:8px">' +
                            '<span style="background:' + (m.elo_cor || '#8E8E93') + '22;color:' + (m.elo_cor || '#8E8E93') + ';' +
                                'padding:2px 8px;border-radius:8px;font-weight:600">⚡ ' + (m.elo || 1000) + '</span>' +
                            '<span style="margin-left:8px">' + (m.multiplo_final || 10) + 'x</span>' +
                        '</div>' +
                    '</div>';
                }

                html += '</div>';
            }

            // ============================================================
            // TABELA COMPLETA
            // ============================================================
            if (musicas.length) {
                html +=
                    '<div class="section-header" style="margin-bottom:12px">' +
                        '<h3 class="section-title" style="font-size:18px">📊 Detalhamento por música</h3>' +
                    '</div>' +
                    '<div class="table-responsive">' +
                        '<table class="ledger-table">' +
                            '<thead><tr>' +
                                '<th>#</th>' +
                                '<th>Música</th>' +
                                '<th class="text-end">ELO</th>' +
                                '<th class="text-end">Receita Anual</th>' +
                                '<th class="text-end">Múltiplo</th>' +
                                '<th class="text-end">Valuation</th>' +
                            '</tr></thead>' +
                            '<tbody>';

                musicas.forEach(function (m, idx) {
                    var elo = m.elo || 1000;
                    var eloCor = m.elo_cor || '#8E8E93';
                    var eloLabel = m.elo_faixa || 'neutro';

                    html += '<tr>' +
                        '<td style="color:var(--apple-label-2)">' + (idx + 1) + '</td>' +
                        '<td>' +
                            '<div style="color:#fff;font-weight:600">' + (m.music_id || 'Música') + '</div>' +
                            (m.elo_faixa ?
                                '<div style="font-size:11px;color:' + eloCor + ';margin-top:2px">' +
                                    '⚡ ' + elo + ' • ' + eloLabel +
                                '</div>'
                            : '') +
                        '</td>' +
                        '<td class="text-end">' +
                            '<span style="background:' + eloCor + '22;color:' + eloCor + ';' +
                                'padding:3px 10px;border-radius:10px;font-size:13px;font-weight:700">' +
                                elo +
                            '</span>' +
                        '</td>' +
                        '<td class="text-end" style="color:var(--apple-label-2)">' +
                            formatarMoeda(m.receita_anual_projetada || 0) +
                        '</td>' +
                        '<td class="text-end" style="color:var(--apple-label-2)">' +
                            (m.multiplo_final || 10) + 'x' +
                            (m.ajuste_elo ? '<div style="font-size:10px;color:' +
                                (m.ajuste_elo > 0 ? 'var(--apple-green)' : 'var(--apple-red)') + '">' +
                                (m.ajuste_elo > 0 ? '+' : '') + m.ajuste_elo + '%</div>' : '') +
                        '</td>' +
                        '<td class="text-end">' +
                            '<strong style="color:var(--apple-green);font-size:15px">' +
                                formatarMoeda(m.valuation || 0) +
                            '</strong>' +
                        '</td>' +
                    '</tr>';
                });

                html += '</tbody></table></div>';
            } else {
                html +=
                    '<div class="empty-state-actionable">' +
                        '<i class="bi bi-graph-up-arrow empty-icon" style="color:var(--apple-yellow)"></i>' +
                        '<h5 class="text-muted">Nenhuma música com dados ainda</h5>' +
                        '<p class="text-muted small">Assim que houver streams no PLAY MY, o valuation aparece aqui.</p>' +
                    '</div>';
            }

            // ============================================================
            // NOTA METODOLÓGICA
            // ============================================================
            html +=
                '<div style="margin-top:24px;background:rgba(255,204,0,0.1);' +
                    'border-left:3px solid #ffcc00;padding:16px;border-radius:8px;' +
                    'font-size:13px;color:#c7c7cc;line-height:1.7">' +
                    '<strong style="color:#ffcc00">📐 Como calculamos o valuation</strong><br><br>' +
                    '<strong>1. Receita anual projetada</strong> = Streams/mês × valor por stream × 12 meses (com tendência dos últimos meses)<br>' +
                    '<strong>2. Múltiplo base</strong> = 10x (padrão do mercado musical)<br>' +
                    '<strong>3. Ajuste por ELO</strong> = (ELO - 1000) / 1000 × 50% — música com ELO alto vale mais<br>' +
                    '<strong>4. Valuation</strong> = Receita anual × múltiplo final<br><br>' +
                    '<span style="color:var(--apple-label-2);font-size:12px">' +
                        'Valores por stream: PLAY MY R$ 0,015 • Spotify R$ 0,004 • Deezer R$ 0,003 • ' +
                        'Apple Music R$ 0,007 • YouTube R$ 0,002' +
                    '</span>' +
                '</div>';

            c.innerHTML = html;

        } catch (e) {
            console.error('Erro valuation:', e);
            c.innerHTML = '<div class="text-muted text-center p-4">Erro ao calcular valuation</div>';
        }
    };

    // ============================================================
    // CARREGAR VALUATION DE UMA MÚSICA ESPECÍFICA
    // ============================================================
    window.loadValuationMusica = async function (music_id, video_id) {
        try {
            var r = await callAPI('ver_valuation', {
                music_id: music_id,
                video_id: video_id || ''
            });

            if (!r || !r.success) return null;
            return r.data;
        } catch (e) {
            console.error('Erro valuation música:', e);
            return null;
        }
    };

    // ============================================================
    // FORMATAR MOEDA (compacto)
    // ============================================================
    function formatarMoeda(valor) {
        valor = parseFloat(valor) || 0;
        if (valor >= 1000000) return 'R$ ' + (valor / 1000000).toFixed(2) + 'M';
        if (valor >= 1000) return 'R$ ' + (valor / 1000).toFixed(2) + 'K';
        return 'R$ ' + valor.toFixed(2).replace('.', ',');
    }

    // ============================================================
    // LOG
    // ============================================================
    console.log('✅ [valuation-panel.js] v1.0.1 carregado');
})();
