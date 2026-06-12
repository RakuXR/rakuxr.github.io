// debug_log.js — Raku Capture in-app debug logger (panel + hygiene rules)
// Copyright (c) 2026 RakuAI, LLC. All rights reserved.
//
// ----------------------------------------------------------------------------
// A small on-device diagnostics surface for the capture PWA: capture_app.js
// appends NET / STATE / POLL / ERROR entries here; the panel is toggled with
// F2 or the floating DEBUG button, and a Copy button puts the whole log on
// the clipboard so a user can paste it into a bug report. A "Send log"
// button (present when opts.send is wired — see log_shipper.js shipAll())
// pushes the ENTIRE retained log to the server in one user-flagged batch,
// for when the log has grown too large to copy/paste.
//
// Log hygiene (the reason this module exists as more than console.log):
//   1. `data:` URIs are elided before an entry is stored. A single
//      data:application/wasm;base64,... URL is megabytes of base64 — useless
//      in a log and ruinous for the log-shipping byte budget. elideDataUris()
//      replaces the payload with `data:<mime>;base64,[1.2 MB elided]`.
//   2. Status-poll dedupe. The reconstruction status is polled every 2 s;
//      logging the full JSON body of every identical poll buries the signal.
//      createPollDeduper() logs the full body only when something MEANINGFUL
//      changed (status, progress_detail.phase, error, progress moved >= 5
//      percentage points, or >= 30 s since the last fully-logged poll);
//      otherwise it yields a one-line "status unchanged (…)" summary.
//
// Honesty: the logger never invents entries and the panel shows exactly what
// was recorded. When server log-shipping is failing, setShipStatus() surfaces
// a visible flag in the panel header instead of pretending diagnostics are
// reaching the server (see log_shipper.js).
//
// Headless-safe: every DOM touch is feature-detected/try-caught, so the
// tests/capture-pwa harness (and any document-less context) can import the
// pure helpers and run the logger without a real browser.
//
// No build step, no framework: a plain ES module imported by capture_app.js.
// The pure helpers (elideDataUris, describeBytes, createPollDeduper) are unit
// tested in log_shipper.test.mjs.
// ----------------------------------------------------------------------------

'use strict';

// Only payloads >= 64 base64 chars are elided — a tiny inline data URI can be
// genuinely useful in a log line, a megabyte one never is.
const DATA_URI_RE = /data:([a-zA-Z0-9][a-zA-Z0-9.+/-]*);base64,[A-Za-z0-9+/=]{64,}/g;

