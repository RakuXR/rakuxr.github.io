// ============================================================================
// Raku Capture — CDN resilience for the splat viewer (Lane 3C)
// ============================================================================
//
// The viewer loads the Spark renderer + three.js from a public CDN via dynamic
// import() (see loadSplatViewer() in capture_app.js). A CDN miss must degrade
// CLEANLY — never a broken canvas, never an indefinite hang. This module is the
// resilience layer:
//
//   - loadCdnModule(url, label)  — import() wrapped with a hard timeout so a
//     CDN that is slow-but-not-failing cannot hang the viewer forever, plus a
//     single retry for a transient blip. Rejects with a clear Error on miss.
//   - renderViewerFallback(...)  — draws the labelled 2D placeholder and writes
//     a clear, localized "viewer offline" message, so the READY state is always
//     observable even with zero CDN reachability.
//
// Loaded as a classic <script> before capture_app.js (capture_app.js is a
// module and can also `import` from here if preferred); the helpers are exposed
// on window.RakuCdnFallback so the module viewer can call them.
//
// Integrity / pinned versions of the CDN deps: see cdn_integrity.json.
// Self-hosting SEAM (move the bundle onto cdn.raku.games): see VENDORING.md.
// ============================================================================

(function (global) {
  'use strict';

  // A CDN module import that takes longer than this is treated as a miss. The
  // Spark bundle is ~5 MB; 20 s is generous for a slow phone connection while
  // still bounding the worst case so the viewer can fall back instead of hang.
  var CDN_IMPORT_TIMEOUT_MS = 20000;

  /**
   * Dynamic-import a module URL with a hard timeout and one retry.
   *
   * Plain `await import(url)` has no timeout: if the CDN accepts the socket but
   * never finishes the body, the viewer hangs indefinitely. This races the
   * import against a timer and retries once for a transient failure, then
   * rejects with an explicit Error the caller turns into the 2D fallback.
   *
   * @param {string} url      module URL to import
   * @param {string} label    short human name for error messages ('three')
   * @param {object} [opts]   { timeoutMs, retries }
   * @returns {Promise<object>} the imported module namespace
   */
  function loadCdnModule(url, label, opts) {
    opts = opts || {};
    var timeoutMs = opts.timeoutMs || CDN_IMPORT_TIMEOUT_MS;
    var retries = typeof opts.retries === 'number' ? opts.retries : 1;
    var name = label || url;

    function attempt(triesLeft) {
      var timer = null;
      var timed = new Promise(function (_resolve, reject) {
        timer = setTimeout(function () {
          reject(new Error(
            'CDN module "' + name + '" timed out after ' + timeoutMs +
            'ms (' + url + ')'));
        }, timeoutMs);
      });
      // The dynamic import. The /* @vite-ignore */ hint keeps bundlers from
      // trying to resolve the runtime CDN URL at build time.
      var imported = import(/* @vite-ignore */ url).then(
        function (mod) {
          if (!mod || typeof mod !== 'object') {
            throw new Error('CDN module "' + name + '" loaded but is empty');
          }
          return mod;
        },
        function (err) {
          throw new Error(
            'CDN module "' + name + '" failed to load (' + url + '): ' +
            (err && err.message ? err.message : String(err)));
        });

      return Promise.race([imported, timed])
        .then(function (mod) { clearTimeout(timer); return mod; })
        .catch(function (err) {
          clearTimeout(timer);
          if (triesLeft > 0) {
            // One transient retry, then give up so the fallback can run.
            return attempt(triesLeft - 1);
          }
          throw err;
        });
    }

    return attempt(retries);
  }

  /**
   * Draw the labelled 2D placeholder for a splat that could not render with the
   * real CDN viewer. Pure-canvas, no external dependency — guaranteed to paint.
   *
   * @param {HTMLCanvasElement} canvas
   * @param {string} splatUrl   the splat that would have been shown
   * @param {string} [caption]  localized "placeholder" caption
   */
  function drawPlaceholder(canvas, splatUrl, caption) {
    if (!canvas) return;
    var dpr = global.devicePixelRatio || 1;
    var w = canvas.clientWidth || 320;
    var h = canvas.clientHeight || 240;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    var ctx = canvas.getContext('2d');
    if (!ctx) return; // no 2D context — caller still shows the text note
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#05050a';
    ctx.fillRect(0, 0, w, h);
    for (var i = 0; i < 600; i++) {
      var x = Math.random() * w;
      var y = Math.random() * h;
      var r = Math.random() * 2 + 0.4;
      ctx.fillStyle = 'hsla(' + (250 + Math.random() * 40) + ', 70%, ' +
        (50 + Math.random() * 30) + '%, 0.7)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#7a7a9a';
    ctx.font = '13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(caption || 'splat preview placeholder', w / 2, h - 18);
  }

  /**
   * Hardened viewer fallback: a CDN miss (or any viewer init failure) ends here
   * and the READY state still renders. Draws the placeholder and writes a
   * clear, localized message into the supplied meta/note elements. Every step
   * is defensive so a fallback can never itself throw.
   *
   * @param {object} args
   *   - canvas    {HTMLCanvasElement}
   *   - splatUrl  {string}
   *   - reason    {Error|string}  what went wrong (logged, not shown raw)
   *   - metaEl    {HTMLElement}   viewer status line (optional)
   *   - noteEl    {HTMLElement}   offline note line (optional)
   *   - strings   {object}        { metaReady, noteOffline(file), placeholder }
   *                               localized text; safe English defaults if absent
   * @returns {{ status:string, offlineFile:string }} for the caller's state
   */
  function renderViewerFallback(args) {
    args = args || {};
    var canvas = args.canvas;
    var splatUrl = args.splatUrl || '';
    var strings = args.strings || {};
    var offlineFile = '';
    try {
      offlineFile = splatUrl.split('/').pop() || splatUrl;
    } catch (e) { offlineFile = splatUrl; }

    if (args.reason) {
      try {
        global.console && console.warn(
          '[RakuCapture] viewer fallback:',
          args.reason && args.reason.message ? args.reason.message : args.reason);
      } catch (e) { /* logging is best-effort */ }
    }

    try {
      drawPlaceholder(canvas, splatUrl, strings.placeholder);
    } catch (e) {
      // Even the placeholder failed — keep going so the text note still shows.
      try { console.warn('[RakuCapture] placeholder draw failed:', e); }
      catch (e2) { /* ignore */ }
    }

    if (args.metaEl) {
      try {
        args.metaEl.textContent =
          strings.metaReady || 'Splat ready (placeholder)';
      } catch (e) { /* ignore */ }
    }
    if (args.noteEl) {
      try {
        args.noteEl.hidden = false;
        var msg = typeof strings.noteOffline === 'function'
          ? strings.noteOffline(offlineFile)
          : ('3D viewer offline — showing a placeholder for ' + offlineFile);
        args.noteEl.textContent = msg;
      } catch (e) { /* ignore */ }
    }

    return { status: 'placeholder', offlineFile: offlineFile };
  }

  global.RakuCdnFallback = {
    loadCdnModule: loadCdnModule,
    renderViewerFallback: renderViewerFallback,
    drawPlaceholder: drawPlaceholder,
    CDN_IMPORT_TIMEOUT_MS: CDN_IMPORT_TIMEOUT_MS,
  };
})(typeof window !== 'undefined' ? window : globalThis);
