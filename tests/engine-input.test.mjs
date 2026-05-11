// Unit tests for the RakuEngine input API.
// Run from repo root with: node --test tests/
//
// No test framework dependency — uses Node's built-in `node:test` runner
// (available in Node >= 18). The engine uses fetch/localStorage in other
// methods but the input API path never touches them, so tests run clean
// with no shims.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RakuEngine } from '../engine/raku-engine.js';

test('publishInput stores boolean state and is observable via getInputState', () => {
  const e = new RakuEngine();
  assert.deepEqual(e.getInputState(), {});
  e.publishInput({ left: true });
  assert.deepEqual(e.getInputState(), { left: true });
  e.publishInput({ left: false, fire: true });
  assert.deepEqual(e.getInputState(), { left: false, fire: true });
});

test('getInputState returns a clone — mutating it does not affect the engine', () => {
  const e = new RakuEngine();
  e.publishInput({ left: true });
  const snap = e.getInputState();
  snap.left = false;
  snap.injected = 'evil';
  assert.deepEqual(e.getInputState(), { left: true });
});

test('publishInput emits "input" event only on actual change', () => {
  const e = new RakuEngine();
  const events = [];
  e.on('input', (ev) => events.push(ev));

  e.publishInput({ left: true });             // change → emit
  e.publishInput({ left: true });             // no change → no emit
  e.publishInput({ left: true, fire: true }); // fire changed → emit
  e.publishInput({ fire: true });             // no change → no emit
  e.publishInput({ left: false });            // change → emit

  assert.equal(events.length, 3);
  assert.deepEqual(events[0].changed, { left: true });
  assert.deepEqual(events[1].changed, { fire: true });
  assert.deepEqual(events[2].changed, { left: false });
});

test('input event payload includes both diff and full merged state', () => {
  const e = new RakuEngine();
  let last = null;
  e.on('input', (ev) => { last = ev; });

  e.publishInput({ left: true });
  e.publishInput({ fire: true });

  assert.deepEqual(last.changed, { fire: true });
  assert.deepEqual(last.state, { left: true, fire: true });
});

test('onInput returns an unsubscribe function', () => {
  const e = new RakuEngine();
  let count = 0;
  const unsubscribe = e.onInput(() => { count++; });

  e.publishInput({ left: true });
  e.publishInput({ left: false });
  assert.equal(count, 2);

  unsubscribe();
  e.publishInput({ left: true });
  assert.equal(count, 2, 'unsubscribed listener should not fire');
});

test('multiple subscribers all receive the same input event', () => {
  const e = new RakuEngine();
  const seenA = [];
  const seenB = [];
  e.onInput((ev) => seenA.push(ev.changed));
  e.onInput((ev) => seenB.push(ev.changed));

  e.publishInput({ left: true });
  e.publishInput({ left: false, fire: true });

  assert.deepEqual(seenA, [{ left: true }, { left: false, fire: true }]);
  assert.deepEqual(seenB, seenA);
});

test('publishInput logs to API stream and activates RakuInput DLL', () => {
  const e = new RakuEngine();
  const apiEvents = [];
  e.on('api', (entry) => apiEvents.push(entry));

  assert.ok(!e.activeDLLNames.includes('RakuInput'));
  e.publishInput({ left: true });

  assert.ok(e.activeDLLNames.includes('RakuInput'),
    'first publishInput should activate RakuInput');
  assert.equal(apiEvents.length, 1);
  assert.equal(apiEvents[0].method, 'POST');
  assert.equal(apiEvents[0].path, '/input');
  assert.equal(apiEvents[0].status, 200);
  assert.deepEqual(apiEvents[0].detail, { left: true });
});

test('publishInput is robust to invalid arguments', () => {
  const e = new RakuEngine();
  // None of these should throw, and none should mutate state
  e.publishInput(null);
  e.publishInput(undefined);
  e.publishInput('not an object');
  e.publishInput(42);
  assert.deepEqual(e.getInputState(), {});
});

test('publishInput accepts non-boolean values (numeric axis, string labels)', () => {
  // The API is intentionally untyped beyond "object of key→value" so
  // games can store analog axis values (0..1), string modes, etc.
  const e = new RakuEngine();
  e.publishInput({ thrust: 0.75, mode: 'climbing' });
  assert.deepEqual(e.getInputState(), { thrust: 0.75, mode: 'climbing' });
  e.publishInput({ thrust: 0.75 });  // identical → no change
  e.publishInput({ thrust: 0.5 });   // different number → change
  assert.deepEqual(e.getInputState(), { thrust: 0.5, mode: 'climbing' });
});

test('off() removes a single listener without affecting others', () => {
  const e = new RakuEngine();
  let countA = 0, countB = 0;
  const fnA = () => countA++;
  const fnB = () => countB++;
  e.on('input', fnA);
  e.on('input', fnB);

  e.publishInput({ x: 1 });
  assert.equal(countA, 1);
  assert.equal(countB, 1);

  e.off('input', fnA);
  e.publishInput({ x: 2 });
  assert.equal(countA, 1, 'fnA should be unsubscribed');
  assert.equal(countB, 2, 'fnB should still fire');
});
