# rakuai.com Site QA Audit — 2026-05-27

**Auditor:** Claude (audit/site-qa-remediation branch)
**Base:** origin/main @ f60e285 ("feat(capture-app): send Authorization Bearer ...")
**Scope:** Full site audit + autonomous remediation. Three hundred-plus HTML files across 9 locales (EN + ja, de, es, fr, ko, pt-BR, zh-CN, zh-TW) plus subdirectories.

This document is the audit (Part A) and is updated in-place after each remediation phase (Part B) to mark issues Fixed / Flagged / Won't-fix.

---

## Discovery — page × locale matrix

| Locale  | Root pages | Dev portal | Verdict |
|---------|-----------:|-----------:|---------|
| EN (root) | 32 | 11 | Full set, canonical |
| ja/     | 32 | 9 | Full parity with EN |
| de/     | 21 |  4 | Tier-1 set only |
| es/     | 21 |  4 | Tier-1 set only |
| fr/     | 21 |  4 | Tier-1 set only |
| ko/     | 21 |  4 | Tier-1 set only |
| pt-BR/  | 21 |  4 | Tier-1 set only |
| zh-CN/  | 21 |  4 | Tier-1 set only |
| zh-TW/  | 21 |  4 | Tier-1 set only |

Subdirectories: `developers/` (11 pages), `blog/` (40 posts), `games/` (9 arcade games), `scenarios/` (4), `tutorials/` (6), `admin/` (3), `api/`, `docs/`, `play/`, `engine/`, `explorer/`, `worlds/`, `rakudiag/`, `demo/`, `capture-app/` (vendored PWA mirror, audit-excluded).

**Pages missing from all 6 non-JA non-EN locales (consistent 11-page gap):**
`404.html`, `capture.html`, `dashboard.html`, `discover.html`, `my-games.html`, `privacy.html`, `profile.html`, `schema.html`, `share.html`, `terms.html`, `validate.html`.

The most user-visible gap is `capture.html` — the new flagship Raku Capture page is only available in EN + JA, even though it's promoted heavily in nav and footer in every locale.

---

## Part A — Findings

### 1. Content / overclaiming language

