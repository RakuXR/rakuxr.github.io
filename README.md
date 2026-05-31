# rakuxr.github.io — the public website for RakuAI

**Supercharge your AI in the real world.**

This repo is the **public website** ([rakuai.com](https://rakuai.com)) and
downloads index for **RakuAI**, the AI-native spatial runtime: phone scans of
rooms become 3D Gaussian splats, and any LLM (Claude, ChatGPT, Gemini, Copilot)
drives them via a **multi-vendor MCP** surface. Built for smart-glasses + phone
capture. **NVIDIA Inception member.** Bootstrapped by Kevin Griffin in Atlanta.

It is a **static GitHub Pages** site on a custom domain (`rakuai.com`, DNS via
Cloudflare) that **auto-deploys on every push to `main`**.

## 📐 Platform strategy (internal)

End-to-end strategy + phased roadmap for every rakuai.com platform — read this
first before reshaping site content or messaging:

**→ [raku-governance/strategy/PLATFORM-STRATEGY-INDEX.md](https://github.com/RakuXR/raku-governance/blob/main/strategy/PLATFORM-STRATEGY-INDEX.md)**

## The rest of the platform

- **Engine** — C++ runtime + MCP server + capture-app PWA → [raku-runtime](https://github.com/RakuXR/raku-runtime)
- **Backend** — FastAPI (9,500+ endpoints) + recon-worker, on Azure Container Apps at `api.rakuai.com` → [raku-api](https://github.com/RakuXR/raku-api)
- **This repo** — the public marketing site you are reading

---

## Key pages (audience / platform landing)

Each platform has a dedicated landing page at the repo root:

| Page | Audience |
|------|----------|
| `capture.html` | Raku Capture — scan reality with a phone |
| `spatial-engine.html` / `engine/` | Spatial engine / C++ runtime |
| `mcp.html` | MCP runtime (multi-vendor LLM control) |
| `smart-glasses.html` | Smart-glasses |
| `robotics.html` | Robotics |
| `insurance.html` | Insurance |
| `creator.html` | Creators |
| `enterprise.html` | Enterprise |
| `ai-systems.html` | AI labs / AI systems |
| `sdk.html` / `developers/` | Developers & SDK |

Plus `index.html`, `pricing.html`, `press.html`, `why-rakuai.html`, and the
auth / dashboard / explorer / play surfaces.

### Localization

The site ships **8 locales** — each in its own top-level directory:
`de/`, `es/`, `fr/`, `ja/`, `ko/`, `pt-BR/`, `zh-CN/`, `zh-TW/`.

### Vendored capture PWA — `capture-app/`

`capture-app/` is a **vendored, generated copy** of the Raku Capture PWA whose
**single source of truth lives in `raku-runtime/web/capture/`**. **Do not edit
the vendored copy here** — change it upstream and re-sync. See
`capture-app/README.md` for the source-of-truth + sync contract, and the
sync / verify scripts below.

---

## Build & tooling scripts (`scripts/`)

| Script | Purpose |
|--------|---------|
| `build_blog.py` | Builds the static blog from `_blog/` sources into `blog/` |
| `add_blog_nav.py` | Injects blog navigation |
| `inject-footer-recognition.py` | Injects footer recognition (e.g. partner badges) |
| `sync-capture-app.sh` | Pulls the latest `capture-app` from `raku-runtime` |
| `verify-capture-app.sh` | Verifies the vendored `capture-app` matches upstream |
| `capture-app-adaptations.py` | Applies site-specific adaptations to the vendored PWA |

The vendored capture-app is also kept honest by the
`verify-capture-app-sync.yml` workflow.

---

## Deployment

Static files served by **GitHub Pages** at [rakuai.com](https://rakuai.com)
(custom domain via the `CNAME` file; Jekyll disabled via `.nojekyll`).

**Single-environment deploy:** a push to `main` triggers
`.github/workflows/deploy-production.yml`, which uploads the repo root as a Pages
artifact and deploys it to `rakuai.com`. Feature branches PR into `main`; review
happens before merge. (The legacy `staging` branch / `deploy-staging.yml` /
`promote-staging-to-production.yml` are deprecated — don't use them.)

### CI gate — E2E

`.github/workflows/e2e.yml` runs **Playwright** client-side smoke tests on every
PR and every push to `main` (target < 30s on a warm runner). Keep it green
before merging. Test sources live in `tests/` (`playwright.config.js`,
`tests/e2e/`).

### Manual deployment

```sh
gh workflow run deploy-production.yml --repo RakuXR/rakuxr.github.io
```

---

## License

Released under the [MIT License](./LICENSE). RakuAI and RakuXR are trademarks of
RakuAI, LLC.
