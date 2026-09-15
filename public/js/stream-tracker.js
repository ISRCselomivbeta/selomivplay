// ============================================================
// js/stream-tracker.js — PLAY MY v1.0.0
// Dispara o registro de stream quando o usuário toca uma música.
// Chama /api/streams?action=registrar
// ============================================================

(function () {
    'use strict';

    var ULTIMO_STREAM = { id: null, ts: 0 };
    var INTERVALO_MINIMO = 30000; // 30 segundos entre plays da mesma música

    // ============================================================
    // REGISTRAR PLAY
    // ============================================================
    window.registrarPlayPlayMy = function (musicId, titulo, userId) {
        if (!musicId) return;

        var agora = Date.now();
        if (ULTIMO_STREAM.id === musicId && (agora - ULTIMO_STREAM.ts) < INTERVALO_MINIMO) {
            console.log('🎵 [stream-tracker] duplicado, ignorando');
            return;
        }
        ULTIMO_STREAM = { id: musicId, ts: agora };

        var url = '/api/streams?action=registrar' +
            '&music_id=' + encodeURIComponent(musicId) +
            '&user_id=' + encodeURIComponent(userId || 'anon') +
            '&titulo=' + encodeURIComponent(titulo || '');

        console.log('🎵 [stream-tracker] registrando play do PLAY MY:', musicId);

        fetch(url)
            .then(function (r) { return r.json(); })
            .then(function (json) {
                if (json && json.success) {
                    console.log('✅ [stream-tracker] PLAY MY registrou:', json.mensagem,
                        '| total: ' + json.total, '| hoje: ' + json.hoje);
                }
            })
            .catch(function (e) {
                console.warn('⚠️ [stream-tracker] erro:', e.message);
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
                        window.registrarPlayPlayMy(t.id, t.titulo, user ? user.id : 'anon');
                    }
                } catch (e) {
                    console.warn('⚠️ [stream-tracker] erro ao registrar:', e);
                }
            };

            console.log('✅ [stream-tracker] integrado ao playTrack');
            clearInterval(intervalo);
        }

        if (tentativas > 40) {
            console.warn('⚠️ [stream-tracker] playTrack não encontrado');
            clearInterval(intervalo);
        }
    }, 500);

    console.log('✅ [stream-tracker.js] v1.0.0 carregado');
})();
