// ============================================
// SECURITY BRIDGE - PLAY MY COMPATIBLE
// VERSÃO: SEM BLOQUEIOS
// ============================================

(function() {
    'use strict';

    console.log('🛡️ Security Bridge (Play My Mode - Sem bloqueios)');

    // ===== SALVAR REFERÊNCIAS ORIGINAIS =====
    const originalInnerHTML = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    const originalInsertAdjacentHTML = Element.prototype.insertAdjacentHTML;
    const originalEval = window.eval;
    const originalFetch = window.fetch;

    // ===== 1. INNERHTML - PERMITE TUDO =====
    Object.defineProperty(Element.prototype, 'innerHTML', {
        get: function() {
            return originalInnerHTML.get.call(this);
        },
        set: function(value) {
            // PERMITE QUALQUER VALOR - SEM BLOQUEIO
            originalInnerHTML.set.call(this, value);
        },
        configurable: true
    });

    // ===== 2. INSERTADJACENTHTML - PERMITE TUDO =====
    Element.prototype.insertAdjacentHTML = function(position, text) {
        return originalInsertAdjacentHTML.call(this, position, text);
    };

    // ===== 3. EVAL - PERMITE TUDO (necessário para YouTube) =====
    window.eval = function(code) {
        return originalEval(code);
    };

    // ===== 4. FETCH - PERMITE TUDO =====
    window.fetch = function(input, init) {
        return originalFetch.call(this, input, init);
    };

    // ===== 5. LOCALSTORAGE - PERMITE TUDO =====
    // Não modifica localStorage

    // ===== 6. SESSÃO - NÃO EXPIRA =====
    // Remove o timer de expiração

    console.log('✅ Security Bridge: Modo Play My - SEM BLOQUEIOS');
    console.log('🎵 Todas as funcionalidades liberadas!');

})();
