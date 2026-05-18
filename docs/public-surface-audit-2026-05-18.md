# RakuAI Public-Surface Audit — 2026-05-18

Snapshot of what a developer landing on rakuai.com from LinkedIn/Google sees right now.
Auditor: Agent C (frontend / public-surface).

## TL;DR

**A user can browse the marketing site fine, but cannot create an account.** Every
signup / login / admin page calls `https://api.rakuai.com/api/v1/...` and
`api.rakuai.com` is **NXDOMAIN** on all public resolvers (8.8.8.8, 1.1.1.1, 9.9.9.9).
Form submissions therefore fail at DNS, not with the 429 / 404 the spec described — the
underlying Fly app `raku-api.fly.dev` does return 429/404, but no public page points at
it. The end-user-visible result is the generic "Network error. Check your connection
and try again." banner.

Static-site content (home, blog, /ja, all nav targets, og-image, raku-mcp) is healthy.

## 1. Homepage `/index.html`  — **works**

- HTTP 200, 102,616 bytes.
- Hero (`<h1>The AI-Native Spatial Game Engine</h1>` line 74) renders.
- "Try It in 60 Seconds" section present (line 356).
- PR #201 signup CTA present **twice**: line 102 (inline button) and line 811 (full-bleed banner section). Both link to `developers/signup.html`. Verified.
- og:image -> `https://rakuai.com/og-default.png`, content-length **900127** (the neon hero, matches spec).

## 2. EN signup `/developers/signup.html`  — **broken (DNS)**

- HTTP 200, 24,692 bytes — page loads.
- `API_BASE = window.RAKU_API_BASE || 'https://api.rakuai.com'`. `js/api-config.js` loads OK and resolves `RAKU_API_BASE` to `https://api.rakuai.com` because hostname is `rakuai.com`.
- Form POSTs to `https://api.rakuai.com/api/v1/auth/register`. The page also probes with OPTIONS at load time.
- **DNS for `api.rakuai.com` is NXDOMAIN** (verified via 8.8.8.8, 1.1.1.1, 9.9.9.9). Probe + submit both fail at the network layer.
- Page surfaces this as the catch-all `catch (_)` -> "Network error. Check your connection and try again." There is no specific user-visible hint that the *server* is down vs. the user's connection — but the OPTIONS probe handler defaults `available = true` on network error, so the form **stays visible** instead of revealing the "request-access via contact" fallback. User clicks Create account, sees "Network error", and has no clear next step.
- Error-handling code for 409 / 422 / 404 / 429 / 5xx is all well-written and ready; just never reached.

## 3. JA signup `/ja/developers/signup.html`  — **broken (DNS)**

- HTTP 200, 26,021 bytes. Properly localized parallel of EN signup.
- Same `API_BASE` and same `https://api.rakuai.com` resolution, so same DNS failure.
- Internal links (terms, privacy, login) correctly stay inside `/ja/` (`../terms.html` from `/ja/developers/` resolves to `/ja/terms.html` which is HTTP 200). EN-toggle link `../../developers/signup.html` is correct.

## 4. Register `/developers/register.html`  — **broken (DNS)**

- HTTP 200, 37,216 bytes.
- POSTs to `https://api.rakuai.com/api/v1/developer/nda` (line 628) and `https://api.rakuai.com/api/v1/developer/profile/extended` (line 805).
- Same DNS failure. User who already has a JWT in localStorage (e.g. signed in pre-DNS-outage) would hit the form and see "Network error" / similar on NDA submit.
- JA equivalent `/ja/developers/register.html` is HTTP 200, 39,508 bytes, same target host.

## 5. Open-redirect guard (PR #201)  — **works, no bypasses**

