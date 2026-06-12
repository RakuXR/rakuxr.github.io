// motion_check.js — did the user actually TRANSLATE, or just turn in place?
// Copyright (c) 2026 RakuAI, LLC. All rights reserved.
//
// ----------------------------------------------------------------------------
// Pure rotation in place produces a degenerate, zero-parallax capture: every
// frame sees the scene from the SAME optical center, structure-from-motion
// has no baseline to triangulate, and the reconstruction collapses into a
// "starburst" splat. This module estimates a `movementScore` (0..1) — how
// much real translation happened during the sweep — from two cheap,
// independent signals, each with its own honest confidence:
//
//   1. IMU linear-acceleration energy (createImuEnergyTracker)
//      DeviceMotion's `acceleration` (NOT accelerationIncludingGravity) is
//      the device's linear acceleration with gravity already removed. We
//      high-pass it against a slow EMA (residual sensor bias drifts slowly;
//      footsteps and side-steps are 1-3 Hz bursts) and accumulate the RMS of
//      the high-passed magnitude. Turning in place keeps the optical center
//      still → sustained linear acceleration stays near the noise floor;
//      walking/side-stepping produces ~0.5-2 m/s² bursts every step.
//
//   2. Frame-parallax heuristic (createParallaxTracker)
//      Consecutive keyframes, downscaled to ~48 px grayscale. First find the
//      dominant GLOBAL integer pixel shift between the pair (coarse SAD
//      search); then measure how much individual image blocks deviate from
//      that global shift (small local SAD search per block). A pure camera
//      rotation moves (to first order, at this tiny scale) the WHOLE image
//      uniformly → per-block residual shift variance is near zero. A
//      translation makes near objects shift more than far ones (parallax) →
//      depth-dependent, non-uniform block shifts → high residual.
//
// HONEST LIMITS (documented, by design):
//   - IMU: constant-velocity translation has zero acceleration — a perfectly
//     smooth dolly glide is invisible to signal 1 (signal 2 still sees its
//     parallax). Devices without DeviceMotion / denied permission yield
//     confidence 0, never a fabricated score.
//   - Parallax: at 48 px the block search is integer-resolution; very distant
//     scenes (all parallax < 1 px between keyframes) under-report
//     translation. Fast pans can move the image beyond the search window —
//     such pairs are REJECTED (they say nothing), not misread. Rolling
//     shutter, motion blur, and exposure swings degrade matching; the
//     validity gates (texture, match quality, unclipped search) drop those
//     pairs and the confidence reflects how many usable pairs remained.
//   - Both signals say "the camera translated", not "the baseline was large
//     enough for THIS scene's depth". This is a pre-flight warning gate, not
//     a reconstruction guarantee.
//
// When NEITHER signal has data the combined result is movementScore 0 with
// confidence 0 — callers MUST treat confidence 0 as "unknown" and fall back
// to their pre-existing behavior (see computeCoverage / lowMovementGate),
// never as "no movement happened". Fake certainty is forbidden.
//
// Dependency-free, no DOM: callers feed IMU samples and small grayscale
// arrays. Node-tested in motion_check.test.mjs.
// ----------------------------------------------------------------------------

'use strict';

// ---- tuning constants (exported so tests + the UI gate share them) ---------

// IMU high-passed RMS (m/s²): below STILL is "standing still / pure
// rotation"; above MOVING is "clearly walking". Linear ramp between.
export const IMU_STILL_RMS = 0.12;
export const IMU_MOVING_RMS = 0.8;

// Parallax residual RMS (px at ~48 px frame width): below LOW is rotation-
// like (uniform shift); above HIGH is clearly depth-dependent flow.
export const PARALLAX_LOW_RESIDUAL = 0.4;
export const PARALLAX_HIGH_RESIDUAL = 1.2;

// UI gate thresholds: a movementScore below LOW_MOVEMENT_SCORE with at least
// MOVEMENT_MIN_CONFIDENCE confidence triggers the "step sideways" guidance.
export const LOW_MOVEMENT_SCORE = 0.35;
export const MOVEMENT_MIN_CONFIDENCE = 0.3;

// Coverage cap while the low-movement gate is active: enough to enable the
// "Finish capture" button (>= 0.6) so the user is warned, not blocked.
export const LOW_MOVEMENT_COVERAGE_CAP = 0.6;

const clamp01 = (x) => Math.max(0, Math.min(1, x));

// ============================================================================
// Signal 1 — IMU linear-acceleration energy
// ============================================================================

/**
 * Accumulates the energy of the high-passed linear acceleration. Feed it
 * DeviceMotion `event.acceleration` (gravity-free) samples.
 */
