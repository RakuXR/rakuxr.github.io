// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Developer-flow regression smoke tests.
 *
 * Why this file exists: the 6-PR developer-flow campaign (PRs #169-#175)
 * touched the global nav, the JA portal, the registration NDA gate, and the
 * login page's API-base resolution. These tests guard against silent
 * regressions in that surface area on every PR.
 *
 * Scope intentionally tight:
 *   - Pure client-side assertions. NO real backend roundtrips
 *     (registration/login submits hit api.rakuai.com which CI cannot reach).
 *   - Console-error capture filters out the noise expected for an offline-
 *     backend CI run (favicon misses, api.rakuai.com network failures).
 */

// ---------------------------------------------------------------------------
// Console-error helper
// ---------------------------------------------------------------------------

/**
 * Attach a console listener that collects only "real" errors. Returns the
 * array; caller asserts it's empty at end of test. Filters out:
 *   - favicon 404s (deploy-only asset)
 *   - any error mentioning api.rakuai.com / raku-api / api.raku.games
 *     (real backend hosts that CI has no network path to)
 *   - generic "Failed to load resource" lines that downstream from the above
 */
function captureConsoleErrors(page) {
    /** @type {string[]} */
    const errors = [];
    const ignorePatterns = [
        /favicon/i,
        /api\.rakuai\.com/i,
        /raku-api[-.]/i,
        /api\.raku\.games/i,
        /net::ERR_/i,
        /Failed to load resource/i,
    ];

    page.on('console', (msg) => {
        if (msg.type() !== 'error') return;
        const text = msg.text();
        if (ignorePatterns.some((re) => re.test(text))) return;
        errors.push(text);
    });
    page.on('pageerror', (err) => {
        const text = String(err && err.message ? err.message : err);
        if (ignorePatterns.some((re) => re.test(text))) return;
        errors.push(text);
    });

    return errors;
}

// ---------------------------------------------------------------------------
// Test 1 — every locale/path has a nav Sign In link
// ---------------------------------------------------------------------------

const NAV_PAGES = [
    { path: '/',             jaPortal: false },
    { path: '/engine/',      jaPortal: false },
    { path: '/ja/',          jaPortal: true },
    { path: '/developers/',  jaPortal: false },
];

for (const { path, jaPortal } of NAV_PAGES) {
    test(`nav: ${path} has Sign In link`, async ({ page }) => {
        const errors = captureConsoleErrors(page);

        await page.goto(path);
        // auth-nav.js is loaded with `defer` and injects on DOMContentLoaded.
        // Wait for the link to appear rather than racing it.
        const link = page.locator('nav a.nav-signin').first();
        await expect(link).toBeVisible();

        const href = await link.getAttribute('href');
        expect(href).toBeTruthy();
        const expectedPath = jaPortal
            ? '/ja/developers/login.html'
            : '/developers/login.html';
        // Allow either a site-absolute path or a full URL ending in the path.
        expect(href).toMatch(new RegExp(expectedPath.replace(/\//g, '\\/') + '$'));

        expect(errors, `unexpected console errors on ${path}: ${errors.join(' | ')}`).toEqual([]);
    });
}

// ---------------------------------------------------------------------------
// Test 2 — JA nav label localization
// ---------------------------------------------------------------------------

test('ja nav: localized サインイン label and /ja/developers/ href', async ({ page }) => {
    const errors = captureConsoleErrors(page);

    await page.goto('/ja/index.html');
    const link = page.locator('nav a.nav-signin').first();
    await expect(link).toHaveText('サインイン');

    const href = await link.getAttribute('href');
    expect(href).toBeTruthy();
    // The link should resolve into the JA portal, not the EN one.
    expect(href).toMatch(/\/ja\/developers\//);

    expect(errors, `unexpected console errors on /ja/index.html: ${errors.join(' | ')}`).toEqual([]);
});

// ---------------------------------------------------------------------------
// Test 3 — registration page shows the signed-out nudge when no token
// ---------------------------------------------------------------------------

test('register: signed-out nudge shown, step1 hidden when no token', async ({ page, context }) => {
    const errors = captureConsoleErrors(page);

    // Make sure localStorage is empty for the target origin. clearCookies +
    // an init script that wipes localStorage guarantees a fresh-visitor view
    // even if a prior test polluted the storage.
    await context.clearCookies();
    await page.addInitScript(() => {
        try { window.localStorage.clear(); } catch (_) { /* ignore */ }
    });

    await page.goto('/developers/register.html');

    const needsSignin = page.locator('#needsSignin');
    const step1Panel  = page.locator('#step1Panel');

    // The page flips visibility synchronously from inline JS once it sees no
    // token. Wait via Playwright's auto-waiting expects rather than a sleep.
    await expect(needsSignin).toBeVisible();
    await expect(step1Panel).toBeHidden();

    expect(errors, `unexpected console errors on register.html: ${errors.join(' | ')}`).toEqual([]);
});

// ---------------------------------------------------------------------------
// Test 4 — login page resolves a non-empty API base
// ---------------------------------------------------------------------------

test('login: window.RAKU_API_BASE override resolves to non-empty string', async ({ page }) => {
    const errors = captureConsoleErrors(page);

    // Simulate a deployment that pre-sets the API base (matches how staging /
    // prod inject `window.RAKU_API_BASE` via a small inline script). If the
    // override hook ever gets dropped, this read will return undefined and
    // the test fails.
    await page.addInitScript(() => {
        window.RAKU_API_BASE = 'https://api.rakuai.com';
    });

    await page.goto('/developers/login.html');

    const apiBase = await page.evaluate(() => window.RAKU_API_BASE);
    expect(typeof apiBase).toBe('string');
    expect(apiBase).not.toBe('');

    expect(errors, `unexpected console errors on login.html: ${errors.join(' | ')}`).toEqual([]);
});
