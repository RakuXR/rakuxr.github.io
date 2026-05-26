# `verify-capture-app-sync` — one-time secret setup

This workflow checks out **the private repo `RakuXR/raku-runtime`** (sparse, just
`web/capture/`) so it can diff our hosted `capture-app/` against the canonical
source. The default `secrets.GITHUB_TOKEN` is scoped to the repo running the
workflow (`rakuxr.github.io`) and cannot read another repo — that's why the
check fails with `Repository not found` until a cross-repo token is configured.

## The fix

Add a repo secret named **`RAKU_RUNTIME_READ_TOKEN`** holding a fine-grained
Personal Access Token (or GitHub App installation token) with **`Contents:
Read`** permission on `RakuXR/raku-runtime`. The workflow already references it
via `token: ${{ secrets.RAKU_RUNTIME_READ_TOKEN }}` on the `actions/checkout`
step.

## Step-by-step

1. **Create the PAT.** GitHub → your profile → Settings → Developer settings →
   Personal access tokens → **Fine-grained tokens** → "Generate new token".
   - Resource owner: **RakuXR**
   - Repository access: "Only select repositories" → **`raku-runtime`**
   - Permissions: under "Repository permissions" set **Contents → Read-only**
   - Expiration: keep it short (90 days) and put a calendar reminder to rotate.
2. **Add the secret.** `rakuxr.github.io` repo → Settings → Secrets and
   variables → Actions → "New repository secret".
   - Name: **`RAKU_RUNTIME_READ_TOKEN`**
   - Value: paste the PAT
3. **Re-run the failing workflow** on the open PR (Actions → "Verify
   capture-app sync" → Re-run jobs). It should now pass when `capture-app/`
   matches canonical.

## Honesty notes

- The workflow does **not** silently pass if the secret is missing. The first
  step explicitly fails with a `::error::` line pointing here. No
  `continue-on-error`, no `--exit-zero` tricks.
- A PAT is a least-privilege solution (Contents:Read on one repo). For a more
  permanent solution, a GitHub App installed on both repos would avoid the
  per-user PAT.
- Why this was never noticed before: `verify-capture-app-sync` was added in PR
  #253 (Wave 3B) and has been red on every run since. No drift PR has landed
  in between, so nothing else flagged it.

## Why the check matters

`capture-app/` is a **generated mirror** of `raku-runtime/web/capture/` plus
the deterministic adaptations in `scripts/capture-app-adaptations.py`. Without
this gate, a contributor can edit the hosted copy in place and the canonical
source silently diverges — a class of bug that already bit us once (Lane 3A/3C
landed in `raku-runtime` but never re-synced here; PR #254 catches up).
