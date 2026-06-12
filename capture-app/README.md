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

## How this deploys

```
raku-runtime/web/capture/  (canonical — all app changes land HERE first)
        │  scripts/sync-capture-app.sh /path/to/raku-runtime
        ▼
scripts/capture-app-adaptations.py  (deterministic hosting adaptations:
        │   CSP for index.html/help.html, sw.js subpath scope fix,
        │   debug_log.js Copy-export header)
        ▼
capture-app/  (this directory — committed on a feature branch)
        │  PR into main  (verify-capture-app-sync.yml gates the diff
        │   against raku-runtime MAIN — merge canonical first)
        ▼
GitHub Pages → https://rakuai.com/capture-app/
```

There is no build step: the synced files deploy as-is when the PR merges.
Because the drift check compares against raku-runtime **main**, a mirror sync
taken from a canonical feature branch goes red until that branch merges —
sequence the raku-runtime PR first.

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

### Debug panel

The in-app debug panel (F2 / the floating DEBUG button, with Copy-to-clipboard
export and server log shipping) is canonical: `debug_log.js` + `log_shipper.js`.
The former mirror-only `capture_debug.js` overlay is retired; the one piece of
it the hosted app keeps is the "Raku Capture debug log" export header
(timestamp / UA / URL / entry count), re-applied to `debug_log.js`'s Copy
output by `scripts/capture-app-adaptations.py`.

## Subpath notes

The app is served under the `/capture-app/` subpath, not a domain root. This
works because every asset reference in the app is **relative** (`./sw.js`,
`./manifest.webmanifest`, `./icon-192.png`, etc.):

- the service worker registers as `./sw.js`, so its scope is `/capture-app/`;
- `manifest.webmanifest` uses `"start_url": "./"` and `"scope": "./"`, both of
  which resolve to `/capture-app/`;
- `detectApiBase()` in `capture_app.js` targets `https://api.rakuai.com` for
  any non-localhost host, so the hosted app talks to production `raku-api`.

No path rewriting is needed when syncing.

## Sensor metadata + pre-warm (Lane A)

At capture time the app records per-frame device sensor data — monotonic
timestamps, IMU samples (`devicemotion` gravity + rotation rate,
`deviceorientation` quaternion) and best-effort camera intrinsics hints — and
uploads it as an extra `capture_metadata` multipart part (filename
`capture_metadata.json`, `schema_version: 1`) alongside the frames, so the GPU
reconstruction worker can skip/constrain COLMAP structure-from-motion.
`frames[].filename` matches the uploaded `frame_<i>.jpg` part names.

- **iOS Safari**: the IMU is permission-gated; `DeviceMotionEvent` /
  `DeviceOrientationEvent.requestPermission()` are both requested inside the
  capture-start tap (one shared "Motion & Orientation" prompt). A denial
  leaves the IMU fields as explicit nulls — capture always proceeds.
- **Android Chrome**: no motion permission gate; the UA-CH high-entropy
  `model` is recorded as `device_model_hint` for a server-side intrinsics
  lookup. WebXR 6DOF poses are a documented follow-up (`pose` is null today).
- **Pre-warm**: starting a scan fires a fire-and-forget
  `POST https://api.rakuai.com/api/v1/captures/session/start` so a GPU worker
  can spin up during the sweep; 404/network failures are silently tolerated
  (the endpoint rolls out in parallel). The hosted CSP already allows
  `connect-src https://api.rakuai.com`, so no adaptation change was needed.

Full schema + field notes: `raku-runtime/web/capture/README.md` → "Sensor
metadata (capture_metadata.json)".

## Status — honest

The capture -> upload -> status -> viewer loop is wired to the live `raku-api`
reconstruction service. The reconstruction backend itself is still **simulated
server-side**: the app runs end to end but currently returns a **placeholder
splat**, not a true reconstruction of the scanned room. See
`raku-runtime/web/capture/README.md` for the full real-vs-stubbed breakdown.
