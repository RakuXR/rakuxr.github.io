/**
 * auth-nav.js
 *
 * Shared nav-link injector. Adds a "Sign In" link (or "Dashboard" when the
 * visitor already has a session token in localStorage) to the global nav on
 * every marketing/docs page so visitors don't have to drill into the
 * "Developers" link first to find login.
 *
 * Why this exists: the site has no shared nav partial. Every page hand-copies
 * the same `<nav>` block. Hand-editing ~40 files would mean ~40 separate
 * touches that drift over time. Instead, each page now references this single
 * script and the link is injected at runtime.
 *
 * Behaviour:
 *   - Looks up the nav with `nav .nav-links` (the structure used on every
 *     marketing/docs page) and falls back to bare `<nav>` for the engine
 *     dashboard, which uses a flatter nav structure.
 *   - When `localStorage.raku_access_token` is set, the label/href become
 *     "Dashboard" -> `/developers/dashboard.html`; otherwise "Sign In" ->
 *     `/developers/login.html`. On localized pages (e.g. `/ja/`, `/zh-CN/`)
 *     the route is the localized `/<locale>/developers/...` equivalent so
 *     the label matches the destination.
 *   - Localized pages get localized labels. Supported locales:
 *       en     -> "Sign In"        / "Dashboard"
 *       ja     -> "サインイン"      / "ダッシュボード"
 *       zh-CN  -> "登录"            / "控制台"
 *       zh-TW  -> "登入"            / "控制台"
 *       ko     -> "로그인"           / "대시보드"
 *       de     -> "Anmelden"        / "Dashboard"
 *       pt-BR  -> "Entrar"          / "Painel"
 *       fr     -> "Connexion"       / "Tableau de bord"
 *       es     -> "Iniciar sesión"  / "Panel"
 *     Locale is detected from `<html lang>` first, then from the URL path
 *     prefix (`/ja/`, `/zh-CN/`, `/zh-TW/`, `/ko/`, `/de/`, `/pt-BR/`,
 *     `/fr/`, `/es/`). Defaults to `en`.
 *   - The href is an absolute site path (`/developers/...`). The script
 *     itself is loaded via the same absolute convention (`/js/auth-nav.js`),
 *     so the site is already deployed at the domain root; matching that
 *     here avoids subtle bugs with directory URLs like `/engine/` or `/ja/`
 *     where relative-path math would resolve to a non-existent
 *     `/engine/developers/login.html`.
 *   - Inserts the link BEFORE any `.lang-toggle` so the language toggle
 *     stays rightmost.
 *   - Idempotent and self-healing: if a `.nav-signin` or `.nav-dashboard`
 *     link is already in the nav (some pages hand-coded one before this
 *     script existed), it is UPDATED in place rather than skipped — so the
 *     "Dashboard" swap for logged-in users still happens on those pages.
 *
 * Plain vanilla JS, no dependencies. Loaded with `defer` so it does not
 * block page rendering.
 */
