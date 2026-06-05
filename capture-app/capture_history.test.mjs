// capture_history.test.mjs -- Node regression tests for the capture history
// store and the terminal-failure classifier that gates FAILED persistence.
// Copyright (c) 2026 RakuAI, LLC. All rights reserved.
//
// Run: node capture-app/capture_history.test.mjs   (no deps; uses node:assert)
//
// The load-bearing fix these tests lock in: a transient error (lost contact,
// client timeout, viewer-load) must NOT be classified as terminal, so the app
// never persists a stale 'failed' record that re-renders as a current failure
// next visit. Only a server-reported job.status === 'failed' is terminal.

import assert from 'node:assert/strict';
import {
  CaptureHistory, STATUS, RECON_FAILED_CODE, isTerminalFailure,
  mapServerStatus,
} from './capture_history.js';

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log('  ok -', name);
}

// A fresh, isolated in-memory store per test (no localStorage under Node).
function freshStore() {
  const mem = new Map();
  return {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
  };
}

console.log('isTerminalFailure (the stale-failure-record fix):');

test('a server-reported reconstruction failure IS terminal', () => {
  const err = new Error('Reconstruction failed.');
  err.code = RECON_FAILED_CODE;
  assert.equal(isTerminalFailure(err), true);
});

test('lost-contact / network blip is NOT terminal', () => {
  assert.equal(isTerminalFailure(new Error('Lost contact with the reconstruction job.')), false);
});

test('client-side timeout is NOT terminal', () => {
  assert.equal(isTerminalFailure(new Error('Reconstruction timed out.')), false);
});

test('a viewer-load (WebGL) error is NOT terminal', () => {
  assert.equal(isTerminalFailure(new Error('WebGL context lost')), false);
});

test('null / undefined / non-error inputs are NOT terminal', () => {
  assert.equal(isTerminalFailure(null), false);
  assert.equal(isTerminalFailure(undefined), false);
  assert.equal(isTerminalFailure({}), false);
  assert.equal(isTerminalFailure({ code: 'something-else' }), false);
});

console.log('store persistence invariants:');

test('a processing entry survives a reload (new instance, same store)', () => {
  const store = freshStore();
  const h1 = new CaptureHistory({ store });
  h1.add({ captureId: 'cap-1', status: STATUS.PROCESSING });
  const h2 = new CaptureHistory({ store });
  assert.equal(h2.get('cap-1').status, STATUS.PROCESSING);
});

test('only an explicit update flips a record to FAILED', () => {
  const store = freshStore();
  const h = new CaptureHistory({ store });
  h.add({ captureId: 'cap-2', status: STATUS.PROCESSING });
  // Simulate the app's transient-error path: it does NOT call update(), so the
  // record must stay PROCESSING and remain recoverable.
  assert.equal(h.get('cap-2').status, STATUS.PROCESSING);
  // Simulate the terminal path: the app DOES update() to FAILED.
  h.update('cap-2', { status: STATUS.FAILED });
  assert.equal(h.get('cap-2').status, STATUS.FAILED);
});

test('mapServerStatus is authoritative for merged server captures', () => {
  assert.equal(mapServerStatus('complete'), STATUS.READY);
  assert.equal(mapServerStatus('failed'), STATUS.FAILED);
  assert.equal(mapServerStatus('expired'), STATUS.FAILED);
  assert.equal(mapServerStatus('reconstructing'), STATUS.PROCESSING);
});

console.log(`\n${passed} passed`);
