// log_shipper.js — batch client debug-log entries to the raku-api backend
// Copyright (c) 2026 RakuAI, LLC. All rights reserved.
//
// ----------------------------------------------------------------------------
// Ships the debug logger's entries (see debug_log.js) to the backend so a
// failed capture can be diagnosed WITHOUT asking the user to copy/paste logs.
//
// CONTRACT — POST {API_BASE}/api/v1/capture/client-logs, JSON body:
//
//   {
//     "session_id":  "<id>" | null,   // when /captures/session/start gave one
//     "capture_id":  "<id>" | null,   // once /api/v1/capture returned one
//     "client": { "ua": "...", "app_version": "...", "platform": "ios|android|other" },
//     "entries": [
//       { "seq": 17, "t_ms": 12345, "level": "NET", "message": "..." }
//     ]
//   }
//
//   - `seq` is monotonically increasing per page load so the server can
//     dedupe across retries/overlapping batches (a failed POST is retried
//     with the same seqs).
//   - `t_ms` is ms since the debug logger was created (monotonic clock).
//   - Batches are capped at MAX_BATCH_ENTRIES entries / MAX_BATCH_BYTES
//     bytes; when over, MIDDLE entries are dropped (oldest context + newest
//     events are the valuable ends) and one marker entry says how many were
//     elided — the server is never silently missing data.
//   - OPTIONAL top-level field `"user_flagged": true` — present ONLY on
//     user-initiated pushes (the debug panel's "Send log" button ->
//     shipAll()). Such a batch is the COMPLETE retained log, intentionally
//     re-sending entries earlier batches may already have delivered, so it
//     is self-contained. Backend lane: flagged batches should be surfaced
//     to operators (notification / triage queue), not just stored — a user
//     pressed a button asking a human to look. The endpoint ignores unknown
//     fields safely, so this client can deploy ahead of the backend change.
//
// Shipping cadence:
//   - every SHIP_INTERVAL_MS (10 s) while new entries are queued;
//   - immediately on ERROR-level entries and on capture state transitions
//     (capture_app.js calls shipNow());
//   - on explicit user request via shipAll() (the panel's "Send log"
//     button): one complete user_flagged batch, fetch-only — sendBeacon is
//     NOT acceptable there because the button promises a server ack;
//   - on pagehide / visibilitychange:hidden via navigator.sendBeacon (the
//     only delivery path that survives a closing tab). pagehide is treated
//     as "maybe coming back": iOS puts the page in the back/forward cache
//     and later restores it (pageshow with persisted=true), so the flush
//     must never permanently stop the shipper;
//   - on pageshow (persisted) / visibilitychange:visible the shipper
//     RE-ARMS via resume(): any fetch orphaned by the freeze is abandoned
//     (iOS never settles a fetch it killed on bfcache entry — left alone it
//     wedges `inFlight` true and silently kills all future shipping), the
//     ship timer restarts, and retained entries re-ship.
//
// HONEST FAILURE HANDLING (CLAUDE.md: fake success is forbidden):
//   - entries are removed from the queue ONLY after an HTTP 2xx response;
//   - after DEGRADE_AFTER_FAILURES consecutive failures the shipper backs
//     off exponentially (capped at MAX_BACKOFF_MS) and notifies onDegraded
//     subscribers so the debug panel can show "diagnostics not reaching
//     server — use Copy to share logs". It never reports shipped logs that
//     were not acknowledged by the server.
//   - sendBeacon's queue-accepted=true is the strongest signal that API
//     offers; a false return leaves the queue intact.
//
// Dependency-free and Node-testable: fetch/beacon/clock/timers are all
// injectable. See log_shipper.test.mjs.
// ----------------------------------------------------------------------------

'use strict';

