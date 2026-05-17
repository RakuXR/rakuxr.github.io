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
 *     "Dashboard" -> `developers/dashboard.html`; otherwise "Sign In" ->
 *     `developers/login.html`.
 *   - Japanese pages (under `/ja/` or `<html lang="ja">`) get localized
 *     labels: "サインイン" / "ダッシュボード".
 *   - The href is computed as a relative path from the current page so it
 *     works at any depth (root, /ja/, /engine/, /tutorials/, /scenarios/,
 *     /blog/<slug>/).
 *   - Inserts the link BEFORE any `.lang-toggle` so the EN/JA toggle stays
 *     rightmost.
 *   - Idempotent: if a `.nav-signin` or `.nav-dashboard` link is already in
 *     the nav (some pages already hand-coded one), nothing is injected.
 *
 * Plain vanilla JS, no dependencies. Loaded with `defer` so it does not
 * block page rendering.
 */
(function () {
    'use strict';

    var TOKEN_KEY = 'raku_access_token';

    function findNav() {
        // Most pages use <nav><div class="container"><div class="nav-links">.
        // engine/index.html uses a flatter <nav>...<a>...<a></nav> with no
        // .nav-links wrapper, so fall back to the <nav> element itself.
        return document.querySelector('nav .nav-links') || document.querySelector('nav');
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

    // Compute the relative prefix from the current page back to the site root,
    // so we can build a path like `developers/login.html` that works from
    // /index.html, /ja/index.html, /engine/index.html, /tutorials/foo.html,
    // /blog/<slug>/index.html, etc.
    function relPrefix() {
        var path = window.location.pathname.replace(/\/+$/, '');
        var segs = path.split('/').slice(1, -1); // drop leading '' and the file
        if (!segs.length) return '';
        var out = '';
        for (var i = 0; i < segs.length; i++) out += '../';
        return out;
    }

    function inject() {
        var nav = findNav();
        if (!nav) return;
        // Idempotency: bail if any flavour of sign-in/dashboard link is
        // already present (some pages hand-coded the link before this script
        // existed).
        if (nav.querySelector('.nav-signin, .nav-dashboard')) return;

        var loggedIn = isLoggedIn();
        var ja = isJa();
        var prefix = relPrefix();

        var a = document.createElement('a');
        a.href = prefix + 'developers/' + (loggedIn ? 'dashboard.html' : 'login.html');
        a.className = loggedIn ? 'nav-dashboard' : 'nav-signin';
        if (ja) {
            a.textContent = loggedIn ? 'ダッシュボード' : 'サインイン';
        } else {
            a.textContent = loggedIn ? 'Dashboard' : 'Sign In';
        }

        // Keep the EN/JA toggle rightmost by inserting before it when present.
        var lang = nav.querySelector('.lang-toggle');
        if (lang) {
            nav.insertBefore(a, lang);
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