/** '512 B' / '12.3 KB' / '1.2 MB' for a byte count. */
export function describeBytes(n) {
  const b = Math.max(0, Math.round(n || 0));
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
  return (b / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * Replace every large base64 `data:` URI in `text` with a short marker that
 * names the mime type and the approximate decoded size, e.g.
 * `data:application/wasm;base64,[1.2 MB elided]`. Pure; safe on any string.
 */
export function elideDataUris(text) {
  return String(text).replace(DATA_URI_RE, (m, mime) => {
    const b64len = m.length - (m.indexOf(',') + 1);
    const bytes = Math.round(b64len * 3 / 4); // base64 → raw bytes
    return 'data:' + mime + ';base64,[' + describeBytes(bytes) + ' elided]';
  });
}

// ============================================================================
// Status-poll dedupe
// ============================================================================

/**
 * Decide, poll by poll, whether the full status body deserves a log entry.
 *
 * next(body, nowMs) returns:
 *   { full: true,  line: null }    -> log the full JSON body
 *   { full: false, line: '...' }   -> log the one-line summary instead
 *
 * Full-body triggers (any one): first poll; `status` changed;
 * `progress_detail.phase` changed; `error` changed; `progress` moved >=
 * `progressDelta` (default 0.05) since the LAST FULLY-LOGGED poll; or >=
 * `minIntervalMs` (default 30 s) since the last fully-logged poll — so even a
 * totally stalled job leaves a periodic heartbeat in the log.
 */
export function createPollDeduper(opts) {
  const o = opts || {};
  const minIntervalMs = o.minIntervalMs != null ? o.minIntervalMs : 30000;
  const progressDelta = o.progressDelta != null ? o.progressDelta : 0.05;
  let last = null;       // snapshot of the last FULLY-logged poll
  let firstAtMs = null;  // first poll time — anchors the 'elapsed Ns' summary

  return {
    next(body, nowMs) {
      const b = body || {};
      const status = b.status != null ? String(b.status) : null;
      const phase = (b.progress_detail && b.progress_detail.phase != null)
        ? String(b.progress_detail.phase) : null;
      const error = b.error != null ? String(b.error) : null;
      const progress = typeof b.progress === 'number' ? b.progress : null;
      if (firstAtMs === null) firstAtMs = nowMs;

      let full = false;
      if (!last) {
        full = true;
      } else if (status !== last.status || phase !== last.phase
          || error !== last.error) {
        full = true;
      } else if (progress !== null && last.progress !== null
          && Math.abs(progress - last.progress) >= progressDelta) {
        full = true;
      } else if ((progress === null) !== (last.progress === null)) {
        full = true; // progress appeared or vanished — that's a change
      } else if (nowMs - last.atMs >= minIntervalMs) {
        full = true; // periodic heartbeat
      }

      if (full) {
        last = { status, phase, error, progress, atMs: nowMs };
        return { full: true, line: null };
      }
      const elapsedS = Math.round((nowMs - firstAtMs) / 1000);
      const progressPart = progress !== null
        ? 'progress ' + progress.toFixed(2) + ', ' : '';
      return {
        full: false,
        line: 'status unchanged (' + progressPart + 'elapsed ' + elapsedS + 's)',
      };
    },
  };
}

// ============================================================================
// The logger + panel
// ============================================================================

// Panel/entry ring-buffer cap — old entries roll off so a long session cannot
// grow memory unboundedly. The log shipper has its own (larger) queue.
export const MAX_LOG_ENTRIES = 400;

/**
 * Create the debug logger. Builds the floating DEBUG button immediately and
 * the panel lazily; both are skipped (without error) when no usable document
 * exists, so the pure log() path still works headlessly.
 *
 * @param {object} [opts]
 * @param {Function} [opts.t]    i18n translate fn `(key, params, fallback)`
 * @param {Document} [opts.doc]  document override (tests)
 * @param {Function} [opts.now]  clock override (tests), default performance.now
 * @param {Function} [opts.send] user-initiated full-log push:
 *   `(entries) => Promise<{ok:boolean, detail?:string}>` — wired by
 *   capture_app.js to log_shipper.js shipAll(). When absent the panel has no
 *   "Send log" button (demo/headless contexts lose nothing).
 * @returns {{ log, onEntry, setShipStatus, toggle, rerender, resetSendState,
 *            getEntries, formatEntries }}
 */
export function createDebugLog(opts) {
  const o = opts || {};
  const tFn = typeof o.t === 'function'
    ? o.t : (key, params, fallback) => (fallback != null ? fallback : key);
  const doc = o.doc || (typeof document !== 'undefined' ? document : null);
  const now = o.now || (typeof performance !== 'undefined' && performance.now
    ? () => performance.now() : () => Date.now());
  const sendFn = typeof o.send === 'function' ? o.send : null;
  const t0 = now();

  const entries = [];        // [{t_ms, level, message}] ring buffer
  const listeners = [];      // onEntry subscribers (the log shipper)
  let panel = null;          // built lazily on first toggle
  let listEl = null;
  let shipStatusEl = null;
  let copyBtn = null;
  let sendBtn = null;        // "Send log" — push the full retained log now
  let sendHintEl = null;     // honest send-failure hint (own wrapped line)
  let sendState = 'idle';    // 'idle' | 'sending' | 'sent'
  let sendGen = 0;           // invalidates a superseded in-flight send's UI
  let droppedFromMemory = 0; // entries the ring buffer evicted (push marker)
  let shipStatusText = null; // pending status set before the panel exists

  function formatEntry(e) {
    return '[+' + (e.t_ms / 1000).toFixed(1) + 's] ' + e.level + ' ' + e.message;
  }

  function formatEntries() {
    return entries.map(formatEntry).join('\n');
  }

  function appendLine(entry) {
    if (!listEl) return;
    try {
      const line = doc.createElement('div');
      line.textContent = formatEntry(entry);
      if (entry.level === 'ERROR') line.style.color = '#ff6b6b';
      listEl.appendChild(line);
      while (listEl.children.length > MAX_LOG_ENTRIES) {
        listEl.removeChild(listEl.children[0]);
      }
    } catch (err) { /* panel rendering is best-effort */ }
  }

  /** Append an entry. `message` is sanitized (data: URIs elided) first. */
  function log(level, message) {
    const entry = {
      t_ms: Math.round(now() - t0),
      level: String(level || 'INFO').toUpperCase(),
      message: elideDataUris(message == null ? '' : message),
    };
    entries.push(entry);
    if (entries.length > MAX_LOG_ENTRIES) {
      droppedFromMemory += entries.length - MAX_LOG_ENTRIES;
      entries.splice(0, entries.length - MAX_LOG_ENTRIES);
    }
    for (const fn of listeners.slice()) {
      try { fn(entry); } catch (err) { /* a bad subscriber never kills logging */ }
    }
    appendLine(entry);
    return entry;
  }

  /** Subscribe to every appended (already-sanitized) entry. */
  function onEntry(fn) { if (typeof fn === 'function') listeners.push(fn); }

  /**
   * Surface (or clear, with null) the log-shipping health flag in the panel
   * header — e.g. "diagnostics not reaching server — use Copy to share logs".
   */
  function setShipStatus(message) {
    shipStatusText = message || null;
    if (shipStatusEl) {
      shipStatusEl.textContent = shipStatusText || '';
      shipStatusEl.hidden = !shipStatusText;
    }
  }

  // --- "Send log" button state machine --------------------------------------
  // idle -> (tap) -> sending -> 2xx ack -> sent (greyed until the next capture
  // sweep calls resetSendState()) | failure -> back to idle + an honest hint.
  // Only send() resolving {ok:true} (a real HTTP 2xx, see shipAll()) reaches
  // 'sent' — fake success is forbidden.

  function sendLabel() {
    if (sendState === 'sending') return tFn('debug.sending', null, 'Sending…');
    if (sendState === 'sent') return tFn('debug.sent', null, 'Sent ✓');
    return tFn('debug.send', null, 'Send log');
  }

  function applySendState() {
    if (!sendBtn) return;
    try {
      sendBtn.disabled = sendState !== 'idle';
      sendBtn.textContent = sendLabel();
      sendBtn.style.opacity = sendState === 'idle' ? '1' : '0.55';
    } catch (err) { /* panel rendering is best-effort */ }
  }

  function showSendHint(show) {
    if (!sendHintEl) return;
    try {
      sendHintEl.hidden = !show;
      sendHintEl.textContent = show
        ? tFn('debug.sendFailed', null,
            "couldn't reach server — try again or use Copy")
        : '';
    } catch (err) { /* hint rendering is cosmetic */ }
  }

  /**
   * Re-arm the Send-log button for a new capture sweep. A "Sent ✓" latch
   * refers to the PREVIOUS session's log, so capture_app.js calls this from
   * the same place it resets the rest of its per-capture state
   * (startCaptureLoop()). Also supersedes any in-flight send: a late ack for
   * the old session may no longer flip the button to Sent.
   */
  function resetSendState() {
    sendGen += 1;
    sendState = 'idle';
    applySendState();
    showSendHint(false);
  }

  function onSendTap() {
    if (sendState !== 'idle' || !sendFn) return;
    // Logged BEFORE collecting, so it is the batch's final entry — the server
    // sees exactly when/why this push happened and the panel shows it too.
    log('INFO', 'user pushed log from device');
    // Ship EVERYTHING currently retained, not just the shipper's unsent
    // queue: the point of the button is one complete, self-contained batch
    // even if earlier batches already landed (the server tolerates overlap).
    const toShip = entries.slice();
    if (droppedFromMemory > 0) {
      toShip.unshift({
        t_ms: null, level: 'INFO',
        message: '[' + droppedFromMemory + ' older log entries already '
          + 'dropped from memory (ring cap ' + MAX_LOG_ENTRIES
          + ') — this push starts at the oldest retained entry]',
      });
    }
    sendGen += 1;
    const gen = sendGen;
    sendState = 'sending';
    applySendState();
    showSendHint(false);
    const settle = (ok) => {
      if (gen !== sendGen) return; // superseded by resetSendState()
      sendState = ok ? 'sent' : 'idle';
      applySendState();
      showSendHint(!ok);
      if (!ok) {
        // Brief hint: auto-clear after a few seconds. unref'd so a pending
        // cosmetic timer never pins a Node test process.
        try {
          const id = setTimeout(() => {
            if (gen === sendGen) showSendHint(false);
          }, 6000);
          if (id && typeof id.unref === 'function') id.unref();
        } catch (err) { /* hint clearing is cosmetic */ }
      }
    };
    let p;
    try { p = sendFn(toShip); } catch (err) { p = Promise.reject(err); }
    Promise.resolve(p).then(
      (res) => settle(!!(res && res.ok)),
      () => settle(false));
  }

  function buildPanel() {
    if (panel || !doc || !doc.body) return;
    panel = doc.createElement('div');
    panel.id = 'debug-log-panel';
    panel.hidden = true;
    panel.style.cssText = 'position:fixed;left:0;right:0;bottom:0;' +
      'max-height:45vh;z-index:9998;background:rgba(10,10,16,0.94);' +
      'color:#cfcfe0;font:11px/1.5 ui-monospace,Consolas,monospace;' +
      'border-top:1px solid #2a2a3a;display:flex;flex-direction:column;';

    const header = doc.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;gap:10px;' +
      'padding:6px 10px;border-bottom:1px solid #2a2a3a;flex-wrap:wrap;';

    const title = doc.createElement('span');
    title.textContent = tFn('debug.title', null, 'Capture debug log');
    title.style.cssText = 'font-weight:bold;color:#9aa;';
    header.appendChild(title);

    shipStatusEl = doc.createElement('span');
    shipStatusEl.id = 'debug-ship-status';
    shipStatusEl.style.cssText = 'color:#f0b429;';
    shipStatusEl.hidden = !shipStatusText;
    shipStatusEl.textContent = shipStatusText || '';
    header.appendChild(shipStatusEl);

    copyBtn = doc.createElement('button');
    copyBtn.type = 'button';
    copyBtn.id = 'btn-debug-copy';
    copyBtn.textContent = tFn('debug.copy', null, 'Copy');
    copyBtn.style.cssText = 'margin-left:auto;font:inherit;padding:2px 10px;' +
      'background:#1d1d2a;color:#cfcfe0;border:1px solid #2a2a3a;border-radius:4px;';
    copyBtn.addEventListener('click', () => {
      // Hosted-mirror adaptation: prepend the self-identifying header
      // (timestamp, UA, URL, entry count) the bug-report workflow expects.
      const text = 'Raku Capture debug log \u2014 ' + new Date().toISOString() +
        '\nUA: ' + ((typeof navigator !== 'undefined' && navigator.userAgent) || '') +
        '\nURL: ' + ((typeof location !== 'undefined' && location.href) || '') +
        '\nentries: ' + entries.length +
        '\n' + '-'.repeat(60) + '\n' +
        formatEntries() + '\n';
      const done = (ok) => {
        copyBtn.textContent = ok
          ? tFn('debug.copied', null, 'Copied')
          : tFn('debug.copyFailed', null, 'Copy failed');
        try {
          setTimeout(() => {
            copyBtn.textContent = tFn('debug.copy', null, 'Copy');
          }, 2500);
        } catch (err) { /* label restore is cosmetic */ }
      };
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(() => done(true), () => done(false));
        } else {
          done(false); // no clipboard API — say so, never fake a copy
        }
      } catch (err) { done(false); }
    });
    header.appendChild(copyBtn);

    // "Send log" — only when a send transport was wired (opts.send): the
    // button promises a server-acknowledged push, so without a transport it
    // must not exist at all rather than fake one.
    if (sendFn) {
      sendBtn = doc.createElement('button');
      sendBtn.type = 'button';
      sendBtn.id = 'btn-debug-send';
      sendBtn.style.cssText = 'font:inherit;padding:2px 10px;background:#1d1d2a;' +
        'color:#cfcfe0;border:1px solid #2a2a3a;border-radius:4px;';
      sendBtn.addEventListener('click', onSendTap);
      header.appendChild(sendBtn);
      applySendState();
      // The failure hint wraps onto its own header line (flex-wrap above).
      sendHintEl = doc.createElement('span');
      sendHintEl.id = 'debug-send-hint';
      sendHintEl.style.cssText = 'color:#f0b429;flex-basis:100%;';
      sendHintEl.hidden = true;
      header.appendChild(sendHintEl);
    }

    const closeBtn = doc.createElement('button');
    closeBtn.type = 'button';
    closeBtn.id = 'btn-debug-close';
    closeBtn.textContent = tFn('debug.close', null, 'Close');
    closeBtn.style.cssText = 'font:inherit;padding:2px 10px;background:#1d1d2a;' +
      'color:#cfcfe0;border:1px solid #2a2a3a;border-radius:4px;';
    header.appendChild(closeBtn);

    // Close is bound by DELEGATION from the panel root, not on the button
    // node: the root is created once and never replaced, so the binding
    // survives an iOS bfcache restore even if the restored page mishandles
    // bindings on descendant nodes (field bug: after an app switch the
    // panel's Close did nothing). Manual ancestor walk — no closest()
    // dependency, works in the headless test DOM too.
    panel.addEventListener('click', (e) => {
      let n = e && e.target;
      while (n && n !== panel) {
        if (n.id === 'btn-debug-close') { toggle(false); return; }
        n = n.parentNode;
      }
    });

    listEl = doc.createElement('div');
    listEl.id = 'debug-log-list';
    listEl.style.cssText = 'overflow:auto;padding:6px 10px;white-space:pre-wrap;' +
      'word-break:break-word;';
    for (const e of entries) appendLine(e);

    panel.appendChild(header);
    panel.appendChild(listEl);
    doc.body.appendChild(panel);
  }

  /**
   * Rebuild the panel's rendered state from the retained in-memory entries:
   * re-attach the panel if the document lost it, re-render the entry list,
   * and re-apply the ship-status flag. Used on page resume — an iOS bfcache
   * restore has been observed to blank the rendered log lines while the
   * in-memory `entries` ring buffer is fully intact. Idempotent and
   * best-effort; a no-op until the panel has been built (a fresh toggle
   * already renders from `entries`).
   */
  function rerender() {
    try {
      if (!panel || !doc || !doc.body) return;
      if (!panel.parentNode) doc.body.appendChild(panel);
      if (listEl) {
        listEl.textContent = ''; // clears all child nodes
        for (const e of entries) appendLine(e);
        if (!panel.hidden && typeof listEl.scrollTo === 'function') {
          try { listEl.scrollTo(0, 1e9); } catch (err) { /* cosmetic */ }
        }
      }
      if (shipStatusEl) {
        shipStatusEl.textContent = shipStatusText || '';
        shipStatusEl.hidden = !shipStatusText;
      }
      applySendState(); // re-apply the Send-log label/disabled after a restore
    } catch (err) { /* panel rendering is best-effort */ }
  }

  /** Show/hide the panel. `force` true/false pins the state; absent toggles. */
  function toggle(force) {
    try {
      buildPanel();
      if (!panel) return;
      const show = force === undefined ? panel.hidden : !!force;
      panel.hidden = !show;
      if (show && listEl && typeof listEl.scrollTo === 'function') {
        try { listEl.scrollTo(0, 1e9); } catch (err) { /* cosmetic */ }
      }
    } catch (err) { /* never break the app for the debug panel */ }
  }

  // Floating DEBUG button + F2 shortcut — both best-effort.
  try {
    if (doc && doc.body && typeof doc.createElement === 'function') {
      const btn = doc.createElement('button');
      btn.type = 'button';
      btn.id = 'btn-debug-log';
      btn.textContent = 'DEBUG';
      btn.setAttribute('aria-label', tFn('debug.title', null, 'Capture debug log'));
      btn.style.cssText = 'position:fixed;bottom:10px;left:10px;z-index:9999;' +
        'opacity:0.55;font:10px ui-monospace,Consolas,monospace;padding:4px 8px;' +
        'background:#16161f;color:#9aa;border:1px solid #2a2a3a;border-radius:6px;';
      btn.addEventListener('click', () => toggle());
      doc.body.appendChild(btn);
    }
    if (doc && typeof doc.addEventListener === 'function') {
      doc.addEventListener('keydown', (e) => {
        if (e && e.key === 'F2') toggle();
      });
    }
  } catch (err) { /* headless / restricted DOM — pure logging still works */ }

  return {
    log,
    onEntry,
    setShipStatus,
    toggle,
    rerender,
    resetSendState,
    getEntries: () => entries.slice(),
    formatEntries,
  };
}
