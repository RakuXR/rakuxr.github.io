// motion_check.test.mjs -- Node regression tests for the translation /
// parallax movement estimator that gates "turning in place" captures.
// Copyright (c) 2026 RakuAI, LLC. All rights reserved.
//
// Run: node web/capture/motion_check.test.mjs   (no deps; uses node:assert)
//
// The load-bearing guarantees these tests lock in:
//   - synthetic standing-rotation signals (near-zero linear acceleration;
//     uniform whole-image shift) score LOW, walking/translation signals
//     (step-like acceleration bursts; depth-dependent block shifts) score
//     HIGH — for both the IMU and the parallax path;
//   - no data => confidence 0 (unknown is never reported as "no movement");
//   - computeCoverage caps at ~60% ONLY under a confident low-movement
//     verdict, and degrades to the frames+sectors behavior otherwise;
//   - lowMovementGate never fires below the confidence floor.

import assert from 'node:assert/strict';
import {
  createImuEnergyTracker, createParallaxTracker, createMotionEstimator,
  estimateGlobalShift, blockShiftResidual, combineMovementSignals,
  computeCoverage, lowMovementGate,
  IMU_STILL_RMS, IMU_MOVING_RMS, LOW_MOVEMENT_SCORE,
  MOVEMENT_MIN_CONFIDENCE, LOW_MOVEMENT_COVERAGE_CAP,
} from './motion_check.js';

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log('  ok -', name);
}

// Deterministic PRNG (mulberry32) so the synthetic imagery never flakes.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
console.log('IMU linear-acceleration energy:');

test('no samples -> confidence 0 (sensor absent / permission denied)', () => {
  const imu = createImuEnergyTracker();
  assert.deepEqual(imu.score(), { score: 0, confidence: 0, rms: 0 });
  // null acceleration (device without a gyro) is ignored, not counted
  for (let i = 0; i < 100; i++) imu.add(null, 16);
  assert.equal(imu.score().confidence, 0);
});

test('standing rotation (sensor noise only) scores low with usable confidence', () => {
  const imu = createImuEnergyTracker();
  const rnd = mulberry32(7);
  // ~8 s of 60 Hz samples: tiny jitter around a small constant bias — what a
  // phone reports while the user pivots in place.
  for (let i = 0; i < 480; i++) {
    imu.add({
      x: 0.05 + (rnd() - 0.5) * 0.06,
      y: -0.03 + (rnd() - 0.5) * 0.06,
      z: 0.02 + (rnd() - 0.5) * 0.06,
    }, 16.6);
  }
  const s = imu.score();
  assert.ok(s.rms < IMU_STILL_RMS, 'rotation rms ' + s.rms.toFixed(3) + ' below still floor');
  assert.equal(s.score, 0);
  assert.ok(s.confidence >= MOVEMENT_MIN_CONFIDENCE, 'confidence ' + s.confidence);
});

test('walking (step-like acceleration bursts) scores high', () => {
  const imu = createImuEnergyTracker();
  const rnd = mulberry32(11);
  // ~8 s of 60 Hz: a 1.8 Hz step oscillation at ±1.5 m/s² plus noise.
  for (let i = 0; i < 480; i++) {
    const tSec = i * 0.0166;
    imu.add({
      x: 1.5 * Math.sin(2 * Math.PI * 1.8 * tSec) + (rnd() - 0.5) * 0.2,
      y: 0.8 * Math.sin(2 * Math.PI * 3.6 * tSec) + (rnd() - 0.5) * 0.2,
      z: (rnd() - 0.5) * 0.2,
    }, 16.6);
  }
  const s = imu.score();
  assert.ok(s.rms > IMU_MOVING_RMS, 'walking rms ' + s.rms.toFixed(3));
  assert.equal(s.score, 1);
  assert.ok(s.confidence >= MOVEMENT_MIN_CONFIDENCE);
});

// ---------------------------------------------------------------------------
console.log('frame-parallax heuristic:');

// Synthetic imagery: a wide textured "base world" cropped at different
// offsets. A pure camera rotation moves the WHOLE view uniformly; a
// translation moves a near object (textured square) more than the
// background — exactly the depth-dependent flow the residual measures.
// SMOOTHED noise (3x3 box blur), not raw per-pixel noise: real images are
// locally correlated, and the tracker's match-quality gate (rightly)
// rejects pairs whose mismatched regions look like uncorrelated static.
const W = 64, H = 64, PAD = 16;
const BW = W + 2 * PAD, BH = H + 2 * PAD;
const SQ = 24; // foreground square size — spans several residual blocks