export const CLIENT_LOGS_PATH = '/api/v1/capture/client-logs';
export const SHIP_INTERVAL_MS = 10000;        // steady-state cadence
export const MAX_BATCH_ENTRIES = 500;         // per-batch entry cap
export const MAX_BATCH_BYTES = 256 * 1024;    // per-batch byte cap (whole body)
export const MAX_BEACON_BYTES = 60 * 1024;    // sendBeacon payloads must stay small
export const MAX_QUEUE_ENTRIES = 1500;        // client-side queue cap
export const MAX_MESSAGE_CHARS = 4096;        // single-entry message cap
export const DEGRADE_AFTER_FAILURES = 3;      // consecutive failures -> degraded
export const MAX_BACKOFF_MS = 60000;          // exponential backoff ceiling

/**
 * UTF-8 byte length of a string. `String.length` counts UTF-16 code units,
 * which undercounts non-ASCII text by up to 3x (e.g. Japanese log lines) —
 * the server's body limit is in bytes, so the cap must be too. TextEncoder
 * is universal (all browsers + Node); the fallback over-estimates (never
 * under-estimates) so a missing encoder can only make batches smaller.
 */
export function utf8Length(s) {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(s).length;
  }
  let bytes = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    bytes += c < 0x80 ? 1 : c < 0x800 ? 2 : 3;
  }
  return bytes;
}

/** Hard-cap one message so a single entry can never blow the byte budget. */
export function truncateMessage(message) {
  const s = String(message == null ? '' : message);
  if (s.length <= MAX_MESSAGE_CHARS) return s;
  return s.slice(0, MAX_MESSAGE_CHARS) + '…[truncated]';
}

/**
 * Cap a batch to maxEntries / maxBytes by dropping MIDDLE entries, inserting
 * one marker entry (seq of its predecessor, so seq order stays sane) that
 * says how many were elided. Pure — does not mutate `entries`.
 *
 * @param {Array<object>} entries [{seq,t_ms,level,message}]
 * @param {{maxEntries?:number, maxBytes?:number}} [opts]
 * @returns {{entries: Array<object>, dropped: number}}
 */
export function capBatch(entries, opts) {
  const o = opts || {};
  const maxEntries = o.maxEntries != null ? o.maxEntries : MAX_BATCH_ENTRIES;
  const maxBytes = o.maxBytes != null ? o.maxBytes : MAX_BATCH_BYTES;
  if (!entries || !entries.length) return { entries: [], dropped: 0 };

  // Split at the middle; drops eat inward from the split point so the oldest
  // (session context) and newest (the failure) entries are kept.
  let splitAt = Math.ceil(entries.length / 2);
  const head = entries.slice(0, splitAt);
  const tail = entries.slice(splitAt);
  let dropped = 0;

  const dropOne = () => {
    if (head.length >= tail.length && head.length > 1) head.pop();
    else if (tail.length > 1) tail.shift();
    else if (head.length) head.pop();
    else tail.shift();
    dropped += 1;
  };

  const assemble = () => {
    if (!dropped) return head.concat(tail);
    const markerSeq = head.length ? head[head.length - 1].seq
      : (tail.length ? tail[0].seq : 0);
    return head.concat([{
      seq: markerSeq, t_ms: null, level: 'INFO',
      message: '[' + dropped + ' log entries elided client-side (batch cap)]',
    }], tail);
  };

  // Entry-count cap (the marker itself counts toward the cap). The
  // head+tail>0 guard keeps a degenerate maxEntries <= 0 from spinning
  // forever once everything droppable is gone (the marker alone remains).
  while (head.length + tail.length + (dropped ? 1 : 0) > maxEntries
         && head.length + tail.length > 0) dropOne();

  // Byte cap. Re-stringifying after every single drop is O(n^2); drop ~10%
  // per iteration to bound the cost.
  let out = assemble();
  while (utf8Length(JSON.stringify(out)) > maxBytes && head.length + tail.length > 1) {
    let n = Math.max(1, Math.floor((head.length + tail.length) * 0.1));
    while (n-- > 0 && head.length + tail.length > 1) dropOne();
    out = assemble();
  }
  return { entries: out, dropped };
}

