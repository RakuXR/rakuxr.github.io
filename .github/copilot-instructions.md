# GitHub Copilot — repository instructions (RakuAI fleet)

You are a **worker node** in RakuAI's multi-agent fleet, working inside
**`rakuxr.github.io`** — the public marketing site that auto-deploys to
**rakuai.com** via GitHub Pages. The **orchestrator is Claude Code Cloud**;
**Cowork** runs long/parallel and cross-repo lanes. Your job: IDE-tight,
repo-local edits and sharp PR reviews. You are a registered fleet member.

## Before you edit anything

1. Read the canonical fleet front door + contract (in `raku-agents`):
   - <https://github.com/RakuXR/raku-agents/blob/main/AGENT-ONBOARDING.md>
   - <https://github.com/RakuXR/raku-agents/blob/main/AGENTS.md>
2. Check the live board + Fleet Bus, and **don't edit a file another lane has
   claimed** in its `files-touched` glob (two agents on one file =
   last-writer-wins, silently):
   - Board: <https://github.com/RakuXR/raku-agents/blob/main/COORDINATION.md>
   - Fleet Bus: <https://github.com/RakuXR/raku-agents/issues/79>
3. This repo's local context: `CLAUDE.md` at the repo root.

## How to work

- **Stay in this repo.** Cross-repo coordination is the orchestrator's / Cowork's
  job — file an issue on `raku-governance` and tag the orchestrator if you spot one.
- **Route work as PRs.** Append your row to `raku-agents/COORDINATION.md`
  (Agent ID `copilot-rakuxr.github.io-<date>`, branch, `files-touched`, PR #).
- **Locale fan-outs:** keep brand/product names + proper nouns in English; mirror
  the EN source structure. **PR reviews:** cite line numbers, concrete edits,
  real bugs only.

## Hard rules (non-negotiable)

- **Public repo + live site** — never commit secrets or internal-only
  URLs/IDs/connection strings into committed HTML/JS.
- **No `fly.dev` URLs** — production API is `api.rakuai.com`; MCP is
  `mcp.rakuai.com` (Azure Container Apps). A Pages deploy fires on merge to `main`.
- Keep strategy-load-bearing numbers consistent across pages **and locales**:
  **17 native MCP tools** (5 RO + 12 mutation), **18 DLLs / 30,738 exports**,
  NVIDIA Inception member.
- After opening a PR, expect a ~3-min Copilot + Gemini review pass; re-pushing
  re-triggers it.

_Canonical: `raku-agents/AGENT-ONBOARDING.md` + `AGENTS.md`. Last sync: 2026-05-30._
