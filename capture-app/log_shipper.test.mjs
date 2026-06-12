// log_shipper.test.mjs -- Node regression tests for the client-log shipping
// pipeline: debug-log hygiene (data:-URI eliding, status-poll dedupe) and the
// log shipper's batching / capping / honest-failure behavior.
// Copyright (c) 2026 RakuAI, LLC. All rights reserved.
//
// Run: node web/capture/log_shipper.test.mjs   (no deps; uses node:assert)
//
// The load-bearing guarantees these tests lock in:
//   - a multi-megabyte data: URI never reaches the log verbatim;
//   - identical 2 s status polls collapse to one-line entries, with full
//     bodies only on real change / >=5pt progress / 30 s heartbeat;
//   - batches respect the 500-entry / 256 KB caps via middle-drop + marker;
//   - entries leave the queue ONLY on an HTTP 2xx ack, repeated failures
//     degrade loudly (onDegraded -> the panel flag) with capped backoff,
//     and recovery re-ships the retained entries. No fake success, ever;
//   - an iOS app-switch (pagehide into the bfcache -> pageshow persisted)
//     cannot kill diagnostics: a fetch the freeze orphaned is abandoned
//     (inFlight cannot stick), retained entries re-ship on resume, the
//     panel re-renders from the in-memory entries, and Close — delegated
//     from the never-replaced panel root — keeps working.

import assert from 'node:assert/strict';
import {
  elideDataUris, describeBytes, createPollDeduper, createDebugLog,
} from './debug_log.js';
import {
  capBatch, truncateMessage, createLogShipper, utf8Length,
  attachLogShipperLifecycle,
  MAX_BATCH_ENTRIES, MAX_BATCH_BYTES, MAX_MESSAGE_CHARS,
  DEGRADE_AFTER_FAILURES, MAX_BACKOFF_MS, CLIENT_LOGS_PATH,
} from './log_shipper.js';

let passed = 0;
function test(name, fn) {
  const r = fn();
  const done = () => { passed += 1; console.log('  ok -', name); };
  if (r && typeof r.then === 'function') return r.then(done);
  done();
}

// ---------------------------------------------------------------------------
console.log('elideDataUris (debug-log hygiene):');

await test('a large base64 data: URI is elided with mime + size', () => {
  const payload = 'A'.repeat(1.2 * 1024 * 1024 / 3 * 4); // ~1.2 MB decoded
  const msg = 'loading data:application/wasm;base64,' + payload + ' done';
  const out = elideDataUris(msg);
  assert.ok(out.includes('data:application/wasm;base64,[1.2 MB elided]'), out.slice(0, 120));
  assert.ok(out.length < 200);
  assert.ok(out.startsWith('loading ') && out.endsWith(' done'));
});

await test('small data: URIs and plain URLs pass through untouched', () => {
  const small = 'data:image/png;base64,iVBORw0KGgo=';
  assert.equal(elideDataUris(small), small);
  const url = 'see https://cdn.raku.games/splats/cap_1.spz';
  assert.equal(elideDataUris(url), url);
});

await test('multiple data: URIs in one message are all elided', () => {
  const big = 'B'.repeat(400);
  const msg = 'data:application/octet-stream;base64,' + big +
    ' and data:application/wasm;base64,' + big;
  const out = elideDataUris(msg);
  assert.equal((out.match(/elided/g) || []).length, 2);
});

await test('describeBytes formats B/KB/MB', () => {
  assert.equal(describeBytes(512), '512 B');
  assert.equal(describeBytes(12.3 * 1024), '12.3 KB');
  assert.equal(describeBytes(1.2 * 1024 * 1024), '1.2 MB');
});

// ---------------------------------------------------------------------------
console.log('createPollDeduper (status-poll dedupe):');

await test('first poll logs the full body', () => {
  const d = createPollDeduper();
  const r = d.next({ status: 'analyzing', progress: 0.1 }, 1000);
  assert.equal(r.full, true);
});

await test('an unchanged poll collapses to a one-line summary', () => {
  const d = createPollDeduper();
  d.next({ status: 'analyzing', progress: 0.10 }, 1000);
  const r = d.next({ status: 'analyzing', progress: 0.11 }, 3000);
  assert.equal(r.full, false);
  assert.ok(/status unchanged \(progress 0\.11, elapsed 2s\)/.test(r.line), r.line);
});

