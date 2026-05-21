/**
 * nav-dropdown.js
 *
 * Behaviour for the hierarchical nav (Solutions / Developers / Resources)
 * shipped across every English page (and rolling out to localized pages
 * later). The HTML is static in every page for SEO / crawler signal — this
 * script only adds open/close, keyboard nav, edge detection, and the
 * mobile hamburger toggle.
 *
 * Contract:
 *   - Each dropdown item: <li class="nav-item has-dropdown">
 *       <button class="nav-dropdown" aria-haspopup="true" aria-expanded="false"
 *               aria-controls="panel-{id}">Label</button>
 *       <div class="nav-dropdown-panel" id="panel-{id}" role="menu" hidden>...</div>
 *     </li>
 *   - Mobile hamburger: <button class="nav-mobile-toggle" aria-expanded="false"
 *                              aria-controls="nav-primary">...</button>
 *   - Primary menu container: any element with .nav-primary (on mobile,
 *     toggling `.open` shows/hides it).
 *
 * Idempotent: safe to load twice (does nothing on subsequent loads).
 *
 * Plain vanilla JS, no dependencies. ~3 KB minified.
 */
(function () {
    'use strict';

    if (window.__rakuNavDropdownInit__) return;
    window.__rakuNavDropdownInit__ = true;

    function init() {
        var navItems = document.querySelectorAll('.nav-primary > .nav-item');
        if (!navItems.length) return;

        var triggers = [];
        var panels = [];

        navItems.forEach(function (item) {
            // Top-level item is either a dropdown button (.nav-dropdown) or
            // a flat link (<a role="menuitem">). Both must be reachable via
            // left/right arrow keys per WAI-ARIA menubar pattern.
            var trigger = item.querySelector('.nav-dropdown') ||
                          item.querySelector(':scope > a[role="menuitem"]');
            var panel = item.querySelector('.nav-dropdown-panel');
            if (!trigger) return;
            triggers.push(trigger);
            panels.push(panel); // may be null for flat links

            if (panel) {
                trigger.addEventListener('click', function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    var wasOpen = trigger.getAttribute('aria-expanded') === 'true';
                    closeAll();
                    if (!wasOpen) openPanel(trigger, panel);
                });
            }

            trigger.addEventListener('keydown', function (e) {
                if (panel && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    openPanel(trigger, panel);
                    focusFirstItem(panel);
                } else if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    moveTrigger(trigger, +1);
                } else if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    moveTrigger(trigger, -1);
                } else if (e.key === 'Escape') {
                    closeAll();
                }
            });

            if (panel) {
                panel.addEventListener('keydown', function (e) {
                    var items = Array.prototype.slice.call(
                        panel.querySelectorAll('a[role="menuitem"], a')
                    );
                    var idx = items.indexOf(document.activeElement);
                    if (e.key === 'Escape') {
                        e.preventDefault();
                        closeAll();
                        trigger.focus();
                    } else if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        items[(idx + 1 + items.length) % items.length].focus();
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        items[(idx - 1 + items.length) % items.length].focus();
                    } else if (e.key === 'ArrowRight') {
                        e.preventDefault();
                        moveTrigger(trigger, +1);
                    } else if (e.key === 'ArrowLeft') {
                        e.preventDefault();
                        moveTrigger(trigger, -1);
                    }
                });
            }
        });

        function openPanel(trigger, panel) {
            trigger.setAttribute('aria-expanded', 'true');
            panel.hidden = false;
            // Edge-detect: flip the panel if it would overflow the right edge.
            // Only flip on desktop — on mobile the panel is static-positioned.
            if (window.innerWidth > 880) {
                panel.classList.remove('panel-flip-right');
                var rect = panel.getBoundingClientRect();
                if (rect.right > window.innerWidth - 16) {
                    panel.classList.add('panel-flip-right');
                }
            }
        }

        function closeAll() {
            triggers.forEach(function (t) { t.setAttribute('aria-expanded', 'false'); });
            panels.forEach(function (p) {
                if (!p) return;
                p.hidden = true;
                p.classList.remove('panel-flip-right');
            });
        }

        function focusFirstItem(panel) {
            var first = panel.querySelector('a[role="menuitem"], a');
            if (first) first.focus();
        }

        function moveTrigger(currentTrigger, delta) {
            var idx = triggers.indexOf(currentTrigger);
            if (idx === -1) return;
            var nextIdx = (idx + delta + triggers.length) % triggers.length;
            var next = triggers[nextIdx];
            // WAI-ARIA menubar: horizontal arrows move focus between top-level
            // items only. Use ArrowDown / Enter / Space to enter the submenu.
            closeAll();
            next.focus();
        }

        // Click outside closes. Click on a link inside a panel also closes,
        // so anchor links to same-page sections don't leave the menu open.
        document.addEventListener('click', function (e) {
            if (e.target.closest('.nav-dropdown-panel a')) { closeAll(); return; }
            if (!e.target.closest('.nav-item.has-dropdown')) closeAll();
        });

        // ESC anywhere closes
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') closeAll();
        });

        // Mobile hamburger toggle
        var mobileToggle = document.querySelector('.nav-mobile-toggle');
        var navPrimary = document.querySelector('.nav-primary, .nav-links');
        if (mobileToggle && navPrimary) {
            mobileToggle.addEventListener('click', function (e) {
                e.stopPropagation();
                var open = navPrimary.classList.toggle('open');
                mobileToggle.setAttribute('aria-expanded', String(open));
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