- The guard lives in `/auth/google/callback.html` lines 69-78 as `safeReturnPath()`. It validates the value pulled from `sessionStorage.raku_post_auth_redirect`.
- Signup pages never read a `return=` query param directly; they only stash a fixed path (`/developers/register.html`) into sessionStorage. So the only attack surface is "can attacker poison sessionStorage cross-origin" (no — SOP) or "can attacker craft sessionStorage manually before sign-in" (only same-origin XSS, which would already be game over).
- Reproduced the guard locally in Node against all suggested bypass patterns; **all blocked**:
  - `//evil.example/` -> null (starts with `//`)
  - `javascript:alert(1)` -> null (doesn't start with `/`)
  - `https://rakuai-evil.com/login` -> null (doesn't start with `/`)
  - `/\evil.example/` -> null (backslash sentinel)
  - `////evil` -> null
  - `data:text/html,<script>alert(1)</script>` -> null
  - `/%2F%2Fevil` -> `/%2F%2Fevil` (stays same-origin, encoded slashes never decoded server-side; safe)
  - Legit same-origin paths pass through.

## 6. Admin pages — **render, but unusable due to DNS**

- `/admin/login.html`  HTTP 200, 11,464 bytes.
- `/admin/setup.html`  HTTP 200, 11,411 bytes.
- `/admin/dashboard.html`  HTTP 200, 7,843 bytes.
- All three load `../js/api-config.js` (verified HTTP 200, content-type `application/javascript`).
- All three set `API_BASE = window.RAKU_API_BASE` (no fallback string), so on production hostname they end up calling `https://api.rakuai.com/api/v1/admin/auth/*`. NXDOMAIN -> all admin pages bounce with network errors on first XHR.
- CSP `connect-src` already includes `https://raku-api.fly.dev https://raku-api-staging.fly.dev https://api.rakuai.com`, so this is purely a DNS / configuration issue, not a CSP issue.
- No data leak in the empty state — only inert form HTML is exposed without auth.
- No console-visible errors from inspecting static HTML; only runtime ones (which require live JS execution to observe).

## 7. Nav / footer links  — **works**

- Sampled nav from home: engine/, api/, games/, why-rakuai.html, developers/, press.html, blog/, sdk.html, docs.html, privacy.html, terms.html, contact.html, ja/, explorer/, scenarios/, worlds/, ai-systems.html, developer-guide.html, enterprise.html, pro-features.html, spatial-engine.html, xr-features.html — all **HTTP 200**.
- Sampled pages also 200: `/`, `/developers/`, `/blog/`, `/api/`, `/admin/login.html`.
- Blog post `https://rakuai.com/blog/supercharge-your-ai/` HTTP 200, 12,342 bytes; og:image -> `https://rakuai.com/blog/img/default-og.png` content-length **900127** (matches spec).

**Minor inconsistency** (not breaking): `/developers/index.html` still links to `register.html`, while the homepage banner from PR #201 routes to `signup.html`. Both pages eventually want the user signed up, but the developer landing page bypasses the new email-signup flow.

## 8. raku-mcp.fly.dev/mcp/  — **works**

- `GET /mcp/`  -> HTTP 401 (auth required).
- `POST /mcp/` unauthenticated -> HTTP 401 `{"error":"invalid_token","error_description":"Authentication required"}`.
- `POST /mcp/` with bogus bearer -> HTTP 401 same body.

This is currently the only reachable backend from a public client. Behaves correctly.

## Severity table

| Section | Finding | Severity |
|---|---|---|
| 1 Home | All elements render; PR #201 CTAs present in two places | works |
| 2 EN signup | DNS NXDOMAIN on api.rakuai.com -> generic "Network error" banner | broken (root cause is backend/DNS, not frontend code; but UX could be better — see below) |
| 3 JA signup | Same as EN | broken (same root cause) |
| 4 Register | Same as EN | broken (same root cause) |
| 5 Open-redirect | All bypass patterns rejected | works |
| 6 Admin pages | Render fine; XHRs fail at DNS | broken (downstream of DNS) |
| 7 Nav/footer/blog | No 404s in sampled links; og-image content-length 900127 verified | works |
| 8 raku-mcp | Returns 401 on unauth / bogus token | works |
| extra | `/developers/index.html` still uses `register.html` while home uses `signup.html` | minor cosmetic |

## Actionable items

The big root cause (DNS for api.rakuai.com missing) is out of scope for the
public-surface auditor — Agent A / Agent B own that. Frontend-side, the one
clearly-actionable improvement is **make the user-facing network-error message
better when the backend is unreachable**. Right now `catch (_)` shows "Network
error. Check your connection and try again." which blames the user. A clearer
"Our signup service is temporarily unavailable. Please try again later or use
the request-access form below." plus revealing the request-access fallback card
would be friendlier during outages.

However: this is a UX polish change that should go through normal review, not
something to ship in the middle of a backend outage. Recommend committing this
audit as a reference doc instead, so the findings are durable.

