// ============================================================
// js/stream-tracker.js — PLAY MY v1.1.0
// Dispara o registro de stream quando o usuário toca uma música.
//
// MUDANÇAS v1.1.0 (consolidação Opção A):
//   - 🎯 Endpoint correto: /api/backend?action=register_streaming
//     (o backend v9.8.4 tem o Stream Guard: IP + 30min + duration mínima)
//   - 🆕 Envia TODOS os campos: music_id, user_id, duration, timestamp
//   - 🆕 Valida user_id real (não envia 'anon')
//   - 🆕 Trata resposta do guard: se blocked, loga e não insiste
//   - 🔧 Intervalo local reduzido para 5s (só anti-duplo-clique)
//        → proteção real (30 min) fica no backend
//   - 🔧 duration=30 fixo (backend valida mínimo 30s)
// ============================================================

(function () {
    'use strict';

    var ULTIMO_STREAM = { id: null, ts: 0 };
    var INTERVALO_LOCAL = 5000;   // 5s — só anti-duplo-clique (proteção real é no backend)
    var DURATION_PADRAO = 30;     // segundos — backend valida min 30s

    // ============================================================
    // REGISTRAR PLAY (via /api/backend com Stream Guard)
    // ============================================================
    window.registrarPlayPlayMy = function (musicId, titulo, userId) {
        if (!musicId) {
            console.warn('⚠️ [stream-tracker] music_id ausente — ignorando');
            return;
        }

        // 🔒 Valida user_id real (backend rejeita 'anon')
        if (!userId || userId === 'anon') {
            console.log('🎵 [stream-tracker] sem user_id real — não registra (backend exige auth)');
            return;
        }

        var agora = Date.now();

        // 🔒 Anti-duplo-clique local (5s)
        if (ULTIMO_STREAM.id === musicId && (agora - ULTIMO_STREAM.ts) < INTERVALO_LOCAL) {
            console.log('🎵 [stream-tracker] duplicado local (<5s), ignorando');
            return;
        }
        ULTIMO_STREAM = { id: musicId, ts: agora };

        // 🆕 v1.1.0 — todos os campos que o backend espera
        var payload = {
            music_id: String(musicId),
            user_id: String(userId),
            duration: DURATION_PADRAO,
            timestamp: new Date().toISOString(),
            titulo: titulo || ''
        };

        var url = '/api/backend?action=register_streaming' +
            '&music_id=' + encodeURIComponent(payload.music_id) +
            '&user_id=' + encodeURIComponent(payload.user_id) +
            '&duration=' + encodeURIComponent(payload.duration) +
            '&timestamp=' + encodeURIComponent(payload.timestamp) +
            '&titulo=' + encodeURIComponent(payload.titulo);

        console.log('🎵 [stream-tracker] registrando play:', payload.music_id, '| user:', payload.user_id);

        fetch(url)
            .then(function (r) { return r.json(); })
            .then(function (json) {
                if (json && json.success) {
                    console.log('✅ [stream-tracker] stream registrado',
                        '| total: ' + (json.data && json.data.streams_total),
                        '| hoje: ' + (json.data && json.data.streams_hoje));
                } else if (json && json.blocked) {
                    // 🔒 Stream Guard rejeitou
                    console.log('🛡️ [stream-tracker] bloqueado pelo guard:', json.reason || json.message);
                } else {
                    console.warn('⚠️ [stream-tracker] resposta inesperada:', json);
                }
            })
            .catch(function (e) {
                console.warn('⚠️ [stream-tracker] erro de rede:', e.message);
            });
    };

    // ============================================================
    // GANCHO NO playTrack DO PLAYER
    // ============================================================
    var tentativas = 0;
    var intervalo = setInterval(function () {
        tentativas++;

        if (typeof window.playTrack === 'function' && !window._streamTrackerAtivo) {
            window._streamTrackerAtivo = true;

            var playTrackOriginal = window.playTrack;

            window.playTrack = function (index) {
                playTrackOriginal.apply(this, arguments);

                try {
                    var t = window.state && window.state.playlist && window.state.playlist[index];
                    if (t && t.id) {
                        var user = window.state && window.state.currentUser;
                        var userId = user && user.id ? user.id : null;

                        // Só registra se tiver user real
                        if (userId) {
                            window.registrarPlayPlayMy(t.id, t.titulo, userId);
                        } else {
                            console.log('🎵 [stream-tracker] sem usuário logado — não registra');
                        }
                    }
                } catch (e) {
                    console.warn('⚠️ [stream-tracker] erro ao registrar:', e);
                }
            };

            console.log('✅ [stream-tracker] integrado ao playTrack (via /api/backend)');
            clearInterval(intervalo);
        }

        if (tentativas > 40) {
            console.warn('⚠️ [stream-tracker] playTrack não encontrado');
            clearInterval(intervalo);
        }
    }, 500);

    console.log('✅ [stream-tracker.js] v1.1.0 carregado — Stream Guard ativo');
})();
