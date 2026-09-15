// ============================================================
// js/streams-panel.js — PLAY MY v1.0.0
// Painel visual de streams por plataforma.
// Mostra: PLAY MY (tempo real) + YouTube (via API) + ROC Nation (CSV)
// ============================================================

(function () {
    'use strict';

    // ============================================================
    // CARREGAR PAINEL DE STREAMS
    // ============================================================
    window.loadStreamsPanel = async function () {
        var c = document.getElementById('streamsPanelContent');
        if (!c) return;

        c.innerHTML =
            '<div style="text-align:center;padding:40px">' +
                '<div class="spinner-border text-success"></div>' +
                '<p class="text-muted mt-2">Carregando streams...</p>' +
            '</div>';

        try {
            // Busca resumo geral
            var r = await callAPI('get_streaming_stats');

            if (!r || !r.success) {
                c.innerHTML = '<div class="text-muted text-center p-4">Erro ao carregar streams</div>';
                return;
            }

            var d = r.data || {};
            var total = d.streams_total || 0;
            var hoje = d.streams_hoje || 0;

            // Busca ranking das top músicas
            var rRanking = await callAPI('get_streaming_ranking', { limit: 20 });
            var ranking = (rRanking && rRanking.success && rRanking.data) ? rRanking.data : [];

            // ============================================================
            // CABEÇALHO — 3 cards de plataformas
            // ============================================================
            var html =
                '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px">' +

                    // PLAY MY
                    '<div style="background:linear-gradient(135deg,rgba(52,199,89,0.15),rgba(52,199,89,0.05));' +
                        'border:1px solid rgba(52,199,89,0.3);border-radius:16px;padding:20px">' +
                        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">' +
                            '<i class="bi bi-play-circle-fill" style="font-size:24px;color:#34c759"></i>' +
                            '<div style="color:#34c759;font-weight:700;font-size:14px">PLAY MY</div>' +
                        '</div>' +
                        '<div style="font-size:32px;font-weight:800;color:#fff;line-height:1">' + total + '</div>' +
                        '<div style="color:var(--apple-label-2);font-size:12px;margin-top:6px">' +
                            'Hoje: <strong style="color:#fff">' + hoje + '</strong>' +
                        '</div>' +
                        '<div style="margin-top:10px">' +
                            '<span style="background:rgba(52,199,89,0.2);color:#34c759;' +
                                'padding:3px 8px;border-radius:8px;font-size:10px;font-weight:600">' +
                                '⚡ TEMPO REAL' +
                            '</span>' +
                        '</div>' +
                    '</div>' +

                    // YOUTUBE
                    '<div style="background:linear-gradient(135deg,rgba(255,0,0,0.15),rgba(255,0,0,0.05));' +
                        'border:1px solid rgba(255,0,0,0.3);border-radius:16px;padding:20px">' +
                        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">' +
                            '<i class="bi bi-youtube" style="font-size:24px;color:#ff0000"></i>' +
                            '<div style="color:#ff0000;font-weight:700;font-size:14px">YOUTUBE</div>' +
                        '</div>' +
                        '<div style="font-size:32px;font-weight:800;color:#fff;line-height:1">—</div>' +
                        '<div style="color:var(--apple-label-2);font-size:12px;margin-top:6px">' +
                            'Consulte por vídeo' +
                        '</div>' +
                        '<div style="margin-top:10px">' +
                            '<span style="background:rgba(255,204,0,0.2);color:#ffcc00;' +
                                'padding:3px 8px;border-radius:8px;font-size:10px;font-weight:600">' +
                                '🕐 ~1H DE DELAY' +
                            '</span>' +
                        '</div>' +
                    '</div>' +

                    // ROC NATION
                    '<div style="background:linear-gradient(135deg,rgba(0,122,255,0.15),rgba(0,122,255,0.05));' +
                        'border:1px solid rgba(0,122,255,0.3);border-radius:16px;padding:20px">' +
                        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">' +
                            '<i class="bi bi-graph-up" style="font-size:24px;color:#007AFF"></i>' +
                            '<div style="color:#007AFF;font-weight:700;font-size:14px">ROC NATION</div>' +
                        '</div>' +
                        '<div style="font-size:32px;font-weight:800;color:#fff;line-height:1">—</div>' +
                        '<div style="color:var(--apple-label-2);font-size:12px;margin-top:6px">' +
                            'Spotify • Deezer • Apple' +
                        '</div>' +
                        '<div style="margin-top:10px">' +
                            '<span style="background:rgba(255,149,0,0.2);color:#FF9500;' +
                                'padding:3px 8px;border-radius:8px;font-size:10px;font-weight:600">' +
                                '📅 MENSAL' +
                            '</span>' +
                        '</div>' +
                    '</div>' +

                '</div>';

            // ============================================================
            // FILTROS DE VISUALIZAÇÃO
            // ============================================================
            html +=
                '<div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap">' +
                    '<button class="btn btn-sm btn-success" onclick="verStreamsPlayMy()">' +
                        '<i class="bi bi-play-circle"></i> PLAY MY' +
                    '</button>' +
                    '<button class="btn btn-sm btn-outline-danger" onclick="verStreamsYouTube()">' +
                        '<i class="bi bi-youtube"></i> YouTube' +
                    '</button>' +
                    '<button class="btn btn-sm btn-outline-primary" onclick="verStreamsRocNation()">' +
                        '<i class="bi bi-graph-up"></i> ROC Nation' +
                    '</button>' +
                    '<button class="btn btn-sm btn-outline-warning" onclick="verStreamsRanking()">' +
                        '<i class="bi bi-trophy"></i> Ranking' +
                    '</button>' +
                '</div>' +

                '<div id="streamsPanelDetalhe"></div>';

            c.innerHTML = html;

            // Carrega PLAY MY por padrão
            verStreamsPlayMy();

        } catch (e) {
            console.error('Erro streams panel:', e);
            c.innerHTML = '<div class="text-muted text-center p-4">Erro ao carregar streams</div>';
        }
    };

    // ============================================================
    // VER STREAMS DO PLAY MY (tempo real)
    // ============================================================
    window.verStreamsPlayMy = async function () {
        var c = document.getElementById('streamsPanelDetalhe');
        if (!c) return;

        c.innerHTML = '<div style="text-align:center;padding:20px"><div class="spinner-border spinner-border-sm text-success"></div></div>';

        try {
            var r = await callAPI('get_streaming_ranking', { limit: 50 });
            var ranking = (r && r.success && r.data) ? r.data : [];

            if (!ranking.length) {
                c.innerHTML =
                    '<div class="empty-state-actionable">' +
                        '<i class="bi bi-play-circle empty-icon" style="color:#34c759"></i>' +
                        '<h5 class="text-muted">Nenhum stream ainda</h5>' +
                        '<p class="text-muted small">Reproduza músicas para começar a contabilizar.</p>' +
                    '</div>';
                return;
            }

            var html =
                '<div style="background:rgba(52,199,89,0.08);border-left:3px solid #34c759;' +
                    'padding:12px 16px;border-radius:8px;margin-bottom:16px;font-size:13px;color:#c7c7cc">' +
                    '<strong style="color:#34c759">🟢 PLAY MY</strong> — Streams registrados no seu player interno. ' +
                    'Atualizado em tempo real.' +
                '</div>' +
                '<div class="table-responsive">' +
                    '<table class="ledger-table">' +
                        '<thead><tr>' +
                            '<th>#</th>' +
                            '<th>Música</th>' +
                            '<th class="text-end">Total</th>' +
                            '<th class="text-end">Hoje</th>' +
                            '<th class="text-end">% do total</th>' +
                        '</tr></thead><tbody>';

            var totalGeral = ranking.reduce(function (s, m) { return s + (m.streams_total || 0); }, 0);

            ranking.forEach(function (m) {
                var pct = totalGeral > 0 ? Math.round((m.streams_total / totalGeral) * 100) : 0;

                html += '<tr>' +
                    '<td style="color:var(--apple-label-2)">' + m.posicao + '</td>' +
                    '<td style="color:#fff;font-weight:600">' + (m.music_id || 'Música') + '</td>' +
                    '<td class="text-end">' +
                        '<strong style="color:#34c759;font-size:15px">' + m.streams_total + '</strong>' +
                    '</td>' +
                    '<td class="text-end" style="color:var(--apple-label-2)">' +
                        (m.streams_hoje || 0) +
                    '</td>' +
                    '<td class="text-end">' +
                        '<div style="display:flex;align-items:center;gap:8px;justify-content:flex-end">' +
                            '<div style="width:60px;height:4px;background:var(--apple-gray-5);' +
                                'border-radius:2px;overflow:hidden">' +
                                '<div style="width:' + pct + '%;height:100%;background:#34c759"></div>' +
                            '</div>' +
                            '<span style="color:var(--apple-label-2);font-size:12px;min-width:36px">' + pct + '%</span>' +
                        '</div>' +
                    '</td>' +
                '</tr>';
            });

            html += '</tbody></table></div>';
            c.innerHTML = html;

        } catch (e) {
            console.error('Erro streams PLAY MY:', e);
            c.innerHTML = '<div class="text-muted text-center p-4">Erro ao carregar</div>';
        }
    };

    // ============================================================
    // VER STREAMS DO YOUTUBE
    // ============================================================
    window.verStreamsYouTube = function () {
        var c = document.getElementById('streamsPanelDetalhe');
        if (!c) return;

        c.innerHTML =
            '<div style="background:rgba(255,0,0,0.08);border-left:3px solid #ff0000;' +
                'padding:16px;border-radius:8px;margin-bottom:16px">' +
                '<h5 style="color:#fff;margin-bottom:12px">📺 YouTube</h5>' +
                '<p style="color:#c7c7cc;font-size:14px;line-height:1.7;margin-bottom:16px">' +
                    'O YouTube <strong>não expõe streams em tempo real</strong> via API pública. ' +
                    'Mas você pode consultar os dados de cada vídeo individualmente.' +
                '</p>' +
            '</div>' +

            '<div style="background:var(--apple-bg-card);border:1px solid var(--apple-separator);' +
                'border-radius:12px;padding:20px;margin-bottom:16px">' +
                '<h6 style="color:#fff;margin-bottom:12px">🔍 Consultar vídeo específico</h6>' +
                '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
                    '<input type="text" id="ytVideoIdInput" class="form-control-custom" ' +
                        'placeholder="Cole o link do YouTube ou o video ID" ' +
                        'style="flex:1;min-width:200px">' +
                    '<button class="btn btn-danger" onclick="consultarVideoYouTube()">' +
                        '<i class="bi bi-search"></i> Consultar' +
                    '</button>' +
                '</div>' +
                '<div id="ytResultado" style="margin-top:16px"></div>' +
            '</div>' +

            '<div style="background:rgba(255,204,0,0.08);border-left:3px solid #ffcc00;' +
                'padding:16px;border-radius:8px;font-size:13px;color:#c7c7cc;line-height:1.7">' +
                '<strong style="color:#ffcc00">💡 Dica</strong><br>' +
                'Para ver o total de views do canal, abra o ' +
                '<a href="https://studio.youtube.com" target="_blank" style="color:#ff0000">YouTube Studio</a> → ' +
                'Analytics → Fontes de tráfego → <strong>Embed</strong>.<br><br>' +
                'Você verá o total de views que vieram de <strong>todos os sites</strong> que incorporaram ' +
                'seus vídeos (incluindo o PLAY MY).<br><br>' +
                '<span style="color:var(--apple-label-2);font-size:12px">' +
                    '⚠️ O YouTube <strong>não mostra</strong> "PLAY MY" separadamente — ' +
                    'todos os sites aparecem como "Embed" no Studio.' +
                '</span>' +
            '</div>';
    };

    // ============================================================
    // CONSULTAR VÍDEO DO YOUTUBE
    // ============================================================
    window.consultarVideoYouTube = async function () {
        var input = document.getElementById('ytVideoIdInput');
        var resultado = document.getElementById('ytResultado');
        if (!input || !resultado) return;

        var valor = input.value.trim();
        if (!valor) {
            resultado.innerHTML = '<div class="text-warning">Cole um link do YouTube primeiro</div>';
            return;
        }

        // Extrai video ID
        var videoId = valor;
        var patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
            /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
            /youtu\.be\/([^&\n?#]+)/
        ];
        for (var p of patterns) {
            var m = valor.match(p);
            if (m && m[1] && m[1].length === 11) { videoId = m[1]; break; }
        }

        resultado.innerHTML = '<div style="text-align:center;padding:12px"><div class="spinner-border spinner-border-sm text-danger"></div></div>';

        try {
            var r = await callAPI('get_youtube_stats', { video_id: videoId });

            if (!r || !r.success || !r.data) {
                resultado.innerHTML = '<div class="text-danger">Vídeo não encontrado</div>';
                return;
            }

            var d = r.data;

            resultado.innerHTML =
                '<div style="background:var(--apple-gray-6);border-radius:10px;padding:16px">' +
                    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:12px">' +
                        '<div>' +
                            '<div style="color:var(--apple-label-2);font-size:11px;text-transform:uppercase;' +
                                'letter-spacing:0.5px">Views</div>' +
                            '<div style="color:#fff;font-size:22px;font-weight:800">' +
                                formatarNumero(d.views || 0) +
                            '</div>' +
                        '</div>' +
                        '<div>' +
                            '<div style="color:var(--apple-label-2);font-size:11px;text-transform:uppercase;' +
                                'letter-spacing:0.5px">Likes</div>' +
                            '<div style="color:#fff;font-size:22px;font-weight:800">' +
                                formatarNumero(d.likes || 0) +
                            '</div>' +
                        '</div>' +
                        '<div>' +
                            '<div style="color:var(--apple-label-2);font-size:11px;text-transform:uppercase;' +
                                'letter-spacing:0.5px">Comentários</div>' +
                            '<div style="color:#fff;font-size:22px;font-weight:800">' +
                                formatarNumero(d.comments || 0) +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                    (d.estimated_earnings ?
                        '<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--apple-separator)">' +
                            '<div style="color:var(--apple-label-2);font-size:11px;text-transform:uppercase;' +
                                'letter-spacing:0.5px">Receita estimada</div>' +
                            '<div style="color:#34c759;font-size:18px;font-weight:800">' +
                                'R$ ' + (d.estimated_earnings * 5.20).toFixed(2) +
                            '</div>' +
                        '</div>'
                    : '') +
                '</div>';

        } catch (e) {
            console.error(e);
            resultado.innerHTML = '<div class="text-danger">Erro ao consultar</div>';
        }
    };

    // ============================================================
    // VER STREAMS DA ROC NATION
    // ============================================================
    window.verStreamsRocNation = async function () {
        var c = document.getElementById('streamsPanelDetalhe');
        if (!c) return;

        c.innerHTML = '<div style="text-align:center;padding:20px"><div class="spinner-border spinner-border-sm text-primary"></div></div>';

        try {
            var r = await callAPI('get_royalties_resumo');

            if (!r || !r.success || !r.data || !r.data.length) {
                c.innerHTML =
                    '<div style="background:rgba(0,122,255,0.08);border-left:3px solid #007AFF;' +
                        'padding:16px;border-radius:8px;margin-bottom:16px">' +
                        '<h5 style="color:#fff;margin-bottom:12px">📊 ROC Nation</h5>' +
                        '<p style="color:#c7c7cc;font-size:14px;line-height:1.7">' +
                            'Nenhum relatório importado ainda. Quando o CSV mensal da ROC Nation chegar, ' +
                            'importe-o e os dados aparecerão aqui.' +
                        '</p>' +
                    '</div>' +

                    '<div style="background:var(--apple-bg-card);border:1px solid var(--apple-separator);' +
                        'border-radius:12px;padding:20px">' +
                        '<h6 style="color:#fff;margin-bottom:12px">📥 Como importar</h6>' +
                        '<div style="color:#c7c7cc;font-size:13px;line-height:1.7">' +
                            '<strong>1.</strong> Baixe o relatório CSV no painel da ROC Nation<br>' +
                            '<strong>2.</strong> Envie via API:<br>' +
                            '<code style="display:block;background:#1c1c1e;padding:10px;border-radius:6px;' +
                                'margin-top:8px;color:#ffcc00;font-size:12px">' +
                                'POST /api/royalties?action=importar' +
                            '</code>' +
                            '<strong>3.</strong> Os dados aparecerão aqui automaticamente' +
                        '</div>' +
                    '</div>';
                return;
            }

            var periodos = r.data;
            var html =
                '<div style="background:rgba(0,122,255,0.08);border-left:3px solid #007AFF;' +
                    'padding:12px 16px;border-radius:8px;margin-bottom:16px;font-size:13px;color:#c7c7cc">' +
                    '<strong style="color:#007AFF">🔵 ROC NATION</strong> — Dados oficiais das plataformas ' +
                    '(Spotify, Deezer, Apple Music, Amazon). Atualizado mensalmente.' +
                '</div>';

            periodos.forEach(function (p) {
                html +=
                    '<div style="background:var(--apple-bg-card);border:1px solid var(--apple-separator);' +
                        'border-radius:12px;padding:16px;margin-bottom:12px">' +
                        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">' +
                            '<div style="color:#fff;font-weight:700;font-size:15px">' +
                                '📅 ' + (p.periodo || 'Período') +
                            '</div>' +
                            '<div style="color:var(--apple-label-2);font-size:12px">' +
                                (p.importado_em ? new Date(p.importado_em).toLocaleDateString('pt-BR') : '') +
                            '</div>' +
                        '</div>' +
                        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:12px">' +
                            '<div>' +
                                '<div style="color:var(--apple-label-2);font-size:11px">Músicas</div>' +
                                '<div style="color:#fff;font-size:18px;font-weight:700">' +
                                    (p.total_musicas || 0) +
                                '</div>' +
                            '</div>' +
                            '<div>' +
                                '<div style="color:var(--apple-label-2);font-size:11px">Streams</div>' +
                                '<div style="color:#fff;font-size:18px;font-weight:700">' +
                                    formatarNumero(p.total_streams || 0) +
                                '</div>' +
                            '</div>' +
                            '<div>' +
                                '<div style="color:var(--apple-label-2);font-size:11px">Receita</div>' +
                                '<div style="color:#34c759;font-size:18px;font-weight:700">' +
                                    'R$ ' + (p.total_receita || 0).toFixed(2) +
                                '</div>' +
                            '</div>' +
                        '</div>' +
                    '</div>';
            });

            c.innerHTML = html;

        } catch (e) {
            console.error(e);
            c.innerHTML = '<div class="text-muted text-center p-4">Erro ao carregar ROC Nation</div>';
        }
    };

    // ============================================================
    // VER RANKING GERAL
    // ============================================================
    window.verStreamsRanking = async function () {
        var c = document.getElementById('streamsPanelDetalhe');
        if (!c) return;

        c.innerHTML = '<div style="text-align:center;padding:20px"><div class="spinner-border spinner-border-sm text-warning"></div></div>';

        try {
            var r = await callAPI('get_streaming_ranking', { limit: 50 });
            var ranking = (r && r.success && r.data) ? r.data : [];

            if (!ranking.length) {
                c.innerHTML = '<div class="empty-state-actionable"><i class="bi bi-trophy empty-icon"></i><h5 class="text-muted">Sem dados ainda</h5></div>';
                return;
            }

            var html =
                '<div style="background:rgba(255,204,0,0.08);border-left:3px solid #ffcc00;' +
                    'padding:12px 16px;border-radius:8px;margin-bottom:16px;font-size:13px;color:#c7c7cc">' +
                    '<strong style="color:#ffcc00">🏆 RANKING GERAL</strong> — Top músicas por streams no PLAY MY' +
                '</div>' +
                '<div style="display:grid;gap:8px">';

            ranking.slice(0, 10).forEach(function (m, i) {
                var medalha = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '#' + (i + 1);

                html +=
                    '<div style="background:var(--apple-bg-card);border:1px solid var(--apple-separator);' +
                        'border-radius:10px;padding:12px;display:flex;align-items:center;gap:12px">' +
                        '<div style="font-size:20px;min-width:36px;text-align:center">' + medalha + '</div>' +
                        '<div style="flex:1;color:#fff;font-weight:600;font-size:14px">' +
                            (m.music_id || 'Música') +
                        '</div>' +
                        '<div style="color:#34c759;font-weight:800;font-size:16px">' +
                            m.streams_total +
                        '</div>' +
                    '</div>';
            });

            html += '</div>';
            c.innerHTML = html;

        } catch (e) {
            console.error(e);
            c.innerHTML = '<div class="text-muted text-center p-4">Erro ao carregar ranking</div>';
        }
    };

    // ============================================================
    // HELPERS
    // ============================================================
    function formatarNumero(n) {
        n = parseInt(n) || 0;
        if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
        return String(n);
    }

    // ============================================================
    // LOG
    // ============================================================
    console.log('✅ [streams-panel.js] v1.0.0 carregado');
})();
