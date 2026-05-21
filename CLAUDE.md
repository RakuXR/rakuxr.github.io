# Claude Code Project Memory — rakuxr.github.io

## Repository Info
- **Org**: RakuXR
- **Repo**: rakuxr.github.io (GitHub Pages site)
- **Live URL**: https://rakuai.com (production)
- **Purpose**: Public website for RakuAI — the AI-native spatial runtime built for smart glasses. The platform LLM makers and smart-glasses manufacturers build with.
- **Type**: Static HTML/CSS/JS (no build step — files deploy as-is)
- **Master strategy**: `raku-governance/STRATEGY.md`

## Deployment Architecture

Single-environment deploy. Push to `main` → GitHub Pages → `https://rakuai.com/`.

The `staging` branch and `/staging/` subdirectory are **deprecated** — review happens in the Claude Code chat window before changes land on `main`. Do not push to `staging` or open PRs against it.

### Branches
| Branch | Purpose | Auto-deploys to |
|--------|---------|-----------------|
| `main` | Production code | `rakuai.com/` (root) |
| Feature branches | Development | Nothing (PR into `main`) |

### Workflows
| Workflow | Trigger | What it does |
|----------|---------|--------------|
| `deploy-production.yml` | Push to `main` | Deploys to GitHub Pages root |

`deploy-staging.yml` and `promote-staging-to-production.yml` are obsolete and should be removed when convenient.

## AI Agent Deployment Workflow

**CRITICAL**: Claude and GitHub Copilot MUST follow this workflow for ALL website changes.

### Step 1: Develop on a Feature Branch
```bash
git checkout main
git pull origin main
git checkout -b <feature-branch>
# ... make changes ...
git add <files>
git commit -m "description of changes"
git push -u origin <feature-branch>
```

### Step 2: Review in Chat
Summarize the change in the Claude Code chat window — what files changed, why, and any test/verification steps. The owner reviews here. Iterate on the feature branch and push again if anything needs adjusting.

### Step 3: Open a PR to `main` (after owner approval)
Once the owner says "ship it" / "looks good" / "merge it", open a PR with `base: main` using `mcp__github__create_pull_request` (or `gh pr create --base main`).

### Step 4: Merge
- **Default**: owner merges via the GitHub UI.
- **If the owner explicitly authorizes Claude to merge**, use `mcp__github__merge_pull_request` (squash for small fixes, merge commit for multi-commit features).

After merge, `deploy-production.yml` fires and the change appears at `https://rakuai.com/`.

### Step 5: Verify Production
After deploy completes, verify the change at `https://rakuai.com/<path>`.

## Rules for AI Agents

1. **NEVER push directly to `main`** — all changes go through a feature branch + PR.
2. **NEVER merge a PR to `main` without explicit owner approval** in the chat.
3. **NEVER use `staging`** — branch is deprecated. PR base is always `main`.
4. **One logical change per feature branch.**
5. **Hotfixes still require owner approval** (which can be granted in the same chat turn).

## File Structure

This is a static site — no build step. All HTML/CSS/JS files deploy as-is.

| File | Purpose |
|------|---------|
| `index.html` | Landing page (Supercharge your AI / MCP runtime positioning for smart glasses + LLM partners) |
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
- **Phase 2**: MCP runtime positioning, smart-glasses + LLM-makers landing pages, partner outreach
- **Phase 3**: Browser game player (WebGL/WASM), shareable links
- **Phase 4**: Discover page, community features, remix
- **Phase 5**: XR deep links, platform-specific landing pages