(function () {
    'use strict';

    var TOKEN_KEY = 'raku_access_token';

    // Localized labels per supported locale. Defaults to 'en' when the
    // detected locale is not in this map. Translations chosen to match
    // common dev-tool conventions (Google Cloud Console / Stripe).
    var LABELS = {
        'en':    { signin: 'Sign In',       dashboard: 'Dashboard' },
        'ja':    { signin: 'サインイン',     dashboard: 'ダッシュボード' },
        'zh-CN': { signin: '登录',          dashboard: '控制台' },
        'zh-TW': { signin: '登入',          dashboard: '控制台' },
        'ko':    { signin: '로그인',         dashboard: '대시보드' },
        'de':    { signin: 'Anmelden',      dashboard: 'Dashboard' },
        'pt-BR': { signin: 'Entrar',        dashboard: 'Painel' },
        'fr':    { signin: 'Connexion',     dashboard: 'Tableau de bord' },
        'es':    { signin: 'Iniciar sesión', dashboard: 'Panel' }
    };

    // Locale code -> URL path prefix. The order matters for path matching:
    // longer/more-specific prefixes (e.g. zh-CN, pt-BR) are listed before
    // shorter ones so a path like `/zh-CN/foo` is not mis-matched as `zh`.
    var LOCALES = ['ja', 'zh-CN', 'zh-TW', 'ko', 'de', 'pt-BR', 'fr', 'es'];

    function findNav() {
        // Most pages use <nav><div class="container"><div class="nav-links">.
        // why-rakuai.html uses <nav class="site-nav"><div class="container">
        // <div class="links">, so check that container too before falling
        // back to the bare <nav> element (used by engine/index.html, which
        // has a flatter <nav>...<a>...<a></nav> structure).
        return document.querySelector('nav .nav-links, nav .links')
            || document.querySelector('nav');
    }

    function isLoggedIn() {
        try {
            return !!localStorage.getItem(TOKEN_KEY);
        } catch (_) {
            // localStorage may be unavailable (private mode, sandboxed iframe).
            // Treat as logged-out — Sign In link still works.
            return false;
        }
    }

    function currentLocale() {
        // Prefer <html lang> when present — the localized HTML files set it
        // explicitly, so this is the most reliable signal even on pages
        // that don't sit under a /<locale>/ prefix (e.g. shared 404).
        var html = document.documentElement;
        var lang = html && (html.lang || html.getAttribute('lang'));
        if (lang) {
            for (var i = 0; i < LOCALES.length; i++) {
                if (lang === LOCALES[i]) return LOCALES[i];
            }
        }
        // Fall back to URL path prefix detection.
        var path = window.location.pathname;
        for (var j = 0; j < LOCALES.length; j++) {
            var code = LOCALES[j];
            // Escape the dash in zh-CN/zh-TW/pt-BR for the regex; '-' is
            // not a regex metachar but be explicit for readability.
            var re = new RegExp('^/' + code.replace('-', '\\-') + '(/|$)');
            if (re.test(path)) return code;
        }
        return 'en';
    }

    function applyState(link, loggedIn, locale) {
        // Localized pages route to the localized portal so the label and
        // the destination match. The /<locale>/developers/* tree is
        // created by each locale's parity PR; merging this fix before
        // that PR lands would 404 the localized sign-in link for that
        // locale, but the EN fallback continues to work.
        var portalBase = locale === 'en' ? '/developers/' : '/' + locale + '/developers/';
        link.href = portalBase + (loggedIn ? 'dashboard.html' : 'login.html');
        link.className = loggedIn ? 'nav-dashboard' : 'nav-signin';
        var labels = LABELS[locale] || LABELS.en;
        link.textContent = loggedIn ? labels.dashboard : labels.signin;
    }

    function inject() {
        var nav = findNav();
        if (!nav) return;

        var loggedIn = isLoggedIn();
        var locale = currentLocale();

        // If a hand-coded sign-in/dashboard link already exists on the page,
        // update it in place so the auth state stays consistent across the
        // whole site. Otherwise create and insert a fresh one.
        var existing = nav.querySelector('.nav-signin, .nav-dashboard');
        if (existing) {
            applyState(existing, loggedIn, locale);
            return;
        }

        var a = document.createElement('a');
        applyState(a, loggedIn, locale);

        // Keep the language toggle rightmost by inserting before it when
        // present. The toggle may not be a direct child of the container
        // we're injecting into (e.g. .site-nav puts both .links and the
        // toggle inside .container), so use lang.parentNode to do the
        // insert at its actual home rather than throwing NotFoundError.
        var lang = nav.querySelector('.lang-toggle');
        if (lang && lang.parentNode) {
            lang.parentNode.insertBefore(a, lang);
        } else {
            nav.appendChild(a);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inject);
    } else {
        inject();
    }
})();