await test('a status change forces a full entry', () => {
  const d = createPollDeduper();
  d.next({ status: 'analyzing', progress: 0.5 }, 1000);
  assert.equal(d.next({ status: 'reconstructing', progress: 0.0 }, 3000).full, true);
});

await test('a progress_detail.phase change forces a full entry', () => {
  const d = createPollDeduper();
  d.next({ status: 'reconstructing', progress: 0.2,
    progress_detail: { phase: 'sfm' } }, 1000);
  assert.equal(d.next({ status: 'reconstructing', progress: 0.2,
    progress_detail: { phase: 'training' } }, 3000).full, true);
});

await test('an error change forces a full entry', () => {
  const d = createPollDeduper();
  d.next({ status: 'reconstructing', progress: 0.2 }, 1000);
  assert.equal(d.next({ status: 'reconstructing', progress: 0.2,
    error: 'worker lost' }, 3000).full, true);
});

await test('progress >= 5 points since the last FULL log forces a full entry', () => {
  const d = createPollDeduper();
  d.next({ status: 'reconstructing', progress: 0.40 }, 1000);
  assert.equal(d.next({ status: 'reconstructing', progress: 0.43 }, 3000).full, false);
  assert.equal(d.next({ status: 'reconstructing', progress: 0.46 }, 5000).full, true);
  // ...and the delta window re-anchors on the newly-logged 0.46
  assert.equal(d.next({ status: 'reconstructing', progress: 0.48 }, 7000).full, false);
});

await test('a 30 s heartbeat full entry survives a stalled job', () => {
  const d = createPollDeduper();
  d.next({ status: 'queued', progress: 0 }, 1000);
  assert.equal(d.next({ status: 'queued', progress: 0 }, 15000).full, false);
  assert.equal(d.next({ status: 'queued', progress: 0 }, 31001).full, true);
});

// ---------------------------------------------------------------------------
console.log('capBatch (batch caps with middle-drop + marker):');

const mkEntries = (n) => Array.from({ length: n }, (_, i) =>
  ({ seq: i + 1, t_ms: i * 100, level: 'NET', message: 'entry ' + (i + 1) }));

await test('a small batch passes through unchanged', () => {
  const { entries, dropped } = capBatch(mkEntries(10), {});
  assert.equal(entries.length, 10);
  assert.equal(dropped, 0);
});

await test('over the entry cap: middle entries drop, ends are kept, marker says how many', () => {
  const { entries, dropped } = capBatch(mkEntries(700), { maxEntries: MAX_BATCH_ENTRIES });
  assert.equal(entries.length, MAX_BATCH_ENTRIES);
  assert.equal(dropped, 700 - (MAX_BATCH_ENTRIES - 1));
  assert.equal(entries[0].seq, 1);                       // oldest kept
  assert.equal(entries[entries.length - 1].seq, 700);    // newest kept
  const marker = entries.find((e) => /elided client-side/.test(e.message));
  assert.ok(marker, 'marker entry present');
  assert.ok(marker.message.includes(String(dropped)));
});

await test('over the byte cap: drops until the JSON fits', () => {
  const fat = Array.from({ length: 400 }, (_, i) =>
    ({ seq: i + 1, t_ms: i, level: 'NET', message: 'x'.repeat(2000) }));
  const { entries } = capBatch(fat, { maxBytes: 64 * 1024 });
  assert.ok(JSON.stringify(entries).length <= 64 * 1024);
  assert.equal(entries[0].seq, 1);
  assert.equal(entries[entries.length - 1].seq, 400);
});

await test('byte cap measures UTF-8 bytes, not UTF-16 chars (Japanese logs)', () => {
  // 'スプラット再構築中' is 9 chars but 27 UTF-8 bytes; a char-based cap
  // would pass batches ~3x over the server's byte limit.
  const ja = Array.from({ length: 400 }, (_, i) =>
    ({ seq: i + 1, t_ms: i, level: 'POLL', message: 'スプラット再構築中…'.repeat(100) }));
  const { entries } = capBatch(ja, { maxBytes: 64 * 1024 });
  assert.ok(utf8Length(JSON.stringify(entries)) <= 64 * 1024,
    'capped batch fits the byte budget in UTF-8 bytes');
  assert.ok(entries.length < 400, 'oversized multibyte batch was actually reduced');
});

