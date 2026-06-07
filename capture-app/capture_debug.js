/* eslint-disable no-console */
/**
 * capture_debug.js — Raku Capture in-app debug log panel.
 *
 * A persistent, copyable debug overlay for the capture flow, modelled on the
 * "API" overlay the arcade games ship (games/lib/game-shared.js). It exists so
 * an operator (or Kevin, watching a reconstruction crawl for 25 minutes) can
 * SEE what the app is actually doing — every network call, every state-machine
 * transition, every reconstruction status poll with its real response JSON —
 * without a remote debugger or a USB cable.
 *
 * What it captures, automatically (no app changes required):
 *   - fetch():      method, URL, status, timing; and for /api/v1/capture/*
 *                   responses, the parsed response JSON (so you see the live
 *                   {status, progress, backend, error} the server returns).
 *   - XMLHttpRequest: the upload POST — method, URL, status, timing, AND the
 *                   upload byte progress (bytes sent / total, % complete).
 *   - EventSource:  the SSE progress stream (/capture/{id}/progress) — open,
 *                   every `stage`/message event, and errors. (The current app
 *                   polls with fetch rather than SSE, but the hook is here so a
 *                   future SSE switch is covered too.)
 *   - window errors + unhandledrejection + console.error/console.warn.
 *
 * What capture_app.js opts into (one hook): state-machine transitions, via
 *   window.RakuDebug.state(from, to). See showPhase() in capture_app.js.
 *
 * Design constraints:
 *   - Loaded as a CLASSIC script BEFORE i18n.js / capture_app.js, so the global
 *     fetch/XHR/EventSource patches are installed before any app code runs and
 *     no early call is missed. (Module scripts defer; this one must not.)
 *   - CSP-safe: 'self' script, no external resources, opens no new connections
 *     (it only observes the ones the app already makes — connect-src unchanged).
 *   - Self-contained: builds its own button + panel + styles in JS. The only
 *     HTML change is the <script> tag; the only JS change elsewhere is the
 *     single state() hook.
 *   - Honest by construction: it reports exactly what happened (status codes,
 *     timings, raw response bodies, error strings). It fabricates nothing.
 */