export function createImuEnergyTracker(opts) {
  const o = opts || {};
  const biasTauMs = o.biasTauMs != null ? o.biasTauMs : 1500;
  let bias = null;     // per-axis EMA — tracks slow sensor bias, passes steps
  let sumSq = 0;       // ∫ |highpassed accel|² dt   (m²/s⁴ · ms)
  let totalMs = 0;
  let samples = 0;

  function stats() {
    return {
      rms: totalMs > 0 ? Math.sqrt(sumSq / totalMs) : 0,
      seconds: totalMs / 1000,
      samples: samples,
    };
  }

  return {
    /**
     * @param {{x:number,y:number,z:number}|null} accel DeviceMotion
     *        `acceleration` (null on devices that cannot provide it — ignored,
     *        which honestly leaves confidence at 0)
     * @param {number} dtMs ms since the previous sample
     */
    add(accel, dtMs) {
      if (!accel) return;
      const ax = accel.x, ay = accel.y, az = accel.z;
      if (!Number.isFinite(ax) || !Number.isFinite(ay) || !Number.isFinite(az)) return;
      if (!bias || !(dtMs > 0) || dtMs > 1000) {
        // First sample, or a gap too long to integrate across: (re)seed the
        // bias estimate, count nothing.
        bias = [ax, ay, az];
        return;
      }
      const k = Math.min(1, dtMs / biasTauMs);
      bias[0] += (ax - bias[0]) * k;
      bias[1] += (ay - bias[1]) * k;
      bias[2] += (az - bias[2]) * k;
      const hx = ax - bias[0], hy = ay - bias[1], hz = az - bias[2];
      sumSq += (hx * hx + hy * hy + hz * hz) * dtMs;
      totalMs += dtMs;
      samples += 1;
    },

    stats: stats,

    /** {score, confidence} — confidence 0 with no samples, ramps with data. */
    score() {
      const s = stats();
      if (s.samples === 0) return { score: 0, confidence: 0, rms: 0 };
      const score = clamp01((s.rms - IMU_STILL_RMS) / (IMU_MOVING_RMS - IMU_STILL_RMS));
      // Needs a few seconds of real samples before the verdict means much:
      // full confidence after ~8 s of ~60 Hz data, proportionally less before.
      const confidence = clamp01(Math.min(s.samples / 120, totalMs / 8000));
      return { score: score, confidence: confidence, rms: s.rms };
    },
  };
}

// ============================================================================
// Signal 2 — frame-parallax heuristic
// ============================================================================

/**
 * Dominant global integer shift between two same-size grayscale frames via
 * coarse SAD search over ±maxShift. Returns null when the frames are too
 * small for the search window.
 *
 * @param {ArrayLike<number>} a previous frame, row-major grayscale 0..255
 * @param {ArrayLike<number>} b current frame
 * @returns {{dx:number, dy:number, sad:number, contrast:number}|null}
 *          sad = mean abs diff at the best shift; contrast = mean abs
 *          deviation of `a`'s compared region (texture available to match on)
 */
export function estimateGlobalShift(a, b, w, h, maxShift) {
  const m = maxShift == null ? 6 : maxShift;
  if (!a || !b || w - 2 * m < 8 || h - 2 * m < 8) return null;

  let best = null;
  for (let dy = -m; dy <= m; dy++) {
    for (let dx = -m; dx <= m; dx++) {
      let sad = 0, n = 0;
      for (let y = m; y < h - m; y++) {
        const rowA = y * w;
        const rowB = (y + dy) * w;
        for (let x = m; x < w - m; x++) {
          sad += Math.abs(a[rowA + x] - b[rowB + x + dx]);
          n++;
        }
      }
      const mean = sad / n;
      if (!best || mean < best.sad) best = { dx: dx, dy: dy, sad: mean };
    }
  }

  // Texture measure of the compared region of `a` — flat frames cannot be
  // matched and must not be trusted.
  let sum = 0, n = 0;
  for (let y = m; y < h - m; y++) {
    for (let x = m; x < w - m; x++) { sum += a[y * w + x]; n++; }
  }
  const mean = sum / n;
  let mad = 0;
  for (let y = m; y < h - m; y++) {
    for (let x = m; x < w - m; x++) mad += Math.abs(a[y * w + x] - mean);
  }
  best.contrast = mad / n;
  return best;
}