await test('degenerate maxEntries <= 0 terminates (no infinite loop)', () => {
  // Regression: with maxEntries 0, once head+tail are empty the marker alone
  // kept the count above the cap forever. The loop must terminate.
  const { entries, dropped } = capBatch(mkEntries(5), { maxEntries: 0 });
  assert.equal(dropped, 5, 'all real entries dropped');
  assert.ok(entries.length <= 1, 'at most the marker remains');
});

await test('utf8Length counts multibyte correctly', () => {
  assert.equal(utf8Length('abc'), 3);
  assert.equal(utf8Length('日本語'), 9);
});

await test('truncateMessage caps a single runaway message', () => {
  const out = truncateMessage('y'.repeat(MAX_MESSAGE_CHARS * 3));
  assert.ok(out.length <= MAX_MESSAGE_CHARS + 20);
  assert.ok(out.endsWith('…[truncated]'));
});

// ---------------------------------------------------------------------------
console.log('createLogShipper (delivery, payload shape, honest failure):');

function makeHarness(responder) {
  const calls = [];
  let nowMs = 100000;
  const shipper = createLogShipper({
    apiBase: 'https://api.test',
    client: { ua: 'TestUA/1', app_version: 'raku-capture-web/1', platform: 'other' },
    fetchFn: (url, opts) => {
      calls.push({ url, opts, body: JSON.parse(opts.body) });
      return Promise.resolve(responder(calls.length));
    },
    beaconFn: null,
    now: () => nowMs,
    setTimeoutFn: () => null,   // tests drive shipNow() manually
    clearTimeoutFn: () => {},
  });
  return { shipper, calls, advance: (ms) => { nowMs += ms; }, nowMs: () => nowMs };
}

const ok200 = () => ({ ok: true, status: 200 });
const fail500 = () => ({ ok: false, status: 500 });

await test('payload shape: session_id/capture_id/client/entries with monotonic seq', async () => {
  const h = makeHarness(ok200);
  h.shipper.setSessionId('sess_42');
  h.shipper.enqueue({ t_ms: 10, level: 'STATE', message: 'phase intro -> guide' });
  h.shipper.enqueue({ t_ms: 20, level: 'NET', message: 'POST /api/v1/capture' });
  h.shipper.setCaptureId('cap_99');
  const shipped = await h.shipper.shipNow('test');
  assert.equal(shipped, true);
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].url, 'https://api.test' + CLIENT_LOGS_PATH);
  assert.equal(h.calls[0].opts.method, 'POST');
  assert.equal(h.calls[0].opts.headers['Content-Type'], 'application/json');
  const body = h.calls[0].body;
  assert.equal(body.session_id, 'sess_42');
  assert.equal(body.capture_id, 'cap_99');
  assert.deepEqual(body.client,
    { ua: 'TestUA/1', app_version: 'raku-capture-web/1', platform: 'other' });
  assert.deepEqual(body.entries.map((e) => e.seq), [1, 2]);
  assert.deepEqual(body.entries[0],
    { seq: 1, t_ms: 10, level: 'STATE', message: 'phase intro -> guide' });
  assert.equal(h.shipper.getState().queued, 0); // acked -> drained
});

await test('a failed POST keeps the queue (no fake success) and retries carry the same seqs', async () => {
  let failNext = true;
  const h = makeHarness(() => failNext ? fail500() : ok200());
  h.shipper.enqueue({ t_ms: 1, level: 'NET', message: 'a' });
  assert.equal(await h.shipper.shipNow('test'), false);
  assert.equal(h.shipper.getState().queued, 1, 'entry retained after failure');
  failNext = false;
  h.advance(MAX_BACKOFF_MS + 1); // clear the backoff gate
  assert.equal(await h.shipper.shipNow('test'), true);
  assert.equal(h.calls[1].body.entries[0].seq, h.calls[0].body.entries[0].seq);
  assert.equal(h.shipper.getState().queued, 0);
});

