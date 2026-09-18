// ============================================================
// js/elo-panel.js — PLAY MY v1.0.1
// Painel visual de ELO musical.
// Mostra: ranking, faixas, breakdown, distribuição.
//
// MUDANÇAS v1.0.1:
//   - CORRIGIDO: proteção contra data undefined em get_elo_ranking
//   - CORRIGIDO: Array.isArray() em ranking
// ============================================================

(function () {
    'use strict';

    // ============================================================
    // CARREGAR PAINEL DE ELO
    // ============================================================
    window.loadEloPanel = async function () {
        var c = document.getElementById('eloPanelContent');
        if (!c) return;

        c.innerHTML =
            '<div style="text-align:center;padding:40px">' +
                '<div class="spinner-border text-warning"></div>' +
                '<p class="text-muted mt-2">Calculando ELO das músicas...</p>' +
            '</div>';

        try {
            var r = await callAPI('get_elo_ranking');

            if (!r || !r.success) {
                c.innerHTML = '<div class="text-muted text-center p-4">Erro ao carregar ELO</div>';
                return;
            }

            // ✅ PROTEÇÃO: data pode ser undefined ou não ter ranking
            var d = (r && r.data) ? r.data : {};
            var ranking = Array.isArray(d.ranking) ? d.ranking : [];
            var ultima = d.ultima_atualizacao || null;

            // ============================================================
            // RESUMO — Distribuição por faixa
            // ============================================================
            var faixas = {
                'lendario':  { min: 1600, cor: '#FFD700', label: 'Lendário',  count: 0 },
                'excelente': { min: 1400, cor: '#34c759', label: 'Excelente', count: 0 },
                'bom':       { min: 1200, cor: '#5AC8FA', label: 'Bom',       count: 0 },
                'neutro':    { min: 1000, cor: '#8E8E93', label: 'Neutro',    count: 0 },
                'atencao':   { min: 800,  cor: '#FF9500', label: 'Atenção',   count: 0 },
                'baixa':     { min: 0,    cor: '#FF3B30', label: 'Baixa',     count: 0 }
            };

            ranking.forEach(function (m) {
                var f = m.faixa || 'baixa';
                if (faixas[f]) faixas[f].count++;
            });

            var total = ranking.length;
            var eloMedio = 0;
            if (total > 0) {
                eloMedio = Math.round(
                    ranking.reduce(function (s, m) { return s + (m.elo || 0); }, 0) / total
                );
            }

            // ============================================================
            // CABEÇALHO — Resumo geral
            // ============================================================
            var html =
                '<div style="background:linear-gradient(135deg,rgba(255,215,0,0.15),rgba(255,149,0,0.15));' +
                    'border-radius:16px;padding:24px;margin-bottom:24px;border:1px solid rgba(255,215,0,0.3)">' +
                    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:16px">' +
                        '<div>' +
                            '<h6 style="color:var(--apple-label-2);text-transform:uppercase;font-size:10px;' +
                                'font-weight:600;margin-bottom:6px;letter-spacing:1px">MÚSICAS</h6>' +
                            '<div style="font-size:32px;font-weight:800;color:#fff">' + total + '</div>' +
                        '</div>' +
                        '<div>' +
                            '<h6 style="color:var(--apple-label-2);text-transform:uppercase;font-size:10px;' +
                                'font-weight:600;margin-bottom:6px;letter-spacing:1px">ELO MÉDIO</h6>' +
                            '<div style="font-size:32px;font-weight:800;color:#FFD700">⚡ ' + eloMedio + '</div>' +
                        '</div>' +
                        '<div>' +
                            '<h6 style="color:var(--apple-label-2);text-transform:uppercase;font-size:10px;' +
                                'font-weight:600;margin-bottom:6px;letter-spacing:1px">ATUALIZADO</h6>' +
                            '<div style="font-size:14px;color:var(--apple-label-2);padding-top:8px">' +
                                (ultima ? new Date(ultima).toLocaleString('pt-BR') : 'Nunca') +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                '</div>';

            // ============================================================
            // DISTRIBUIÇÃO POR FAIXA
            // ============================================================
            html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:24px">';

            Object.keys(faixas).forEach(function (key) {
                var f = faixas[key];
                var pct = total > 0 ? Math.round((f.count / total) * 100) : 0;

                html += '<div style="background:var(--apple-bg-card);border:1px solid ' + f.cor + '40;' +
                    'border-radius:10px;padding:12px;text-align:center">' +
                    '<div style="font-size:11px;color:' + f.cor + ';font-weight:700;text-transform:uppercase;' +
                        'letter-spacing:0.5px;margin-bottom:6px">' + f.label + '</div>' +
                    '<div style="font-size:22px;font-weight:800;color:#fff">' + f.count + '</div>' +
                    '<div style="font-size:10px;color:var(--apple-label-2);margin-top:2px">' + pct + '%</div>' +
                '</div>';
            });

            html += '</div>';

            // ============================================================
            // RANKING COMPLETO
            // ============================================================
            if (ranking.length) {
                html +=
                    '<div class="section-header" style="margin-bottom:12px">' +
                        '<h3 class="section-title" style="font-size:18px">🏆 Ranking de ELO</h3>' +
                    '</div>' +
                    '<div class="table-responsive">' +
                        '<table class="ledger-table">' +
                            '<thead><tr>' +
                                '<th>#</th>' +
                                '<th>Música</th>' +
                                '<th class="text-end">ELO</th>' +
                                '<th class="text-end">Faixa</th>' +
                                '<th class="text-end">Play MY</th>' +
                                '<th class="text-end">Externos</th>' +
                                '<th class="text-end">Tendência</th>' +
                            '</tr></thead>' +
                            '<tbody>';

                ranking.forEach(function (m, idx) {
                    var elo = m.elo || 0;
                    var cor = m.cor || '#8E8E93';
                    var label = m.faixa_label || 'Neutro';
                    var bd = m.breakdown || {};

                    var tendencia = bd.tendencia || 0;
                    var trendIcon = tendencia > 5 ? '📈' : tendencia < -5 ? '📉' : '➡️';
                    var trendCor = tendencia > 5
                        ? 'var(--apple-green)'
                        : tendencia < -5 ? 'var(--apple-red)' : 'var(--apple-label-2)';

                    var pctBarra = Math.min(100, (elo / 2000) * 100);

                    html += '<tr>' +
                        '<td style="color:var(--apple-label-2)">' + (idx + 1) + '</td>' +
                        '<td>' +
                            '<div style="color:#fff;font-weight:600">' + (m.music_id || 'Música') + '</div>' +
                            '<div style="margin-top:4px;height:4px;background:var(--apple-gray-5);' +
                                'border-radius:2px;overflow:hidden;max-width:200px">' +
                                '<div style="width:' + pctBarra + '%;height:100%;' +
                                    'background:linear-gradient(90deg,' + cor + ',' + cor + '88)"></div>' +
                            '</div>' +
                        '</td>' +
                        '<td class="text-end">' +
                            '<strong style="color:' + cor + ';font-size:16px">⚡ ' + elo + '</strong>' +
                        '</td>' +
                        '<td class="text-end">' +
                            '<span style="background:' + cor + '22;color:' + cor + ';' +
                                'padding:3px 10px;border-radius:10px;font-size:12px;font-weight:600">' +
                                label +
                            '</span>' +
                        '</td>' +
                        '<td class="text-end" style="color:var(--apple-label-2)">' +
    (bd.play_my_streams || 0) +
'</td>' +
'<td class="text-end" style="color:var(--apple-label-2)">' +
    (bd.externos_streams || 0) +
'</td>' +
                        '<td class="text-end" style="color:' + trendCor + ';font-weight:600">' +
                            trendIcon + ' ' + (tendencia > 0 ? '+' : '') + tendencia + '%' +
                        '</td>' +
                    '</tr>';
                });

                html += '</tbody></table></div>';
            } else {
                html +=
                    '<div class="empty-state-actionable">' +
                        '<i class="bi bi-lightning-charge empty-icon" style="color:var(--apple-yellow)"></i>' +
                        '<h5 class="text-muted">Nenhuma música com ELO calculado</h5>' +
                        '<p class="text-muted small">Reproduza músicas no PLAY MY ou importe dados da ROC Nation.</p>' +
                    '</div>';
            }

            // ============================================================
            // NOTA METODOLÓGICA
            // ============================================================
            html +=
                '<div style="margin-top:24px;background:rgba(255,215,0,0.1);' +
                    'border-left:3px solid #FFD700;padding:16px;border-radius:8px;' +
                    'font-size:13px;color:#c7c7cc;line-height:1.7">' +
                    '<strong style="color:#FFD700">⚡ Como calculamos o ELO</strong><br><br>' +
                    '<strong>Base:</strong> Toda música começa com ELO 1000<br>' +
                    '<strong>Volume PLAY MY:</strong> +2 por stream (até +300)<br>' +
                    '<strong>Volume externo:</strong> +3 por stream Spotify/Deezer/Apple (até +400)<br>' +
                    '<strong>Consistência:</strong> +100 se ativa há 6 meses, +50 se 3 meses, +20 se 1 mês<br>' +
                    '<strong>Tendência:</strong> +150 se crescendo >20%, -150 se caindo >20%<br>' +
                    '<strong>Inatividade:</strong> -200 após 60 dias sem streams<br><br>' +
                    '<span style="color:var(--apple-label-2);font-size:12px">' +
                        'Faixas: Lendário (1600+) • Excelente (1400+) • Bom (1200+) • ' +
                        'Neutro (1000+) • Atenção (800+) • Baixa (<800)' +
                    '</span>' +
                '</div>';

            c.innerHTML = html;

        } catch (e) {
            console.error('Erro ELO panel:', e);
            c.innerHTML = '<div class="text-muted text-center p-4">Erro ao carregar ELO</div>';
        }
    };

    // ============================================================
    // CARREGAR ELO DE UMA MÚSICA ESPECÍFICA
    // ============================================================
    window.loadEloMusica = async function (music_id) {
        try {
            var r = await callAPI('ver_elo', { music_id: music_id });
            if (!r || !r.success) return null;
            return r.data;
        } catch (e) {
            console.error('Erro ELO música:', e);
            return null;
        }
    };

    // ============================================================
    // FORÇAR ATUALIZAÇÃO DE TODOS OS ELOS
    // ============================================================
    window.atualizarTodosElos = async function () {
        if (!confirm('Recalcular ELO de todas as músicas? Isso pode demorar.')) return;

        var c = document.getElementById('eloPanelContent');
        if (c) {
            c.innerHTML =
                '<div style="text-align:center;padding:40px">' +
                    '<div class="spinner-border text-warning"></div>' +
                    '<p class="text-muted mt-2">Recalculando ELO de todas as músicas...</p>' +
                '</div>';
        }

        try {
            var r = await callAPI('atualizar_todos_elos');
            if (r && r.success) {
                if (typeof showToast === 'function') {
                    showToast('✅ ELOs atualizados: ' + ((r.data && r.data.total) || 0) + ' músicas', 'success');
                }
                loadEloPanel();
            } else {
                if (typeof showToast === 'function') {
                    showToast('Erro ao atualizar ELOs', 'error');
                }
            }
        } catch (e) {
            console.error('Erro atualizar ELOs:', e);
            if (typeof showToast === 'function') {
                showToast('Erro ao atualizar', 'error');
            }
        }
    };

    // ============================================================
    // LOG
    // ============================================================
    console.log('✅ [elo-panel.js] v1.0.1 carregado');
})();