/**
 * After removing the global shift, how non-uniform is the per-block shift
 * field? Each textured block gets a small local SAD search (±local) around
 * the global shift; the residual is the RMS magnitude of the per-block
 * deviations. Rotation → ~0; translation → depth-dependent spread.
 *
 * @param {{dx:number,dy:number}} global  from estimateGlobalShift
 * @returns {{valid:boolean, rms:number, blocks:number}}
 */
export function blockShiftResidual(a, b, w, h, global, opts) {
  const o = opts || {};
  const block = o.block != null ? o.block : 10;
  const local = o.local != null ? o.local : 2;
  const maxShift = o.maxShift != null ? o.maxShift : 6;
  const minStd = o.minStd != null ? o.minStd : 6; // texture gate (gray levels)
  const margin = maxShift + local;

  const residuals = [];
  for (let by = margin; by + block <= h - margin; by += block) {
    for (let bx = margin; bx + block <= w - margin; bx += block) {
      // Texture gate: a flat block matches everywhere — skip it.
      let sum = 0;
      for (let y = by; y < by + block; y++) {
        for (let x = bx; x < bx + block; x++) sum += a[y * w + x];
      }
      const mean = sum / (block * block);
      let varSum = 0;
      for (let y = by; y < by + block; y++) {
        for (let x = bx; x < bx + block; x++) {
          const d = a[y * w + x] - mean;
          varSum += d * d;
        }
      }
      if (Math.sqrt(varSum / (block * block)) < minStd) continue;

      let bestSad = Infinity, bestDdx = 0, bestDdy = 0;
      for (let ddy = -local; ddy <= local; ddy++) {
        for (let ddx = -local; ddx <= local; ddx++) {
          const dx = global.dx + ddx, dy = global.dy + ddy;
          let sad = 0;
          for (let y = by; y < by + block; y++) {
            const rowA = y * w;
            const rowB = (y + dy) * w;
            for (let x = bx; x < bx + block; x++) {
              sad += Math.abs(a[rowA + x] - b[rowB + x + dx]);
            }
          }
          if (sad < bestSad) { bestSad = sad; bestDdx = ddx; bestDdy = ddy; }
        }
      }
      residuals.push(Math.hypot(bestDdx, bestDdy));
    }
  }

  if (residuals.length < 4) return { valid: false, rms: 0, blocks: residuals.length };
  let sq = 0;
  for (const r of residuals) sq += r * r;
  return { valid: true, rms: Math.sqrt(sq / residuals.length), blocks: residuals.length };
}

/**
 * Accumulates parallax evidence across consecutive downscaled grayscale
 * keyframes. Pairs that cannot be matched reliably (no texture, poor best
 * match, search window clipped) are rejected, not misread.
 */
export function createParallaxTracker(opts) {
  const o = opts || {};
  const maxShift = o.maxShift != null ? o.maxShift : 6;
  const maxSad = o.maxSad != null ? o.maxSad : 14;       // match quality gate
  const minContrast = o.minContrast != null ? o.minContrast : 4;
  let prev = null;
  const pairResiduals = [];
  let totalPairs = 0;
  let validPairs = 0;

  return {
    /** Feed each downscaled grayscale keyframe in capture order. */
    addFrame(gray, w, h) {
      if (!gray || !(w > 0) || !(h > 0)) return;
      if (prev && prev.w === w && prev.h === h) {
        totalPairs += 1;
        const g = estimateGlobalShift(prev.data, gray, w, h, maxShift);
        const usable = g
          && g.sad <= maxSad                 // the best match actually matches
          && g.contrast >= minContrast       // there was texture to match on
          && Math.abs(g.dx) < maxShift       // search window not clipped
          && Math.abs(g.dy) < maxShift;      // (clipped = pan too fast to read)
        if (usable) {
          const r = blockShiftResidual(prev.data, gray, w, h, g,
            { maxShift: maxShift });
          if (r.valid) {
            validPairs += 1;
            pairResiduals.push(r.rms);
          }
        }
      }
      prev = { data: gray, w: w, h: h };
    },

    /** {score, confidence, pairs} — confidence 0 with no usable pairs. */
    score() {
      if (!validPairs) return { score: 0, confidence: 0, pairs: 0 };
      // 70th percentile: translation is often intermittent (step, pause,
      // step) — reward the moving stretches without letting one outlier
      // pair decide.
      const sorted = pairResiduals.slice().sort((x, y) => x - y);
      const p70 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.7))];
      const score = clamp01((p70 - PARALLAX_LOW_RESIDUAL)
        / (PARALLAX_HIGH_RESIDUAL - PARALLAX_LOW_RESIDUAL));
      // Confidence: needs several usable pairs, discounted by how many pairs
      // had to be rejected (a mostly-unmatchable sweep is weak evidence).
      const usableRatio = validPairs / Math.max(1, totalPairs);
      const confidence = clamp01(Math.min(1, validPairs / 6)
        * clamp01(usableRatio + 0.5));
      return { score: score, confidence: confidence, pairs: validPairs, residual_p70: p70 };
    },
  };
}