function blur3(src, w, h) {
  const out = new Float64Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const yy = y + dy, xx = x + dx;
          if (yy >= 0 && yy < h && xx >= 0 && xx < w) { s += src[yy * w + xx]; n++; }
        }
      }
      out[y * w + x] = s / n;
    }
  }
  return out;
}

function makeTexture(seed, w, h) {
  const rnd = mulberry32(seed);
  const raw = new Float64Array(w * h);
  for (let i = 0; i < raw.length; i++) raw[i] = rnd() * 255;
  return blur3(raw, w, h);
}

const base = makeTexture(101, BW, BH);
const squareTex = makeTexture(202, SQ, SQ);

function view(ox, oy) {
  const out = new Float64Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) out[y * W + x] = base[(y + oy + PAD) * BW + (x + ox + PAD)];
  }
  return out;
}

function paintSquare(img, sx, sy) {
  for (let y = 0; y < SQ; y++) {
    for (let x = 0; x < SQ; x++) img[(sy + y) * W + (sx + x)] = squareTex[y * SQ + x];
  }
}

test('estimateGlobalShift recovers a known uniform shift', () => {
  const a = view(0, 0);
  const b = view(3, -2); // content moves by (-3, +2) in b
  const g = estimateGlobalShift(a, b, W, H, 6);
  assert.equal(g.dx, -3);
  assert.equal(g.dy, 2);
  assert.ok(g.sad < 1, 'exact shift -> near-zero SAD, got ' + g.sad.toFixed(2));
  assert.ok(g.contrast > 10, 'texture has contrast: ' + g.contrast.toFixed(1));
});

test('pure rotation (uniform shift) -> near-zero block residual', () => {
  const a = view(0, 0);
  const b = view(3, 0);
  const g = estimateGlobalShift(a, b, W, H, 6);
  const r = blockShiftResidual(a, b, W, H, g);
  assert.equal(r.valid, true);
  assert.ok(r.rms < 0.2, 'rotation residual rms ' + r.rms.toFixed(3));
});

test('translation (foreground square moves more) -> high block residual', () => {
  // Background shifts by 1 px; the near square shifts by 3 px (parallax).
  const a = view(0, 0);
  paintSquare(a, 16, 16);
  const b = view(1, 0);
  paintSquare(b, 16 - 3, 16);
  const g = estimateGlobalShift(a, b, W, H, 6);
  assert.equal(g.dx, -1, 'global locks onto the background');
  const r = blockShiftResidual(a, b, W, H, g);
  assert.equal(r.valid, true);
  assert.ok(r.rms >= 0.5, 'translation residual rms ' + r.rms.toFixed(3));
});

test('parallax tracker: rotation sweep scores low, translation sweep scores high', () => {
  const rot = createParallaxTracker();
  for (let i = 0; i < 8; i++) rot.addFrame(view((i % 2) * 3, 0), W, H);
  const rs = rot.score();
  assert.ok(rs.confidence >= MOVEMENT_MIN_CONFIDENCE, 'rotation pairs usable: ' + rs.pairs);
  assert.ok(rs.score < LOW_MOVEMENT_SCORE, 'rotation parallax score ' + rs.score.toFixed(3));

  const tr = createParallaxTracker();
  for (let i = 0; i < 8; i++) {
    const bg = i % 2;            // background wobbles by 1 px
    const fg = bg * 3;           // the near square wobbles by 3 px
    const f = view(bg, 0);
    paintSquare(f, 16 - fg, 16);
    tr.addFrame(f, W, H);
  }
  const ts = tr.score();
  assert.ok(ts.confidence >= MOVEMENT_MIN_CONFIDENCE, 'translation pairs usable: ' + ts.pairs);
  assert.ok(ts.score > 0.5, 'translation parallax score ' + ts.score.toFixed(3));
});

test('unreadably fast pans are rejected, not misread (clipped search window)', () => {
  const p = createParallaxTracker();
  p.addFrame(view(0, 0), W, H);
  p.addFrame(view(14, 0), W, H); // beyond the ±6 search window
  const s = p.score();
  assert.equal(s.pairs, 0, 'clipped pair contributes nothing');
  assert.equal(s.confidence, 0);
});

test('no frames -> confidence 0', () => {
  assert.deepEqual(createParallaxTracker().score(), { score: 0, confidence: 0, pairs: 0 });
});

// ---------------------------------------------------------------------------
console.log('signal combination + estimator:');

test('no data at all -> movementScore 0 with confidence 0 (unknown, not "still")', () => {
  assert.deepEqual(combineMovementSignals(
    { score: 0, confidence: 0 }, { score: 0, confidence: 0 }),
    { movementScore: 0, confidence: 0 });
  const est = createMotionEstimator();
  const r = est.evaluate();
  assert.equal(r.movementScore, 0);
  assert.equal(r.confidence, 0);
});