await test('>= 3 consecutive failures -> degraded flag + exponential backoff capped at 60s', async () => {
  const h = makeHarness(fail500);
  const flags = [];
  h.shipper.onDegraded((d) => flags.push(d));
  h.shipper.enqueue({ t_ms: 1, level: 'NET', message: 'x' });
  for (let i = 1; i <= 8; i++) {
    h.advance(MAX_BACKOFF_MS + 1);
    await h.shipper.shipNow('test');
    const st = h.shipper.getState();
    assert.equal(st.consecutiveFailures, i);
    const expected = Math.min(MAX_BACKOFF_MS, 1000 * Math.pow(2, i - 1));
    assert.equal(st.nextAllowedAt - h.nowMs(), expected, 'backoff after failure ' + i);
    assert.equal(st.degraded, i >= DEGRADE_AFTER_FAILURES);
  }
  assert.deepEqual(flags, [true], 'onDegraded fired exactly once');
  // While inside the backoff window, shipNow does NOT spam the network.
  const callsBefore = h.calls.length;
  await h.shipper.shipNow('test');
  assert.equal(h.calls.length, callsBefore, 'no POST during backoff');
});

await test('recovery clears the degraded flag and ships the retained entries', async () => {
  let healthy = false;
  const h = makeHarness(() => healthy ? ok200() : fail500());
  const flags = [];
  h.shipper.onDegraded((d) => flags.push(d));
  h.shipper.enqueue({ t_ms: 1, level: 'NET', message: 'kept' });
  for (let i = 0; i < DEGRADE_AFTER_FAILURES; i++) {
    h.advance(MAX_BACKOFF_MS + 1);
    await h.shipper.shipNow('test');
  }
  assert.deepEqual(flags, [true]);
  healthy = true;
  h.advance(MAX_BACKOFF_MS + 1);
  assert.equal(await h.shipper.shipNow('test'), true);
  assert.deepEqual(flags, [true, false], 'degraded cleared on recovery');
  assert.equal(h.shipper.getState().queued, 0);
  assert.equal(h.calls[h.calls.length - 1].body.entries[0].message, 'kept');
});

await test('ERROR-level entries trigger an immediate ship attempt', async () => {
  const h = makeHarness(ok200);
  h.shipper.enqueue({ t_ms: 5, level: 'ERROR', message: 'boom' });
  await Promise.resolve(); await Promise.resolve(); // let the POST settle
  assert.equal(h.calls.length, 1, 'shipped without waiting for the interval');
  assert.equal(h.calls[0].body.entries[0].level, 'ERROR');
});

await test('disabled shipper (demo mode) never queues or POSTs', async () => {
  const calls = [];
  const s = createLogShipper({
    apiBase: 'https://api.test', client: { ua: '', app_version: '', platform: 'other' },
    enabled: false,
    fetchFn: () => { calls.push(1); return Promise.resolve(ok200()); },
    setTimeoutFn: () => null, clearTimeoutFn: () => {},
  });
  assert.equal(s.enqueue({ t_ms: 1, level: 'ERROR', message: 'x' }), null);
  assert.equal(await s.shipNow('test'), false);
  assert.equal(calls.length, 0);
  assert.equal(s.getState().queued, 0);
});

await test('flushBeacon: queue drains only when the beacon is ACCEPTED', () => {
  let accept = false;
  const sent = [];
  const s = createLogShipper({
    apiBase: 'https://api.test', client: { ua: '', app_version: '', platform: 'other' },
    fetchFn: () => Promise.resolve(ok200()),
    beaconFn: (url, body) => { sent.push({ url, body }); return accept; },
    setTimeoutFn: () => null, clearTimeoutFn: () => {},
  });
  s.enqueue({ t_ms: 1, level: 'STATE', message: 'bye' });
  assert.equal(s.flushBeacon(), false);
  assert.equal(s.getState().queued, 1, 'rejected beacon leaves the queue intact');
  accept = true;
  assert.equal(s.flushBeacon(), true);
  assert.equal(s.getState().queued, 0);
  const body = JSON.parse(sent[1].body);
  assert.equal(body.entries[0].message, 'bye');
});

