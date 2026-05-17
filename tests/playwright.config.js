// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * Playwright config for rakuai.com static-site E2E smoke tests.
 *
 * - Chromium only (smoke coverage; cross-browser parity is not the goal).
 * - 30s per-test timeout — the static site has no real backend in CI, so
 *   anything taking longer is almost certainly a hang we want to surface.
 * - baseURL points at the local static server started by CI
 *   (`python3 -m http.server 8080` from the repo root).
 * - Tests live in ./e2e; this config file is co-located with package.json
 *   under /tests so the dev dependency on @playwright/test stays out of
 *   the production-deployed site root.
 */
module.exports = defineConfig({
    testDir: './e2e',
    timeout: 30_000,
    expect: { timeout: 5_000 },
    // Run tests serially. The backing static server is `python3 -m http.server`,
    // which is single-threaded and serializes requests anyway; parallelism only
    // adds contention and flaky timeouts. `fullyParallel:false` + `workers:1`
    // makes the execution model explicit (and removes the prior config's
    // self-contradiction of fullyParallel:true with workers:1).
    fullyParallel: false,
    retries: 0,
    workers: 1,
    reporter: [['list']],
    use: {
        baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8080',
        trace: 'retain-on-failure',
        // Tests should run quickly against a local server.
        actionTimeout: 5_000,
        navigationTimeout: 10_000,
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
});