test('one confident "moving" signal is not averaged away by a weak low reading', () => {
  const c = combineMovementSignals(
    { score: 0.9, confidence: 0.8 },   // IMU clearly sees steps
    { score: 0.1, confidence: 0.2 });  // parallax barely had usable pairs
  assert.ok(c.movementScore >= 0.7, 'combined ' + c.movementScore.toFixed(3));
  assert.ok(c.confidence >= 0.5);
});

test('both signals confidently low -> confidently low verdict', () => {
  const c = combineMovementSignals(
    { score: 0.05, confidence: 0.7 }, { score: 0.1, confidence: 0.9 });
  assert.ok(c.movementScore < LOW_MOVEMENT_SCORE);
  assert.ok(c.confidence >= MOVEMENT_MIN_CONFIDENCE);
});

test('end-to-end estimator: rotation-only inputs -> confidently low', () => {
  const est = createMotionEstimator();
  const rnd = mulberry32(13);
  for (let i = 0; i < 480; i++) {
    est.addMotionSample({ x: (rnd() - 0.5) * 0.05, y: (rnd() - 0.5) * 0.05,
      z: (rnd() - 0.5) * 0.05 }, 16.6);
  }
  for (let i = 0; i < 8; i++) est.addFrameGray(view((i % 2) * 2, 0), W, H);
  const r = est.evaluate();
  assert.ok(r.movementScore < LOW_MOVEMENT_SCORE, 'score ' + r.movementScore.toFixed(3));
  assert.ok(r.confidence >= MOVEMENT_MIN_CONFIDENCE, 'confidence ' + r.confidence.toFixed(3));
});

// ---------------------------------------------------------------------------
console.log('computeCoverage + lowMovementGate policy:');

const baseArgs = {
  frameCount: 20, frameTarget: 20,
  sectorsCovered: 8, sectorsTotal: 8, orientationActive: true,
};

test('full frames + all sectors + good movement -> full coverage', () => {
  assert.equal(computeCoverage({ ...baseArgs,
    movementScore: 0.9, movementConfidence: 0.8 }), 1);
});

test('confident low movement caps coverage at the (finishable) 60%', () => {
  assert.equal(computeCoverage({ ...baseArgs,
    movementScore: 0.1, movementConfidence: 0.8 }), LOW_MOVEMENT_COVERAGE_CAP);
  assert.ok(LOW_MOVEMENT_COVERAGE_CAP >= 0.6, 'cap keeps Finish enabled');
});

test('unmeasurable movement (confidence 0) does NOT cap — degrade to frames+sectors', () => {
  assert.equal(computeCoverage({ ...baseArgs,
    movementScore: 0, movementConfidence: 0 }), 1);
});

test('without orientation data, frames alone carry the estimate', () => {
  assert.equal(computeCoverage({ frameCount: 12, frameTarget: 20,
    sectorsCovered: 0, sectorsTotal: 8, orientationActive: false,
    movementScore: 0, movementConfidence: 0 }), 0.6);
});

test('coverage blends frames and sectors when orientation is live', () => {
  assert.equal(computeCoverage({ frameCount: 20, frameTarget: 20,
    sectorsCovered: 4, sectorsTotal: 8, orientationActive: true,
    movementScore: 0.9, movementConfidence: 0.8 }), 0.75);
});

test('gate fires only on a confident low verdict with an otherwise-complete sweep', () => {
  assert.equal(lowMovementGate({ ...baseArgs,
    movementScore: 0.1, movementConfidence: 0.8 }), true);
  // below the confidence floor -> never fires (unknown != "not moving")
  assert.equal(lowMovementGate({ ...baseArgs,
    movementScore: 0.1, movementConfidence: 0.1 }), false);
  // movement fine -> no gate
  assert.equal(lowMovementGate({ ...baseArgs,
    movementScore: 0.8, movementConfidence: 0.8 }), false);
  // sweep not at the frame goal yet -> normal hints, no gate
  assert.equal(lowMovementGate({ ...baseArgs, frameCount: 10,
    movementScore: 0.1, movementConfidence: 0.8 }), false);
  // sectors still missing (and known) -> the directional hints own the UX
  assert.equal(lowMovementGate({ ...baseArgs, sectorsCovered: 5,
    movementScore: 0.1, movementConfidence: 0.8 }), false);
  // orientation unknown: frames at goal + confident low movement still gates
  assert.equal(lowMovementGate({ ...baseArgs, orientationActive: false,
    sectorsCovered: 0, movementScore: 0.1, movementConfidence: 0.8 }), true);
});

console.log(`\n${passed} passed`);