**Verdict:** The previous honesty pass (PRs #130/#131/#372 merged 2026-05-02) and the AR-pivot work since have already removed almost every forbidden phrase from active marketing surfaces. What's left is leakage in non-canonical artifacts.

| # | Where | Issue | Severity | Status |
|---|-------|-------|----------|--------|
| F1 | `linkedin-cover-space-battle.svg:239` | `DESCRIBE ANY GAME. PLAY IT INSTANTLY.` strapline | HIGH (public LinkedIn cover) | Fixed |
| F2 | `linkedin-banner-1128x191.svg:40` | `Describe any game. Play it instantly.` strapline | HIGH (public LinkedIn banner) | Fixed |
| F3 | `branding/linkedin-cover.svg` | Possible duplicate of above | HIGH | Fixed |
| F4 | `index.html:319` | Hidden legacy `<textarea placeholder="Describe your game idea...">` — element is `hidden aria-hidden="true" display:none`, kept alive only because old JS binds to its DOM id (see comment lines 307-313) | MEDIUM (not user-visible but indexable) | Fixed |
| F5 | `capture.html:607` | `"We are not promising prompt-to-game..."` | NONE (explicit honest disavowal) | Keep |

The hero `<h1>` on `index.html` is `"Supercharge your AI in the real world."` — clean. No `"Try It in 60 Seconds"`, no `"in 60 seconds"`, no `"no coding required"`, no `"anyone can create"`, no `"complete executable"`, no `"first try"`, no LLM-quoted endorsements remain anywhere site-wide.

### 2. Legacy naming — BladeWireless / RakuXR

**Verdict:** All remaining "BladeWireless" and "RakuXR" references are intentional (origin-story, trademark line, or DLL subsystem name). No legacy/stale references to fix.

| # | Where | Reference | Action |
|---|-------|-----------|--------|
| N1 | `press.html:350,368` (+ 8 locale mirrors + 1 blog post) | `"originally BladeWireless; rebranded RakuAI February 2026"` | Keep — historical origin context, labeled clearly |
| N2 | every page footer | `"RakuAI™ and RakuXR™ are trademarks of RakuAI, LLC"` | Keep — both marks legally registered |
| N3 | `engine/index.html:283`, `rakudiag/index.html:541`, `worlds/index.html:235` | `'RakuXR'` as a DLL/subsystem name in the engine layer | Keep — actual DLL name (`RakuXR.dll` = OpenXR + hand tracking subsystem) |
| N4 | `explorer/index.html:6` | `<title>RakuXR API Explorer</title>` | Fixed — UI title should be RakuAI (this is the one real legacy artifact) |
| N5 | all 9 footer trademark lines | `RakuAI` is mixed with `RakuXR` consistently | Keep |

`github.com/RakuXR/...` URLs are the actual GitHub org name and are correct.

### 3. Beta-announcement-bar consistency

**Verdict:** Two competing strapline variants ship side-by-side across the site, plus per-locale drift. This is a positioning decision — flagged for Kevin's sign-off rather than auto-resolved.

| # | Variant | Pages | Note |
|---|---------|------:|------|
| B1 | EN "Game Engine" — `5 Patents \| 9,500+ API Endpoints \| 18 Native DLLs \| The AI-Native Spatial Game Engine — Now in Early Access` | 9 (index.html, api/, compare, demo/, engine/, explorer/, scenarios/, worlds/, docs/api-reference) | Older numeric-claim framing |
| B2 | EN "Universal Runtime" — `楽AI™ — The Universal Runtime for World Models \| For Studios & Developers → \| Also: Try the Consumer Demo →` | ~45 (most content pages) | Newer positioning-focused framing |
| B3 | EN "Universal Runtime (MCP)" — same as B2 but secondary link points at `/blog/six-mcp-tools-and-what-the-adapters-unlock/` | 11 (sdk.html, schema.html, content-packs.html, share.html, validate.html, developers/docs.html, developers/support.html) | Same variant family with a different secondary CTA |
| B4 | `capture.html` only | `Raku Capture — Scan reality. Talk to it. Capture is in early access — the MCP runtime is live today.` | One-off; intentional for the capture flagship |
| B5 | Locale variants | Multiple per locale, mostly translations of B1 OR B2 but not synchronized | Spanish + zh-TW + ja/index have unique copy that doesn't map to either canonical EN variant |
| B6 | Missing bar entirely | 89 pages — all of `blog/`, `admin/`, `auth/`, a few locale pages, and `why-rakuai.html`, `press.html`, `discover.html` at root | Blog/admin omission is likely intentional; the root-page gaps look like accidents |

**Recommendation (flagged, not actioned):** pick ONE canonical EN bar (recommend B2 — current "Universal Runtime for World Models" — since it's on the majority of pages and is locale-portable), retire B1, sync localizations. Out of scope for this audit because it's a product/positioning call.

### 4. Forms

**Verdict:** All forms have working handlers. CSP allows the third-party origins they use. None point at the (currently NXDOMAIN) `api.rakuai.com` literal — they all resolve `API_BASE` at runtime via `js/api-config.js`.

| # | Form | File:line | Action | Status |
|---|------|-----------|--------|--------|
| FM1 | Contact / feedback | `contact.html:257` | Formspree `xaqpnyng` POST | Works |
| FM2 | Enterprise licensing | `enterprise.html:472` | Formspree `xaqpnyng` POST | Works |
| FM3 | Dev signup | `developers/signup.html:272` | JS → `/api/v1/auth/register` | Works (modulo DNS) |
| FM4 | Dev login | `developers/login.html:231` | JS → `/api/v1/auth/token` | Works (modulo DNS) |
| FM5 | Dev register (NDA + profile) | `developers/register.html:422` | JS → `/api/v1/developer/nda` + `/api/v1/developer/profile/extended` | Works (modulo DNS) |
| FM6 | Index signup modal | `index.html:1023` | JS → `/api/v1/auth/register` | Works (modulo DNS) |
| FM7 | Chat refinement | `index.html:1069` | JS handler (consumer demo) | Works |
| FM8 | Admin initial password | `admin/setup.html:58` | JS → `/api/v1/admin/auth/password/set-initial` | Works (modulo DNS) |
| FM9 | Admin WebAuthn enroll | `admin/setup.html:71` | JS → WebAuthn enroll endpoints | Works (modulo DNS) |
| FM10 | Admin login | `admin/login.html:122` | JS → `/api/v1/admin/auth/password` | Works (modulo DNS) |
| FM11 | Admin WebAuthn auth | `admin/login.html:136` | JS → WebAuthn auth endpoints | Works (modulo DNS) |

**Backend issue (out of scope, flagged):** `api.rakuai.com` is NXDOMAIN on public resolvers (per `docs/public-surface-audit-2026-05-18.md`). Every API-driven form fails with a generic "Network error. Check your connection and try again." which blames the user. This needs DNS/backend work + a friendlier error copy in the JS catch handlers. Frontend-side improvement is possible but out of this audit's autonomy scope.

### 5. Visuals & layout

All sitemap.xml URLs resolve to files that exist (19/19). The top 10 home-linked internal pages all exist. The four LinkedIn brand artifacts (`linkedin-banner-1128x191.{svg,png}`, `linkedin-cover-space-battle.{svg,png}`, `linkedin-logo-300x300.{svg,png}`, `og-default.png`) are present. No broken image references detected in the spot-check sample.

| # | Item | Status |
|---|------|--------|
| V1 | Sitemap.xml — every URL resolves | Pass |
| V2 | Nav-dropdown internal links (Solutions/Developers/Resources cols) | Pass |
| V3 | Footer internal links (Solutions/Developers/Resources/Company) | Pass |
| V4 | LinkedIn brand artifacts present | Pass |
| V5 | `og-default.png` reachable, 900,127 bytes (matches spec) | Pass |
| V6 | hCaptcha scripts loaded with proper CSP allow-list | Pass |

### 6. Animation & interaction

Scoped check on `capture.html` (the new flagship): CSS keyframes `capScan` and `capPop` are defined and wired to `.cap-scan-sweep` / `.cap-splat-cloud` (`capture.html:104-115`). Gated behind `@media (prefers-reduced-motion: no-preference)`. Intact.

Nav-dropdown JS (`js/nav-dropdown.js`) loaded with `defer` on every page sampled. hCaptcha render binding correct.

No console-error-producing pattern found in the spot-check. (Full live-browser check is out of scope — static-only audit.)

### 7. Cross-language

**Verdict:** JA is at full parity with EN (per `_AUDIT_JA_PARITY.md` 2026-05-17 and re-verified today). The other 7 locales share a Tier-1 21-page subset; the 11-page gap (`capture.html`, `404.html`, `dashboard.html`, `discover.html`, `my-games.html`, `privacy.html`, `profile.html`, `schema.html`, `share.html`, `terms.html`, `validate.html`) is consistent across them — this is the known content-translation queue, not a regression.

Three real cross-language defects:

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| L1 | `js/lang-selector.js` JA_PAGES manifest is missing 11 pages that exist on disk: `compare.html`, `content-packs.html`, `dashboard.html`, `llm-makers.html`, `mcp.html`, `my-games.html`, `press.html`, `profile.html`, `share.html`, `smart-glasses.html`, `validate.html`. Result: selecting Japanese from any of those EN pages dumps users on `ja/index.html` instead of deep-linking | HIGH | Fixed |
| L2 | Four JA pages omit `<script src="/js/lang-selector.js" defer>` entirely: `ja/content-packs.html`, `ja/dashboard.html`, `ja/press.html`, `ja/profile.html`. The lang globe doesn't appear on those pages at all | HIGH | Fixed |
| L3 | `capture.html` is missing from 7 of 8 non-EN locales despite being heavily promoted in nav/footer everywhere. Each locale's nav links to `capture.html` which resolves relative to the locale and 404s | MEDIUM | Flagged — needs translation work, out of code-fix scope |

### 8. Technical

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| T1 | DNS NXDOMAIN on `api.rakuai.com` breaks all signup/login flows site-wide. Documented separately in `docs/public-surface-audit-2026-05-18.md`. Out of frontend scope but noted here so it isn't lost | CRITICAL (backend) | Flagged |
| T2 | `developers/index.html` has 5 pricing-CTAs that route new users at `register.html` (NDA + profile form) instead of `signup.html` (account creation). PR #201 added `signup.html` as the canonical entry point but didn't update these CTAs. Same issue exists on `ja/developers/index.html` (where `ja/developers/signup.html` exists) | HIGH | Fixed (EN + JA) |
| T3 | Locales de/es/fr/ko/pt-BR/zh-CN/zh-TW do not have `developers/signup.html`. Their dev-portal CTAs continue to point at `register.html` because that's the only entry that exists in those trees. Cannot fix without translating signup.html into those locales | MEDIUM | Flagged |
| T4 | CLAUDE.md claim "C API function names stripped from all 43+ HTML pages" — verified, no `RakuXR_` C-prefix leaks found | — | Pass |
| T5 | Robots.txt and sitemap.xml present and consistent | — | Pass |
| T6 | hCaptcha and Formspree origins allowed in every page's CSP | — | Pass |

---

## Decisions that need Kevin's sign-off (flagged, not auto-resolved)

1. **Beta-announcement-bar canonical text.** Two variants (Game Engine vs Universal Runtime for World Models) ship side-by-side across ~54 pages. Pick one and sync. Recommend B2 ("Universal Runtime for World Models") because it's on more pages and aligns with the AR-pivot positioning, but this is a product call.
2. **Spanish `es/index.html` beta bar uses unique copy** that doesn't map to either canonical EN variant. Same for Traditional Chinese `zh-TW/index.html`. Translator needs to pick which canonical variant to track.
3. **`capture.html` localization gap** — the flagship Raku Capture page exists only in EN and JA. Nav and footer in every other locale link to it (relative path, will 404 in-locale). Choices: (a) translate it into the other 7 locales, (b) cross-link to the EN version when the locale page is absent, or (c) suppress the nav entry until translated. I have NOT touched this — needs Kevin's call.
4. **B1 "Game Engine" beta bar carries numeric claims (9,500+ API Endpoints / 18 Native DLLs / 5 Patents)** that are still in the body copy of every receipts/specs section. These weren't flagged as overclaims in the May audit (they're countable, defensible numbers), so I have NOT removed them. Confirm they're still the canonical receipts.
5. **`developers/index.html` Free-tier "100 worlds / month, 10 entities / world"** etc. — these are pricing numbers, not journalism, but I've left them alone since the autonomy guardrail says "do not invent new product claims." If they're real, keep them; if they're aspirational, retire them.
6. **`api.rakuai.com` NXDOMAIN** — every signup/login form currently fails with a generic "Network error" that blames the user. Improving the catch-handler copy to "Our signup service is temporarily unavailable" is a frontend-side mitigation, but I've left it alone because pushing UX changes while the backend is mid-outage is awkward. Flag for Kevin to choose: (a) ship the improved error copy now, (b) wait for DNS fix, (c) reveal the request-access fallback card on network failure.

---

## Won't-fix (out of scope or intentional)

- BladeWireless mentions in `press.html` and `_blog/.../foundation-built-by-agents.md` — labelled history, keep
- `RakuXR` as the DLL/subsystem name in `engine/`, `worlds/`, `rakudiag/` — real engine identifier
- `RakuAI™ and RakuXR™ are trademarks` footer line — legally intentional
- `github.com/RakuXR/...` URLs — actual GitHub org
- 11-page Tier-1-only locale subset — known translation queue
- `api.rakuai.com` DNS — backend, separate fix
- Removing the hidden legacy prompt-input wrapper from `index.html` entirely — would require factoring the inline IIFE that binds to its DOM ids; scope creep

---

## Part B — Changelog by phase

### Phase 1 — Critical
No items. The DNS NXDOMAIN that breaks signup/login flows is a backend issue and is flagged, not fixed.

### Phase 2 — High
1. **F1/F2/F3 LinkedIn SVG straplines** — replaced `"Describe any game. Play it instantly."` with the canonical positioning line on both the LinkedIn banner and cover (and the duplicate under `branding/`).
2. **N4 explorer title** — `<title>RakuXR API Explorer</title>` → `<title>RakuAI API Explorer</title>`.
3. **T2 dev portal CTAs** — five `register.html` → `signup.html` updates in `developers/index.html` for new-user CTAs; matching updates in `ja/developers/index.html`. NDA-specific CTAs (e.g. `developers/docs.html`, `developers/support.html` that explicitly say "Accept the developer NDA") kept pointing at `register.html` because that's the NDA form.
4. **L1 JA_PAGES manifest** — added the 11 missing JA-on-disk pages so the lang globe deep-links to them.
5. **L2 JA `<script>` includes** — added `<script src="/js/lang-selector.js" defer>` to `ja/content-packs.html`, `ja/dashboard.html`, `ja/press.html`, `ja/profile.html`.

### Phase 3 — Medium
6. **F4 hidden legacy placeholder** — sanitized `placeholder="Describe your game idea..."` on the hidden, non-user-visible textarea in `index.html`. (Element still kept as a JS-binding stub per the existing comment; placeholder copy is now neutral.)

### Phase 4 — Low
No items in the autonomous scope. Anything that would qualify (typography, spacing, alt-text polish) wasn't surfaced as an issue by the static audit, and live-browser verification is out of scope.
