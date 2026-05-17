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
 *     `/developers/login.html`.
 *   - Japanese pages (under `/ja/` or `<html lang="ja">`) get localized
 *     labels: "サインイン" / "ダッシュボード".
 *   - The href is an absolute site path (`/developers/...`). The script
 *     itself is loaded via the same absolute convention (`/js/auth-nav.js`),
 *     so the site is already deployed at the domain root; matching that
 *     here avoids subtle bugs with directory URLs like `/engine/` or `/ja/`
 *     where relative-path math would resolve to a non-existent
 *     `/engine/developers/login.html`.
 *   - Inserts the link BEFORE any `.lang-toggle` so the EN/JA toggle stays
 *     rightmost.
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

    function isJa() {
        var html = document.documentElement;
        if (html && (html.lang === 'ja' || html.getAttribute('lang') === 'ja')) return true;
        return /\/ja(\/|$)/.test(window.location.pathname);
    }

    function applyState(link, loggedIn, ja) {
        link.href = '/developers/' + (loggedIn ? 'dashboard.html' : 'login.html');
        link.className = loggedIn ? 'nav-dashboard' : 'nav-signin';
        if (ja) {
            link.textContent = loggedIn ? 'ダッシュボード' : 'サインイン';
        } else {
            link.textContent = loggedIn ? 'Dashboard' : 'Sign In';
        }
    }

    function inject() {
        var nav = findNav();
        if (!nav) return;

        var loggedIn = isLoggedIn();
        var ja = isJa();

        // If a hand-coded sign-in/dashboard link already exists on the page,
        // update it in place so the auth state stays consistent across the
        // whole site. Otherwise create and insert a fresh one.
        var existing = nav.querySelector('.nav-signin, .nav-dashboard');
        if (existing) {
            applyState(existing, loggedIn, ja);
            return;
        }

        var a = document.createElement('a');
        applyState(a, loggedIn, ja);

        // Keep the EN/JA toggle rightmost by inserting before it when
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
