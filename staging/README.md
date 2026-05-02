# rakuxr.github.io

RakuAI - Make Games by Talking. Official website and public downloads.

## Deployment

This site is deployed to [rakuai.com](https://rakuai.com) via **GitHub Actions** to **GitHub Pages**.

| Setting | Value |
|---------|-------|
| Source | GitHub Actions (`.github/workflows/deploy.yml`) |
| Custom domain | `rakuai.com` (configured via `CNAME` file) |
| Jekyll | Disabled (`.nojekyll` file present) |
| Trigger | Push to `main` branch or manual `workflow_dispatch` |

### How it works

1. Any push to `main` triggers the **Deploy to GitHub Pages** workflow.
2. The workflow checks out the repo, uploads the entire root as a Pages artifact, and deploys it.
3. GitHub Pages serves the static files at `rakuai.com`.

### Manual deployment

To trigger a deployment without pushing code:

```sh
gh workflow run deploy.yml --repo RakuXR/rakuxr.github.io
```

---

RakuAI and RakuXR are trademarks of RakuAI, LLC.
