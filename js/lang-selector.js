/**
 * lang-selector.js
 *
 * Multi-language selector (Design B). Renders a small globe icon (🌐)
 * immediately AFTER the existing `.lang-toggle` chip in the global nav.
 * Clicking the globe opens a dropdown listing every supported locale by
 * its NATIVE name. The existing `楽AI` / `EN` `.lang-toggle` chip stays
 * untouched as a fast one-click EN<->JA swap that users already love.
 *
 * Why this exists: the site has no shared nav partial. Every page
 * hand-copies the same `<nav>` block, so the language picker has to be
 * injected at runtime instead of edited into ~50 files. Loaded with
 * `defer` alongside `js/auth-nav.js`; the two scripts coexist and inject
 * into the nav independently.
 *
 * Behaviour:
 *   - Detects the current locale from `<html lang>` first, falling back
 *     to the path prefix (`/ja/`, `/zh-CN/`, ...).
 *   - For each target locale, picks a destination URL using a small
 *     hardcoded availability map. If the current path's file is known
 *     to exist for that locale, links to the localized equivalent; else
 *     falls back to the locale's `index.html`. This avoids 404s from
 *     deep-linking into a locale tree that doesn't yet have that page.
 *   - The AVAILABILITY map lists the Tier-1 pages for all 9 locales.
 *     EN/JA trees exist today; the other seven are being added by
 *     parallel translation PRs (#178-#185). Until those merge, links
 *     to those locales will 404 — that's a known transient state.
 *   - Dropdown is keyboard accessible (Tab focusable, Enter/Space open,
 *     ArrowUp/ArrowDown navigate, Esc closes), closes on click-outside
 *     or item selection, and marks the current locale with a checkmark.
 *   - Idempotent: skipped if a `.lang-globe` button is already present.
 *
 * Plain vanilla JS, no dependencies.
 */
