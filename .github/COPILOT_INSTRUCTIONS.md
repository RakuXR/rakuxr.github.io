# GitHub Copilot Instructions — rakuxr.github.io

## Repository Overview
This is the public website for RakuAI (rakuai.com), deployed via GitHub Pages.
Static HTML/CSS/JS — no build step. Files deploy as-is.

## Deployment Workflow (MANDATORY)

This repository uses a **staging → production** deployment model.
**You MUST follow this workflow for ALL changes.**

### Branch Rules
| Branch | Purpose | Deploys to |
|--------|---------|------------|
| `main` | Production | `rakuai.com/` |
| `staging` | Testing | `rakuai.com/staging/` |
| Feature branches | Development | Nothing |

### Workflow
1. **Develop** on a feature branch (branched from `staging`)
2. **Merge** feature branch into `staging` (auto-deploys to `/staging/`)
3. **Verify** changes at `https://rakuai.com/staging/`
4. **Request owner approval** — NEVER promote to production without explicit owner confirmation
5. **Promote** staging → main only after owner says "ship it", "promote", "looks good", etc.

### How to Promote (after approval)
```bash
git checkout main
git pull origin main
git merge staging --no-ff -m "Promote staging to production: <summary>"
git push origin main
```

## Rules

1. **NEVER push directly to main** — all changes go through staging
2. **NEVER promote without explicit owner approval**
3. **ALWAYS verify staging before requesting approval**
4. **After major phase work**, staging must be reviewed by owner
5. **Hotfixes** still need owner approval (even if urgent)

## Code Style
- Static HTML/CSS/JS, no frameworks
- CSS in `style.css` (global)
- No external CDN dependencies (self-hosted assets)
- All pages follow existing HTML structure (header, main content, footer)
- Japanese translations in `ja/` directory

## IP Protection
- Do NOT expose C API function names, DLL names, or internal architecture
- Do NOT add public API manifests or schemas
- Stubbed files (schema.json, api-manifest.json) must stay stubbed
- See `CLAUDE.md` for full IP protection status

## Related Repos
- **raku-governance**: Strategy, roadmap, decision log
- **raku-runtime**: Engine, asset pipeline scripts
- **raku-sdk**: Developer SDK
- **raku-public**: Public documentation