// ============================================================================
// Combination + the coverage / gate policy
// ============================================================================

/**
 * Confidence-weighted combination of the two signals.
 *
 * Asymmetry, on purpose: the harmful failure mode is nagging (or capping) a
 * user who IS translating, so one confident "definitely moving" signal is not
 * averaged away by the other's noisy low reading. The combined confidence is
 * that of the better-instrumented signal — it bounds how much the verdict
 * can be trusted either way.
 *
 * @returns {{movementScore:number, confidence:number}}
 */
export function combineMovementSignals(imu, parallax) {
  const i = imu || { score: 0, confidence: 0 };
  const p = parallax || { score: 0, confidence: 0 };
  const tw = i.confidence + p.confidence;
  if (tw <= 0) return { movementScore: 0, confidence: 0 };
  let score = (i.score * i.confidence + p.score * p.confidence) / tw;
  for (const s of [i, p]) {
    if (s.confidence >= 0.5 && s.score >= 0.7) {
      score = Math.max(score, 0.85 * s.score);
    }
  }
  return {
    movementScore: clamp01(score),
    confidence: clamp01(Math.max(i.confidence, p.confidence)),
  };
}

/** One estimator owning both trackers — what capture_app.js instantiates. */
export function createMotionEstimator() {
  const imu = createImuEnergyTracker();
  const parallax = createParallaxTracker();
  return {
    addMotionSample: (accel, dtMs) => imu.add(accel, dtMs),
    addFrameGray: (gray, w, h) => parallax.addFrame(gray, w, h),
    evaluate() {
      const i = imu.score();
      const p = parallax.score();
      const c = combineMovementSignals(i, p);
      return {
        movementScore: c.movementScore,
        confidence: c.confidence,
        imu: i,
        parallax: p,
      };
    },
  };
}

/**
 * Honest coverage: a function of frames captured, yaw sectors swept, and
 * (when measurable) actual translation — replacing the old random-increment
 * stub. Monotone non-decreasing in frames/sectors; the movement gate can
 * only CAP it at LOW_MOVEMENT_COVERAGE_CAP (still >= the finish-enable
 * threshold, so the user is warned, never locked out).
 *
 * Degrades honestly: without orientation data, sectors are unknown and the
 * frame count carries the estimate; without movement confidence, no cap is
 * applied (unknown movement is NOT treated as no movement).
 *
 * @param {object} o {frameCount, frameTarget, sectorsCovered, sectorsTotal,
 *                    orientationActive, movementScore, movementConfidence}
 * @returns {number} 0..1
 */
export function computeCoverage(o) {
  const frameTarget = Math.max(1, o.frameTarget || 1);
  const frameScore = clamp01((o.frameCount || 0) / frameTarget);
  let base;
  if (o.orientationActive && o.sectorsTotal > 0) {
    const sectorScore = clamp01((o.sectorsCovered || 0) / o.sectorsTotal);
    base = 0.5 * frameScore + 0.5 * sectorScore;
  } else {
    base = frameScore; // no orientation signal — frames carry the estimate
  }
  if ((o.movementConfidence || 0) >= MOVEMENT_MIN_CONFIDENCE
      && (o.movementScore || 0) < LOW_MOVEMENT_SCORE) {
    base = Math.min(base, LOW_MOVEMENT_COVERAGE_CAP);
  }
  return clamp01(base);
}

/**
 * Should the "step sideways" guidance + finish-confirm fire? True only when
 * the sweep otherwise LOOKS complete (frames at target; sectors covered when
 * known) yet the movement signals confidently say "no translation". With
 * confidence below MOVEMENT_MIN_CONFIDENCE this is always false — the gate
 * degrades to the pre-existing behavior rather than guessing.
 */
export function lowMovementGate(o) {
  if ((o.movementConfidence || 0) < MOVEMENT_MIN_CONFIDENCE) return false;
  if ((o.movementScore || 0) >= LOW_MOVEMENT_SCORE) return false;
  if ((o.frameCount || 0) < (o.frameTarget || 0)) return false;
  if (o.orientationActive && o.sectorsTotal > 0
      && (o.sectorsCovered || 0) < o.sectorsTotal) {
    return false; // still sectors to sweep — the normal hints handle that
  }
  return true;
}
