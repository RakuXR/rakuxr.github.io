/**
 * api-config.js
 *
 * Resolves the RakuAI backend base URL for the current environment.
 * Loaded SYNCHRONOUSLY (without `defer`) so window.RAKU_API_BASE is
 * set before any inline consumer script runs.
 *
 *   - localhost / 127.0.0.1 / empty hostname (file://) -> dev backend
 *   - staging.rakuai.com                              -> Fly.io staging
 *   - everything else                                 -> production
 *
 * Pages can override by setting `window.RAKU_API_BASE` BEFORE loading
 * this script (the script honours an existing value so test pages and
 * future preview environments can wire their own URL).
 */
(function () {
    'use strict';
    if (typeof window.RAKU_API_BASE === 'string' && window.RAKU_API_BASE.length) return;
    var h = window.location.hostname;
    if (h === 'localhost' || h === '127.0.0.1' || h === '') {
        window.RAKU_API_BASE = 'http://localhost:8000';
    } else if (h === 'staging.rakuai.com') {
        window.RAKU_API_BASE = 'https://api.rakuai.com';
    } else {
        window.RAKU_API_BASE = 'https://api.rakuai.com';
    }
})();
