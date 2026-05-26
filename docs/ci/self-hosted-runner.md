# Self-hosted runner — `rakuxr.github.io`

> **This repo is PUBLIC.** Per the project-wide rule, **self-hosted runners are
> for PRIVATE repositories only** — a public repo would run untrusted PR code
> on the host machine. Every workflow in this repo therefore stays on
> `runs-on: ubuntu-latest` (GitHub-hosted). This document is kept here for
> reference and to keep the three Raku repos in sync; **do not** flip any
> workflow in this repo to `[self-hosted, raku-local]` unless this repo is
> made private.

The full setup procedure (Windows runner install, service registration, `raku-local`
label) lives in the private repos:

- `raku-api`: `docs/ci/self-hosted-runner.md`
- `raku-runtime`: `docs/ci/self-hosted-runner.md`

A single Windows runner registered with label `raku-local` can serve both
private repos. This public site repo continues to use hosted minutes.

## Why this matters

GitHub's own warning on the self-hosted runner page is explicit:

> We recommend that you only use self-hosted runners with private repositories.
> This is because forks of your repository can potentially run dangerous code
> on your self-hosted runner machine by creating a pull request that executes
> the code in a workflow.

Because anyone can fork `rakuxr.github.io` and open a PR, the only safe
posture is to keep its CI on ephemeral GitHub-hosted runners.

## If this repo ever goes private

Then, and only then, the same procedure from the private-repo docs applies:

1. Repo Settings → Actions → Runners → New self-hosted runner → label `raku-local`.
2. Install as a Windows service (`./svc.cmd install`, `./svc.cmd start`).
3. Flip the relevant workflows from `runs-on: ubuntu-latest` to
   `runs-on: [self-hosted, raku-local]`.

Until then, leave them alone.