await test('flushBeacon without a beacon API reports false (never fakes delivery)', () => {
  const s = createLogShipper({
    apiBase: 'https://api.test', client: { ua: '', app_version: '', platform: 'other' },
    fetchFn: () => Promise.resolve(ok200()), beaconFn: null,
    setTimeoutFn: () => null, clearTimeoutFn: () => {},
  });
  s.enqueue({ t_ms: 1, level: 'STATE', message: 'x' });
  assert.equal(s.flushBeacon(), false);
  assert.equal(s.getState().queued, 1);
});

// ---------------------------------------------------------------------------
// iOS app-switch / bfcache resume (field bug: user switches to another app
// mid-reconstruction; on return the shipper is wedged and the panel is dead).
// ---------------------------------------------------------------------------
console.log('bfcache / app-switch resume:');

/** Fake window+document that record listeners and can fire lifecycle events. */
function makeLifecycleEnv() {
  const listeners = { win: {}, doc: {} };
  const reg = (map) => (type, fn) =>
    (map[type] || (map[type] = [])).push(fn);
  const win = { addEventListener: reg(listeners.win) };
  const doc = { visibilityState: 'visible', addEventListener: reg(listeners.doc) };
  const fire = (where, type, ev) => {
    for (const fn of (listeners[where][type] || []).slice()) fn(ev || {});
  };
  return { win, doc, fire };
}

await test('pagehide flushes the beacon but does NOT stop the shipper', () => {
  const sent = [];
  const s = createLogShipper({
    apiBase: 'https://api.test', client: { ua: '', app_version: '', platform: 'other' },
    fetchFn: () => Promise.resolve(ok200()),
    beaconFn: (url, body) => { sent.push(body); return true; },
    setTimeoutFn: () => null, clearTimeoutFn: () => {},
  });
  const env = makeLifecycleEnv();
  attachLogShipperLifecycle(s, env.win, env.doc);
  s.enqueue({ t_ms: 1, level: 'STATE', message: 'before hide' });
  env.fire('win', 'pagehide', { persisted: true });
  assert.equal(sent.length, 1, 'beacon flushed on pagehide');
  assert.equal(s.getState().queued, 0, 'accepted beacon genuinely drained the queue');
  assert.equal(s.getState().stopped, false, 'pagehide must not stop the shipper');
  // Logging keeps working while hidden / after restore.
  assert.equal(typeof s.enqueue({ t_ms: 2, level: 'NET', message: 'after hide' }), 'number');
});

await test('a fetch orphaned by the bfcache freeze cannot wedge shipping (inFlight unsticks)', async () => {
  // iOS kills in-flight fetches on bfcache entry and never settles them
  // after restore. Pre-fix, that left inFlight=true forever and every later
  // shipNow() no-opped — shipping was silently dead after resume.
  let settleZombie = null;
  let calls = 0;
  const bodies = [];
  const s = createLogShipper({
    apiBase: 'https://api.test', client: { ua: '', app_version: '', platform: 'other' },
    fetchFn: (url, opts) => {
      calls += 1;
      bodies.push(JSON.parse(opts.body));
      if (calls === 1) return new Promise((res) => { settleZombie = res; });
      return Promise.resolve(ok200());
    },
    beaconFn: null,
    setTimeoutFn: () => null, clearTimeoutFn: () => {},
  });
  const env = makeLifecycleEnv();
  attachLogShipperLifecycle(s, env.win, env.doc);

  s.enqueue({ t_ms: 1, level: 'NET', message: 'frozen mid-flight' });
  s.shipNow('test'); // never settles — the zombie flight
  assert.equal(s.getState().inFlight, true, 'flight is pending');
  assert.equal(await s.shipNow('test'), false, 'second ship blocked while in flight');

  env.fire('win', 'pageshow', { persisted: true }); // bfcache restore
  // resume() un-wedged inFlight and immediately re-shipped the retained
  // entry (fetch #2) — pre-fix, the zombie flight blocked this forever.
  assert.equal(calls, 2, 'retained entry re-shipped after resume');
  await Promise.resolve(); await Promise.resolve(); // let the 2xx ack land
  assert.equal(s.getState().inFlight, false, 'replacement flight settled');
  assert.equal(s.getState().queued, 0);
  assert.equal(bodies[1].entries[0].seq, bodies[0].entries[0].seq,
    're-ship carries the same seq so the server can dedupe');

  // The zombie finally settling must not corrupt state or double-ack.
  settleZombie(ok200());
  await Promise.resolve(); await Promise.resolve();
  const st = s.getState();
  assert.equal(st.queued, 0);
  assert.equal(st.inFlight, false);
  assert.equal(st.consecutiveFailures, 0);
  // ...and shipping still works afterwards.
  s.enqueue({ t_ms: 9, level: 'NET', message: 'post-resume entry' });
  assert.equal(await s.shipNow('test'), true);
  assert.equal(s.getState().queued, 0);
});

