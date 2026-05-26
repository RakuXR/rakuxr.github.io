# Raku Capture — hosted copy

This directory is a **hosted, static copy** of the Raku Capture PWA. It is
served by GitHub Pages at <https://rakuai.com/capture-app/> and is the public
phone entry point for capture (it is what the QR code on `capture.html` points
at).

## Canonical source — single source of truth

The canonical source of this app lives in **`raku-runtime/web/capture/`**.
This directory is GENERATED, not hand-edited:

```
capture-app/  ==  raku-runtime/web/capture/   (verbatim)
                  + the deterministic hosting adaptations in
                    scripts/capture-app-adaptations.py
                  + two preserved mirror-only files:
                    README.md, qr-capture-app.svg
```

`scripts/verify-capture-app.sh` regenerates that and `diff`s it against what
is committed; the `Verify capture-app sync` GitHub Action runs it on every
push and PR. **Drift fails the build** — silent divergence is impossible.

### Pulling canonical changes into the mirror

From the repo root:

```sh
scripts/sync-capture-app.sh /path/to/raku-runtime   # local checkout
scripts/sync-capture-app.sh                         # auto-clones canonical
```

Review the diff, then commit.

### Adding a new hosting-only adaptation

If the public host genuinely needs to differ from canonical (e.g. a new CSP
directive), add the change to `scripts/capture-app-adaptations.py` so it is
deterministic and reproducible. Never hand-edit files in `capture-app/`.

## Subpath notes

The app is served under the `/capture-app/` subpath, not a domain root. This
works because every asset reference in the app is **relative** (`./sw.js`,
`./manifest.webmanifest`, `./icon-192.png`, etc.):

- the service worker registers as `./sw.js`, so its scope is `/capture-app/`;
- `manifest.webmanifest` uses `"start_url": "./"` and `"scope": "./"`, both of
  which resolve to `/capture-app/`;
- `detectApiBase()` in `capture_app.js` targets `https://raku-api.fly.dev` for
  any non-localhost host, so the hosted app talks to production `raku-api`.

No path rewriting is needed when syncing.

## Status — honest

The capture -> upload -> status -> viewer loop is wired to the live `raku-api`
reconstruction service. The reconstruction backend itself is still **simulated
server-side**: the app runs end to end but currently returns a **placeholder
splat**, not a true reconstruction of the scanned room. See
`raku-runtime/web/capture/README.md` for the full real-vs-stubbed breakdown.
