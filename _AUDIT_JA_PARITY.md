# JA-vs-EN Parity Audit

Audit date: 2026-05-17
Base ref: `origin/main` @ `16be4fe`
Followup to: PR #189 (squash-merge orphaned the full JA index re-translation)

The user reported that `ja/index.html` on main was still a 223-line stub while `index.html` is 2105 lines — PR #189's full Japanese re-translation never landed because of an early squash merge. The orphan recovery is being handled separately on branch `claude/ja-index-recover-pLGxG`.

This report audits **every other** `ja/*.html` and `ja/developers/*.html` page on `main` against its EN counterpart to find any other staleness PR #189 missed.

## Method

For each JA/EN pair on `origin/main`:
1. Compare line counts (`wc -l`).
2. Compare `<section>` block counts.
3. Compare full `id="..."` attribute sets (catches missing sections referenced by anchors).

Verdicts:
- **in-sync** = JA within 80%–110% of EN line count AND `<section>` counts match AND ID sets match.
- **stale** = significantly smaller than EN OR missing sections / IDs.

## Root JA pages

| Page | EN lines | JA lines | Ratio | EN `<section>` | JA `<section>` | IDs match | Verdict |
|---|---:|---:|---:|---:|---:|:---:|---|
| ja/404.html | 84 | 60 | 71% | 1 | 1 | yes | in-sync* |
| ja/ai-systems.html | 276 | 263 | 95% | 3 | 3 | yes | in-sync |
| ja/contact.html | 381 | 372 | 98% | 2 | 2 | yes | in-sync |
| ja/content-packs.html | 143 | 148 | 103% | 5 | 5 | yes | in-sync |
| ja/creator.html | 182 | 191 | 105% | 1 | 1 | yes | in-sync |
| ja/dashboard.html | 195 | 205 | 105% | 2 | 2 | yes | in-sync |
| ja/developer-guide.html | 82 | 73 | 89% | 2 | 2 | yes | in-sync |
| ja/discover.html | 365 | 362 | 99% | 1 | 1 | yes | in-sync |
| ja/docs.html | 200 | 190 | 95% | 7 | 7 | yes | in-sync |
| ja/enterprise.html | 550 | 553 | 101% | 5 | 5 | yes | in-sync |
| ja/llm-guide.html | 82 | 73 | 89% | 2 | 2 | yes | in-sync |
| ja/my-games.html | 412 | 417 | 101% | 2 | 2 | yes | in-sync |
| ja/press.html | 422 | 427 | 101% | 9 | 9 | yes | in-sync |
| ja/pricing.html | 534 | 541 | 101% | 6 | 6 | yes | in-sync |
| ja/privacy.html | 119 | 110 | 92% | 2 | 2 | yes | in-sync |
| ja/pro-features.html | 430 | 414 | 96% | 4 | 4 | yes | in-sync |
| ja/profile.html | 259 | 263 | 102% | 2 | 2 | yes | in-sync |
| ja/schema.html | 131 | 122 | 93% | 5 | 5 | yes | in-sync |
| ja/sdk.html | 439 | 446 | 102% | 6 | 6 | yes | in-sync |
| ja/share.html | 401 | 402 | 100% | 1 | 1 | yes | in-sync |
| ja/spatial-engine.html | 302 | 289 | 96% | 3 | 3 | yes | in-sync |
| ja/templates.html | 330 | 340 | 103% | 2 | 2 | yes | in-sync |
| ja/terms.html | 142 | 133 | 94% | 2 | 2 | yes | in-sync |
| ja/validate.html | 184 | 189 | 103% | 2 | 2 | yes | in-sync |
| ja/why-rakuai.html | 527 | 531 | 101% | 4 | 4 | yes | in-sync |
| ja/xr-features.html | 282 | 289 | 102% | 3 | 3 | yes | in-sync |

\* `ja/404.html` is 71% of EN because the EN file carries an extra inline `<script>` (SPA `/play/:gameId` redirector — 16 lines), an expanded beta-announcement-bar, an extra footer-links section, and an expanded trademark notice. The single `<section>` (the 404 hero) is fully translated and `id` sets match. Not stale.

## Developer portal pages

| Page | EN lines | JA lines | Ratio | EN `<section>` | JA `<section>` | IDs match | Verdict |
|---|---:|---:|---:|---:|---:|:---:|---|
| ja/developers/index.html | 461 | 467 | 101% | 4 | 4 | yes | in-sync |
| ja/developers/login.html | 396 | 399 | 101% | 0 | 0 | yes | in-sync |
| ja/developers/register.html | 882 | 888 | 101% | 2 | 2 | yes | in-sync |
| ja/developers/dashboard.html | 514 | 539 | 105% | 0 | 0 | yes* | in-sync |
| ja/developers/docs.html | 391 | 396 | 101% | 0 | 0 | yes | in-sync |
| ja/developers/sdk.html | 306 | 311 | 102% | 0 | 0 | yes | in-sync |
| ja/developers/showcase.html | 332 | 337 | 102% | 0 | 0 | yes | in-sync |
| ja/developers/status.html | 398 | 400 | 101% | 1 | 1 | yes | in-sync |
| ja/developers/support.html | 408 | 409 | 100% | 0 | 0 | yes | in-sync |

\* `ja/developers/dashboard.html` `id` diff is `id="${esc(k.id)}"` — a JS template-literal artifact present in EN only because it appears inside a `` `...` `` string. Not a real DOM id. No real differences.

## Summary

- **Stale pages found: 0.** (Outside the already-known `ja/index.html`, which is being handled on `claude/ja-index-recover-pLGxG`.)
- All 35 JA pages are within 71%–105% of their EN line count.
- All `<section>` counts match.
- All `id` attribute sets match (modulo a single JS template-literal artifact in `developers/dashboard.html`).
- No JA file references EN-only section anchors.

## Incidental observations (not parity bugs, optional fixes)

Several JA pages from the PR #174 batch are missing `<script src="/js/lang-selector.js" defer>` (EN counterparts include it):

- `ja/content-packs.html`
- `ja/dashboard.html`
- `ja/my-games.html`
- `ja/press.html`
- `ja/profile.html`
- `ja/share.html`
- `ja/validate.html`

This means the language-selector dropdown will not appear on those JA pages. The `<a class="lang-toggle">EN</a>` fallback link is still present, so navigation still works. This is a minor JS-include inconsistency, not a content-parity issue, but is worth a followup PR.

Additionally, several JA pages still use the older Japanese beta-announcement-bar copy (`楽AI 公開中 — ゲームを説明して、すぐにプレイ`) while EN pages use the newer "Universal Runtime for World Models" framing. This is consistent across the JA site but lags the EN copy. Translation refresh is optional — it's a marketing-copy decision, not a parity bug.

## How to use this report

- Every page above is **in-sync**, so no further re-translation agents are needed at this time.
- If any of the "incidental observations" above are worth fixing, spawn a small followup PR (single file or a batch edit, not a full re-translation).
- Once `ja/index.html` is recovered via `claude/ja-index-recover-pLGxG`, JA-site parity is restored.