await test('entries retained by a REJECTED beacon re-ship after pageshow(persisted)', async () => {
  let fetched = [];
  const s = createLogShipper({
    apiBase: 'https://api.test', client: { ua: '', app_version: '', platform: 'other' },
    fetchFn: (url, opts) => {
      fetched.push(JSON.parse(opts.body));
      return Promise.resolve(ok200());
    },
    beaconFn: () => false, // UA refused the beacon — nothing shipped
    setTimeoutFn: () => null, clearTimeoutFn: () => {},
  });
  const env = makeLifecycleEnv();
  attachLogShipperLifecycle(s, env.win, env.doc);
  s.enqueue({ t_ms: 1, level: 'ERROR', message: 'kept across the hide' });
  await Promise.resolve(); await Promise.resolve(); // let the ERROR fast-ship ack
  s.enqueue({ t_ms: 2, level: 'STATE', message: 'second kept entry' });
  const before = s.getState().queued;
  env.fire('win', 'pagehide', { persisted: true });
  assert.equal(s.getState().queued, before, 'rejected beacon left the queue intact');
  env.fire('win', 'pageshow', { persisted: true });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(s.getState().queued, 0, 'retained entries shipped on resume');
  const last = fetched[fetched.length - 1];
  assert.equal(last.entries[last.entries.length - 1].message, 'second kept entry');
});

await test('pageshow WITHOUT persisted does not fire a resume; visible does (belt-and-braces)', () => {
  const s = createLogShipper({
    apiBase: 'https://api.test', client: { ua: '', app_version: '', platform: 'other' },
    fetchFn: () => Promise.resolve(ok200()), beaconFn: () => true,
    setTimeoutFn: () => null, clearTimeoutFn: () => {},
  });
  const env = makeLifecycleEnv();
  const resumes = [];
  attachLogShipperLifecycle(s, env.win, env.doc, { onResume: (why) => resumes.push(why) });
  env.fire('win', 'pageshow', { persisted: false }); // a normal first load
  assert.deepEqual(resumes, []);
  env.fire('win', 'pageshow', { persisted: true });
  assert.deepEqual(resumes, ['bfcache-restore']);
  env.doc.visibilityState = 'hidden';
  env.fire('doc', 'visibilitychange', {});
  assert.deepEqual(resumes, ['bfcache-restore'], 'hidden flushes, never resumes');
  env.doc.visibilityState = 'visible';
  env.fire('doc', 'visibilitychange', {});
  assert.deepEqual(resumes, ['bfcache-restore', 'visible']);
});

await test('stop() is reversed by resume(): a stopped flag cannot stick across a restore', async () => {
  const s = createLogShipper({
    apiBase: 'https://api.test', client: { ua: '', app_version: '', platform: 'other' },
    fetchFn: () => Promise.resolve(ok200()), beaconFn: null,
    setTimeoutFn: () => null, clearTimeoutFn: () => {},
  });
  s.stop();
  assert.equal(s.getState().stopped, true);
  assert.equal(s.enqueue({ t_ms: 1, level: 'NET', message: 'dropped' }), null,
    'stopped shipper drops entries (documented)');
  s.resume();
  assert.equal(s.getState().stopped, false, 'resume un-sticks stop()');
  assert.equal(typeof s.enqueue({ t_ms: 2, level: 'NET', message: 'lives' }), 'number');
  assert.equal(await s.shipNow('test'), true);
});

