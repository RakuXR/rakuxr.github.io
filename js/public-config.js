/**
 * public-config.js
 *
 * Public (non-secret) deploy-time configuration values. These are SAFE to
 * ship in client JS — they're checked at the boundary (CAPTCHA verify
 * server-side, OAuth callback origin allow-list) — but we keep them in one
 * file so swapping staging/prod or rotating keys is a single-file edit.
 *
 * Production values are baked here. Override in dev by setting
 * window.RAKU_PUBLIC_CONFIG before this script loads (e.g. inline in a
 * dev-only HTML page or via a build step).
 */
(function () {
    'use strict';
    if (window.RAKU_PUBLIC_CONFIG && typeof window.RAKU_PUBLIC_CONFIG === 'object') return;
    window.RAKU_PUBLIC_CONFIG = {
        hcaptcha_site_key: 'PLACEHOLDER_INJECT_AT_DEPLOY',
        google_oauth_client_id: 'PLACEHOLDER_INJECT_AT_DEPLOY'
    };
})();