(function () {
    'use strict';

    // All known locales, in display order. Labels are always shown in
    // the TARGET language's native script — never translated.
    var LOCALES = [
        { code: 'en',    label: 'English',       prefix: '' },
        { code: 'ja',    label: '日本語',         prefix: 'ja/' },
        { code: 'zh-CN', label: '中文 (简体)',    prefix: 'zh-CN/' },
        { code: 'zh-TW', label: '中文 (繁體)',    prefix: 'zh-TW/' },
        { code: 'ko',    label: '한국어',          prefix: 'ko/' },
        { code: 'de',    label: 'Deutsch',       prefix: 'de/' },
        { code: 'pt-BR', label: 'Português (BR)', prefix: 'pt-BR/' },
        { code: 'fr',    label: 'Français',      prefix: 'fr/' },
        { code: 'es',    label: 'Español',       prefix: 'es/' }
    ];

    // Pages known to exist per locale. Keys are paths relative to the
    // locale root (e.g. 'pricing.html' or 'developers/sdk.html'). If a
    // path is NOT in the set for the target locale, the link falls back
    // to that locale's index.html. Update this map as new translation
    // trees land.
    var EN_PAGES = [
        '', 'index.html',
        '404.html', 'ai-systems.html', 'capture.html', 'compare.html',
        'contact.html', 'content-packs.html', 'creator.html',
        'dashboard.html', 'developer-guide.html', 'discover.html', 'docs.html',
        'enterprise.html', 'llm-guide.html', 'llm-makers.html', 'mcp.html',
        'my-games.html', 'press.html', 'pricing.html', 'privacy.html',
        'pro-features.html', 'profile.html', 'schema.html', 'sdk.html',
        'share.html', 'smart-glasses.html', 'spatial-engine.html',
        'templates.html', 'terms.html', 'validate.html', 'why-rakuai.html',
        'xr-features.html',
        'developers/', 'developers/index.html',
        'developers/claude-desktop.html', 'developers/dashboard.html',
        'developers/docs.html', 'developers/login.html',
        'developers/register.html', 'developers/sdk.html',
        'developers/showcase.html', 'developers/signup.html',
        'developers/status.html', 'developers/support.html',
        'scenarios/', 'scenarios/index.html', 'scenarios/safespace.html',
        'scenarios/timelens.html', 'scenarios/trailquest.html',
        'tutorials/', 'tutorials/index.html', 'tutorials/ai-npc-tutorial.html',
        'tutorials/getting-started-xr.html',
        'tutorials/mixed-reality-tutorial.html',
        'tutorials/physics-tutorial.html',
        'tutorials/spatial-audio-tutorial.html',
        'engine/', 'engine/index.html'
    ];

    var JA_PAGES = [
        '', 'index.html',
        '404.html', 'ai-systems.html', 'capture.html', 'compare.html',
        'contact.html', 'content-packs.html', 'creator.html',
        'dashboard.html', 'developer-guide.html', 'discover.html', 'docs.html',
        'enterprise.html', 'llm-guide.html', 'llm-makers.html', 'mcp.html',
        'my-games.html', 'press.html', 'pricing.html', 'privacy.html',
        'pro-features.html', 'profile.html', 'schema.html', 'sdk.html',
        'share.html', 'smart-glasses.html', 'spatial-engine.html',
        'templates.html', 'terms.html', 'validate.html', 'why-rakuai.html',
        'xr-features.html',
        'developers/', 'developers/index.html', 'developers/dashboard.html',
        'developers/docs.html', 'developers/login.html',
        'developers/register.html', 'developers/signup.html',
        'developers/sdk.html', 'developers/showcase.html',
        'developers/status.html', 'developers/support.html'
    ];

    // Tier-1 page set shared by all seven incoming locale trees
    // (pt-BR, es, fr, de, zh-CN, zh-TW, ko). Each translation PR
    // (#178-#185) lands the same 10 pages, so they share one list.
    // Until those PRs merge the destinations 404 — the map describes
    // the eventual state so deep-linking works as soon as they land.
    var TIER1_PAGES = [
        '', 'index.html',
        'why-rakuai.html', 'pricing.html', 'enterprise.html',
        'developer-guide.html', 'contact.html',
        'developers/', 'developers/index.html',
        'developers/login.html', 'developers/register.html',
        'developers/dashboard.html'
    ];

    function toSet(arr) {
        var s = {};
        for (var i = 0; i < arr.length; i++) s[arr[i]] = true;
        return s;
    }

    var AVAILABILITY = {
        'en':    toSet(EN_PAGES),
        'ja':    toSet(JA_PAGES),
        'pt-BR': toSet(TIER1_PAGES),
        'es':    toSet(TIER1_PAGES),
        'fr':    toSet(TIER1_PAGES),
        'de':    toSet(TIER1_PAGES),
        'zh-CN': toSet(TIER1_PAGES),
        'zh-TW': toSet(TIER1_PAGES),
        'ko':    toSet(TIER1_PAGES)
    };

    // Localized tooltip / aria-label for the globe button. Falls back to
    // English for any locale we don't have a string for yet.
    var TOOLTIPS = {
        'en':    'Change language',
        'ja':    '言語を変更',
        'zh-CN': '更改语言',
        'zh-TW': '變更語言',
        'ko':    '언어 변경',
        'de':    'Sprache ändern',
        'pt-BR': 'Mudar idioma',
        'fr':    'Changer de langue',
        'es':    'Cambiar idioma'
    };

    // Minimal fallback styles for pages that don't load /style.css
    // (e.g. press.html, engine/index.html, scenarios/*). Pages WITH
    // style.css get the canonical look — these rules are lower-
    // specificity duplicates that the canonical sheet overrides via
    // the cascade order (this <style> is injected into <head> before
    // style.css evaluation continues).
    var FALLBACK_CSS = [
        '.lang-selector { position: relative; display: inline-block; margin-left: 8px; vertical-align: middle; }',
        '.lang-globe { background: none; border: 1px solid currentColor; border-radius: 6px; padding: 4px 10px; cursor: pointer; color: inherit; font-size: 0.9rem; font-family: inherit; line-height: 1; }',
        '.lang-globe:hover { background: rgba(255,255,255,0.06); }',
        '.lang-menu { position: absolute; right: 0; top: calc(100% + 6px); min-width: 200px; background: #14142a; border: 1px solid #2a2a4a; border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.4); padding: 6px 0; z-index: 1000; display: none; }',
        '.lang-menu.is-open { display: block; }',
        '.lang-menu a { display: block; padding: 8px 14px; color: #e8e8f0; text-decoration: none; font-size: 0.92rem; }',
        '.lang-menu a:hover, .lang-menu a:focus { background: rgba(108,92,231,0.15); }',
        '.lang-menu a.is-current { font-weight: 700; }',
        '.lang-menu a.is-current::before { content: \'\\2713  \'; }',
        '@media (max-width: 600px) { .lang-menu { right: 4px; min-width: 160px; } }'
    ].join('\n');

    function injectFallbackStyles() {
        if (document.querySelector('style[data-lang-selector-fallback]')) return;
        var s = document.createElement('style');
        s.setAttribute('data-lang-selector-fallback', '');
        s.textContent = FALLBACK_CSS;
        document.head.appendChild(s);
    }

    function findNav() {
        return document.querySelector('nav .nav-links, nav .links')
            || document.querySelector('nav');
    }

    // Returns the current locale code. Prefers <html lang> (case-
    // insensitive, with region-subtag fallback so `en-US` matches `en`);
    // falls back to scanning the path for a known /<locale>/ prefix
    // (tolerating either `/ja` or `/ja/`).
    function currentLocale() {
        var html = document.documentElement;
        var lang = html && (html.lang || html.getAttribute('lang'));
        if (lang) {
            lang = lang.toLowerCase();
            for (var i = 0; i < LOCALES.length; i++) {
                var code = LOCALES[i].code.toLowerCase();
                if (code === lang || lang.indexOf(code + '-') === 0) {
                    return LOCALES[i].code;
                }
            }
        }
        var path = window.location.pathname;
        for (var j = 0; j < LOCALES.length; j++) {
            var p = LOCALES[j].prefix; // e.g. 'ja/'
            if (!p) continue;
            var pNoSlash = p.replace(/\/$/, '');
            if (path === '/' + pNoSlash || path.indexOf('/' + p) === 0) {
                return LOCALES[j].code;
            }
        }
        return 'en';
    }

    // Strips the current locale's prefix from the pathname, returning
    // the page key (e.g. 'pricing.html' or 'developers/sdk.html'). The
    // EN tree lives at the site root, so for EN this just trims the
    // leading slash.
    function currentPageKey(currentCode) {
        var path = window.location.pathname.replace(/^\/+/, '');
        var loc;
        for (var k = 0; k < LOCALES.length; k++) {
            if (LOCALES[k].code === currentCode) { loc = LOCALES[k]; break; }
        }
        if (loc && loc.prefix && path.indexOf(loc.prefix) === 0) {
            path = path.slice(loc.prefix.length);
        }
        // Directory URLs ('developers/' or '') are valid keys in the
        // availability set.
        return path;
    }

    function urlFor(targetLocale, pageKey) {
        var base = '/' + targetLocale.prefix; // '/' for EN, '/ja/', etc.
        var avail = AVAILABILITY[targetLocale.code];
        if (avail) {
            // Tolerate trailing-slash mismatch: `/developers` (pageKey
            // `developers`) should still resolve via `developers/`.
            if (avail[pageKey]) return base + pageKey;
            if (avail[pageKey + '/']) return base + pageKey + '/';
        }
        return base + 'index.html';
    }

    function buildSelector(currentCode, pageKey) {
        var wrapper = document.createElement('div');
        wrapper.className = 'lang-selector';

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'lang-globe';
        btn.setAttribute('aria-haspopup', 'listbox');
        btn.setAttribute('aria-expanded', 'false');
        btn.setAttribute('aria-label', TOOLTIPS[currentCode] || TOOLTIPS.en);
        btn.title = TOOLTIPS[currentCode] || TOOLTIPS.en;
        btn.textContent = '🌐'; // 🌐
        wrapper.appendChild(btn);

        var menu = document.createElement('ul');
        menu.className = 'lang-menu';
        menu.setAttribute('role', 'listbox');
        menu.hidden = true;

        var items = [];
        for (var i = 0; i < LOCALES.length; i++) {
            var loc = LOCALES[i];
            var li = document.createElement('li');
            li.setAttribute('role', 'presentation');

            var a = document.createElement('a');
            a.href = urlFor(loc, pageKey);
            a.setAttribute('role', 'option');
            a.setAttribute('hreflang', loc.code);
            a.setAttribute('lang', loc.code);
            a.dataset.code = loc.code;
            a.tabIndex = -1;

            var isCurrent = loc.code === currentCode;
            if (isCurrent) {
                a.classList.add('is-current');
                a.setAttribute('aria-current', 'true');
                a.setAttribute('aria-selected', 'true');
            } else {
                a.setAttribute('aria-selected', 'false');
            }

            var check = document.createElement('span');
            check.className = 'lang-check';
            check.setAttribute('aria-hidden', 'true');
            check.textContent = isCurrent ? '✓' : '';
            a.appendChild(check);

            var lbl = document.createElement('span');
            lbl.className = 'lang-label';
            lbl.textContent = loc.label;
            a.appendChild(lbl);

            li.appendChild(a);
            menu.appendChild(li);
            items.push(a);
        }
        wrapper.appendChild(menu);

        function setOpen(open) {
            menu.hidden = !open;
            btn.setAttribute('aria-expanded', open ? 'true' : 'false');
            wrapper.classList.toggle('is-open', open);
            // Also mirror the state onto the menu element itself so CSS
            // selectors that key off `.lang-menu.is-open` (the fallback
            // stylesheet, and the defensive rule in style.css) actually
            // flip from `display: none` to `display: block`. Without this
            // mirror the wrapper opens but the menu stays hidden — the
            // exact symptom reported after PR #180 shipped.
            menu.classList.toggle('is-open', open);
            if (open) {
                // Focus the current locale's item first if present,
                // else the first item.
                var idx = -1;
                for (var k = 0; k < items.length; k++) {
                    if (items[k].classList.contains('is-current')) { idx = k; break; }
                }
                (items[idx >= 0 ? idx : 0] || btn).focus();
            }
        }

        function isOpen() { return !menu.hidden; }

        btn.addEventListener('click', function (e) {
            e.preventDefault();
            setOpen(!isOpen());
        });
        btn.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setOpen(true);
            }
        });

        // Arrow-key navigation inside the menu.
        menu.addEventListener('keydown', function (e) {
            var focusIdx = items.indexOf(document.activeElement);
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                var next = items[(focusIdx + 1) % items.length];
                if (next) next.focus();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                var prev = items[(focusIdx - 1 + items.length) % items.length];
                if (prev) prev.focus();
            } else if (e.key === 'Home') {
                e.preventDefault();
                items[0] && items[0].focus();
            } else if (e.key === 'End') {
                e.preventDefault();
                items[items.length - 1] && items[items.length - 1].focus();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                setOpen(false);
                btn.focus();
            }
        });

        // Item activation: native <a> click handles navigation, we just
        // close the menu so the visual state stays consistent if a
        // listener somewhere cancels the click.
        items.forEach(function (a) {
            a.addEventListener('click', function () { setOpen(false); });
        });

        // Click outside closes the menu.
        document.addEventListener('click', function (e) {
            if (!isOpen()) return;
            if (!wrapper.contains(e.target)) setOpen(false);
        });

        // Esc anywhere closes the menu.
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && isOpen()) {
                setOpen(false);
                btn.focus();
            }
        });

        return wrapper;
    }

    function inject() {
        var nav = findNav();
        if (!nav) return;
        if (nav.querySelector('.lang-globe')) return; // idempotent

        injectFallbackStyles();

        var currentCode = currentLocale();
        var pageKey = currentPageKey(currentCode);
        var selector = buildSelector(currentCode, pageKey);

        // Insert immediately AFTER the existing .lang-toggle chip so
        // the 楽AI/EN one-click toggle stays put and the globe sits to
        // its right. Falls back to appending if no chip is present.
        var chip = nav.querySelector('.lang-toggle');
        if (chip && chip.parentNode) {
            if (chip.nextSibling) {
                chip.parentNode.insertBefore(selector, chip.nextSibling);
            } else {
                chip.parentNode.appendChild(selector);
            }
        } else {
            nav.appendChild(selector);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inject);
    } else {
        inject();
    }
})();
