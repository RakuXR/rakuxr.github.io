# Claude Code Project Memory — rakuxr.github.io

## Repository Info
- **Org**: RakuXR
- **Repo**: rakuxr.github.io (GitHub Pages site)
- **Live URL**: https://rakuai.com (production)
- **Staging URL**: https://rakuai.com/staging/ (staging)
- **Purpose**: Public website for RakuAI prompt-to-game platform
- **Type**: Static HTML/CSS/JS (no build step — files deploy as-is)
- **Master strategy**: `raku-governance/STRATEGY.md`

## Deployment Architecture

This repo uses a **staging → production** deployment model with GitHub Pages.

### Branches
| Branch | Purpose | Auto-deploys to |
|--------|---------|-----------------|
| `main` | Production-ready code | `rakuai.com/` (root) |
| `staging` | Testing & review | `rakuai.com/staging/` |
| Feature branches | Development | Nothing (PR into staging) |

### Deployment Flow
```
feature-branch → PR → staging → owner approval → main (production)
```

### Workflows
| Workflow | Trigger | What it does |
|----------|---------|--------------|
| `deploy-production.yml` | Push to `main` | Deploys to GitHub Pages root |
| `deploy-staging.yml` | Push to `staging` | Deploys to `/staging/` subdirectory |
| `promote-staging-to-production.yml` | Manual or API dispatch | Merges staging → main |

## AI Agent Deployment Workflow

**CRITICAL**: Claude and GitHub Copilot MUST follow this workflow for ALL website changes.

### Step 1: Develop on Feature Branch
```bash
git checkout staging
git pull origin staging
git checkout -b <feature-branch>
# ... make changes ...
git add <files>
git commit -m "description of changes"
git push -u origin <feature-branch>
```

### Step 2: Merge to Staging
```bash
git checkout staging
git pull origin staging
git merge <feature-branch>
git push origin staging
# This auto-deploys to rakuai.com/staging/
```
Or create a PR from feature-branch → staging and merge it.

### Step 3: Verify on Staging
After merge to staging, verify the changes at `https://rakuai.com/staging/`.
- Check all modified pages render correctly
- Verify no broken links or missing assets
- Test on mobile viewport if UI changes were made

### Step 4: Request Owner Approval
**AI agents MUST NOT promote staging to production without explicit owner approval.**

Tell the user:
> "Changes are deployed to staging at https://rakuai.com/staging/. Please review and confirm when ready to promote to production."

### Step 5: Promote to Production (after owner approval)
Once the owner explicitly approves (e.g., "looks good, push to production", "promote it", "ship it"):

**Option A — Git merge (preferred for AI agents):**
```bash
git checkout main
git pull origin main
git merge staging --no-ff -m "Promote staging to production: <summary>"
git push origin main
```

**Option B — GitHub API dispatch:**
```bash
gh api repos/RakuXR/rakuxr.github.io/dispatches \
  -f event_type=promote-staging \
  -f client_payload='{"actor":"claude"}'
```

**Option C — GitHub Actions UI:**
Go to Actions → "Promote Staging to Production" → Run workflow → Type "promote"

### Step 6: Verify Production
After promotion, verify at `https://rakuai.com/`.

## Rules for AI Agents

1. **NEVER push directly to main** — all changes go through staging first
2. **NEVER promote staging→production without explicit owner approval**
3. **ALWAYS verify staging URL before requesting approval**
4. **Feature branches merge into staging, not main**
5. **After major phase completion** (Phase 2, 3, 4, 5), staging MUST be reviewed by owner before production promotion
6. **Hotfixes**: Only owner-approved critical fixes may skip staging (must still get explicit approval)
7. **The old `deploy.yml` workflow is superseded** by `deploy-production.yml` — delete `deploy.yml` after confirming new workflows are operational

## File Structure

This is a static site — no build step. All HTML/CSS/JS files deploy as-is.

| File | Purpose |
|------|---------|
| `index.html` | Landing page (will become prompt-to-game UX in Phase 2) |
| `style.css` | Global styles |
| `CNAME` | Custom domain → rakuai.com |
| `.nojekyll` | Bypass Jekyll processing |
| `robots.txt` | Search engine directives |
| `sitemap.xml` | SEO sitemap |
| `404.html` | Custom 404 page |
| `docs/` | Static documentation pages |
| `ja/` | Japanese language pages |
| `tutorials/` | Tutorial pages |

## IP Protection Status
- C API function names stripped from all 43+ HTML pages
- Proprietary technical details removed from 21 pages
- Pack manifests moved to authenticated CDN
- schema.json, api-manifest.json stubbed
- .well-known/ai-plugin.json removed
- See `raku-governance/STRATEGY.md` for full IP audit

## Phase Roadmap (Website)
- **Phase 1** ✅: IP protection, marketing site cleanup
- **Phase 2**: Prompt input UX, registration, backend integration
- **Phase 3**: Browser game player (WebGL/WASM), shareable links
- **Phase 4**: Discover page, community features, remix
- **Phase 5**: XR deep links, platform-specific landing pages
