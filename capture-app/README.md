# Raku Capture — hosted copy

This directory is a **hosted, static copy** of the Raku Capture PWA. It is
served by GitHub Pages at <https://rakuai.com/capture-app/> and is the public
phone entry point for capture (it is what the QR code on `capture.html` points
at).

## Canonical source

The canonical source of this app lives in **`raku-runtime/web/capture/`**.
This directory is a deployment mirror — **do not edit it directly**. Any change
to the app must be made in `raku-runtime/web/capture/` first, then re-synced
here.

To re-sync, run from the repo root:

```sh
scripts/sync-capture-app.sh /path/to/raku-runtime
```

The script copies every app file from `raku-runtime/web/capture/` into this
directory, then restores this `README.md` (the canonical source has its own
prototype-facing README that should not overwrite this one).

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
