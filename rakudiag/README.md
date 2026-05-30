# RakuDiag (Web UI)

RakuDiag is the **web equivalent of the desktop `RakuDiag` tool** — a live
health dashboard that exercises every subsystem of the RakuAI native engine
(18 DLLs, C API bridge, physics, audio, AI, etc.) and reports which ones are
actually wired up in the currently-running backend.

Use it to answer questions like:

- Is the native engine loaded, or is the API falling back to stubs?
- How many C API functions are bound in this build?
- Which of the 18 DLLs (RakuCore, RakuPhysics, RakuRenderer, ...) are present?
- Did the latest deploy break the physics or AI subsystem?

## How to run tests

1. Open [`/rakudiag/`](./index.html) in your browser.
2. The page automatically runs one pass of the test suite ~500&nbsp;ms after
   load.
3. Click **Run Tests** at the top to re-run at any time.
4. The base URL defaults to `https://api.rakuai.com/api` and is
   remembered in `localStorage`. Change it to point at a different
   environment (e.g. `http://localhost:8080/api`).

Results are color coded:

- Green &mdash; `PASS`
- Red &mdash; `FAIL`
- Gray &mdash; `SKIP` (usually means the native engine isn't loaded, so that
  subsystem is intentionally skipped)

The overall badge at the top shows `PASS`, `PARTIAL`, or `FAIL`.

## How to check results programmatically

RakuDiag is backed by a single JSON endpoint:

```
GET {base}/rakudiag/run
```

Example:

```bash
curl -s https://api.rakuai.com/api/rakudiag/run | jq
```

Response shape (abbreviated):

```json
{
  "bridge": {
    "native_loaded": true,
    "bound_functions": 2636,
    "modules": [
      "RakuCore", "RakuPhysics", "RakuRenderer", "RakuAudio",
      "RakuAI", "RakuSLM", "RakuVoice", "RakuScripting",
      "RakuNetwork", "RakuAssets", "RakuUI", "RakuInput",
      "RakuScene", "RakuAnimation", "RakuCSG", "RakuGameplay",
      "RakuEditor", "RakuXR"
    ]
  },
  "tests": [
    { "subsystem": "core",    "name": "create_world",  "status": "pass", "duration_ms": 12, "details": { "world_id": "w-abc123" } },
    { "subsystem": "physics", "name": "step_physics",  "status": "pass", "duration_ms": 3,  "details": { "collisions": 0 } },
    { "subsystem": "native",  "name": "native_alloc",  "status": "skip", "duration_ms": 0,  "details": "native not loaded" }
  ]
}
```

CI systems can grep the response for `"status":"fail"` to gate deploys, or
pipe the JSON into any dashboard.

## Related demos

- [Engine Dashboard](../engine/) &mdash; interactive tour of all 18 DLLs and
  2,636 C API functions.
- [API Explorer](../explorer/) &mdash; browse the 454 REST endpoints.
- [TimeLens Demo](../demo/) &mdash; narrative walkthrough.
- [Worlds](../worlds/) &mdash; playable in-browser worlds.

## Implementation notes

- Single HTML file, inline CSS, vanilla JS &mdash; no frameworks, no build step.
- Dark theme matching the rest of `rakuai.com` (`#0a0a1a` bg, `#6c5ce7`
  accent, `#00cec9` success, `#ff6b6b` danger).
- Handles CORS and network errors gracefully: if the API is unreachable the
  page shows an error banner and marks the overall status `UNREACHABLE`
  instead of blanking out.
- The configured base URL persists across reloads via `localStorage`
  (`rakudiag.baseUrl`).