/**
 * Create the shipper.
 *
 * @param {object} opts
 * @param {string} opts.apiBase           e.g. https://api.rakuai.com
 * @param {object} opts.client            { ua, app_version, platform }
 * @param {boolean} [opts.enabled=true]   false (demo mode) = enqueue is a no-op
 * @param {Function} [opts.fetchFn]       injectable fetch (tests)
 * @param {Function} [opts.beaconFn]      injectable sendBeacon (tests)
 * @param {Function} [opts.now]           injectable clock, default Date.now
 * @param {Function} [opts.setTimeoutFn]  injectable timer (tests)
 * @param {Function} [opts.clearTimeoutFn]
 * @param {number}  [opts.intervalMs]     default SHIP_INTERVAL_MS
 */
export function createLogShipper(opts) {
  const o = opts || {};
  const apiBase = o.apiBase || '';
  const url = apiBase + (o.path || CLIENT_LOGS_PATH);
  const client = o.client || { ua: '', app_version: '', platform: 'other' };
  const enabled = o.enabled !== false;
  const intervalMs = o.intervalMs != null ? o.intervalMs : SHIP_INTERVAL_MS;
  const now = o.now || (() => Date.now());
  const fetchFn = o.fetchFn
    || (typeof fetch === 'function' ? (...a) => fetch(...a) : null);
  const beaconFn = o.beaconFn || ((typeof navigator !== 'undefined'
    && navigator.sendBeacon)
    ? (u, data) => navigator.sendBeacon(u, data) : null);
  const setTimeoutFn = o.setTimeoutFn
    || ((fn, ms) => (typeof setTimeout === 'function' ? setTimeout(fn, ms) : null));
  const clearTimeoutFn = o.clearTimeoutFn
    || ((id) => { if (typeof clearTimeout === 'function') clearTimeout(id); });

  let queue = [];                 // [{seq,t_ms,level,message}] — unacked entries
  let seq = 0;                    // monotonically increasing per page load
  let sessionId = null;
  let captureId = null;
  let consecutiveFailures = 0;
  let degraded = false;
  let nextAllowedAt = 0;          // backoff gate (epoch ms)
  let inFlight = false;
  let flightGen = 0;              // bumped by resume() to orphan a dead flight
  let resumeLock = false;         // same-tick double-resume guard (see resume())
  let stopped = false;
  let timer = null;
  const degradedListeners = [];

  function notifyDegraded(isDegraded) {
    for (const fn of degradedListeners.slice()) {
      try { fn(isDegraded); } catch (err) { /* subscriber errors are theirs */ }
    }
  }

  function schedule(ms) {
    if (timer !== null || stopped || !enabled) return;
    timer = setTimeoutFn(() => {
      timer = null;
      try { shipNow('interval'); } catch (err) { /* defensive */ }
    }, ms);
    // Node (selftest harness): a pending retry timer must not pin the process.
    if (timer && typeof timer.unref === 'function') timer.unref();
  }

  function buildPayload(batchEntries) {
    return {
      session_id: sessionId,
      capture_id: captureId,
      client: client,
      entries: batchEntries,
    };
  }

  function onFailure(detail) {
    consecutiveFailures += 1;
    if (consecutiveFailures >= DEGRADE_AFTER_FAILURES && !degraded) {
      degraded = true;
      notifyDegraded(true);
    }
    // Exponential backoff: 1s, 2s, 4s, ... capped at MAX_BACKOFF_MS. This is
    // the retry-spam stop: queued entries are kept, attempts are spaced out.
    const backoff = Math.min(MAX_BACKOFF_MS,
      1000 * Math.pow(2, consecutiveFailures - 1));
    nextAllowedAt = now() + backoff;
    if (queue.length) schedule(backoff);
    return detail; // for the caller's promise chain; never thrown
  }

  function onSuccess() {
    consecutiveFailures = 0;
    nextAllowedAt = 0;
    if (degraded) {
      degraded = false;
      notifyDegraded(false);
    }
  }

  /**
   * Attempt one POST of the current queue. Resolves true only on a server-
   * acknowledged (HTTP 2xx) delivery; false for "did not ship" (disabled,
   * empty, in flight, backing off, or the POST failed). Never throws.
   */
  function shipNow(reason) {
    if (!enabled || stopped || inFlight || !queue.length) {
      return Promise.resolve(false);
    }
    const nowMs = now();
    if (nowMs < nextAllowedAt) {
      schedule(Math.max(50, nextAllowedAt - nowMs));
      return Promise.resolve(false);
    }
    if (!fetchFn) return Promise.resolve(false); // no transport — stay honest
    const count = queue.length; // entries enqueued during flight stay queued
    const batch = capBatch(queue.slice(0, count), {
      maxEntries: MAX_BATCH_ENTRIES,
      maxBytes: MAX_BATCH_BYTES - 2048, // envelope headroom
    });
    const body = JSON.stringify(buildPayload(batch.entries));
    inFlight = true;
    const gen = flightGen; // resume() bumps this to orphan a frozen flight
    let p;
    try {
      p = fetchFn(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
        keepalive: reason === 'lifecycle',
      });
    } catch (err) {
      p = Promise.reject(err);
    }
    return Promise.resolve(p).then((resp) => {
      // A flight orphaned by resume() must not touch shipper state: its
      // entries stayed queued (they re-ship; the server dedupes by seq if
      // this response means they actually landed) and a NEWER flight may
      // own `inFlight` now.
      if (gen !== flightGen) return false;
      inFlight = false;
      if (resp && resp.ok) {
        // The capped batch INTENTIONALLY elided middle entries; the whole
        // window they came from is acked by the marker, so drop all `count`.
        queue.splice(0, count);
        onSuccess();
        if (queue.length) schedule(intervalMs);
        return true;
      }
      onFailure('HTTP ' + (resp ? resp.status : 'no-response'));
      return false;
    }, (err) => {
      if (gen !== flightGen) return false; // orphaned — see above
      inFlight = false;
      onFailure(err && err.message ? err.message : String(err));
      return false;
    });
  }

  /**
   * USER-INITIATED full-log push (the debug panel's "Send log" button).
   * Ships the caller-supplied entries — the panel's ENTIRE retained ring
   * buffer, including entries already acked in earlier batches — as one
   * self-contained batch carrying top-level `user_flagged: true`, so the
   * server holds a complete log without stitching batches. Fresh seqs are
   * assigned (continuing the page-load counter): the overlap with earlier
   * batches is intentional and must NOT be deduped away.
   *
   * Resolves { ok:true, status } ONLY on a real HTTP 2xx ack;
   * { ok:false, detail } for everything else — disabled shipper (demo
   * mode), no transport, network error, non-2xx. Never throws, never uses
   * sendBeacon (a beacon cannot return the ack this affordance promises).
   *
   * Deliberately ORTHOGONAL to steady-state shipping: it does not touch the
   * queue, the inFlight latch, the backoff gate, or the degraded flag in
   * either direction — a user push is allowed during backoff (one deliberate
   * tap is not retry spam), and only the regular pipeline's own 2xx may
   * clear degraded (resume()'s honesty rule applies here too).
   *
   * @param {{entries: Array<{t_ms,level,message}>, flagged?: boolean}} opts
   * @returns {Promise<{ok: boolean, status?: number, detail?: string}>}
   */
  function shipAll(opts) {
    const req = opts || {};
    const src = Array.isArray(req.entries) ? req.entries : [];
    if (!enabled) return Promise.resolve({ ok: false, detail: 'disabled' });
    if (!fetchFn) return Promise.resolve({ ok: false, detail: 'no transport' });
    if (!src.length) return Promise.resolve({ ok: false, detail: 'no entries' });
    // Defensive at the API boundary: a null/primitive element must not
    // TypeError the whole push — it becomes an empty INFO entry instead.
    const withSeqs = src.map((raw) => {
      const e = (raw && typeof raw === 'object') ? raw : {};
      return {
        seq: ++seq,
        t_ms: typeof e.t_ms === 'number' ? e.t_ms : null,
        level: String(e.level || 'INFO').toUpperCase(),
        message: truncateMessage(e.message),
      };
    });
    const batch = capBatch(withSeqs, {
      maxEntries: MAX_BATCH_ENTRIES,
      maxBytes: MAX_BATCH_BYTES - 2048, // envelope headroom
    });
    const payload = buildPayload(batch.entries);
    if (req.flagged) payload.user_flagged = true;
    let p;
    try {
      p = fetchFn(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      p = Promise.reject(err);
    }
    return Promise.resolve(p).then((resp) => {
      if (resp && resp.ok) return { ok: true, status: resp.status };
      return { ok: false, detail: 'HTTP ' + (resp ? resp.status : 'no-response') };
    }, (err) => ({
      ok: false,
      detail: err && err.message ? err.message : String(err),
    }));
  }

  /**
   * Queue one sanitized log entry {t_ms, level, message}. Assigns `seq`.
   * ERROR-level entries trigger an immediate ship attempt (still subject to
   * the backoff gate). Returns the assigned seq, or null when disabled.
   */
  function enqueue(e) {
    if (!enabled || stopped || !e) return null;
    const entry = {
      seq: ++seq,
      t_ms: typeof e.t_ms === 'number' ? e.t_ms : null,
      level: String(e.level || 'INFO').toUpperCase(),
      message: truncateMessage(e.message),
    };
    queue.push(entry);
    if (queue.length > MAX_QUEUE_ENTRIES) {
      // Middle-drop with a marker (same policy as capBatch): keep the oldest
      // context and the newest events.
      const keepHead = 200;
      const keepTail = MAX_QUEUE_ENTRIES - keepHead - 1;
      const droppedN = queue.length - keepHead - keepTail;
      const headPart = queue.slice(0, keepHead);
      const tailPart = queue.slice(queue.length - keepTail);
      queue = headPart.concat([{
        seq: headPart[headPart.length - 1].seq, t_ms: null, level: 'INFO',
        message: '[' + droppedN + ' log entries dropped client-side (queue overflow)]',
      }], tailPart);
    }
    if (entry.level === 'ERROR') shipNow('error');
    else schedule(intervalMs);
    return entry.seq;
  }

  /**
   * Last-gasp delivery for pagehide/hidden: hand the queue to sendBeacon.
   * Returns true ONLY when the UA accepted the beacon (its strongest
   * guarantee); a false return leaves the queue untouched. No beacon API =
   * false — never fake delivery.
   */
  function flushBeacon() {
    if (!enabled || stopped || !queue.length || !beaconFn) return false;
    const count = queue.length;
    const batch = capBatch(queue.slice(0, count), {
      maxEntries: MAX_BATCH_ENTRIES,
      maxBytes: MAX_BEACON_BYTES - 1024,
    });
    const body = JSON.stringify(buildPayload(batch.entries));
    let accepted = false;
    try {
      // Plain-string beacons avoid the CORS preflight an application/json
      // Blob would force on a cross-origin endpoint.
      accepted = beaconFn(url, body) === true;
    } catch (err) {
      accepted = false;
    }
    if (accepted) queue.splice(0, count);
    return accepted;
  }

  function stop() {
    stopped = true;
    if (timer !== null) { clearTimeoutFn(timer); timer = null; }
  }

  /**
   * Re-arm after a bfcache restore (pageshow persisted=true) or a return to
   * visibility — the inverse of the pagehide flush. iOS kills any in-flight
   * fetch when the page enters the back/forward cache and NEVER settles it
   * after restore; left alone that wedges `inFlight` true and every future
   * shipNow() no-ops — shipping is silently dead. resume() orphans such a
   * flight (its eventual settle, if any, is ignored via the generation
   * check) and its entries stay queued: if the POST actually landed, the
   * per-page-load `seq` lets the server dedupe the re-ship — never a lost
   * batch, never a fake ack. Also reverses stop(): a page restored from the
   * bfcache is observably not gone, so a pagehide-motivated stop was
   * premature. Idempotent; honest state (degraded flag, backoff gate) is
   * deliberately NOT reset — only a real 2xx clears those.
   */
  function resume() {
    // pageshow(persisted) and visibilitychange:visible typically BOTH fire
    // on an iOS bfcache restore, in the same tick. Only the first call may
    // orphan a wedged flight — without this lock the second call would
    // orphan the healthy re-ship the first one just started (duplicate
    // sends, churn). The lock clears on the next microtask, so two distinct
    // restores can never share it.
    if (inFlight && !resumeLock) {
      resumeLock = true;
      Promise.resolve().then(() => { resumeLock = false; });
      flightGen += 1;
      inFlight = false;
    }
    stopped = false;
    if (timer !== null) { clearTimeoutFn(timer); timer = null; }
    // Re-ship retained entries promptly (the page may be backgrounded again
    // soon); shipNow() still honors the backoff gate and re-schedules.
    if (queue.length) shipNow('resume');
  }

  return {
    enqueue,
    shipNow,
    shipAll,
    flushBeacon,
    stop,
    resume,
    setSessionId: (id) => { sessionId = id || null; },
    setCaptureId: (id) => { captureId = id || null; },
    onDegraded: (fn) => { if (typeof fn === 'function') degradedListeners.push(fn); },
    // Introspection for tests + the debug panel.
    getState: () => ({
      queued: queue.length,
      seq: seq,
      degraded: degraded,
      consecutiveFailures: consecutiveFailures,
      nextAllowedAt: nextAllowedAt,
      sessionId: sessionId,
      captureId: captureId,
      enabled: enabled,
      inFlight: inFlight,
      stopped: stopped,
    }),
  };
}