await test('resume() does NOT fake recovery: degraded flag and backoff survive it', async () => {
  const h = makeHarness(fail500);
  const flags = [];
  h.shipper.onDegraded((d) => flags.push(d));
  h.shipper.enqueue({ t_ms: 1, level: 'NET', message: 'x' });
  for (let i = 0; i < DEGRADE_AFTER_FAILURES; i++) {
    h.advance(MAX_BACKOFF_MS + 1);
    await h.shipper.shipNow('test');
  }
  assert.deepEqual(flags, [true]);
  const callsBefore = h.calls.length;
  h.shipper.resume(); // inside the backoff window
  await Promise.resolve();
  assert.equal(h.calls.length, callsBefore, 'backoff gate still respected on resume');
  assert.equal(h.shipper.getState().degraded, true,
    'only a real 2xx clears degraded — resume() never does');
});

// ---------------------------------------------------------------------------
// Debug panel resume: re-render from retained entries + delegated Close.
// ---------------------------------------------------------------------------
console.log('debug panel resume (re-render + delegated Close):');

/**
 * A minimal document for createDebugLog: nodes with children / listeners /
 * textContent-clears-children semantics (like the real DOM and the
 * tests/capture-pwa harness). Clicks on descendants do not bubble — a test
 * simulates a bubbled click by dispatching on the panel root with the real
 * target, which is exactly what delegation relies on in a browser.
 */
function makePanelDoc() {
  class El {
    constructor(tag) {
      this.tagName = String(tag).toUpperCase();
      this.id = ''; this.hidden = false; this.type = '';
      this._text = ''; this.style = {}; this.children = [];
      this.parentNode = null; this._listeners = {}; this._attrs = {};
    }
    get textContent() { return this._text; }
    set textContent(v) { this._text = v == null ? '' : String(v); this.children = []; }
    setAttribute(k, v) { this._attrs[k] = String(v); }
    appendChild(c) {
      if (c.parentNode) c.parentNode.removeChild(c);
      c.parentNode = this; this.children.push(c); return c;
    }
    removeChild(c) {
      const i = this.children.indexOf(c);
      if (i >= 0) this.children.splice(i, 1);
      c.parentNode = null; return c;
    }
    addEventListener(t, fn) {
      (this._listeners[t] || (this._listeners[t] = [])).push(fn);
    }
    dispatch(t, ev) {
      for (const fn of (this._listeners[t] || []).slice()) {
        fn(Object.assign({ type: t, target: this }, ev || {}));
      }
    }
    find(pred) { // depth-first descendant search (test helper)
      for (const c of this.children) {
        if (pred(c)) return c;
        const hit = c.find(pred);
        if (hit) return hit;
      }
      return null;
    }
  }
  const body = new El('body');
  return {
    body,
    createElement: (t) => new El(t),
    addEventListener: () => {},
  };
}

function makePanelFixture() {
  const doc = makePanelDoc();
  let nowMs = 0;
  const dlog = createDebugLog({ doc, now: () => nowMs });
  return {
    doc, dlog, advance: (ms) => { nowMs += ms; },
    panel: () => doc.body.find((n) => n.id === 'debug-log-panel'),
    list: () => doc.body.find((n) => n.id === 'debug-log-list'),
    closeBtn: () => doc.body.find((n) => n.id === 'btn-debug-close'),
  };
}

await test('rerender() rebuilds the entry list from retained in-memory entries', () => {
  const f = makePanelFixture();
  f.dlog.log('STATE', 'one'); f.dlog.log('NET', 'two'); f.dlog.log('ERROR', 'three');
  f.dlog.toggle(true);
  assert.equal(f.list().children.length, 3, 'panel rendered the retained entries');
  // Simulate the iOS field blank-out: rendered lines vanish, memory intact.
  f.list().textContent = '';
  assert.equal(f.list().children.length, 0);
  f.dlog.rerender();
  assert.equal(f.list().children.length, 3, 'entries re-rendered after resume');
  assert.ok(/ERROR three$/.test(f.list().children[2].textContent));
  // New entries keep appending after the re-render.
  f.dlog.log('POLL', 'four');
  assert.equal(f.list().children.length, 4);
});

