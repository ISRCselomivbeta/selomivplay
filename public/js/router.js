// ============================================================
// js/router.js — PLAY MY v1.0.0
// Sistema de roteamento SPA
// ============================================================

const ROUTES = {
    '/':              { section: 'marketplace' },
    '/marketplace':   { section: 'marketplace' },
    '/news':          { section: 'news' },
    '/portfolio':     { section: 'portfolio' },
    '/ledger':        { section: 'ledger' },
    '/artists':       { section: 'artists' },
    '/investments':   { section: 'investments' },
    '/playlists':     { section: 'playlists' },
    '/external':      { section: 'external' },
    '/artist':        { section: 'artist' },
    '/admin':         { section: 'admin' },
    '/tickets':       { section: 'tickets' },
    '/blockchain':    { section: 'blockchain' },
    '/trades':        { section: 'trades' }
};

const Router = {
    currentSection: null,
    initialized: false,

    init() {
        if (this.initialized) return;
        this.initialized = true;
        console.log('🧭 [router] Inicializando...');
        this.detectInitialRoute();

        window.addEventListener('popstate', (e) => {
            if (e.state && e.state.section) {
                this.goToSection(e.state.section, false);
            }
        });

        console.log('✅ [router] Pronto');
    },

    detectInitialRoute() {
        const params = new URLSearchParams(window.location.search);
        const section = params.get('section');
        if (section) return this.goToSection(section, false);

        const path = window.location.pathname;
        if (ROUTES[path]) return this.goToSection(ROUTES[path].section, false);

        this.goToSection('marketplace', false);
    },

    goToSection(section, pushState = true) {
        if (!section || this.currentSection === section) return;
        this.currentSection = section;

        if (typeof changeSection === 'function') {
            try { changeSection(section); } catch (e) {}
        }

        if (pushState) {
            const path = '/' + section;
            try { window.history.pushState({ section }, section, path); }
            catch (e) {}
        }
    },

    getCurrentSection() { return this.currentSection; }
};

window.Router = Router;
window.navigateTo = (p) => Router.goToSection(p);
window.goToSection = (s) => Router.goToSection(s);

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => Router.init());

console.log('✅ [router.js] v1.0.0 carregado');