(function () {
  'use strict';

  if (window.RakuDebug && window.RakuDebug.__installed) return;

  // ---- config ------------------------------------------------------------
  var MAX_ENTRIES = 600;        // ring-buffer cap (keeps memory bounded)
  var MAX_BODY_CHARS = 4096;    // cap a logged response body so the panel/clip
                                // copy never balloons on a big payload
  var STORAGE_KEY = 'raku.capture.debug.open';
  var API_HINT = '/api/v1/capture'; // responses we read + log the JSON body of

  // ---- ring buffer (populated even before the DOM panel exists) ----------
  var entries = [];   // { ts:number, iso:string, cat:string, msg:string, data:any }
  var dropped = 0;    // count of entries evicted past MAX_ENTRIES
  var seq = 0;

  function nowMs() {
    // performance.now() is monotonic (good for durations); Date is wall-clock
    // (good for human-readable timestamps). Use each for what it's good at.
    return (window.performance && performance.now) ? performance.now() : Date.now();
  }

  function stamp() {
    var d = new Date();
    function p(n, w) { n = String(n); while (n.length < (w || 2)) n = '0' + n; return n; }
    return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()) +
      '.' + p(d.getMilliseconds(), 3);
  }

  function push(cat, msg, data) {
    var e = { id: ++seq, iso: stamp(), cat: cat, msg: String(msg == null ? '' : msg), data: data };
    entries.push(e);
    if (entries.length > MAX_ENTRIES) { entries.shift(); dropped++; }
    render(e);
    return e;
  }

  // ---- public API --------------------------------------------------------
  var RakuDebug = {
    __installed: true,
    /** Generic structured log entry. cat is a short UPPERCASE tag. */
    log: function (cat, msg, data) { return push(String(cat || 'LOG').toUpperCase(), msg, data); },
    /** State-machine transition hook, called by capture_app.js showPhase(). */
    state: function (from, to) {
      return push('STATE', (from || '∅') + ' → ' + (to || '?'), null);
    },
    /** Programmatic open/close (also wired to the toggle button + F2). */
    show: function () { setOpen(true); },
    hide: function () { setOpen(false); },
    toggle: function () { setOpen(!isOpen); },
    /** Full plaintext dump of the buffer — what "Copy Log" copies. */
    dump: dumpText,
    clear: function () { entries = []; dropped = 0; renderAll(); },
    /** Resolved raku-api base; set by capture_app.js. Used for the GPU probe. */
    apiBase: null,
    /** Probe + display whether the GPU reconstruction worker is reachable. */
    checkGpu: function () { return checkGpuAvailability(); }
  };
  window.RakuDebug = RakuDebug;

  // =======================================================================
  // Interceptors — installed immediately, before any app code runs.
  // =======================================================================

  // ---- fetch() -----------------------------------------------------------
  var origFetch = window.fetch;
  if (typeof origFetch === 'function') {
    window.fetch = function (input, init) {
      var method = ((init && init.method) ||
        (input && typeof input === 'object' && input.method) || 'GET').toUpperCase();
      var url = (typeof input === 'string') ? input :
        (input && input.url) ? input.url : String(input);
      // When a capture is SUBMITTED (POST /api/v1/capture), immediately probe
      // GPU-worker availability so the user sees whether real reconstruction is
      // reachable BEFORE committing to the wait (rather than after a timeout).
      if (method === 'POST' && /\/api\/v1\/capture(\?.*)?$/.test(url)) {
        push('GPU', 'Capture submitted — checking GPU worker availability…', null);
        checkGpuAvailability();
      }
      var t0 = nowMs();
      return origFetch.apply(this, arguments).then(function (resp) {
        var dt = Math.round(nowMs() - t0);
        var cat = resp.ok ? 'NET' : 'NET!';
        var line = method + ' ' + shortUrl(url) + ' → ' + resp.status + ' (' + dt + 'ms)';
        // For capture API responses, read + log the real JSON body so the
        // status/progress/backend/error the server returned is visible. Clone
        // so the app still consumes the original body untouched.
        if (url.indexOf(API_HINT) !== -1) {
          try {
            resp.clone().text().then(function (text) {
              var data = text;
              try { data = JSON.parse(text); } catch (e) { /* leave as text */ }
              push(resp.ok ? 'POLL' : 'POLL!', line, capData(data));
            }, function () { push(cat, line, null); });
          } catch (e) { push(cat, line, null); }
        } else {
          push(cat, line, null);
        }
        return resp;
      }, function (err) {
        var dt = Math.round(nowMs() - t0);
        push('NET!', method + ' ' + shortUrl(url) + ' → NETWORK ERROR (' + dt + 'ms)',
          String(err && err.message || err));
        throw err;
      });
    };
  }

  // ---- XMLHttpRequest (the upload POST) ----------------------------------
  var XHR = window.XMLHttpRequest;
  if (XHR && XHR.prototype) {
    var origOpen = XHR.prototype.open;
    var origSend = XHR.prototype.send;
    XHR.prototype.open = function (method, url) {
      this.__rakuDbg = { method: (method || 'GET').toUpperCase(), url: String(url || ''), t0: 0 };
      return origOpen.apply(this, arguments);
    };
    XHR.prototype.send = function () {
      var d = this.__rakuDbg;
      if (d) {
        d.t0 = nowMs();
        var self = this;
        push('XHR', d.method + ' ' + shortUrl(d.url) + ' → sending…', null);
        // Upload byte progress — bytes sent / total, % complete.
        if (this.upload) {
          this.upload.addEventListener('progress', function (e) {
            if (!e || !e.lengthComputable) return;
            var pct = e.total ? Math.round((e.loaded / e.total) * 100) : 0;
            push('UPLOAD', 'sent ' + fmtBytes(e.loaded) + ' / ' + fmtBytes(e.total) +
              ' (' + pct + '%)', null);
          });
        }
        this.addEventListener('loadend', function () {
          var dt = Math.round(nowMs() - d.t0);
          var ok = self.status >= 200 && self.status < 300;
          var body = null;
          if (self.responseType === '' || self.responseType === 'text') {
            try {
              var t = self.responseText;
              if (t) { try { body = JSON.parse(t); } catch (e) { body = t; } }
            } catch (e) { /* responseText not accessible for this type */ }
          }
          push(ok ? 'XHR' : 'XHR!', d.method + ' ' + shortUrl(d.url) + ' → ' +
            (self.status || 'no status') + ' (' + dt + 'ms)', capData(body));
        });
      }
      return origSend.apply(this, arguments);
    };
  }

  // ---- EventSource (SSE progress stream) ---------------------------------
  var ES = window.EventSource;
  if (typeof ES === 'function') {
    function PatchedES(url, config) {
      var es = new ES(url, config);
      push('SSE', 'open ' + shortUrl(String(url)), null);
      es.addEventListener('open', function () { push('SSE', 'connected ' + shortUrl(String(url)), null); });
      es.addEventListener('error', function () {
        push('SSE!', 'error/closed ' + shortUrl(String(url)) + ' (readyState=' + es.readyState + ')', null);
      });
      es.addEventListener('message', function (ev) { logSse('message', ev); });
      // The backend emits named `stage` events; capture those explicitly too.
      es.addEventListener('stage', function (ev) { logSse('stage', ev); });
      return es;
    }
    function logSse(kind, ev) {
      var data = ev && ev.data;
      try { data = JSON.parse(ev.data); } catch (e) { /* leave as text */ }
      push('SSE', kind + ' event', capData(data));
    }
    PatchedES.prototype = ES.prototype;
    PatchedES.CONNECTING = ES.CONNECTING;
    PatchedES.OPEN = ES.OPEN;
    PatchedES.CLOSED = ES.CLOSED;
    window.EventSource = PatchedES;
  }

  // ---- errors ------------------------------------------------------------
  window.addEventListener('error', function (e) {
    if (e && e.message) push('ERROR', e.message,
      (e.filename ? e.filename + ':' + e.lineno + ':' + e.colno : null));
  });
  window.addEventListener('unhandledrejection', function (e) {
    var r = e && e.reason;
    push('ERROR', 'unhandledrejection: ' + (r && r.message || r),
      r && r.stack ? String(r.stack).split('\n').slice(0, 4).join('\n') : null);
  });
  ['error', 'warn'].forEach(function (level) {
    var orig = console[level];
    console[level] = function () {
      try {
        push(level === 'error' ? 'ERROR' : 'WARN',
          Array.prototype.map.call(arguments, fmtArg).join(' '), null);
      } catch (e) { /* never let logging break the app */ }
      return orig.apply(console, arguments);
    };
  });

  // =======================================================================
  // Helpers
  // =======================================================================
  function fmtArg(a) {
    if (a == null) return String(a);
    if (typeof a === 'string') return a;
    try { return JSON.stringify(a); } catch (e) { return String(a); }
  }
  function shortUrl(u) {
    // Trim the origin so the panel shows the path (and query), which is the
    // part that varies. Keep absolute cross-origin URLs intact.
    try {
      if (u.indexOf(location.origin) === 0) return u.slice(location.origin.length) || '/';
      var m = u.match(/^https?:\/\/[^/]+(\/.*)?$/);
      return m ? (m[0].replace(/^https?:\/\//, '')) : u;
    } catch (e) { return u; }
  }
  function fmtBytes(n) {
    if (n == null || isNaN(n)) return '?';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / (1024 * 1024)).toFixed(2) + ' MB';
  }
  function capData(data) {
    if (data == null) return null;
    var s;
    try { s = (typeof data === 'string') ? data : JSON.stringify(data, null, 2); }
    catch (e) { s = String(data); }
    if (s.length > MAX_BODY_CHARS) s = s.slice(0, MAX_BODY_CHARS) + '\n…[truncated ' +
      (s.length - MAX_BODY_CHARS) + ' chars]';
    return s;
  }

  // =======================================================================
  // UI — built on DOM ready (patches above already buffer everything).
  // =======================================================================
  var badge, panel, listEl, countEl, gpuEl, isOpen = false, built = false;

  var CAT_COLORS = {
    NET: '#66ffff', 'NET!': '#ff6666',
    POLL: '#9b8cff', 'POLL!': '#ff6666',
    XHR: '#ffd166', 'XHR!': '#ff6666',
    UPLOAD: '#5ad19a', STATE: '#ff7ad9',
    SSE: '#6cf', 'SSE!': '#ff6666',
    GPU: '#5ad19a', 'GPU!': '#ff6666',
    ERROR: '#ff6666', WARN: '#f0b429', LOG: '#cfcfe6'
  };
  function catColor(cat) { return CAT_COLORS[cat] || '#cfcfe6'; }

  // ---- GPU reconstruction worker availability ----------------------------
  var _gpuChecking = false;

  function _apiBase() {
    // Prefer the base capture_app.js handed us; otherwise mirror its detection.
    if (RakuDebug.apiBase) return RakuDebug.apiBase;
    var h = location.hostname;
    return (h === 'localhost' || h === '127.0.0.1') ? 'http://localhost:8000' : 'https://api.rakuai.com';
  }

  function setGpuStrip(cls, text) {
    if (!gpuEl) return;
    gpuEl.className = cls; // 'up' | 'down' | 'unknown'
    gpuEl.textContent = text;
  }

  /**
   * Probe GET /api/v1/capture/recon/availability and reflect the result in the
   * GPU strip + a log entry, so the user knows whether real reconstruction is
   * reachable BEFORE committing to a wait. Degrades honestly: a 404 means the
   * API hasn't shipped the endpoint yet; a network error means unknown.
   */
  function checkGpuAvailability() {
    if (_gpuChecking) return;
    _gpuChecking = true;
    setGpuStrip('unknown', 'GPU worker: checking…');
    var base = _apiBase();
    // Use the original fetch so this probe doesn't recursively log as app NET.
    var f = origFetch || window.fetch;
    f(base + '/api/v1/capture/recon/availability', { method: 'GET' }).then(function (resp) {
      if (resp.status === 404) {
        setGpuStrip('unknown', 'GPU worker: status endpoint not deployed yet');
        push('GPU', 'availability endpoint not found (404) — API not yet updated', null);
        _gpuChecking = false;
        return;
      }
      return resp.json().then(function (data) {
        var avail = data && data.available;
        var backend = (data && data.backend) || '?';
        var reason = (data && data.reason) || '';
        if (avail === true) {
          setGpuStrip('up', 'GPU worker: REACHABLE ✓  (' + backend + ')');
          push('GPU', 'available ✓ — ' + backend, capData(data));
        } else if (avail === false) {
          setGpuStrip('down', 'GPU worker: NOT reachable ✗ — try Phone GPU mode');
          push('GPU!', 'NOT available ✗ — ' + reason, capData(data));
        } else {
          setGpuStrip('unknown', 'GPU worker: unknown (' + backend + ')');
          push('GPU', 'availability unknown — ' + reason, capData(data));
        }
        _gpuChecking = false;
      });
    }, function (err) {
      setGpuStrip('unknown', 'GPU worker: probe failed (network)');
      push('GPU!', 'availability probe failed: ' + (err && err.message || err), null);
      _gpuChecking = false;
    });
  }

  function build() {
    if (built) return;
    built = true;
    var style = document.createElement('style');
    style.textContent = [
      '#raku-debug-badge{position:fixed;right:12px;bottom:12px;z-index:2147483646;',
      'background:#16161f;color:#6cf;border:1px solid #2a2a3a;border-radius:8px;',
      "font:600 12px ui-monospace,'Courier New',monospace;padding:8px 12px;cursor:pointer;",
      'box-shadow:0 2px 10px rgba(0,0,0,.5);user-select:none;letter-spacing:.5px;}',
      '#raku-debug-badge:hover{border-color:#6cf;color:#9df;}',
      '#raku-debug-badge.on{background:#6c63ff;color:#fff;border-color:#6c63ff;}',
      '#raku-debug-panel{position:fixed;right:12px;bottom:54px;z-index:2147483647;',
      'width:min(440px,calc(100vw - 24px));height:min(60vh,560px);display:none;',
      'flex-direction:column;background:rgba(8,8,14,.94);border:1px solid #2a2a3a;',
      'border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,.6);color:#e8e8f0;',
      "font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,'Courier New',monospace;}",
      '#raku-debug-panel.on{display:flex;}',
      '#raku-debug-head{display:flex;align-items:center;gap:8px;padding:8px 10px;',
      'border-bottom:1px solid #2a2a3a;flex-shrink:0;}',
      '#raku-debug-head .ttl{color:#9df;font-weight:700;letter-spacing:.5px;}',
      '#raku-debug-head .cnt{color:#7a7a9a;font-size:10px;}',
      '#raku-debug-head .sp{flex:1;}',
      '#raku-debug-head button{background:#1d1d2a;color:#cfcfe6;border:1px solid #2a2a3a;',
      'border-radius:6px;font:600 10px ui-monospace,monospace;padding:5px 9px;cursor:pointer;}',
      '#raku-debug-head button:hover{border-color:#6c63ff;color:#fff;}',
      '#raku-debug-head button.copied{background:#3ec97a;color:#06210f;border-color:#3ec97a;}',
      // GPU availability strip — prominent so the user sees reachability at a glance.
      '#raku-debug-gpu{flex-shrink:0;padding:6px 10px;font-weight:700;cursor:pointer;',
      'border-bottom:1px solid #2a2a3a;font-size:11px;letter-spacing:.3px;}',
      '#raku-debug-gpu.up{background:rgba(62,201,122,.16);color:#5ad19a;}',
      '#raku-debug-gpu.down{background:rgba(255,107,107,.16);color:#ff8a8a;}',
      '#raku-debug-gpu.unknown{background:rgba(240,180,41,.12);color:#f0b429;}',
      '#raku-debug-list{flex:1;overflow-y:auto;overflow-x:hidden;padding:6px 8px;}',
      '#raku-debug-list::-webkit-scrollbar{width:8px;}',
      '#raku-debug-list::-webkit-scrollbar-thumb{background:#2a2a3a;border-radius:4px;}',
      '.rdbg-row{padding:3px 0;border-bottom:1px dashed rgba(255,255,255,.06);',
      'white-space:pre-wrap;word-break:break-word;overflow-wrap:anywhere;}',
      '.rdbg-row .ts{color:#6a6a86;}',
      '.rdbg-row .cat{font-weight:700;margin:0 6px;}',
      '.rdbg-row .msg{color:#e8e8f0;}',
      '.rdbg-row .data{display:block;margin:3px 0 2px 8px;padding:6px 8px;background:#05050a;',
      'border:1px solid #1d1d2a;border-radius:6px;color:#9aa;max-height:180px;overflow:auto;}',
      '.rdbg-empty{color:#666;text-align:center;padding:14px;}'
    ].join('');
    document.head.appendChild(style);

    badge = document.createElement('button');
    badge.id = 'raku-debug-badge';
    badge.type = 'button';
    badge.textContent = 'DEBUG';
    badge.title = 'Toggle the capture debug log (F2)';
    badge.addEventListener('click', function () { RakuDebug.toggle(); });
    document.body.appendChild(badge);

    panel = document.createElement('div');
    panel.id = 'raku-debug-panel';
    panel.setAttribute('aria-live', 'polite');
    panel.innerHTML =
      '<div id="raku-debug-head">' +
        '<span class="ttl">Capture Debug</span>' +
        '<span class="cnt" id="raku-debug-count">0</span>' +
        '<span class="sp"></span>' +
        '<button id="raku-debug-copy" type="button">Copy Log</button>' +
        '<button id="raku-debug-clear" type="button">Clear</button>' +
      '</div>' +
      '<div id="raku-debug-gpu" class="unknown" title="GPU reconstruction worker reachability — checked on load and when you start a capture">GPU worker: checking…</div>' +
      '<div id="raku-debug-list"></div>';
    document.body.appendChild(panel);

    listEl = panel.querySelector('#raku-debug-list');
    countEl = panel.querySelector('#raku-debug-count');
    gpuEl = panel.querySelector('#raku-debug-gpu');
    gpuEl.addEventListener('click', function () { checkGpuAvailability(); });
    panel.querySelector('#raku-debug-clear').addEventListener('click', function () { RakuDebug.clear(); });
    panel.querySelector('#raku-debug-copy').addEventListener('click', onCopy);

    // F2 toggles, matching the arcade overlay's keyboard affordance.
    window.addEventListener('keydown', function (e) {
      if (e.key === 'F2') { e.preventDefault(); RakuDebug.toggle(); }
    });

    // Restore last open/closed choice so it persists across reloads.
    try { if (localStorage.getItem(STORAGE_KEY) === '1') setOpen(true); } catch (e) {}

    renderAll();
    // Probe GPU-worker availability up front so the strip reflects reachability
    // immediately, before the user starts a capture.
    checkGpuAvailability();
  }

  function setOpen(open) {
    isOpen = !!open;
    if (badge) badge.classList.toggle('on', isOpen);
    if (panel) panel.classList.toggle('on', isOpen);
    try { localStorage.setItem(STORAGE_KEY, isOpen ? '1' : '0'); } catch (e) {}
    if (isOpen) scrollToEnd();
  }

  function rowHtml(e) {
    var div = document.createElement('div');
    div.className = 'rdbg-row';
    var ts = document.createElement('span'); ts.className = 'ts'; ts.textContent = e.iso;
    var cat = document.createElement('span'); cat.className = 'cat';
    cat.style.color = catColor(e.cat); cat.textContent = e.cat;
    var msg = document.createElement('span'); msg.className = 'msg'; msg.textContent = e.msg;
    div.appendChild(ts); div.appendChild(cat); div.appendChild(msg);
    if (e.data != null) {
      var d = document.createElement('span'); d.className = 'data'; d.textContent = e.data;
      div.appendChild(d);
    }
    return div;
  }

  function render(e) {
    if (!built || !listEl) return;
    var empty = listEl.querySelector('.rdbg-empty');
    if (empty) empty.remove();
    var atEnd = listEl.scrollTop + listEl.clientHeight >= listEl.scrollHeight - 24;
    listEl.appendChild(rowHtml(e));
    // Mirror the ring-buffer eviction in the DOM so it never grows unbounded.
    while (listEl.childNodes.length > MAX_ENTRIES) listEl.removeChild(listEl.firstChild);
    if (countEl) countEl.textContent = String(entries.length) + (dropped ? ' (+' + dropped + ' dropped)' : '');
    if (atEnd) scrollToEnd();
  }

  function renderAll() {
    if (!built || !listEl) return;
    listEl.innerHTML = '';
    if (!entries.length) {
      listEl.innerHTML = '<div class="rdbg-empty">No activity yet. Interactions, network calls, and state changes will appear here.</div>';
    } else {
      var frag = document.createDocumentFragment();
      entries.forEach(function (e) { frag.appendChild(rowHtml(e)); });
      listEl.appendChild(frag);
    }
    if (countEl) countEl.textContent = String(entries.length) + (dropped ? ' (+' + dropped + ' dropped)' : '');
    scrollToEnd();
  }

  function scrollToEnd() { if (listEl) listEl.scrollTop = listEl.scrollHeight; }

  function dumpText() {
    var head = 'Raku Capture debug log — ' + new Date().toISOString() +
      '\nUA: ' + navigator.userAgent +
      '\nURL: ' + location.href +
      '\nentries: ' + entries.length + (dropped ? ' (+' + dropped + ' dropped past cap)' : '') +
      '\n' + '-'.repeat(60) + '\n';
    var body = entries.map(function (e) {
      var s = e.iso + '  ' + e.cat + '  ' + e.msg;
      if (e.data != null) s += '\n    ' + String(e.data).replace(/\n/g, '\n    ');
      return s;
    }).join('\n');
    return head + body + '\n';
  }

  function onCopy(ev) {
    var btn = ev.currentTarget;
    var text = dumpText();
    function ok() {
      btn.classList.add('copied');
      var prev = btn.textContent; btn.textContent = 'Copied!';
      setTimeout(function () { btn.classList.remove('copied'); btn.textContent = prev; }, 1400);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(ok, function () { legacyCopy(text, ok); });
    } else {
      legacyCopy(text, ok);
    }
  }
  function legacyCopy(text, done) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.focus(); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
      done && done();
    } catch (e) { /* clipboard blocked — nothing else we can do silently */ }
  }

  // Build the panel as soon as the body exists.
  if (document.body) {
    build();
  } else {
    document.addEventListener('DOMContentLoaded', build);
  }

  // Announce that the logger is live (also the first visible entry).
  push('LOG', 'Capture debug logger ready — F2 or the DEBUG button toggles this panel.', null);
})();
