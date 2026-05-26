# Capture viewer — CDN dependency vendoring note (Lane 3C)

The capture viewer renders Gaussian splats with two third-party libraries
pulled at runtime from a public CDN (jsDelivr):

| Dependency | Pinned version | Why it is remote |
|---|---|---|
| `three` | 0.169.0 | WebGL renderer the splat mesh draws into. |
| `@sparkjsdev/spark` | 0.1.10 | Gaussian-splat renderer (`SplatMesh`). |

Both are loaded by **dynamic `import()`** inside `loadSplatViewer()` in
`capture_app.js`. Their exact pinned URLs and SHA-384 integrity hashes are
recorded in `cdn_integrity.json`, alongside a verification procedure.

## Why these are not vendored into the repo

1. **Subresource Integrity does not apply to `import()`.** SRI is a feature of
   `<script>`/`<link>` tags and of import-map `integrity` maps. A bare dynamic
   `import(url)` of a module has no `integrity` attribute, so the browser
   cannot reject tampered bytes. The integrity layer is therefore the pinned
   version + the out-of-band hash check in `cdn_integrity.json`.
2. **The sandbox cannot reach the npm registry or a build toolchain**
   (program protocol §8). A proper vendored build — `npm install`, bundling
   the bare-specifier `spark.module.js` against `three` with an import map or
   a bundler — needs infrastructure this lane cannot run.

## SEAM — self-hosting the bundle (human / infra task)

To fully remove the third-party-CDN dependency on the hot path, a human with a
build environment should:

1. `npm install three@0.169.0 @sparkjsdev/spark@0.1.10`.
2. Bundle `spark.module.js` so its bare `import "three"` /
   `import "three/addons/..."` specifiers are resolved (esbuild/rollup, or ship
   a static `<script type="importmap">` that maps `three`). `spark@0.1.10`'s
   `dist/spark.module.js` uses bare specifiers and will **not** load standalone
   without this step.
3. Upload the resolved bundles to `cdn.raku.games` (the CDN we control — see
   `RAKU-OPERATIONS.md`) at a versioned path, e.g.
   `https://cdn.raku.games/vendor/three@0.169.0/three.module.js` and
   `.../spark@0.1.10/spark.module.js`.
4. Verify each uploaded file's SHA-384 matches `cdn_integrity.json` (or re-pin
   after review if the bundling step legitimately changes the bytes).
5. Point `THREE_CDN_URL` / `SPARK_CDN_URL` at the `cdn.raku.games` paths
   (those constants are owned by the version-pin back-port — coordinate).

Until that drop happens, the public-CDN load is the live path and the
viewer's **hardened fallback** (Lane 3C, `cdn_fallback.js`) guarantees a CDN
miss degrades to the labelled 2D placeholder instead of a broken canvas or a
hang. Status today: **public CDN = REAL; self-hosted bundle = SEAM (human)**.