/**
 * Wire the page lifecycle, both directions:
 *
 *   - pagehide + visibilitychange:hidden — the documented last-chance
 *     moments to hand logs to sendBeacon before the tab dies. The flush
 *     never stops the shipper: on iOS pagehide usually means "frozen into
 *     the back/forward cache", not "gone".
 *   - pageshow (event.persisted=true) — the bfcache restore. The shipper
 *     re-arms via resume(); `hooks.onResume(why)` then lets the caller
 *     re-arm UI (the debug panel re-renders its entry list).
 *   - visibilitychange:visible — belt-and-braces resume for the iOS
 *     app-switch path where no pageshow fires. resume() is idempotent, so
 *     double-firing is harmless.
 *
 * Feature-detected; a headless context is a no-op.
 *
 * @param {object} shipper            createLogShipper() instance
 * @param {Window} [win]              window override (tests)
 * @param {Document} [doc]            document override (tests)
 * @param {{onResume?:Function}} [hooks] called AFTER shipper.resume() with
 *                                    'bfcache-restore' | 'visible'
 */
export function attachLogShipperLifecycle(shipper, win, doc, hooks) {
  const w = win || (typeof window !== 'undefined' ? window : null);
  const d = doc || (typeof document !== 'undefined' ? document : null);
  const onResume = (hooks && typeof hooks.onResume === 'function')
    ? hooks.onResume : null;
  const resume = (why) => {
    try { shipper.resume(); } catch (err) { /* defensive */ }
    if (onResume) {
      try { onResume(why); } catch (err) { /* a bad hook never kills resume */ }
    }
  };
  try {
    if (w && typeof w.addEventListener === 'function') {
      w.addEventListener('pagehide', () => { shipper.flushBeacon(); });
      w.addEventListener('pageshow', (e) => {
        if (e && e.persisted) resume('bfcache-restore');
      });
    }
    if (d && typeof d.addEventListener === 'function') {
      d.addEventListener('visibilitychange', () => {
        if (d.visibilityState === 'hidden') shipper.flushBeacon();
        else if (d.visibilityState === 'visible') resume('visible');
      });
    }
  } catch (err) { /* lifecycle wiring is best-effort */ }
}