await test('rerender() preserves the ship-status flag and re-attaches a lost panel', () => {
  const f = makePanelFixture();
  f.dlog.log('NET', 'entry');
  f.dlog.toggle(true);
  f.dlog.setShipStatus('diagnostics not reaching server — use Copy to share logs');
  const panel = f.panel();
  f.doc.body.removeChild(panel); // restored page lost the node entirely
  f.dlog.rerender();
  assert.equal(panel.parentNode, f.doc.body, 'panel re-attached to the document');
  const flag = f.doc.body.find((n) => n.id === 'debug-ship-status');
  assert.equal(flag.hidden, false);
  assert.ok(/not reaching server/.test(flag.textContent));
});

await test('Close works via delegation from the panel root (survives resume)', () => {
  const f = makePanelFixture();
  f.dlog.log('STATE', 'x');
  f.dlog.toggle(true);
  const panel = f.panel();
  assert.equal(panel.hidden, false, 'panel open');
  // The blank-out + re-render cycle must not affect the Close binding: it
  // lives on the panel root, which is never replaced.
  f.list().textContent = '';
  f.dlog.rerender();
  panel.dispatch('click', { target: f.closeBtn() }); // a bubbled Close tap
  assert.equal(panel.hidden, true, 'Close dismissed the panel');
  // A click elsewhere in the panel must NOT close it.
  f.dlog.toggle(true);
  panel.dispatch('click', { target: f.list() });
  assert.equal(panel.hidden, false);
});

await test('end-to-end: log -> hide(beacon) -> restore -> panel re-renders and shipping resumes', async () => {
  // The capture_app.js wiring in miniature: logger entries feed the shipper;
  // lifecycle resume re-arms the shipper THEN re-renders the panel.
  const f = makePanelFixture();
  let calls = 0;
  const s = createLogShipper({
    apiBase: 'https://api.test', client: { ua: '', app_version: '', platform: 'other' },
    fetchFn: () => { calls += 1; return new Promise(() => {}); }, // all zombies
    beaconFn: () => false, // beacon refused — entries retained
    setTimeoutFn: () => null, clearTimeoutFn: () => {},
  });
  f.dlog.onEntry((e) => s.enqueue(e));
  const env = makeLifecycleEnv();
  attachLogShipperLifecycle(s, env.win, env.doc, {
    onResume: () => f.dlog.rerender(),
  });

  f.dlog.log('STATE', 'reconstruction running');
  f.dlog.toggle(true);
  s.shipNow('test'); // flight that the freeze will orphan
  assert.equal(calls, 1);

  env.fire('win', 'pagehide', { persisted: true });   // app switch (Spotify)
  f.list().textContent = '';                          // iOS blanks the lines
  env.fire('win', 'pageshow', { persisted: true });   // back to the PWA

  assert.equal(f.list().children.length, 1, 'retained entry visible after resume');
  assert.equal(calls, 2, 'shipping re-attempted after resume despite the zombie');
  assert.equal(s.getState().queued, 1,
    'honest: the zombie re-ship has NOT been acked, so the entry stays queued');
  f.panel().dispatch('click', { target: f.closeBtn() });
  assert.equal(f.panel().hidden, true, 'Close still works after resume');
});

await test('double resume in one tick orphans the zombie once, not the new flight', async () => {
  // pageshow(persisted) + visibilitychange:visible both fire on an iOS
  // restore. The second resume() must NOT orphan the healthy re-ship the
  // first one started — its 2xx must still drain the queue.
  let settlers = [];
  const s = createLogShipper({
    apiBase: 'https://api.test', client: { ua: '', app_version: '', platform: 'other' },
    fetchFn: () => new Promise((res) => settlers.push(res)),
    setTimeoutFn: () => null, clearTimeoutFn: () => {},
  });
  s.enqueue({ t_ms: 1, level: 'NET', message: 'a' });
  s.shipNow('test');                 // zombie flight (never settled by iOS)
  assert.equal(s.getState().inFlight, true);
  s.resume();                        // orphans zombie, starts healthy re-ship
  s.resume();                        // same tick: must NOT orphan the re-ship
  assert.equal(settlers.length, 2, 'zombie + one healthy re-ship, no third');
  settlers[1]({ ok: true, status: 202 });   // healthy flight acks
  await Promise.resolve(); await Promise.resolve();
  assert.equal(s.getState().queued, 0, 'ack from the re-ship drained the queue');
  assert.equal(s.getState().inFlight, false);
});

console.log(`\n${passed} passed`);
