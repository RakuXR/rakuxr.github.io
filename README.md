# rakuxr.github.io

**Supercharge your AI in the real world.**

This is the official **RakuAI** public website (<https://rakuai.com>) and the
public downloads index. RakuAI is an AI-native spatial runtime: phone scans of
rooms become 3D Gaussian splats, and any LLM (Claude, ChatGPT, Gemini,
Copilot) drives them via MCP. Built for smart-glasses + phone capture.
NVIDIA Inception member. Bootstrapped by Kevin Griffin in Atlanta.

For the rest of the platform:

- **Engine** (C++ runtime + MCP server + capture-app PWA) → [raku-runtime](https://github.com/RakuXR/raku-runtime)
- **Backend** (FastAPI + recon-worker, Azure Container Apps) → [raku-api](https://github.com/RakuXR/raku-api)
- **This repo** → the public marketing site you are reading

---

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

## License

Site content is © RakuAI, LLC. Code samples and snippets are MIT unless
otherwise marked. RakuAI and RakuXR are trademarks of RakuAI, LLC.
