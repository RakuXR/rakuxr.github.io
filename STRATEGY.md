# Strategy Reference

> This repo's strategy is governed by the master strategy document in **raku-governance**.

## Master Strategy Document

**Location**: `raku-governance/STRATEGY.md`

The master strategy covers:
- Vision and strategic pivot (Prompt-to-Game Platform)
- Competitive landscape (Playabl, Moonlake, Base44)
- Phased roadmap (Phase 1-5)
- IP protection status
- Repository map and cross-references

## This Repo's Role

**rakuxr.github.io** is the **website** (rakuai.com). It is the primary user-facing surface and the home for:
- Landing page and marketing
- Prompt-to-game UX (Phase 2)
- Browser game runtime host (Phase 3)
- Developer portal and registration
- Community discover page (Phase 4)

## IP Protection Status (2026-03-14)

Major IP protection sweep completed:
- `d7269db`: Stripped C API function names from 43+ HTML pages
- `7b8cfb5`: Removed proprietary technical details from 21 pages
- `dea565c`: Removed pack manifests, moved to authenticated CDN
- `6a1764a`: Extended protection to Japanese language pages
- `ec20185`: Added IP protection legal clauses
- Stubbed: schema.json, api-manifest.json, content-pack-manifest.schema.json

## Deployment Architecture

This repo uses a **staging → production** model via GitHub Pages.

| Branch | Deploys to | Trigger |
|--------|------------|---------|
| `main` | `rakuai.com/` (production) | Push to main |
| `staging` | `rakuai.com/staging/` | Push to staging |

**Workflow**: Feature branch → `staging` (auto-deploy, verify) → owner approval → `main` (production)

**AI agents** (Claude, Copilot) follow the workflow in `CLAUDE.md` and `.github/COPILOT_INSTRUCTIONS.md`. They can push to staging independently but MUST get owner approval before promoting to production.

**Workflows**:
- `deploy-production.yml` — deploys `main` to GitHub Pages root
- `deploy-staging.yml` — deploys `staging` to `/staging/` subdirectory
- `promote-staging-to-production.yml` — merges staging → main (manual or API trigger)

## Key Files

| File | Status | Notes |
|------|--------|-------|
| `schema.json` | Stubbed | Returns `{"access": "sdk-required"}` |
| `api-manifest.json` | Stubbed | Returns `{"access": "nda-required"}` |
| `content-pack-manifest.schema.json` | Stubbed | Returns `{"access": "sdk-required"}` |
| `.well-known/ai-plugin.json` | ✅ Removed (2026-03-15) | OpenAI plugin manifest deleted |
| `CLAUDE.md` | ✅ Created (2026-03-15) | AI agent deployment workflow and project memory |
| `.github/COPILOT_INSTRUCTIONS.md` | ✅ Created (2026-03-15) | Copilot-specific deployment instructions |
| `.github/workflows/deploy-production.yml` | ✅ Created (2026-03-15) | Production deployment workflow |
| `.github/workflows/deploy-staging.yml` | ✅ Created (2026-03-15) | Staging deployment workflow |
| `.github/workflows/promote-staging-to-production.yml` | ✅ Created (2026-03-15) | Staging → production promotion |

## Relevant Roadmap Phases

- **Phase 1 (Protect)**: ✅ Complete — ai-plugin.json removed, all IP protection done
- **Phase 2 (Prompt UX)**: Add prompt input page, registration system, backend API integration
- **Phase 3 (Browser MVP)**: Host WebGL/WASM game player, shareable game links
- **Phase 4 (Full Browser)**: Discover page, remix system, social features
