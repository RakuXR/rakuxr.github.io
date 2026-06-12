// capture_app.js — Raku Capture PWA front-end controller
// Copyright (c) 2026 RakuAI, LLC. All rights reserved.
//
// ----------------------------------------------------------------------------
// Drives the guided room-capture experience as a real state machine:
//   intro -> guide -> capture (live camera) -> upload -> processing -> ready.
//
// As of Phase 1 W1.3 the backend seams are WIRED to the live reconstruction
// service in raku-api:
//   - captureKeyframe()    grabs real JPEG frames from the camera.
//   - uploadCapture()      POSTs them to /api/v1/capture.
//   - pollReconstruction() polls /api/v1/capture/{id}/status.
//   - loadSplatViewer()    renders the result with the Spark splat renderer
//                          and an interactive orbit/zoom camera.
//
// A monotonic run token (state.runToken) lets the app abandon an in-flight
// pipeline when the user navigates away, and loadSplatViewer returns a
// teardown fn so the render loop + listeners never leak across captures.
//
// Phase 1 W1.4 adds two more REAL pieces:
//   - The intro screen renders a real, public sample splat (loaded from
//     samples/manifest.json) in the SAME interactive Spark viewer, so a
//     visitor can drag a real 3D scene before scanning anything.
//   - The viewer toolbar has a 'Clean up' button that opens the splat in the
//     MIT SuperSplat editor (https://superspl.at/editor) to trim floaters /
//     crop the scan. SuperSplat's ?load= deep-link is documented for .ply
//     only; for .spz the button opens SuperSplat and copies the splat URL to
//     the clipboard with an on-screen hint. No auto-trim is claimed — the
//     trimming itself happens in SuperSplat, by the user.
//
// Still a SEAM: the reconstruction itself. The backend currently runs a
// simulated pipeline (SimulatedReconstructionBackend) — it returns a real,
// staged job and a cdn.raku.games splat URL, but the splat is a placeholder
// until the native GLOMAP + Brush backend lands. See raku-api
// services/reconstruction.py.
// ----------------------------------------------------------------------------

'use strict';

// ============================================================================
// Scale calibration module
// ============================================================================
// scale_calibration.js owns the metric-scale reference table and the metadata
// builder. The capture side only RECORDS the chosen reference + its known
// real-world dimensions; the actual scale solve is a reconstruction-backend
// step (see scale_calibration.js header for the honest scope boundary).

import {
  SCALE_CAPTURE_MS,
  listScaleReferences,
  getScaleReference,
  buildScaleMetadata,
} from './scale_calibration.js';

// ============================================================================
// Sensor metadata module (Lane A — capture→splat speed program)
// ============================================================================
// sensor_metadata.js owns per-frame IMU sampling (gravity, rotation rate,
// orientation quaternion), best-effort camera intrinsics, the
// capture_metadata.json builder (exact cross-lane schema), and the
// fire-and-forget GPU pre-warm ping. Everything is feature-detected and
// fails soft — capture never breaks when sensors are unavailable.

import {
  METADATA_FILENAME,
  ensureMotionPermission,
  startSensorCapture,
  stopSensorCapture,
  sensorFrameRecord,
  snapshotCameraSettings,
  buildCaptureMetadata,
  prewarmCaptureSession,
} from './sensor_metadata.js';

// ============================================================================
// i18n shim
// ============================================================================
// window.RakuI18n is installed by i18n.js (loaded before this module). The
// shim degrades gracefully if i18n.js is somehow absent: t() echoes a sensible
// English-ish fallback string, raw() returns the fallback list. This keeps the
// app functional even when the locale layer fails to load.

// W2A: capture persistence -- localStorage history + the My Captures view.
import { CaptureHistory, STATUS as HISTORY_STATUS,
  RECON_FAILED_CODE, isTerminalFailure } from './capture_history.js';
import { CapturesView } from './captures_view.js';

// One shared history store for this page. Anonymous-first: it records every
// capture in localStorage so a user can recover a scan after the tab closes.
const captureHistory = new CaptureHistory();

const I18N = window.RakuI18n || null;

/**
 * Translate an imperative string. params fills {name} placeholders.
 *
 * If the i18n runtime is present but the key is missing from BOTH the active
 * and fallback locales, RakuI18n.t() returns the key string itself. In that
 * case we prefer the human-readable `fallback` argument when one was supplied,
 * so a missing locale key never surfaces a raw dotted key to the user.
 */
function t(key, params, fallback) {
  if (I18N && typeof I18N.t === 'function') {
    const val = I18N.t(key, params);
    // val === key means the key was not found in any locale.
    if (val !== key || fallback == null) return val;
  }
  let s = fallback != null ? fallback : key;
  if (params) {
    s = String(s).replace(/\{(\w+)\}/g, (m, k) =>
      Object.prototype.hasOwnProperty.call(params, k) ? params[k] : m);
  }
  return s;
}

/** Raw (non-interpolated) locale value — used for the HINTS array. */
function tRaw(key, fallback) {
  if (I18N && typeof I18N.raw === 'function') {
    const v = I18N.raw(key);
    if (v !== undefined) return v;
  }
  return fallback;
}

// ============================================================================
// CDN / backend base detection
// ============================================================================

/** Backend API base for the capture/reconstruction service (raku-api). */
function detectApiBase() {
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:8000';
  return 'https://api.rakuai.com';
}

const API_BASE = detectApiBase();
// Hand the resolved API base to the debug overlay (capture_debug.js, loaded
// first) so it probes GPU-worker availability against the right host.
if (window.RakuDebug) window.RakuDebug.apiBase = API_BASE;

// Spark renderer pinned CDN module URL. Spark is an MIT-licensed 3D Gaussian
// splat renderer for three.js (https://github.com/sparkjsdev/spark).
// Pinned to the 0.1.x line: it has no `three` peer constraint and is
// compatible with the pinned three@0.169.0 (the 2.x line needs three>=0.180.0).
const SPARK_CDN_URL = 'https://cdn.jsdelivr.net/npm/@sparkjsdev/spark@0.1.10/dist/spark.module.js';
const THREE_CDN_URL = 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

// SuperSplat — MIT browser-based Gaussian-splat editor used for the viewer's
// 'Clean up' affordance (trim floaters / crop the scan). URL verified 2026-05-24.
// Its ?load= deep-link is documented for .ply URLs only; .spz is handled by
// opening the editor + copying the URL (see openSplatCleanup()).
const SUPERSPLAT_EDITOR_URL = 'https://superspl.at/editor';

// Sample-splat manifest (real public room-scale splats) for the intro preview.
const SAMPLES_MANIFEST_URL = './samples/manifest.json';

// Capture tuning.
const MAX_KEYFRAMES = 48;          // upper bound on frames sent per capture
const KEYFRAME_MAX_EDGE = 1280;    // downscale long edge before upload

// ============================================================================
// State machine
// ============================================================================

const Phase = Object.freeze({
  INTRO: 'intro',
  SIGNIN: 'signin',
  REGISTER: 'register',
  DEMO: 'demo',
  GUIDE: 'guide',
  SCALE: 'scale',
  CAPTURE: 'capture',
  UPLOADING: 'uploading',
  PROCESSING: 'processing',
  READY: 'ready',
  ERROR: 'error',
});

const state = {
  phase: Phase.INTRO,
  mediaStream: null,
  capturedFrames: [],     // Array<Blob> — JPEG keyframes grabbed from the camera
  coverage: 0,            // 0..1 heuristic of how much of the room is covered
  captureId: null,        // server-assigned id once uploaded
  splatUrl: null,         // resolved .spz/.sog URL once reconstruction completes
  runToken: 0,            // bumped to abandon an in-flight pipeline run
  viewerTeardown: null,   // stops the viewer's render loop + input listeners
  previewTeardown: null,  // stops the intro sample-splat preview render loop
  cleanupSplatUrl: null,  // splat URL the 'Clean up' button acts on (W1.4)

  // ---- dynamic-text snapshots --------------------------------------------
  // These mirror the runtime-managed UI text that has NO data-i18n attribute
  // (it is owned by JS, see index.html). relocalizeDynamic() reads them to
  // re-render the live UI in the new locale on a mid-flow language switch.
  uploadPct: null,        // 0..1 once the upload reports progress; null = preparing
  procStage: null,        // 'analyzing' | 'reconstructing' | other reconstruction stage
  procPct: 0,             // 0..1 reconstruction progress for the current stage
  viewerStatus: 'loading',// 'loading' | 'controls' | 'placeholder' — real viewer state
  viewerOfflineFile: null,// filename shown in the offline-placeholder #viewer-note
  errorMessageKey: null,  // i18n key of the current error, when it came from a key
  errorMessageParams: null,// params for that key
  errorMessageText: null, // literal error text when it did NOT come from a key
  errorRaw: null,         // raw backend/network error string -> diagnosis + technical details
  errorStage: null,       // last-known proc stage when the failure happened
  errorDiagShown: false,  // true once the user taps "What happened?" (consent-gated)
  procStartedAt: null,    // performance.now() when processing (post-upload) began -> elapsed timer
  procElapsedMs: 0,       // elapsed ms in the current processing run, snapshot for the renderer
  procSlowHint: false,    // 10-min+ : the existing "still working" reassurance is active
  gpuWorkerDown: null,    // advisory /recon/availability result for this run: null=unknown, true=no worker online
  introSampleName: null,  // label of the intro preview sample, for its caption

  // ---- metric-scale calibration ------------------------------------------
  // The scale-reference step (plan §6.1 step 2). scaleReferenceId is the
  // chosen reference's id (see scale_calibration.js), or null if none picked.
  // scaleSkipped records an explicit opt-out. scaleFrames are the dedicated
  // JPEG frames of the reference; scaleDwellMs is how long it was held in
  // view. These feed buildScaleMetadata() at upload time.
  scaleReferenceId: null, // 'credit_card' | 'paper_a4' | 'paper_letter' | null
  scaleSkipped: false,    // true once the user explicitly skips the step
  scaleFrames: [],        // Array<Blob> — dedicated reference keyframes
  scaleDwellMs: 0,        // ms the reference was held in frame
  scaleSubstep: false,    // true while the in-camera scale sub-step is running

  // ---- per-frame sensor metadata (Lane A) --------------------------------
  // frameMeta is PARALLEL to capturedFrames: frameMeta[i] is the sensor record
  // (t_ms, imu sample, pose placeholder) grabbed at the same drawImage() as
  // capturedFrames[i]'s pixels. captureT0 anchors the monotonic per-frame
  // timestamps; cameraSnapshot is taken while the track is still live (after
  // stopCamera() getSettings() returns {}).
  frameMeta: [],          // Array<object> — sensorFrameRecord() results
  captureT0: null,        // performance.now() at capture-sweep start
  cameraSnapshot: null,   // snapshotCameraSettings() result for this sweep
  uploadedFrameSize: null,// {width,height} of the as-uploaded (downscaled) JPEGs
  pendingFrameBlobs: 0,   // in-flight async toBlob() conversions (drained pre-upload)
};

// DOM lookup helper ----------------------------------------------------------
const $ = (id) => document.getElementById(id);

const screens = {
  [Phase.INTRO]: 'screen-intro',
  [Phase.SIGNIN]: 'screen-signin',
  [Phase.REGISTER]: 'screen-register',
  [Phase.DEMO]: 'screen-demo',
  [Phase.GUIDE]: 'screen-guide',
  [Phase.SCALE]: 'screen-scale',
  [Phase.CAPTURE]: 'camera-stage',
  [Phase.UPLOADING]: 'screen-uploading',
  [Phase.PROCESSING]: 'screen-processing',
  [Phase.READY]: 'viewer-stage',
  [Phase.ERROR]: 'screen-error',
};

function showPhase(phase) {
  const leavingIntro = state.phase === Phase.INTRO && phase !== Phase.INTRO;
  const enteringIntro = state.phase !== Phase.INTRO && phase === Phase.INTRO;
  // Debug overlay hook (capture_debug.js): record every state-machine
  // transition. No-op when the debug logger is not loaded.
  if (window.RakuDebug) window.RakuDebug.state(state.phase, phase);
  state.phase = phase;
  for (const [p, elId] of Object.entries(screens)) {
    const el = $(elId);
    if (el) el.hidden = (p !== phase);
  }
  // Keep the intro sample-splat preview's render loop off-screen-free: tear it
  // down when leaving the intro, rebuild it when the user comes back.
  if (leavingIntro && state.previewTeardown) {
    state.previewTeardown();
    state.previewTeardown = null;
  }
  if (enteringIntro && !state.previewTeardown) {
    initIntroPreview();
  }
}

/**
 * Show the error screen.
 *
 * Prefer the key form — showError({ key, params, fallback }) — so the message
 * can be re-rendered in the active locale if the user switches language on the
 * error screen. The literal-string form — showError('some text') — is kept for
 * messages that have no locale key (e.g. a raw server `detail`); such text is
 * shown verbatim and cannot be re-localized.
 */
/**
 * The backend's worker-down error suggests "try phone GPU mode instead", but
 * the server cannot know this browser's capabilities. When the text suggests
 * phone GPU mode and WebGPU is absent here, append the honest device-side
 * caveat so the suggestion isn't a dead end (the compute toggle hard-disables
 * the phone option for the same reason).
 */
function _phoneGpuSuggestionNote(text) {
  if (!text || !/phone gpu mode/i.test(text) || _hasWebGPU()) return text;
  return text + ' ' + t('error.phoneGpuUnsupported', null,
    'Note: phone GPU mode is not supported by this browser.');
}

function showError(message) {
  let text;
  if (message && typeof message === 'object') {
    state.errorMessageKey = message.key || null;
    state.errorMessageParams = message.params || null;
    state.errorMessageText = null;
    // The raw backend/network detail (when present) drives both the diagnosis
    // rule table and the collapsible "technical details".
    state.errorRaw = (message.params && message.params.detail) || message.raw || null;
    text = t(message.key, message.params, message.fallback);
  } else {
    state.errorMessageKey = null;
    state.errorMessageParams = null;
    state.errorMessageText = message || null;
    state.errorRaw = message || null;
    text = message || t('error.generic', null, 'Something went wrong.');
  }
  // Snapshot the stage we were in when it failed (drives stage-aware rules),
  // and reset the consent-gated diagnosis + collapsible details for this error.
  state.errorStage = state.procStage || null;
  state.errorDiagShown = false;
  const techWrap = $('error-technical');
  if (techWrap) techWrap.hidden = true;
  $('error-message').textContent = _phoneGpuSuggestionNote(text);
  applyErrorDiagnostics();
  showPhase(Phase.ERROR);
}

/**
 * Resolve a key's text in BOTH the English source and the active locale, so a
 * substring test can match either. The in-code `englishFallback` is the stable
 * English source string; `I18N.t(key)` yields what the user actually saw in the
 * active locale (RakuI18n already falls back to English for missing keys, so
 * the English path is always represented).
 */
function _localizedVariants(key, englishFallback) {
  const out = [];
  if (englishFallback) out.push(englishFallback);
  if (I18N && typeof I18N.t === 'function') {
    try { const v = I18N.t(key); if (v && v !== key) out.push(v); } catch (e) {}
  }
  return out;
}

/** True if `haystack` (lowercased) contains any of `key`'s localized variants. */
function _matchesKey(haystack, key, englishFallback) {
  return _localizedVariants(key, englishFallback).some((s) => {
    const needle = String(s || '').toLowerCase().trim();
    return needle.length > 0 && haystack.indexOf(needle) !== -1;
  });
}

/**
 * Rule-based, client-side failure diagnosis (v1). Maps the raw error string +
 * last-known stage to a plain-English cause + concrete next action, returned as
 * an i18n key so it re-renders on a locale switch. Pure string matching on data
 * the client already has — no telemetry, no network.
 *
 * Locale-robust: it first tries to match the LOCALIZED text of the known error
 * source keys (so a Japanese timeout/network/SfM message is classified
 * correctly), then falls back to the English-prose heuristics below — which
 * keeps the original English path working unchanged.
 */
function diagnoseFailureKey(rawError, lastStage) {
  const e = String(rawError || '').toLowerCase();

  // 1) Stable-signal pass: match the localized variants of known source keys.
  //    Order mirrors the prose pass: timeout before network before SfM.
  if (_matchesKey(e, 'error.reconstructionTimeout', 'Reconstruction timed out.')) {
    return 'error.diagTimeout';
  }
  if (_matchesKey(e, 'error.uploadNetwork', 'Network error during upload.')
      || _matchesKey(e, 'error.reconstructionLostContact', 'Lost contact with the reconstruction job.')) {
    return 'error.diagNetwork';
  }
  if (_matchesKey(e, 'error.reconstructionFailed', 'Reconstruction failed.')
      || _matchesKey(e, 'error.noFrames', 'No frames were captured — try scanning the room again.')) {
    return 'error.diagSfm';
  }

  // 2) English-prose heuristics (unchanged). Covers raw backend `detail`
  //    strings (English from the server) and any text not matched above.
  // Timeout / out-of-time on current capacity. Checked first because a timeout
  // message often also mentions "reconstruct".
  if (/timeout|timed out|timed-out|deadline|took too long|time limit|1500|time.*exceed|exceed.*time/.test(e)) {
    return 'error.diagTimeout';
  }
  // Upload / network error.
  if (/network|upload|connection|connect|offline|disconnect|lost contact|unreachable|fetch|http 5\d\d|http 4\d\d|\(http \d/.test(e)) {
    return 'error.diagNetwork';
  }
  // Too-few / low-overlap frames or COLMAP structure-from-motion failure.
  if (/colmap|sfm|structure[- ]?from[- ]?motion|feature|match|overlap|too few|insufficient|not enough|register|frames?|reconstruct|alignment|\balign/.test(e)
      || lastStage === 'analyzing') {
    return 'error.diagSfm';
  }
  // Unknown / other.
  return 'error.diagUnknown';
}

/** Re-render the error screen's message in the active locale. */
function applyErrorMessage() {
  const el = $('error-message');
  if (!el) return;
  let text;
  if (state.errorMessageKey) {
    text = t(state.errorMessageKey, state.errorMessageParams);
  } else if (state.errorMessageText != null) {
    text = state.errorMessageText; // literal text — not localizable
  } else {
    text = t('error.generic', null, 'Something went wrong.');
  }
  el.textContent = _phoneGpuSuggestionNote(text);
  applyErrorDiagnostics();
}

/**
 * Render the failure-diagnostics affordances: the "What happened?" button, the
 * consent-gated plain-English diagnosis, and the collapsible "technical details"
 * holding the raw error. Idempotent; safe to call on locale change.
 */
function applyErrorDiagnostics() {
  const diagEl = $('error-diagnosis');
  const diagBtn = $('btn-diagnose');
  const detailsBtn = $('btn-error-details');
  const techWrap = $('error-technical');
  const detailEl = $('error-detail');

  const hasRaw = !!(state.errorRaw && String(state.errorRaw).trim());
  const diagKey = diagnoseFailureKey(state.errorRaw, state.errorStage);

  if (diagEl) {
    diagEl.textContent = t(diagKey, null, 'We hit an unexpected error.');
    diagEl.hidden = !state.errorDiagShown;
  }
  if (diagBtn) {
    diagBtn.textContent = t('error.diagnose', null, 'What happened?');
    diagBtn.hidden = state.errorDiagShown; // offer it only while still hidden
  }
  if (detailEl) detailEl.textContent = hasRaw ? String(state.errorRaw) : '';
  if (detailsBtn) {
    detailsBtn.hidden = !hasRaw; // only when there is a raw error to show
    const open = techWrap && !techWrap.hidden;
    detailsBtn.textContent = open
      ? t('error.hideDetails', null, 'Hide technical details')
      : t('error.showDetails', null, 'Show technical details');
  }
}

/**
 * Abandon any in-flight pipeline run and tear down the viewer. Returns a fresh
 * run token; runPipeline abandons work whose token is no longer current. Call
 * this whenever the user navigates away from the upload/processing/ready flow.
 */
function resetRun() {
  state.runToken += 1;
  if (state.viewerTeardown) {
    state.viewerTeardown();
    state.viewerTeardown = null;
  }
  return state.runToken;
}

// ============================================================================
// Metric-scale calibration -- the scale-reference step (plan section 6.1 step 2)
// ============================================================================
//
// Flow: GUIDE -> SCALE (pick a reference, or skip) -> CAPTURE. When a reference
// is chosen the camera opens into a brief in-camera scale SUB-STEP: the user
// holds the known-size object in frame for ~3 s while the app grabs dedicated
// reference frames, then it transitions seamlessly into the normal room sweep.
//
// HONEST BOUNDARY: this only RECORDS the reference and grabs frames of it. The
// metric scale is solved server-side by the reconstruction backend, which
// detects the reference and compares its reconstructed size to the known
// real-world size in scale_calibration.js. Skipping leaves the capture
// honestly marked scale-unknown.

let scaleSubstepTimer = null;

// Offscreen canvas reused for every scale-reference keyframe grab.
const _scaleCanvas = document.createElement('canvas');

// Upper bound on dedicated reference frames -- a short dwell needs only a few.
const MAX_SCALE_FRAMES = 12;

/**
 * Render the reference picker into #scale-options from the scale_calibration.js
 * reference table. Each option is a button localized via the reference's
 * per-id i18n keys (scale.ref.<key>.name / .desc).
 */
function renderScaleOptions() {
  const host = $('scale-options');
  if (!host) return;
  host.textContent = '';

  listScaleReferences().forEach((ref) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'scale-option';
    btn.dataset.refId = ref.id;
    btn.setAttribute('aria-pressed', String(state.scaleReferenceId === ref.id));

    const name = document.createElement('span');
    name.className = 'scale-option-name';
    name.textContent = t(ref.i18nKey + '.name', null, ref.id);

    const desc = document.createElement('span');
    desc.className = 'scale-option-desc';
    desc.textContent = t(ref.i18nKey + '.desc', null, '');

    btn.appendChild(name);
    btn.appendChild(desc);
    btn.addEventListener('click', () => selectScaleReference(ref.id));
    host.appendChild(btn);
  });
}

/** Mark a reference chosen; reflect it in the picker and enable Continue. */
function selectScaleReference(id) {
  state.scaleReferenceId = getScaleReference(id) ? id : null;
  state.scaleSkipped = false;
  document.querySelectorAll('#scale-options .scale-option').forEach((btn) => {
    btn.setAttribute('aria-pressed',
      String(btn.dataset.refId === state.scaleReferenceId));
  });
  const cont = $('btn-scale-continue');
  if (cont) cont.disabled = !state.scaleReferenceId;
}

/**
 * Resolve the localized display name of the chosen reference, for the live
 * sub-step copy. Falls back to the bare id if the locale key is missing.
 */
function scaleReferenceName() {
  const ref = getScaleReference(state.scaleReferenceId);
  if (!ref) return '';
  return t(ref.i18nKey + '.name', null, ref.id);
}

/**
 * Run the in-camera scale sub-step: hold the reference in frame for
 * SCALE_CAPTURE_MS while grabbing dedicated reference frames, with a live
 * countdown. Resolves when the dwell completes (or is cut short by cancel via
 * finishScaleSubstep()).
 *
 * @returns {Promise<void>}
 */
function runScaleSubstep() {
  return new Promise((resolve) => {
    state.scaleSubstep = true;
    state.scaleFrames = [];
    state.scaleDwellMs = 0;
    const frame = $('scale-frame');
    if (frame) frame.hidden = false;

    const startedAt = performance.now();
    applyScaleFrameLabel(); // initial localized label

    // Stash the resolver so finishScaleSubstep() can settle this promise
    // exactly once, whether the dwell completed normally or a cancel /
    // resetScaleState() cut it short. Without this an aborted sub-step would
    // leave `await runScaleSubstep()` in beginCapture() hanging forever.
    runScaleSubstep._resolve = resolve;

    if (scaleSubstepTimer) clearInterval(scaleSubstepTimer);
    scaleSubstepTimer = setInterval(() => {
      const elapsed = performance.now() - startedAt;
      state.scaleDwellMs = Math.min(SCALE_CAPTURE_MS, Math.round(elapsed));
      captureScaleKeyframe();
      applyScaleFrameLabel();
      if (elapsed >= SCALE_CAPTURE_MS) finishScaleSubstep();
    }, 350);
  });
}

/**
 * Stop the scale sub-step cleanly (timer + overlay) AND settle the pending
 * runScaleSubstep() promise so its awaiter can continue. Idempotent: a second
 * call is a no-op because the resolver is cleared after it fires.
 */
function finishScaleSubstep() {
  if (scaleSubstepTimer) { clearInterval(scaleSubstepTimer); scaleSubstepTimer = null; }
  state.scaleSubstep = false;
  const frame = $('scale-frame');
  if (frame) frame.hidden = true;
  const resolve = runScaleSubstep._resolve;
  runScaleSubstep._resolve = null;
  if (resolve) resolve();
}

/**
 * Grab a frame of the reference object from the live video. Mirrors
 * captureKeyframe() but writes into the dedicated state.scaleFrames bucket so
 * the reference footage is identifiable to the backend solver.
 */
function captureScaleKeyframe() {
  const video = $('camera-video');
  if (!video || !video.videoWidth) return;
  if (state.scaleFrames.length >= MAX_SCALE_FRAMES) return;

  const longEdge = Math.max(video.videoWidth, video.videoHeight);
  const scale = Math.min(1, KEYFRAME_MAX_EDGE / longEdge);
  const w = Math.round(video.videoWidth * scale);
  const h = Math.round(video.videoHeight * scale);
  _scaleCanvas.width = w;
  _scaleCanvas.height = h;
  const ctx = _scaleCanvas.getContext('2d');
  if (!ctx) return;
  ctx.drawImage(video, 0, 0, w, h);
  // toBlob is async: stash the current bucket so a late-arriving blob lands in
  // the substep it was grabbed for, even if resetScaleState() / a new run has
  // since swapped state.scaleFrames for a fresh array. Mirrors the room
  // keyframe path's guard.
  const targetFrames = state.scaleFrames;
  _scaleCanvas.toBlob(
    (blob) => {
      if (blob && targetFrames && targetFrames.length < MAX_SCALE_FRAMES) {
        targetFrames.push(blob);
      }
    },
    'image/jpeg',
    0.8 // slightly higher quality -- the reference's edges must stay crisp
  );
}

/** Live, localized label for the in-camera scale sub-step overlay. */
function applyScaleFrameLabel() {
  const label = $('scale-frame-label');
  if (!label) return;
  if (!state.scaleSubstep) return; // overlay hidden -- nothing to render
  const remainMs = Math.max(0, SCALE_CAPTURE_MS - state.scaleDwellMs);
  const seconds = Math.ceil(remainMs / 1000);
  if (state.scaleDwellMs <= 0) {
    // Before the dwell has begun: a setup instruction naming the chosen
    // reference, so the operator knows exactly what to place in frame.
    const name = scaleReferenceName();
    label.textContent = t('scale.frameLabel', { name: name },
      'Hold the ' + name + ' steady in the frame.');
  } else if (seconds > 0) {
    label.textContent = t('scale.frameCountdown', { seconds: seconds },
      'Hold steady... ' + seconds + 's');
  } else {
    label.textContent = t('scale.frameDone', null,
      'Reference captured -- now scan the room.');
  }
}

/**
 * Reset every scale-calibration field to its pre-step default. Called when
 * entering the scale step fresh and when starting a brand-new capture, so a
 * second scan never inherits the previous run's reference or frames.
 */
function resetScaleState() {
  state.scaleReferenceId = null;
  state.scaleSkipped = false;
  state.scaleFrames = [];
  state.scaleDwellMs = 0;
  finishScaleSubstep(); // clear any lingering timer/overlay
}

/**
 * Open the camera and start the capture flow. Shared by both scale-step exits
 * (skip / continue). When a reference was chosen it first runs the in-camera
 * scale sub-step (hold the reference in frame ~3 s), then transitions into the
 * normal room sweep. A skip goes straight to the sweep.
 */
async function beginCapture() {
  // Fire-and-forget GPU pre-warm the moment the user starts a scan, so a
  // reconstruction worker can be spinning up during the room sweep. Silently
  // tolerates 404 (endpoint rolling out in parallel) and never blocks.
  if (!_demoMode()) prewarmCaptureSession(API_BASE, _getAuthToken());

  // Request the DeviceOrientation + DeviceMotion permissions FIRST, while we
  // are still inside the capture button's user-gesture task (iOS 13+ requires
  // that). Both calls are issued synchronously in the same gesture: on iOS
  // they map to the SAME underlying "Motion & Orientation" grant, so the user
  // sees a single prompt that unlocks both the coverage ring
  // (deviceorientation) and the per-frame IMU metadata (devicemotion). Await
  // them so the motion prompt and the camera prompt are sequential, not
  // overlapping — simultaneous permission prompts can conflict or be silently
  // rejected on iOS Safari. The listeners are attached later in
  // startCoverageTracking() / startSensorCapture(); if the user denies, the
  // coverage ring stays hidden and the IMU fields stay null.
  const motionPermission = ensureMotionPermission();
  await ensureOrientationPermission();
  await motionPermission;
  const ok = await requestCamera();
  if (!ok) return; // requestCamera() already surfaced the error screen
  showPhase(Phase.CAPTURE);

  if (state.scaleReferenceId && !state.scaleSkipped) {
    // In-camera scale sub-step first -- grab dedicated frames of the reference.
    await runScaleSubstep();
    // The user may have cancelled out of the camera during the sub-step.
    if (state.phase !== Phase.CAPTURE) return;
  }

  startCaptureLoop();
}

// ============================================================================
// Camera + guided capture
// ============================================================================


async function requestCamera() {
  // Guard: navigator.mediaDevices is undefined in non-secure contexts (plain
  // HTTP) and on older browsers; reaching .getUserMedia on it would throw a
  // TypeError before our catch block could classify the failure.
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showError({
      key: 'error.cameraUnsupported',
      fallback: 'Camera capture is not supported in this browser, or the ' +
        'page is not served over HTTPS.',
    });
    return false;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    });
    state.mediaStream = stream;
    const video = $('camera-video');
    video.srcObject = stream;
    await video.play().catch(() => {});
    return true;
  } catch (err) {
    const detail = err && err.message ? err.message : String(err);
    if (err && err.name === 'NotAllowedError') {
      showError({
        key: 'error.cameraDenied',
        fallback: 'Camera permission was denied. Enable it in your browser ' +
          'settings to capture a room.',
      });
    } else {
      showError({
        key: 'error.cameraAccess',
        params: { detail: detail },
        fallback: 'Could not access the camera: ' + detail,
      });
    }
    return false;
  }
}

function stopCamera() {
  if (state.mediaStream) {
    state.mediaStream.getTracks().forEach((t) => t.stop());
    state.mediaStream = null;
  }
}

// English fallback hints — used only if the locale layer is unavailable.
const HINTS_FALLBACK = [
  'Pan slowly across the room from one corner.',
  'Walk the perimeter, keeping the walls in frame.',
  'Move in close on furniture and objects.',
  'Tilt up and down to catch the ceiling and floor.',
  'Great coverage — tap Finish capture when ready.',
];

/** Live capture hints for the active locale (capture.hints array). */
function getHints() {
  const h = tRaw('capture.hints', HINTS_FALLBACK);
  return Array.isArray(h) && h.length ? h : HINTS_FALLBACK;
}

let coverageTimer = null;

function startCaptureLoop() {
  stopCaptureLoop();   // clear any prior interval before starting a fresh one
  state.coverage = 0;
  state.capturedFrames = [];
  // Lane A: fresh per-frame sensor bookkeeping for this sweep. The camera
  // settings are snapshotted NOW, while the track is live — after stopCamera()
  // getSettings() returns {} and the intrinsics hints would be lost.
  state.frameMeta = [];
  state.captureT0 = performance.now();
  state.cameraSnapshot = snapshotCameraSettings(state.mediaStream);
  state.pendingFrameBlobs = 0;
  startSensorCapture();
  updateCoverage(0);
  // Reveal the live capture status (real frame counter + directional coverage)
  // and start tracking camera orientation for the coverage ring.
  const statusEl = $('capture-status');
  if (statusEl) statusEl.hidden = false;
  updateCaptureProgress();
  startCoverageTracking();
  $('btn-finish-capture').disabled = true;

  // Heuristic coverage tick. Real impl: SLAM/pose-spread from the frames.
  // This stub advances steadily so all guidance states are exercised; each
  // tick also grabs a real keyframe so there is genuine footage to upload.
  coverageTimer = setInterval(() => {
    state.coverage = Math.min(1, state.coverage + 0.04 + Math.random() * 0.02);
    captureKeyframe();
    updateCoverage(state.coverage);
    updateCaptureProgress(); // surface the real, growing keyframe count
    if (state.coverage >= 0.6) $('btn-finish-capture').disabled = false;
    if (state.coverage >= 1) stopCaptureLoop();
  }, 400);
}

function stopCaptureLoop() {
  if (coverageTimer) { clearInterval(coverageTimer); coverageTimer = null; }
  stopCoverageTracking(); // detach the deviceorientation listener
  stopSensorCapture();    // detach the IMU (devicemotion/orientation) listeners
}

// Offscreen canvas reused for every keyframe grab.
const _keyframeCanvas = document.createElement('canvas');

/**
 * Grab a frame from the live video as a downscaled JPEG blob and queue it for
 * upload. Capped at MAX_KEYFRAMES so a long scan cannot bloat the upload.
 */
function captureKeyframe() {
  const video = $('camera-video');
  if (!video || !video.videoWidth) return;
  if (state.capturedFrames.length >= MAX_KEYFRAMES) return;

  const longEdge = Math.max(video.videoWidth, video.videoHeight);
  const scale = Math.min(1, KEYFRAME_MAX_EDGE / longEdge);
  const w = Math.round(video.videoWidth * scale);
  const h = Math.round(video.videoHeight * scale);
  _keyframeCanvas.width = w;
  _keyframeCanvas.height = h;
  const ctx = _keyframeCanvas.getContext('2d');
  if (!ctx) return;
  ctx.drawImage(video, 0, 0, w, h);
  // Lane A: snapshot the sensor record at drawImage() time — NOT in the async
  // toBlob callback — so the IMU sample matches the pixels. toBlob is async:
  // stash the current buckets so a late-arriving blob lands in the sweep it
  // was grabbed for (mirrors the scale-keyframe guard), and push blob+record
  // in the SAME callback so frameMeta[i] always describes capturedFrames[i]
  // (and therefore the uploaded `frame_<i>.jpg`).
  const record = sensorFrameRecord(state.captureT0);
  state.uploadedFrameSize = { width: w, height: h }; // what the worker's SfM sees
  const targetFrames = state.capturedFrames;
  const targetMeta = state.frameMeta;
  state.pendingFrameBlobs++; // drained by awaitPendingFrameBlobs() pre-upload
  _keyframeCanvas.toBlob(
    (blob) => {
      state.pendingFrameBlobs = Math.max(0, state.pendingFrameBlobs - 1);
      if (blob && targetFrames.length < MAX_KEYFRAMES) {
        targetFrames.push(blob);
        targetMeta.push(record);
      }
    },
    'image/jpeg',
    0.72
  );
}

/**
 * Wait for in-flight toBlob() keyframe conversions to settle before the
 * upload snapshots state.capturedFrames. toBlob is async, so the frame
 * grabbed on the last interval tick before "Finish capture" may still be
 * compressing when the tap lands — without this drain that trailing frame
 * (and its frameMeta record) would be silently dropped from the upload.
 * Bounded: a callback that never fires (defensive — not an observed browser
 * behavior) only delays the upload by maxWaitMs, never wedges it.
 *
 * @param {number} maxWaitMs hard cap on the drain wait
 * @returns {Promise<void>}
 */
function awaitPendingFrameBlobs(maxWaitMs = 1500) {
  if (!state.pendingFrameBlobs) return Promise.resolve();
  const deadline = performance.now() + maxWaitMs;
  return new Promise((resolve) => {
    const tick = () => {
      if (!state.pendingFrameBlobs || performance.now() >= deadline) resolve();
      else setTimeout(tick, 25);
    };
    tick();
  });
}

function updateCoverage(coverage) {
  const pct = Math.round(coverage * 100);
  $('coverage-fill').style.width = pct + '%';
  $('coverage-label').textContent = t('capture.coverage', { pct: pct }, 'Coverage ' + pct + '%');

  const hints = getHints();
  const stepIdx = Math.min(hints.length - 1, Math.floor(coverage * (hints.length - 1)));
  $('capture-hint').textContent = hints[stepIdx];
  const steps = document.querySelectorAll('#guide-steps li');
  steps.forEach((li, i) => {
    li.classList.toggle('done', i < stepIdx);
    li.classList.toggle('active', i === stepIdx && stepIdx < steps.length);
  });
}

// ============================================================================
// Live capture feedback — real frame counter + directional coverage guidance
// ============================================================================
// Two HONEST, additive signals shown during the room sweep, layered on top of
// the existing (heuristic) coverage bar:
//
//   1. Frame counter — the REAL number of keyframes queued for upload
//      (state.capturedFrames.length), with a red/yellow/green quality tier:
//      red < 10, yellow 10-19, green 20+ (the "good coverage" goal).
//
//   2. Directional coverage — which yaw sectors the camera has actually swept,
//      derived from real DeviceOrientation events. The ring AND its directional
//      hints appear ONLY once usable orientation data has arrived, so a device
//      with no motion sensor (or with the permission denied) never sees a
//      fabricated direction — the frame counter still works on its own. This
//      keeps the feature within the honesty rule: no invented signal.

const FRAME_TARGET = 20;            // "good coverage" keyframe goal (quality tiers)
const COVERAGE_SECTORS = 8;         // 8 yaw sectors of 45° each
const SECTOR_DEG = 360 / COVERAGE_SECTORS;

// Module-local coverage-tracking state — purely UI, kept out of `state`.
let _coveredSectors = new Set();    // sector indices 0..7 the camera has faced
let _currentSector = null;          // sector the camera faces right now
let _lastPaintedSector = null;      // last sector we repainted the ring for
let _orientationActive = false;     // true once a usable orientation event landed
let _headingSense = 1;              // +1 compass (CW heading), -1 alpha (CCW)
let _onDeviceOrientation = null;    // bound listener, for clean removal

/**
 * Frame counter — render the REAL queued-keyframe count with its quality tier.
 * Called every capture tick and on a locale switch (relocalizeDynamic).
 */
function updateCaptureProgress() {
  const counter = $('frame-counter');
  const countEl = $('frame-count');
  const targetEl = $('frame-target');
  const qualEl = $('frame-quality');
  const n = state.capturedFrames.length;
  if (countEl) countEl.textContent = String(n);
  if (targetEl) {
    targetEl.textContent =
      '/' + FRAME_TARGET + ' ' + t('capture.framesUnit', null, 'frames');
  }
  if (counter) {
    // red < 10, yellow 10-19, green 20+ .
    counter.classList.toggle('q-low', n < 10);
    counter.classList.toggle('q-mid', n >= 10 && n < FRAME_TARGET);
    counter.classList.toggle('q-good', n >= FRAME_TARGET);
  }
  if (qualEl) {
    qualEl.textContent = n >= FRAME_TARGET
      ? t('capture.goodCoverage', null, 'Good coverage!')
      : t('capture.keepScanning', null, 'Keep scanning…');
  }
}

/** Compass-style heading (deg, 0..360) from an orientation event, or null. */
function _headingFromEvent(e) {
  // iOS exposes a true compass heading; elsewhere `alpha` is the yaw. Alpha's
  // zero may be arbitrary, but the RELATIVE sweep across sectors is all we need.
  let h = (typeof e.webkitCompassHeading === 'number') ? e.webkitCompassHeading
        : (typeof e.alpha === 'number') ? e.alpha : null;
  if (h === null || !Number.isFinite(h)) return null;
  return ((h % 360) + 360) % 360;
}

/** Build the 8 ring-sector <path> nodes once (idempotent). */
function buildCoverageRing() {
  const host = $('coverage-ring-sectors');
  if (!host || host.childElementCount) return; // already built
  const rIn = 24, rOut = 44, gapDeg = 3; // small gap between adjacent sectors
  const pt = (r, aDeg) => {
    const a = aDeg * Math.PI / 180;
    return `${(r * Math.sin(a)).toFixed(2)} ${(-r * Math.cos(a)).toFixed(2)}`;
  };
  for (let i = 0; i < COVERAGE_SECTORS; i++) {
    const a0 = i * SECTOR_DEG + gapDeg;
    const a1 = (i + 1) * SECTOR_DEG - gapDeg;
    const large = (a1 - a0) > 180 ? 1 : 0;
    const d = `M${pt(rOut, a0)} A${rOut} ${rOut} 0 ${large} 1 ${pt(rOut, a1)} ` +
              `L${pt(rIn, a1)} A${rIn} ${rIn} 0 ${large} 0 ${pt(rIn, a0)} Z`;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('class', 'ring-sector');
    path.dataset.sector = String(i);
    host.appendChild(path);
  }
}

/** Repaint the ring's sector fills + the directional hint from covered set. */
function updateCoverageRing() {
  const ring = $('coverage-ring');
  if (!ring) return;
  // Honesty gate: with no real orientation data we keep the ring hidden so a
  // direction is never fabricated.
  if (!_orientationActive) { ring.hidden = true; return; }
  ring.hidden = false;
  buildCoverageRing();
  document.querySelectorAll('#coverage-ring-sectors .ring-sector').forEach((p) => {
    const i = Number(p.dataset.sector);
    p.classList.toggle('covered', _coveredSectors.has(i));
    p.classList.toggle('current', i === _currentSector);
  });
  const hintEl = $('coverage-ring-hint');
  if (hintEl) hintEl.textContent = _coverageHint();
}

/** Directional text hint toward the nearest uncovered sector. */
function _coverageHint() {
  if (_coveredSectors.size >= COVERAGE_SECTORS) {
    return t('capture.coverageComplete', null, 'All around — great coverage!');
  }
  if (_currentSector === null) return '';
  // Nearest uncovered sector by signed sector distance in (-4 .. 4].
  let best = null, bestAbs = Infinity;
  for (let i = 0; i < COVERAGE_SECTORS; i++) {
    if (_coveredSectors.has(i)) continue;
    let d = i - _currentSector;
    while (d > COVERAGE_SECTORS / 2) d -= COVERAGE_SECTORS;
    while (d <= -COVERAGE_SECTORS / 2) d += COVERAGE_SECTORS;
    if (Math.abs(d) < bestAbs) { bestAbs = Math.abs(d); best = d; }
  }
  if (best === null) return '';
  if (bestAbs >= COVERAGE_SECTORS / 2) {
    return t('capture.turnAround', null, 'Turn around to cover the other side');
  }
  // Physical clockwise rotation = "turn right". Compass heading increases
  // clockwise (_headingSense +1); raw alpha increases counter-clockwise
  // (_headingSense -1), so multiply the sector delta by the sense to get the
  // real-world turn direction.
  return (_headingSense * best) > 0
    ? t('capture.turnRight', null, 'Try turning right')
    : t('capture.turnLeft', null, 'Try turning left');
}

/** DeviceOrientation handler: map heading -> sector, mark covered, repaint. */
function _handleOrientation(e) {
  const h = _headingFromEvent(e);
  if (h === null) return;
  _headingSense = (typeof e.webkitCompassHeading === 'number') ? 1 : -1;
  const sector = Math.floor(h / SECTOR_DEG) % COVERAGE_SECTORS;
  const first = !_orientationActive;
  _orientationActive = true;
  // deviceorientation fires ~60 Hz; only update the covered set + repaint when
  // the faced sector actually changes — _currentSector, _coveredSectors and the
  // directional hint only change on a sector-boundary crossing, so the writes
  // on every intervening event are redundant.
  if (first || sector !== _lastPaintedSector) {
    _currentSector = sector;
    _coveredSectors.add(sector);
    _lastPaintedSector = sector;
    updateCoverageRing();
  }
}

/**
 * Ask for the DeviceOrientation permission (iOS 13+ gates the sensor behind a
 * user-gesture prompt). Returns a promise that resolves to 'granted'/'denied';
 * platforms without the gate resolve 'granted'. Best-effort — a denial just
 * leaves the ring hidden.
 */
function ensureOrientationPermission() {
  try {
    const DOE = typeof window !== 'undefined' && window.DeviceOrientationEvent;
    if (DOE && typeof DOE.requestPermission === 'function') {
      return DOE.requestPermission().catch(() => 'denied');
    }
  } catch (e) { /* ignore — no gating here */ }
  return Promise.resolve('granted');
}

/** Begin directional-coverage tracking for a fresh capture. */
function startCoverageTracking() {
  _coveredSectors = new Set();
  _currentSector = null;
  _lastPaintedSector = null;
  _orientationActive = false;
  _headingSense = 1;
  updateCoverageRing(); // stays hidden until the first real event arrives
  if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) return;
  _onDeviceOrientation = _handleOrientation;
  // Attach regardless of the permission result: if it was denied the event
  // simply never fires and the ring stays hidden (honest — no fake direction).
  window.addEventListener('deviceorientation', _onDeviceOrientation);
}

/** Stop directional-coverage tracking and detach the listener. */
function stopCoverageTracking() {
  if (_onDeviceOrientation) {
    window.removeEventListener('deviceorientation', _onDeviceOrientation);
    _onDeviceOrientation = null;
  }
  _orientationActive = false;
}

// ============================================================================
// Upload — POST /api/v1/capture  (live)
// ============================================================================

/**
 * Read a stored access token from localStorage if the user is signed in.
 *
 * The PWA can be reached from accounts created on rakuai.com (which uses
 * ``raku_access_token`` as the canonical key) or from Phase I5b's in-app
 * sign-in surface (which may use a Raku-Capture-specific key, named in
 * task #145). This helper checks both so a future rename does not silently
 * regress to anonymous uploads. ``raku_access_token`` is preferred since
 * it's the site-wide standard (js/auth-nav.js, js/upgrade-flow.js, etc.).
 *
 * Returns null when not signed in or when localStorage is unavailable
 * (private mode); the caller treats null as anonymous and accepts the
 * lower rate-limit tier.
 *
 * Why we read this BEFORE the upload XHR: /api/v1/capture is rate-limited
 * per-tier (anonymous 3/day, free 10/day, pro 100/day). Without this
 * header, every authenticated user falls into the anonymous bucket and
 * trips the cap during normal use.
 *
 * Expired-token guard: an old logged-out JWT lingering under one of the
 * candidate keys would otherwise be sent and rejected with 401 by the
 * backend, blocking the upload entirely. We parse the JWT payload and
 * skip any token whose ``exp`` claim is in the past, so the caller falls
 * back to anonymous (and gets a working — if rate-limited — flow).
 */
function _isJwtExpired(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;  // not a JWT shape; let server decide
    let payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (payload.length % 4) payload += '=';
    const decoded = JSON.parse(atob(payload));
    if (decoded && typeof decoded.exp === 'number') {
      // Treat anything within 30s of expiry as already expired so we don't
      // race a request to the wire and get a 401 for a token that lapsed
      // between the check and the fetch.
      return Date.now() >= (decoded.exp * 1000) - 30_000;
    }
  } catch (e) {
    // Opaque token / corrupted base64 — let the server decide rather than
    // discarding a token that might be valid.
  }
  return false;
}

function _getAuthToken() {
  try {
    if (typeof localStorage === 'undefined') return null;
    // raku_access_token is the site-wide canonical key (rakuai.com login).
    // The other keys are alternatives the Phase I5b / I15 sign-in surface
    // may use; they exist as forward-compat hooks.
    const keys = [
      'raku_access_token',
      'raku_auth_token',
      'rakuai_jwt',
      'rakuai_access_token',
      'raku_jwt',
      'rakuCaptureJwt',
    ];
    for (const k of keys) {
      const v = localStorage.getItem(k);
      if (v && v.length > 16) {
        const token = v.trim();
        if (_isJwtExpired(token)) continue;  // try the next candidate key
        return token;
      }
    }
  } catch (e) {
    // localStorage blocked (Safari private mode etc.) - treat as anonymous.
  }
  return null;
}

/**
 * Upload captured keyframes to the reconstruction service.
 *
 * @param {Blob[]} frames captured JPEG keyframes
 * @param {(pct:number)=>void} onProgress 0..1 upload progress
 * @returns {Promise<string>} captureId
 */
function uploadCapture(frames, onProgress) {
  return new Promise((resolve, reject) => {
    // Booth demo mode (?demo=) must NEVER call the capture API. The demo flow
    // does not route here, but if it somehow did, fail loudly and honestly
    // rather than uploading anything (CLAUDE.md: fake success is forbidden).
    if (_demoMode()) {
      reject(new Error(t('demo.noLiveCapture', null,
        'Demo mode: live capture and reconstruction are disabled — nothing was uploaded.')));
      return;
    }
    if (!frames || !frames.length) {
      reject(new Error(t('error.noFrames', null,
        'No frames were captured — try scanning the room again.')));
      return;
    }
    const form = new FormData();
    frames.forEach((blob, i) => form.append('frames', blob, `frame_${i}.jpg`));

    // Metric-scale calibration: the dedicated reference frames (if any) ride
    // alongside the room frames so the backend solver can find the reference.
    // They are named scale_* so they are identifiable, and counted in the
    // scaleReference metadata below.
    const scaleFrames = state.scaleFrames || [];
    scaleFrames.forEach((blob, i) =>
      form.append('frames', blob, `scale_${i}.jpg`));

    // buildScaleMetadata() (scale_calibration.js) produces the scaleReference
    // object: which known-size reference the user picked + its exact
    // real-world dimensions, OR a skipped marker. The reconstruction backend
    // reads this to resolve real metric scale — that solve is a backend step,
    // not done here (see scale_calibration.js header).
    const scaleReference = buildScaleMetadata({
      referenceId: state.scaleReferenceId,
      skipped: state.scaleSkipped,
      frameCount: scaleFrames.length,
      dwellMs: state.scaleDwellMs,
    });

    // Lane A: per-frame sensor metadata (timestamps, IMU samples, best-effort
    // intrinsics) rides alongside the frames as its own multipart part,
    // `capture_metadata.json`. The schema is the cross-lane contract with the
    // capture endpoint + recon worker (see sensor_metadata.js header) — the
    // worker joins frames[].filename to the `frame_<i>.jpg` parts above to
    // skip/constrain COLMAP. Only ROOM frames are described; the scale_<i>.jpg
    // reference frames are deliberately excluded (they are a different,
    // hold-still sub-step — their IMU data carries no sweep information).
    // FastAPI ignores unknown multipart fields, so this is safe to send even
    // before the server consumes it.
    let sensorMetadata = null;
    try {
      sensorMetadata = buildCaptureMetadata({
        frameCount: frames.length,
        frameRecords: state.frameMeta,
        cameraSettings: state.cameraSnapshot,
        uploadedFrameSize: state.uploadedFrameSize,
      });
      form.append(
        'capture_metadata',
        new Blob([JSON.stringify(sensorMetadata)], { type: 'application/json' }),
        METADATA_FILENAME
      );
    } catch (err) {
      // Sensor metadata must NEVER break an upload — frames alone still work.
      console.warn('[RakuCapture] sensor metadata build failed:', err);
      sensorMetadata = null;
    }

    form.append(
      'meta',
      JSON.stringify({
        device: navigator.userAgent,
        compute_backend: _getComputeBackend(),
        // frameCount reports every part appended to the `frames` field —
        // room frames PLUS the scale-reference frames — so it matches what
        // the backend actually receives. roomFrameCount / scaleReference
        // break that total down for anything that needs the split.
        frameCount: frames.length + scaleFrames.length,
        roomFrameCount: frames.length,
        coverage: state.coverage,
        scaleReference: scaleReference,
        // Advisory flag: a capture_metadata.json part is attached (lets the
        // server branch without sniffing the multipart body).
        hasSensorMetadata: sensorMetadata !== null,
      })
    );

    // XHR (not fetch) so the progress bar reflects real upload progress.
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/api/v1/capture`);
    // Authenticated users get the free/pro tier rate-limit bucket;
    // anonymous users keep falling under the 3/day cap. The header is
    // simply omitted when no token is stored so existing anonymous
    // capture flows still work unchanged.
    const _authToken = _getAuthToken();
    if (_authToken) {
      xhr.setRequestHeader('Authorization', `Bearer ${_authToken}`);
    }
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          if (onProgress) onProgress(1);
          resolve(data.capture_id);
        } catch (err) {
          reject(new Error(t('error.uploadUnreadable', null,
            'Upload succeeded but the response was unreadable.')));
        }
      } else {
        let detail = t('error.uploadFailedHttp', { status: xhr.status },
          `Upload failed (HTTP ${xhr.status}).`);
        try { detail = JSON.parse(xhr.responseText).detail || detail; } catch (e) {}
        reject(new Error(detail));
      }
    };
    xhr.onerror = () => reject(new Error(t('error.uploadNetwork', null,
      'Network error during upload.')));
    xhr.send(form);
  });
}

// ============================================================================
// Reconstruction polling — GET /api/v1/capture/{id}/status  (live)
// ============================================================================

/**
 * Poll the reconstruction job until a splat asset is ready.
 *
 * @param {string} captureId
 * @param {(stage:string, pct:number)=>void} onProgress
 * @param {()=>boolean} shouldAbort polled each loop; stops cleanly when true
 * @returns {Promise<string|null>} splat URL, or null if aborted/cancelled
 */
async function pollReconstruction(captureId, onProgress, shouldAbort) {
  // Demo mode never has a live reconstruction job — refuse loudly (see
  // uploadCapture's matching guard) instead of polling the API.
  if (_demoMode()) {
    throw new Error(t('demo.noLiveCapture', null,
      'Demo mode: live capture and reconstruction are disabled — nothing was uploaded.'));
  }
  const POLL_MS = 2000;
  // CPU SfM on big scenes can legitimately take 20+ min. Set the ceiling at
  // 30 min so the client doesn't kill a job that is still making progress.
  // The server enforces its own job timeout; this is just the client patience.
  const MAX_MS = 30 * 60 * 1000;
  const MAX_CONSECUTIVE_FAILURES = 5;
  // After 10 min, surface a "still working" hint via the progress label so
  // the user knows the long wait is expected, not a hang.
  const SLOW_HINT_MS = 10 * 60 * 1000;
  const started = performance.now();
  let consecutiveFailures = 0;

  while (performance.now() - started < MAX_MS) {
    if (shouldAbort && shouldAbort()) return null;

    let job = null;
    let gone = false;
    try {
      const resp = await fetch(`${API_BASE}/api/v1/capture/${captureId}/status`);
      if (resp.ok) {
        job = await resp.json();
        consecutiveFailures = 0;
      } else if (resp.status === 404) {
        gone = true;
      } else {
        consecutiveFailures += 1;
      }
    } catch (err) {
      consecutiveFailures += 1;
    }

    if (shouldAbort && shouldAbort()) return null;

    if (job) {
      if (job.status === 'ready') {
        if (onProgress) onProgress('reconstructing', 1);
        return job.splat_url;
      }
      if (job.status === 'failed') {
        // Tag this as the *terminal* reconstruction failure (the server itself
        // reported it failed) so callers persist FAILED only here -- never for
        // the transient 'lost contact' / timeout throws below, which would
        // otherwise re-render as a stale failure next visit.
        const failure = new Error(job.error || t('error.reconstructionFailed',
          null, 'Reconstruction failed.'));
        failure.code = RECON_FAILED_CODE;
        throw failure;
      }
      if (job.status === 'cancelled') {
        return null; // user cancelled — handled quietly, not an error
      }
      // queued | analyzing | reconstructing — pass the status through verbatim
      // so the user-facing "Queued" stage can render (applyProcessingLabels()
      // owns the queued -> first-step mapping). Previously this collapsed
      // 'queued' into 'analyzing' here, making the queued stage unreachable.
      const stage = job.status;
      const elapsed = performance.now() - started;
      // The slow-hint message is set on state so the label renderer can pick
      // it up; the server's job is fine, we just want the user to know.
      state.procSlowHint = elapsed > SLOW_HINT_MS;
      if (onProgress) onProgress(stage, job.progress || 0);
    } else if (gone || consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      throw new Error(t('error.reconstructionLostContact', null,
        'Lost contact with the reconstruction job.'));
    }

    await delay(POLL_MS);
  }
  throw new Error(t('error.reconstructionTimeout', null, 'Reconstruction timed out.'));
}

/** Best-effort cancellation of an in-flight reconstruction job. */
function cancelReconstruction(captureId) {
  if (!captureId || _demoMode()) return; // demo mode never touches the API
  fetch(`${API_BASE}/api/v1/capture/${captureId}`, { method: 'DELETE' }).catch(() => {});
}

// ============================================================================
// Spark splat viewer — interactive orbit/zoom camera (W1.3)
// ============================================================================

/**
 * Load the reconstructed splat with the Spark renderer and an interactive
 * orbit camera. Falls back to a labelled placeholder if the Spark/three CDN
 * modules are unreachable, so the READY state is always observable.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {string} splatUrl .spz/.sog asset URL on cdn.raku.games
 * @returns {Promise<()=>void>} teardown — stops the render loop + listeners
 */
async function loadSplatViewer(canvas, splatUrl, trackStatus, targets, autoFocus) {
  // When trackStatus is true this is the REAL capture viewer: record the
  // viewer status in `state` so relocalizeDynamic() can re-render the toolbar
  // on a locale switch. The intro preview passes false — it must not touch the
  // capture viewer's shared status state.
  //
  // `targets` selects where the status text lands: { meta, note } elements.
  // The capture viewer omits it and gets the real toolbar nodes; the intro
  // preview passes detached stand-ins so its status text never paints on the
  // page (see loadSplatViewerInto). Passing the targets explicitly replaces
  // the old, fragile id-swap trick that mutated the DOM's element ids.
  const metaEl = (targets && targets.meta) || $('viewer-meta');
  const noteEl = (targets && targets.note) || $('viewer-note');
  function viewerStatus(status, offlineFile) {
    if (trackStatus) {
      state.viewerStatus = status;
      state.viewerOfflineFile = offlineFile || null;
    }
  }
  viewerStatus('loading');
  metaEl.textContent = t('viewer.metaLoading', null, 'Loading splat…');

  // Spherical orbit camera state, shared with the input controller.
  const cam = { theta: 0.6, phi: 1.3, radius: 2.8, autoRotate: true };

  try {
    // Lane 3C: load the CDN modules through the resilience layer — a hard
    // timeout + one retry, so a slow-but-not-failing CDN cannot hang the
    // viewer. Falls back to a plain import() if cdn_fallback.js is absent.
    const importCdn = (typeof window !== 'undefined' && window.RakuCdnFallback)
      ? window.RakuCdnFallback.loadCdnModule
      : (url) => import(/* @vite-ignore */ url);
    const THREE = await importCdn(THREE_CDN_URL, 'three');
    const spark = await importCdn(SPARK_CDN_URL, 'spark');
    const { SplatMesh } = spark;

    // preserveDrawingBuffer: WebKit/Safari clears the drawing buffer after
    // compositing, so any canvas readback (toDataURL, getImageData, drawImage)
    // returns transparent black. Enabling preserveDrawingBuffer keeps the last
    // frame in the buffer so screenshots, sharing, and automated tests can read
    // back pixel data. The minor perf cost is acceptable for a mobile PWA.
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    resizeRendererToCanvas(renderer, canvas);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);

    const splats = new SplatMesh({ url: splatUrl });
    // Splats from the COLMAP/Brush pipeline carry a Y-down, Z-forward world
    // axis (OpenCV convention), whereas three.js uses Y-up, Z-backward.
    // Rotating the splat mesh 180° about X maps the data into three.js space so
    // it renders right-side up, while the camera keeps its default up vector and
    // the orbit controls stay intuitive (no inverted horizontal drag).
    splats.rotation.x = Math.PI;
    scene.add(splats);

    // Real captures from COLMAP/Brush land at arbitrary world coordinates and
    // scale, so the fixed radius-2.8 orbit around the origin can point at empty
    // space and render black. Once the splat geometry is ready, recenter it on
    // the origin and size the orbit to fit its bounding box.
    //
    // autoFocus gates this: it runs ONLY for genuine CAPTURE results (the splat
    // came back from the reconstruction API). The intro sample and the booth
    // demo samples are curated public splats already centred at the origin and
    // sized for the hardcoded radius-2.8 orbit — recentering/refitting them
    // pushes the camera far out and renders them tiny (PR #1610 regression). So
    // those paths pass autoFocus=false and keep the known-good default framing.
    if (autoFocus) splats.initialized.then(() => {
      if (!running) return; // viewer torn down before the geometry was ready
      const box = splats.getBoundingBox(false);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      // Guard non-finite bounds: empty or degenerate geometry yields Infinity,
      // which would poison cam.radius/position with NaN and freeze the camera
      // (Math.min/max propagate NaN). On bad bounds we keep the default framing.
      if (Number.isFinite(center.x) && Number.isFinite(center.y) && Number.isFinite(center.z)) {
        // rotation.x = π negates local Y,Z — cancel centroid accordingly
        splats.position.set(-center.x, center.y, center.z);
      }
      const maxDim = Math.max(size.x, size.y, size.z);
      const fit = (maxDim / 2) / Math.tan((camera.fov * Math.PI / 180) / 2);
      if (Number.isFinite(fit) && fit > 0) {
        cam.radius = fit * 1.6;
        cam.minRadius = fit * 0.4;
        cam.maxRadius = fit * 4;
      }
    }).catch(() => { /* keep default framing */ });

    const onResize = () => resizeRendererToCanvas(renderer, canvas);
    window.addEventListener('resize', onResize);
    const detachControls = attachViewerControls(canvas, cam);

    let running = true;
    (function frame() {
      if (!running) return; // teardown stops the loop
      if (cam.autoRotate) cam.theta += 0.0016;
      cam.phi = Math.max(0.18, Math.min(Math.PI - 0.18, cam.phi));
      const lo = cam.minRadius || 0.7, hi = cam.maxRadius || 8;
      cam.radius = Math.max(lo, Math.min(hi, cam.radius));

      const sinPhi = Math.sin(cam.phi);
      camera.aspect = (canvas.clientWidth || 1) / (canvas.clientHeight || 1);
      camera.position.set(
        cam.radius * sinPhi * Math.sin(cam.theta),
        cam.radius * Math.cos(cam.phi),
        cam.radius * sinPhi * Math.cos(cam.theta)
      );
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
      requestAnimationFrame(frame);
    })();

    viewerStatus('controls');
    noteEl.hidden = true;
    metaEl.textContent =
      t('viewer.metaControls', null, 'Drag to orbit · scroll or pinch to zoom');

    return () => {
      running = false;
      window.removeEventListener('resize', onResize);
      detachControls();
      try { renderer.dispose(); } catch (e) { /* best effort */ }
    };
  } catch (err) {
    // Lane 3C: a Spark/three CDN miss (or any viewer-init failure) degrades
    // here. The hardened fallback in cdn_fallback.js draws the labelled 2D
    // placeholder and writes a clear, localized offline message — never a
    // broken canvas, never a hang. If cdn_fallback.js is somehow absent we
    // still draw the inline placeholder so READY stays observable.
    console.warn('[RakuCapture] Spark viewer unavailable, using placeholder:', err);
    let offlineFile = splatUrl.split('/').pop() || splatUrl;
    // Use the outer-scope metaEl/noteEl (resolved from `targets` at the top
    // of loadSplatViewer) so the intro preview's detached stand-in nodes
    // receive the status text instead of bleeding into the capture viewer's
    // real #viewer-meta / #viewer-note. Fixes a bug where the fallback path
    // re-queried the page DOM and shadowed the outer bindings.
    if (typeof window !== 'undefined' && window.RakuCdnFallback) {
      const r = window.RakuCdnFallback.renderViewerFallback({
        canvas: canvas,
        splatUrl: splatUrl,
        reason: err,
        metaEl: metaEl,
        noteEl: noteEl,
        strings: {
          placeholder: t('viewer.placeholderCaption', null,
            'splat preview placeholder'),
          metaReady: t('viewer.metaReadyPlaceholder', null,
            'Splat ready (placeholder)'),
          noteOffline: (file) => t('viewer.noteOffline', { file: file },
            'Spark viewer offline — placeholder for ' + file),
        },
      });
      offlineFile = r.offlineFile;
    } else {
      // Defensive last resort — the resilience module did not load.
      drawViewerPlaceholder(canvas, splatUrl);
      if (noteEl) {
        noteEl.hidden = false;
        noteEl.textContent =
          t('viewer.noteOffline', { file: offlineFile },
            'Spark viewer offline — placeholder for ' + offlineFile);
      }
      if (metaEl) {
        metaEl.textContent =
          t('viewer.metaReadyPlaceholder', null, 'Splat ready (placeholder)');
      }
    }
    viewerStatus('placeholder', offlineFile);
    return () => {}; // nothing to tear down for the static placeholder
  }
}

/**
 * Pointer/touch/wheel orbit + zoom controller for the viewer canvas.
 * @returns {()=>void} detach — removes every listener it added
 */
function attachViewerControls(canvas, cam) {
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let pinchDist = 0;
  let idleTimer = null;

  // Pause the idle auto-rotate while the user interacts; resume after 4 s.
  function pause() {
    cam.autoRotate = false;
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { cam.autoRotate = true; }, 4000);
  }

  const onPointerDown = (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    pause();
    if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!dragging || pinchDist) return; // ignore single-pointer drag mid-pinch
    cam.theta -= (e.clientX - lastX) * 0.008;
    cam.phi -= (e.clientY - lastY) * 0.008;
    lastX = e.clientX;
    lastY = e.clientY;
    pause();
  };
  const endDrag = () => { dragging = false; };
  const onWheel = (e) => {
    e.preventDefault();
    cam.radius *= e.deltaY > 0 ? 1.1 : 0.9;
    pause();
  };
  const onTouchMove = (e) => {
    if (e.touches.length !== 2) return;
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const dist = Math.hypot(dx, dy);
    if (pinchDist) {
      cam.radius *= pinchDist / dist;
      pause();
    }
    pinchDist = dist;
  };
  const onTouchEnd = () => { pinchDist = 0; };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('touchmove', onTouchMove, { passive: true });
  canvas.addEventListener('touchend', onTouchEnd);

  return () => {
    if (idleTimer) clearTimeout(idleTimer);
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', endDrag);
    canvas.removeEventListener('pointercancel', endDrag);
    canvas.removeEventListener('wheel', onWheel);
    canvas.removeEventListener('touchmove', onTouchMove);
    canvas.removeEventListener('touchend', onTouchEnd);
  };
}

function resizeRendererToCanvas(renderer, canvas) {
  const w = canvas.clientWidth || canvas.parentElement.clientWidth;
  const h = canvas.clientHeight || canvas.parentElement.clientHeight;
  renderer.setSize(w, h, false);
}

/** Minimal 2D placeholder so the READY state renders without Spark/three. */
function drawViewerPlaceholder(canvas, splatUrl) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 320;
  const h = canvas.clientHeight || 240;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  ctx.fillStyle = '#05050a';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 600; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const r = Math.random() * 2 + 0.4;
    ctx.fillStyle = `hsla(${250 + Math.random() * 40}, 70%, ${50 + Math.random() * 30}%, 0.7)`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#7a7a9a';
  ctx.font = '13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(t('viewer.placeholderCaption', null, 'splat preview placeholder'), w / 2, h - 18);
}

// ============================================================================
// W1.4 — SuperSplat "Clean up" affordance
// ============================================================================

/**
 * Open the current splat in the SuperSplat editor so the user can trim
 * floaters / crop the scan. SuperSplat (https://superspl.at/editor) is the
 * MIT-licensed browser splat editor named in the build plan (§4).
 *
 * HONEST behaviour — no auto-trim is performed here:
 *   - .ply splats: SuperSplat's documented `?load=<url>` deep-link is used, so
 *     the editor opens with the splat already loaded.
 *   - .spz / other: SuperSplat's `?load=` is documented for .ply only, so we
 *     open the editor and copy the splat URL to the clipboard, showing a hint
 *     telling the user to paste / drag it in. The actual trimming happens in
 *     SuperSplat, by the user.
 *
 * @param {string} splatUrl the .spz/.sog/.ply asset URL to clean up
 */
function openSplatCleanup(splatUrl) {
  if (!splatUrl) return;
  const isPly = /\.ply(\?|#|$)/i.test(splatUrl);

  if (isPly) {
    // Documented SuperSplat deep-link — editor opens with the splat loaded.
    window.open(
      SUPERSPLAT_EDITOR_URL + '?load=' + encodeURIComponent(splatUrl),
      '_blank',
      'noopener'
    );
    flashViewerHint(t('cleanup.openingPly', null,
      'Opening SuperSplat with your splat loaded — trim floaters, then re-export.'));
    return;
  }

  // .spz/.sog: open the editor; copy the URL so the user can paste/drag it in.
  window.open(SUPERSPLAT_EDITOR_URL, '_blank', 'noopener');
  const tell = (ok) => {
    flashViewerHint(
      ok
        ? t('cleanup.openedCopied', null,
            'SuperSplat opened. Splat URL copied — paste or drag it into the editor to clean up.')
        : t('cleanup.openedManual', { url: splatUrl },
            'SuperSplat opened. Open this scan there to clean up:\n' + splatUrl)
    );
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(splatUrl).then(() => tell(true), () => tell(false));
  } else {
    tell(false);
  }
}

/** Briefly surface a message in the viewer toolbar's meta line. */
function flashViewerHint(message) {
  const meta = $('viewer-meta');
  if (!meta) return;
  // Snapshot the *original* status only when no flash is currently active, so
  // back-to-back flashes all restore the real status (not a preceding hint).
  if (flashViewerHint._restore === undefined) {
    flashViewerHint._restore = meta.textContent;
  }
  const restore = flashViewerHint._restore;
  meta.textContent = message;
  clearTimeout(flashViewerHint._t);
  flashViewerHint._t = setTimeout(() => {
    // Only restore if nothing else changed the line in the meantime.
    if (meta.textContent === message) meta.textContent = restore;
    flashViewerHint._restore = undefined;
  }, 6000);
}

// ============================================================================
// W1.4 — Intro live splat preview (plan §6.1 step 1)
// ============================================================================

/**
 * Fetch the sample-splat manifest. Returns the chosen sample object, or null
 * if the manifest is unreachable / malformed (the intro just stays static).
 *
 * @returns {Promise<object|null>}
 */
async function loadSampleManifest() {
  try {
    const resp = await fetch(SAMPLES_MANIFEST_URL, { cache: 'no-cache' });
    if (!resp.ok) return null;
    const data = await resp.json();
    const samples = Array.isArray(data && data.samples) ? data.samples : [];
    if (!samples.length) return null;
    const pick =
      samples.find((x) => x && x.id === data.default) || samples[0];
    return pick && pick.url ? pick : null;
  } catch (err) {
    console.warn('[RakuCapture] sample manifest unavailable:', err);
    return null;
  }
}

/**
 * Render a real public sample splat into the intro screen's preview canvas,
 * reusing the same interactive Spark viewer the finished scan uses — so a
 * visitor can drag a real 3D scene before scanning anything (plan §6.1 step 1).
 *
 * Degrades gracefully: if the manifest or the splat URL is unreachable, the
 * intro keeps its static copy and the preview panel stays hidden.
 */
async function initIntroPreview() {
  // Booth demo mode replaces the intro entirely; the stacked demo listeners
  // route INTRO-bound buttons straight back to Phase.DEMO, so skip the
  // manifest fetch the transient INTRO would otherwise kick off.
  if (_demoMode()) return;
  const panel = $('intro-preview');
  const canvas = $('intro-preview-canvas');
  if (!panel || !canvas) return; // preview is optional UI
  if (initIntroPreview._busy || state.previewTeardown) return; // already up / loading
  initIntroPreview._busy = true;

  let sample;
  try {
    sample = await loadSampleManifest();
  } finally {
    initIntroPreview._busy = false;
  }
  if (!sample) return; // no manifest → intro stays static, no broken panel
  if (state.phase !== Phase.INTRO) return; // user navigated away while loading

  panel.hidden = false;
  // Store the sample name so applyIntroCaption() can re-render the caption in
  // the active locale on a mid-flow language switch.
  state.introSampleName = sample.label || sample.id || null;
  applyIntroCaption();

  try {
    // Lane 3C: pick a reachable sample URL. As of 2026-06-07 the manifest
    // primary `url` is a VERIFIED-WORKING public host (cdn.raku.games is not
    // live yet — see samples/manifest.json plannedSelfHostUrl). resolveSampleUrl
    // returns it (probing only when a manifest entry also lists a fallbackUrl),
    // and loadSplatViewer degrades to a labelled placeholder if it is ever
    // unreachable, so the above-the-fold demo cannot 404.
    const sampleUrl = await resolveSampleUrl(sample);
    if (!sampleUrl) { panel.hidden = true; return; }
    if (state.phase !== Phase.INTRO) { panel.hidden = true; return; }
    // loadSplatViewer returns a teardown fn; it falls back to a labelled
    // placeholder if the Spark/three CDN modules are unreachable.
    const teardown = await loadSplatViewerInto(canvas, sampleUrl);
    if (state.phase !== Phase.INTRO) {
      // User navigated away while the splat was still loading — showPhase()'s
      // teardown already ran (previewTeardown was null then), so dispose now
      // rather than leaving the render loop running off-screen.
      teardown();
      panel.hidden = true;
      return;
    }
    state.previewTeardown = teardown;
  } catch (err) {
    console.warn('[RakuCapture] intro preview failed:', err);
    panel.hidden = true; // never leave a broken canvas above the fold
  }
}

/**
 * Resolve a reachable URL for a sample-splat manifest entry (Lane 3C).
 *
 * The manifest's primary `url` is the verified-working host the demo loads from
 * (cdn.raku.games self-hosting is not live yet — see samples/manifest.json).
 * A manifest entry MAY still carry an optional `fallbackUrl`; when it does, this
 * probes the primary with a lightweight ranged GET (HEAD is often blocked on
 * object stores) and returns the first URL that answers, so the landing demo
 * survives a missing or 404-ing primary. With only a primary `url` (the current
 * manifest), it is returned directly and loadSplatViewer's own placeholder
 * handles any miss.
 *
 * @param {object} sample manifest entry: { url, fallbackUrl? }
 * @returns {Promise<string|null>} a URL (null only when sample has no usable url; on probe failure the last candidate is returned UNPROBED so the viewer fallback handles the degrade)
 */
async function resolveSampleUrl(sample) {
  if (!sample || !sample.url) return null;
  const candidates = [sample.url];
  if (sample.fallbackUrl && sample.fallbackUrl !== sample.url) {
    candidates.push(sample.fallbackUrl);
  }
  for (let i = 0; i < candidates.length; i++) {
    const url = candidates[i];
    // The last candidate is returned unprobed: if everything we tried is
    // unreachable, hand back the final URL anyway and let loadSplatViewer's
    // own fallback draw the labelled placeholder rather than hiding the panel
    // on a transient probe failure.
    if (i === candidates.length - 1) return url;
    let timer = null;
    try {
      const ctrl = new AbortController();
      timer = setTimeout(() => ctrl.abort(), 6000);
      const resp = await fetch(url, {
        method: 'GET',
        headers: { Range: 'bytes=0-0' },
        signal: ctrl.signal,
        cache: 'no-store',
      });
      // Drain the response body — if the origin ignored the Range header
      // and replied 200 with the full body (~30 MB for a real splat), this
      // releases the stream so the browser doesn't continue downloading.
      // Fire-and-forget: don't await — the cancel is a hint to the browser
      // and adds no useful latency to the probe. The .catch() swallows
      // environments where resp.body is absent or not a cancellable stream.
      resp.body?.cancel().catch(() => { /* best-effort */ });
      if (resp.ok || resp.status === 206) return url;
      console.warn('[RakuCapture] sample URL not reachable (' +
        resp.status + '), trying fallback:', url);
    } catch (err) {
      console.warn('[RakuCapture] sample URL probe failed, trying fallback:',
        url, err && err.message ? err.message : err);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  return null;
}

/**
 * Thin wrapper around loadSplatViewer for the intro canvas. loadSplatViewer
 * writes status into the capture viewer's #viewer-meta / #viewer-note nodes;
 * for the intro we don't want those touched, so we pass detached stand-in
 * nodes as the `targets` arg. No element ids are mutated, so the toolbar's
 * #viewer-meta / #viewer-note stay intact for the real capture viewer.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {string} url
 * @returns {Promise<()=>void>} teardown
 */
async function loadSplatViewerInto(canvas, url) {
  // Detached stand-in nodes — never appended to the document, so their status
  // text can never paint on the page.
  const sink = { meta: document.createElement('span'), note: document.createElement('span') };
  // trackStatus = false: the intro preview must not touch the capture
  // viewer's shared status state either. autoFocus = false: the sample is a
  // curated, origin-centred splat sized for the default radius-2.8 orbit, so
  // it must keep the known-good framing rather than be recentered/refit.
  return loadSplatViewer(canvas, url, false, sink, false);
}

// ============================================================================
// Orchestration — run the pipeline after capture finishes
// ============================================================================

/**
 * Advisory pre-dispatch probe of GET /capture/recon/availability. The server
 * already fails a doomed job honestly (~30s claim timeout), but without this
 * the user watches an estimated progress bar the platform knows is going
 * nowhere. Best-effort and non-blocking: any error leaves the state unknown
 * and the flow untouched — the warning only ever ADDS honesty, never gates.
 */
function _checkReconAvailability(run) {
  let timer = null;
  const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  if (ctrl) timer = setTimeout(() => ctrl.abort(), 6000);
  fetch(`${API_BASE}/api/v1/capture/recon/availability`, {
    method: 'GET',
    signal: ctrl ? ctrl.signal : undefined,
  })
    .then((resp) => (resp.ok ? resp.json() : null))
    .then((data) => {
      if (run !== state.runToken || !data) return;
      if (data.available === false) {
        state.gpuWorkerDown = true;
        applyProcessingLabels();
      }
    })
    .catch(() => { /* advisory only — unknown stays unknown */ })
    .finally(() => { if (timer) clearTimeout(timer); });
}

async function runPipeline() {
  // Take a run token; if the user navigates away, resetRun() bumps it and the
  // stale-token checks below abandon this run without touching the new UI.
  const run = resetRun();
  try {
    state.uploadPct = null;          // null until the first progress event
    state.gpuWorkerDown = null;
    _checkReconAvailability(run);
    showPhase(Phase.UPLOADING);
    setFill('upload-fill', 0);
    applyUploadLabel();              // 'Preparing…' in the active locale
    state.captureId = await uploadCapture(state.capturedFrames, (pct) => {
      state.uploadPct = pct;
      setFill('upload-fill', pct);
      applyUploadLabel();
    });
    if (run !== state.runToken) return;

    // W2A: persist the capture locally the moment it has an id, so it is
    // recoverable from My Captures even if the user closes the tab now.
    try {
      captureHistory.add({
        captureId: state.captureId,
        status: HISTORY_STATUS.PROCESSING,
        device: navigator.userAgent,
      });
    } catch (err) { console.warn('[Capture] history add failed:', err); }

    state.procStage = null;          // no stage reported yet
    state.procPct = 0;
    state.procStartedAt = performance.now(); // drives the elapsed timer
    state.procElapsedMs = 0;
    state.procSlowHint = false;
    showPhase(Phase.PROCESSING);
    applyProcessingLabels();         // default copy in the active locale
    state.splatUrl = await pollReconstruction(
      state.captureId,
      (stage, pct) => {
        state.procStage = stage;
        state.procPct = pct;
        state.procElapsedMs = state.procStartedAt
          ? performance.now() - state.procStartedAt : 0;
        setFill('processing-fill', pct);
        applyProcessingLabels();
      },
      () => run !== state.runToken
    );
    if (run !== state.runToken || !state.splatUrl) return;

    // W2A: the capture is done -- update its history entry so My Captures
    // can re-open the splat directly next visit.
    try {
      captureHistory.update(state.captureId, {
        status: HISTORY_STATUS.READY,
        splatUrl: state.splatUrl,
      });
    } catch (err) { console.warn('[Capture] history update failed:', err); }

    showPhase(Phase.READY);
    state.cleanupSplatUrl = state.splatUrl; // the 'Clean up' button acts on this
    state.viewerStatus = 'loading';
    state.viewerOfflineFile = null;
    const teardown = await loadSplatViewer($('viewer-canvas'), state.splatUrl, true, null, true);
    if (run !== state.runToken) {
      teardown(); // user left while the splat was loading
      return;
    }
    state.viewerTeardown = teardown;
  } catch (err) {
    // A genuine, server-reported reconstruction failure is terminal -- record
    // it so My Captures reflects reality instead of showing 'processing'
    // forever. Transient errors (lost contact, client timeout, viewer-load)
    // leave the entry PROCESSING and recoverable -- never a stale FAILED.
    if (isTerminalFailure(err) && state.captureId) {
      try {
        captureHistory.update(state.captureId,
          { status: HISTORY_STATUS.FAILED });
      } catch (e2) { /* non-fatal */ }
    }
    // Only surface the error if this run is still the active one.
    if (run === state.runToken) {
      const detail = err && err.message ? err.message : String(err);
      showError({
        key: 'error.pipelineFailed',
        params: { detail: detail },
        fallback: 'Reconstruction failed: ' + detail,
      });
    }
  }
}

// ============================================================================
// Utilities
// ============================================================================

function setFill(id, pct) {
  $(id).style.width = Math.round(Math.min(1, Math.max(0, pct)) * 100) + '%';
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---- dynamic-text apply helpers --------------------------------------------
// Each helper renders one phase's runtime-managed (no data-i18n) text from the
// snapshot in `state`, in the ACTIVE locale. The pipeline calls them as values
// change; relocalizeDynamic() calls them on a locale switch. Single source of
// truth, so a mid-flow language change is always correct.

/** UPLOADING — 'Preparing…' before progress, live 'Uploading N%' after. */
function applyUploadLabel() {
  const el = $('upload-label');
  if (!el) return;
  if (state.uploadPct == null) {
    el.textContent = t('uploading.preparing', null, 'Preparing…');
  } else {
    const pct = (state.uploadPct * 100).toFixed(1);
    el.textContent = t('uploading.progress', { pct: pct }, 'Uploading ' + pct + '%');
  }
}

// ---------------------------------------------------------------------------
// PROCESSING — honest, named-stage display
// ---------------------------------------------------------------------------
// The backend reports per-stage `progress` (0..1) that RESETS between stages,
// and for the real COLMAP backend the reconstructing-stage progress is a
// time-elapsed/timeout estimate capped at ~0.85. Rendering either as one smooth
// 0→100% bar lies to the user (looks like it jumps to ~99% then restarts, or
// sits "stuck at 85%"). So: NAMED, ORDERED stages with a "Step N of M" header;
// the bar is labelled as the current stage so a reset reads as "next step", not
// "restarted"; and for reconstruction we drop the misleading number for an
// indeterminate "working" indicator + honest copy. Fake progress is forbidden.

// User-facing ordered stages. Backend statuses queued|analyzing|reconstructing
// map onto the first three; 'finalizing' is shown when reconstruction hits 1.0
// (just before 'ready').
const PROC_STAGES = ['queued', 'analyzing', 'reconstructing', 'finalizing'];

// Thresholds (ms) for honest, escalating "limited compute" messaging while in
// the reconstructing stage. The existing 10-min slowHint is preserved and wins
// over these when active.
const COMPUTE_NOTICE_MS = 75 * 1000;              // ~75s -> shared-compute notice
const COMPUTE_STILL_WORKING_MS = 5 * 60 * 1000;   // 5 min -> still-working reassurance

function _formatElapsed(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m + ':' + String(s).padStart(2, '0');
}

// Map a reported stage string to our ordered user-facing stage.
function _userStage(stage) {
  if (stage === 'queued') return 'queued';
  if (stage === 'analyzing') return 'analyzing';
  if (stage === 'reconstructing') {
    return (state.procPct >= 1) ? 'finalizing' : 'reconstructing';
  }
  return stage || 'queued';
}

function applyProcessingLabels() {
  const titleEl = $('processing-title');
  const labelEl = $('processing-label');
  const stageEl = $('processing-stage');
  const trackEl = $('processing-track');
  const fillEl = $('processing-fill');
  const elapsedEl = $('processing-elapsed');
  const noticeEl = $('processing-notice');
  const rawStage = state.procStage;

  // Pre-stage (upload just finished, nothing reported yet): default copy only.
  if (rawStage == null) {
    if (titleEl) titleEl.textContent = t('processing.titleDefault', null, 'Analyzing footage');
    if (stageEl) stageEl.textContent = '';
    if (labelEl) labelEl.textContent = t('processing.labelDefault', null, 'This usually takes a minute or two…');
    if (trackEl) trackEl.classList.remove('is-indeterminate');
    if (elapsedEl) elapsedEl.textContent = '';
    if (noticeEl) {
      // The worker-down warning applies even before the first stage report.
      const notice = state.gpuWorkerDown ? t('processing.gpuWorkerDown', null,
        'Heads-up: no cloud GPU worker is online right now — this capture will likely fail until one comes back.') : '';
      noticeEl.textContent = notice;
      noticeEl.hidden = !notice;
    }
    return;
  }

  const uStage = _userStage(rawStage);
  const idx = PROC_STAGES.indexOf(uStage);
  const stepNo = idx >= 0 ? idx + 1 : 1;
  const total = PROC_STAGES.length;
  const isRecon = uStage === 'reconstructing';

  // Title: the named stage.
  if (titleEl) {
    const titleKey = uStage === 'analyzing'
      ? 'processing.titleAnalyzing'
      : uStage === 'reconstructing'
        ? 'processing.titleReconstructing'
        : uStage === 'finalizing'
          ? 'processing.titleFinalizing'
          : uStage === 'queued'
            ? 'processing.titleQueued'
            : 'processing.titleGeneric';
    titleEl.textContent = t(titleKey, null, 'Processing');
  }

  // "Step N of M: <stage name>" so a per-stage progress reset reads as moving
  // to the next step, not restarting.
  if (stageEl) {
    const stageName = t('processing.stage_' + uStage, null,
      uStage.charAt(0).toUpperCase() + uStage.slice(1));
    stageEl.textContent = t('processing.stepOf', { n: stepNo, total: total, label: stageName },
      'Step ' + stepNo + ' of ' + total + ': ' + stageName);
  }

  // The bar: indeterminate for reconstruction (its number is a capped
  // time-estimate, not real completion); a real per-stage % otherwise.
  if (trackEl) trackEl.classList.toggle('is-indeterminate', isRecon);
  if (isRecon && fillEl) fillEl.style.width = ''; // let the animation own the band

  // Label under the bar.
  if (labelEl) {
    if (isRecon) {
      labelEl.textContent = t('processing.labelReconstructingWorking', null,
        'Reconstructing… (this is the longest step)');
    } else if (uStage === 'finalizing') {
      labelEl.textContent = t('processing.labelFinalizing', null, 'Finalizing…');
    } else if (uStage === 'queued') {
      labelEl.textContent = t('processing.labelQueued', null, 'Waiting for a free worker…');
    } else {
      const pct = ((state.procPct || 0) * 100).toFixed(1);
      labelEl.textContent = t('processing.labelAnalyzing', { pct: pct },
        'Finding camera poses and features… ' + pct + '%');
    }
  }

  // Elapsed timer.
  const elapsedMs = state.procElapsedMs || 0;
  if (elapsedEl) {
    elapsedEl.textContent = elapsedMs > 0
      ? t('processing.elapsed', { time: _formatElapsed(elapsedMs) }, 'Elapsed ' + _formatElapsed(elapsedMs))
      : '';
  }

  // Honest, escalating "limited compute" notice — only during reconstruction.
  // A known-down GPU worker outranks every reassurance: do not reassure a
  // user about a job the platform already knows has no worker to run it.
  if (noticeEl) {
    let notice = '';
    if (state.gpuWorkerDown) {
      notice = t('processing.gpuWorkerDown', null,
        'Heads-up: no cloud GPU worker is online right now — this capture will likely fail until one comes back.');
    } else if (isRecon) {
      if (state.procSlowHint) {
        // 10-min+ : reuse the existing strongest reassurance.
        notice = t('processing.slowHint', null,
          'Still working — slow scenes can take 20+ minutes. We will not give up while the server is making progress.');
      } else if (elapsedMs > COMPUTE_STILL_WORKING_MS) {
        notice = t('processing.computeStillWorking', null,
          'This is taking longer than usual, but your scan is still being processed. We are compute-limited right now, not broken — thanks for your patience.');
      } else if (elapsedMs > COMPUTE_NOTICE_MS) {
        notice = t('processing.computeNotice', null,
          'Reconstruction runs on our shared compute and can take several minutes right now — we are scaling up GPU capacity. Your scan is still processing.');
      }
    }
    noticeEl.textContent = notice;
    noticeEl.hidden = notice === '';
  }
}

/** READY — viewer toolbar status + offline note, from the real viewer state. */
function applyViewerStatus() {
  const meta = $('viewer-meta');
  const note = $('viewer-note');
  if (meta) {
    if (state.viewerStatus === 'controls') {
      meta.textContent =
        t('viewer.metaControls', null, 'Drag to orbit · scroll or pinch to zoom');
    } else if (state.viewerStatus === 'placeholder') {
      meta.textContent =
        t('viewer.metaReadyPlaceholder', null, 'Splat ready (placeholder)');
    } else {
      meta.textContent = t('viewer.metaLoading', null, 'Loading splat…');
    }
  }
  if (note) {
    if (state.viewerStatus === 'placeholder' && state.viewerOfflineFile) {
      note.hidden = false;
      note.textContent = t('viewer.noteOffline', { file: state.viewerOfflineFile },
        'Spark viewer offline — placeholder for ' + state.viewerOfflineFile);
    } else {
      note.hidden = true;
    }
  }
}

/** INTRO — sample-splat preview caption, in the active locale. */
function applyIntroCaption() {
  const caption = $('intro-preview-caption');
  if (!caption) return;
  if (state.introSampleName) {
    caption.textContent = t('intro.previewCaptionNamed',
      { name: state.introSampleName },
      'Live sample: ' + state.introSampleName + ' — drag to look around');
  } else {
    caption.textContent =
      t('intro.previewCaption', null, 'Live sample — drag to look around');
  }
}

// ============================================================================
// Wiring
// ============================================================================

// W2A: My Captures -- open the recovery view, wired to re-open a splat.
let _capturesView = null;
function openCapturesView() {
  if (!_capturesView) {
    _capturesView = new CapturesView({
      history: captureHistory,
      onReopen: (entry) => reopenCapture(entry),
    });
  }
  _capturesView.open();
}

// Re-open a capture from history: ready -> viewer; else resume polling.
async function reopenCapture(entry) {
  if (!entry || !entry.captureId) return;
  const run = resetRun();
  state.captureId = entry.captureId;
  if (entry.status === HISTORY_STATUS.READY && entry.splatUrl) {
    state.splatUrl = entry.splatUrl;
    showPhase(Phase.READY);
    state.cleanupSplatUrl = entry.splatUrl;
    state.viewerStatus = 'loading';
    try {
      const teardown = await loadSplatViewer(
        $('viewer-canvas'), entry.splatUrl, true, null, true);
      if (run !== state.runToken) { teardown(); return; }
      state.viewerTeardown = teardown;
    } catch (err) {
      if (run === state.runToken) showError(err.message || String(err));
    }
    return;
  }
  try {
    state.procStage = null;
    state.procPct = 0;
    // Reopened/deep-linked captures re-enter PROCESSING too, so start the same
    // elapsed-timer state the main pipeline does — otherwise the elapsed time
    // and the escalating compute-limit notices never appear on a resume.
    state.procStartedAt = performance.now();
    state.procElapsedMs = 0;
    state.procSlowHint = false;
    state.gpuWorkerDown = null;
    _checkReconAvailability(run);
    showPhase(Phase.PROCESSING);
    state.splatUrl = await pollReconstruction(
      entry.captureId,
      (stage, pct) => { state.procStage = stage; state.procPct = pct;
        state.procElapsedMs = state.procStartedAt
          ? performance.now() - state.procStartedAt : 0;
        setFill('processing-fill', pct); applyProcessingLabels(); },
      () => run !== state.runToken);
    if (run !== state.runToken || !state.splatUrl) return;
    try {
      captureHistory.update(entry.captureId, {
        status: HISTORY_STATUS.READY, splatUrl: state.splatUrl });
    } catch (err) { /* non-fatal */ }
    showPhase(Phase.READY);
    state.cleanupSplatUrl = state.splatUrl;
    const teardown = await loadSplatViewer($('viewer-canvas'), state.splatUrl, true, null, true);
    if (run !== state.runToken) { teardown(); return; }
    state.viewerTeardown = teardown;
  } catch (err) {
    // W2A: a genuine, server-reported reconstruction failure is terminal --
    // record it so My Captures reflects reality. But a *transient* error --
    // lost contact (404 / network blips), a client-side timeout while the
    // server is still working, or a viewer-load error on an otherwise-ready
    // splat -- must NOT be recorded as FAILED: that stale 'failed' would
    // re-render as a current failure next visit even though the job is still
    // processing/ready server-side. Leave it PROCESSING (recoverable) instead.
    if (isTerminalFailure(err)) {
      try {
        captureHistory.update(entry.captureId,
          { status: HISTORY_STATUS.FAILED });
      } catch (e2) { /* non-fatal */ }
    }
    if (run === state.runToken) showError(err.message || String(err));
  }
}

// W2A: deep-link -- a shared ?capture=<id> URL re-opens that capture.
function handleCaptureDeepLink() {
  let id = null;
  try { id = new URL(window.location.href).searchParams.get('capture'); }
  catch (err) { return; }
  if (!id) return;
  const entry = captureHistory.get(id) ||
    { captureId: id, status: HISTORY_STATUS.PROCESSING };
  reopenCapture(entry);
}

function bindEvents() {
  // Intro -> guide (camera permission is requested on the guide screen).
  $('btn-grant-camera').addEventListener('click', () => {
    showPhase(Phase.GUIDE);
  });

  // W2A: open the My Captures recovery view. Button is optional.
  const myCapturesBtn = $('btn-my-captures');
  if (myCapturesBtn) {
    myCapturesBtn.addEventListener('click', () => openCapturesView());
  }

  // Guide -> scale-reference step (metric-scale calibration, plan 6.1 step 2).
  $('btn-begin-capture').addEventListener('click', () => {
    resetScaleState();
    renderScaleOptions();
    const cont = $('btn-scale-continue');
    if (cont) cont.disabled = true;
    showPhase(Phase.SCALE);
  });

  // Scale step: skip -- capture proceeds with no metric scale (honestly marked
  // scale-unknown by buildScaleMetadata()).
  $('btn-skip-scale').addEventListener('click', () => {
    state.scaleReferenceId = null;
    state.scaleSkipped = true;
    beginCapture();
  });

  // Scale step: continue -- a reference was chosen; the camera opens into the
  // in-camera scale sub-step before the room sweep.
  $('btn-scale-continue').addEventListener('click', () => {
    if (!state.scaleReferenceId) return; // button is disabled until one is picked
    state.scaleSkipped = false;
    beginCapture();
  });

  // Capture controls.
  $('btn-cancel-capture').addEventListener('click', () => {
    finishScaleSubstep(); // settles any in-flight scale sub-step
    stopCaptureLoop();
    stopCamera();
    showPhase(Phase.INTRO);
  });

  $('btn-finish-capture').addEventListener('click', async () => {
    stopCaptureLoop();
    stopCamera(); // safe pre-drain: pending toBlob()s read the offscreen canvas, not the stream
    await awaitPendingFrameBlobs(); // include the trailing keyframe + its meta record
    runPipeline();
  });

  $('btn-cancel-uploading').addEventListener('click', () => {
    // While the multipart upload is in flight there is no captureId yet
    // (the server hands it back on the 202). Aborting on the client side
    // means we just bump the run token so the upload promise's resolve
    // becomes a no-op and tear down the UI back to the intro screen.
    resetRun();
    showPhase(Phase.INTRO);
  });
  $('btn-cancel-processing').addEventListener('click', () => {
    cancelReconstruction(state.captureId);
    resetRun(); // abandon the in-flight pipeline so it cannot reappear
    resetScaleState();
    showPhase(Phase.INTRO);
  });

  // Failure diagnostics. "What happened?" reveals the plain-English cause+fix
  // (consent-gated — nothing shown or sent until the user asks).
  const diagBtn = $('btn-diagnose');
  if (diagBtn) {
    diagBtn.addEventListener('click', () => {
      state.errorDiagShown = true;
      applyErrorDiagnostics();
    });
  }
  // Collapsible "technical details" toggle (raw error string).
  const detailsBtn = $('btn-error-details');
  if (detailsBtn) {
    detailsBtn.addEventListener('click', () => {
      const wrap = $('error-technical');
      if (wrap) wrap.hidden = !wrap.hidden;
      applyErrorDiagnostics();
    });
  }

  // Viewer toolbar.
  $('btn-new-capture').addEventListener('click', () => {
    resetRun(); // tears down the viewer's render loop + listeners
    state.captureId = null;
    state.splatUrl = null;
    state.cleanupSplatUrl = null;
    resetScaleState(); // a fresh capture starts the scale step over
    showPhase(Phase.INTRO);
  });

  // W1.4 — 'Clean up' opens the splat in the SuperSplat editor.
  $('btn-cleanup').addEventListener('click', () => {
    openSplatCleanup(state.cleanupSplatUrl || state.splatUrl);
  });

  $('btn-share').addEventListener('click', () => {
    const url = state.splatUrl || window.location.href;
    if (navigator.share) {
      navigator.share({ title: t('viewer.shareTitle', null, 'Raku Capture'), url })
        .catch(() => {});
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      // No Web Share API — fall back to the clipboard, and tell the user it
      // worked (or didn't) so the button is never a silent no-op.
      navigator.clipboard.writeText(url)
        .then(() => flashViewerHint(
          t('viewer.shareCopied', null, 'Capture URL copied to clipboard')))
        .catch(() => flashViewerHint(
          t('viewer.shareCopyFailed', null, 'Could not copy the URL — copy it from the address bar')));
    } else {
      flashViewerHint(
        t('viewer.shareCopyFailed', null, 'Could not copy the URL — copy it from the address bar'));
    }
  });

  // Error retry.
  $('btn-retry').addEventListener('click', () => {
    resetRun();
    showPhase(Phase.INTRO);
  });
}

/**
 * Re-render every runtime-managed (no data-i18n) UI string for the CURRENT
 * phase in the now-active locale. Registered as a RakuI18n.onChange listener,
 * so it fires after i18n.js has re-applied all declarative [data-i18n*] text.
 *
 * Static text is handled by i18n.js. This function owns only the strings JS
 * sets imperatively — and it covers ALL phases, so switching language mid-flow
 * (during UPLOADING / PROCESSING / READY / ERROR, not just CAPTURE) never
 * leaves stale or wrong-language text. In-flight dynamic values (upload %,
 * reconstruction stage + %, the specific error) are re-rendered from the
 * snapshot in `state`, so the live number/stage survives the switch.
 */
function relocalizeDynamic() {
  switch (state.phase) {
    case Phase.INTRO:
      // The sample-preview caption is JS-owned once a sample has loaded.
      applyIntroCaption();
      break;

    case Phase.GUIDE:
      // Fully static (data-i18n) — i18n.js already handled it. Nothing to do.
      break;

    case Phase.DEMO:
      // Booth demo: re-render the JS-owned status line + the sample picker's
      // size hints in the new locale (heading/lead/badge are data-i18n).
      applyDemoStatus();
      renderDemoPicker();
      break;

    case Phase.SCALE:
      // The picker option labels are JS-built (from the reference table), so
      // re-render them in the new locale. i18n.js already handled the static
      // [data-i18n] copy on this screen.
      renderScaleOptions();
      break;

    case Phase.CAPTURE:
      // Re-renders #coverage-label and #capture-hint at the live coverage, and
      // the in-camera scale sub-step overlay label when that sub-step is up.
      updateCoverage(state.coverage);
      updateCaptureProgress();  // frame counter + quality text in the new locale
      updateCoverageRing();     // directional coverage hint in the new locale
      applyScaleFrameLabel();
      break;

    case Phase.UPLOADING:
      applyUploadLabel();
      break;

    case Phase.PROCESSING:
      applyProcessingLabels();
      break;

    case Phase.READY:
      // Re-render the viewer toolbar from the REAL viewer status (loading vs
      // controls vs offline placeholder) — not from whether viewerTeardown is
      // set, which is null during the load window and would mislabel it.
      applyViewerStatus();
      break;

    case Phase.ERROR:
      applyErrorMessage();
      break;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const i18nReady =
    (window.RakuI18n && window.RakuI18n.ready) || Promise.resolve();
  i18nReady
    .catch(() => {})
    .then(() => {
      if (window.RakuI18n && typeof window.RakuI18n.onChange === 'function') {
        window.RakuI18n.onChange(relocalizeDynamic);
      }
      bindEvents();
      if (_demoMode()) {
        // Booth demo (?demo=1 / ?demo=<sampleId>): pre-baked samples only —
        // no sign-in, no camera, no capture/reconstruction API calls. The
        // ?capture= deep link is deliberately ignored here: re-opening a
        // capture would poll the live API. See the demo section below.
        enterDemoMode();
      } else {
        showPhase(Phase.INTRO);
        initIntroPreview();
        handleCaptureDeepLink(); // W2A: open ?capture= deep link
      }
    });
});


// ============================================================================
// Auth wiring (task #172) — sign-in + create account
// ============================================================================

const API_BASE_FOR_AUTH = (window.RAKU_API_BASE || 'https://api.rakuai.com');

function _setAuthToken(token) {
  try { localStorage.setItem('raku_access_token', token); } catch (e) { /* ignore */ }
  applyAuthState();
}

function _clearAuthToken() {
  try { localStorage.removeItem('raku_access_token'); } catch (e) { /* ignore */ }
  applyAuthState();
}

function _parseJwt(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    let p = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (p.length % 4) p += '=';
    return JSON.parse(atob(p));
  } catch (e) { return null; }
}

function applyAuthState() {
  const t = _getAuthToken();
  const signedOut = $('auth-state');
  const signinBtn = $('btn-signin');
  const registerBtn = $('btn-register');
  const headerLink = $('header-signin-link');
  if (!signedOut) return;
  if (t) {
    const payload = _parseJwt(t);
    const who = payload && (payload.email || payload.sub) || 'signed in';
    signedOut.textContent = t === null ? '' : (window.RakuI18n
      ? window.RakuI18n.t('auth.signedInAs', { who }, 'Signed in as ' + who + '.')
      : 'Signed in as ' + who + '.');
    if (signinBtn) { signinBtn.textContent = window.RakuI18n ? window.RakuI18n.t('auth.signout', null, 'Sign out') : 'Sign out'; signinBtn.dataset.action = 'signout'; }
    if (registerBtn) registerBtn.style.display = 'none';
    if (headerLink) headerLink.textContent = window.RakuI18n ? window.RakuI18n.t('header.signout', null, 'Sign out') : 'Sign out';
  } else {
    signedOut.textContent = window.RakuI18n
      ? window.RakuI18n.t('auth.signedOut', null, 'Not signed in - captures stay anonymous (3/day limit).')
      : 'Not signed in - captures stay anonymous (3/day limit).';
    if (signinBtn) { signinBtn.textContent = window.RakuI18n ? window.RakuI18n.t('auth.signin', null, 'Sign in') : 'Sign in'; signinBtn.dataset.action = 'signin'; }
    if (registerBtn) registerBtn.style.display = '';
    if (headerLink) headerLink.textContent = window.RakuI18n ? window.RakuI18n.t('header.signin', null, 'Sign in') : 'Sign in';
  }
}

async function _postAuth(path, payload) {
  const res = await fetch(`${API_BASE_FOR_AUTH}/api/v1/auth/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

function _bindAuth() {
  const signinBtn = $('btn-signin');
  const registerBtn = $('btn-register');
  const headerLink = $('header-signin-link');
  if (signinBtn) signinBtn.addEventListener('click', () => {
    if (signinBtn.dataset.action === 'signout') { _clearAuthToken(); return; }
    showPhase(Phase.SIGNIN);
  });
  if (registerBtn) registerBtn.addEventListener('click', () => showPhase(Phase.REGISTER));
  if (headerLink) headerLink.addEventListener('click', (e) => {
    e.preventDefault();
    if (_getAuthToken()) _clearAuthToken();
    else showPhase(Phase.SIGNIN);
  });
  const linkGoReg = $('link-go-register');
  const linkBack1 = $('link-back-to-intro');
  const linkGoSign = $('link-go-signin');
  const linkBack2 = $('link-register-back');
  if (linkGoReg) linkGoReg.addEventListener('click', (e) => { e.preventDefault(); showPhase(Phase.REGISTER); });
  if (linkBack1) linkBack1.addEventListener('click', (e) => { e.preventDefault(); showPhase(Phase.INTRO); });
  if (linkGoSign) linkGoSign.addEventListener('click', (e) => { e.preventDefault(); showPhase(Phase.SIGNIN); });
  if (linkBack2) linkBack2.addEventListener('click', (e) => { e.preventDefault(); showPhase(Phase.INTRO); });

  const sf = $('signin-form');
  if (sf) sf.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = $('signin-error');
    if (errEl) { errEl.hidden = true; errEl.textContent = ''; }
    try {
      const email = $('signin-email').value.trim();
      const password = $('signin-password').value;
      const result = await _postAuth('login', { email, password });
      if (result.access_token) { _setAuthToken(result.access_token); showPhase(Phase.INTRO); }
    } catch (err) {
      if (errEl) { errEl.hidden = false; errEl.textContent = err.message || 'Sign-in failed.'; }
    }
  });
  const rf = $('register-form');
  if (rf) rf.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = $('register-error');
    if (errEl) { errEl.hidden = true; errEl.textContent = ''; }
    try {
      const email = $('register-email').value.trim();
      const password = $('register-password').value;
      const terms = $('register-terms').checked;
      if (!terms) throw new Error('Please accept the terms.');
      const result = await _postAuth('register', { email, password });
      if (result.access_token) { _setAuthToken(result.access_token); showPhase(Phase.INTRO); }
    } catch (err) {
      if (errEl) { errEl.hidden = false; errEl.textContent = err.message || 'Registration failed.'; }
    }
  });

  applyAuthState();
}

// Hook into the existing init path — bind auth alongside the other event wiring.
if (typeof bindEvents === 'function') {
  const _origBindEvents = bindEvents;
  bindEvents = function() { _origBindEvents.apply(this, arguments); _bindAuth(); };
}


// ============================================================================
// Phone vs Cloud compute backend toggle (task #174)
// ============================================================================
// User picks "cloud" (default) or "phone" (experimental WebGPU). The choice
// is persisted to localStorage so we don't ask every visit, and appended to
// the upload meta as `compute_backend` so the server can route appropriately
// when the GPU lane lands. WebGPU is feature-detected — if absent, the
// "phone" option is disabled and a fallback note is surfaced.

const _COMPUTE_KEY = 'raku.compute_backend';

function _hasWebGPU() {
  try { return typeof navigator !== 'undefined' && 'gpu' in navigator; }
  catch (e) { return false; }
}

function _getComputeBackend() {
  try {
    const v = localStorage.getItem(_COMPUTE_KEY);
    if (v === 'phone' || v === 'cloud') return v;
  } catch (e) { /* ignore */ }
  return 'cloud';  // default
}

function _setComputeBackend(v) {
  try { localStorage.setItem(_COMPUTE_KEY, v); } catch (e) { /* ignore */ }
}

function _bindComputeToggle() {
  const toggle = document.getElementById('compute-toggle');
  if (!toggle) return;
  const radios = toggle.querySelectorAll('input[name="compute_backend"]');
  const phoneRadio = toggle.querySelector('input[value="phone"]');
  const fallbackNote = document.getElementById('compute-fallback-note');
  const initial = _getComputeBackend();
  // Hard-disable the phone option when WebGPU is missing.
  if (!_hasWebGPU() && phoneRadio) {
    phoneRadio.disabled = true;
    if (fallbackNote) fallbackNote.hidden = false;
    if (initial === 'phone') _setComputeBackend('cloud');
  }
  // Apply the saved choice + listen for changes.
  for (const r of radios) {
    r.checked = (r.value === _getComputeBackend());
    r.addEventListener('change', () => {
      if (r.checked) _setComputeBackend(r.value);
    });
  }
}

// Hook into bindEvents so the toggle lights up alongside the rest.
if (typeof bindEvents === 'function') {
  const _origBindEventsCompute = bindEvents;
  bindEvents = function() { _origBindEventsCompute.apply(this, arguments); _bindComputeToggle(); };
}


// ============================================================================
// Booth demo mode (?demo=1 / ?demo=<sampleId>) — AWE USA 2026
// ============================================================================
// A booth-grade, offline-tolerant flow that renders ONLY the pre-baked sample
// splats from samples/manifest.json. While demo mode is active:
//   - sign-in / register and the compute-backend toggle are hidden
//     (body.demo-mode CSS in index.html);
//   - the capture/reconstruction API is NEVER called — uploadCapture /
//     pollReconstruction carry explicit guards that fail loudly if reached;
//   - the viewer shows an honest "Demo — pre-captured sample" badge so a
//     sample is never mistaken for a live scan;
//   - the "Clean up" (external SuperSplat editor) button is hidden;
//   - "New capture" is repurposed as "Back to samples".
//
// Offline tolerance is sw.js's job (raku-demo-splats-v1 cache-first lane for
// the sample splats + the pinned Spark/three viewer modules): a device that
// loaded a sample once while online can replay it offline. An uncached sample
// on an offline device surfaces an explicit, localized message — never a
// blank canvas, never fake success (CLAUDE.md honesty rule).
//
// Zero behavior change when ?demo is absent: every entry point checks
// _demoMode() and the normal flow is untouched.

/** Parse the ?demo= query param once. null = not in demo mode. */
function _parseDemoParam() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('demo')) return null;
    const v = (params.get('demo') || '').trim();
    // ?demo / ?demo=1 / ?demo=true -> sample picker; ?demo=<id> -> that sample.
    if (v === '' || v === '1' || v === 'true') return { sampleId: null };
    return { sampleId: v };
  } catch (err) {
    return null; // no URLSearchParams / malformed URL -> normal mode
  }
}

const DEMO = _parseDemoParam();

/** True when the page was opened with ?demo=… (booth demo mode). */
function _demoMode() { return DEMO !== null; }

// JS-owned demo state (module-local; the picker is rebuilt from these on a
// locale switch via relocalizeDynamic's Phase.DEMO case).
let _demoSamples = null;       // Array<sample> from samples/manifest.json
let _demoStatus = null;        // { key, params } of the current status message

/** Set (or clear, with null) the demo picker's status line, by i18n key. */
function _setDemoStatus(key, params) {
  _demoStatus = key ? { key: key, params: params || null } : null;
  applyDemoStatus();
}

/** Render the demo status line in the active locale. */
function applyDemoStatus() {
  const el = $('demo-status');
  if (!el) return;
  if (_demoStatus) {
    el.hidden = false;
    el.textContent = t(_demoStatus.key, _demoStatus.params);
  } else {
    el.hidden = true;
    el.textContent = '';
  }
}

/**
 * Fetch ALL samples from samples/manifest.json (the intro preview's
 * loadSampleManifest() returns only the default pick). The manifest is part
 * of the sw.js shell pre-cache, so this works offline after one online visit.
 * Returns null when unreachable/malformed — the caller surfaces an explicit,
 * localized message, never a silent empty picker.
 */
async function _loadDemoSamples() {
  if (_demoSamples) return _demoSamples;
  try {
    const resp = await fetch(SAMPLES_MANIFEST_URL);
    if (!resp.ok) return null;
    const data = await resp.json();
    const samples = (Array.isArray(data && data.samples) ? data.samples : [])
      .filter((s) => s && s.id && s.url);
    if (!samples.length) return null;
    _demoSamples = samples;
    return samples;
  } catch (err) {
    console.warn('[RakuCapture] demo: sample manifest unavailable:', err);
    return null;
  }
}

/** Build the sample-picker buttons. Idempotent; re-run on locale change. */
function renderDemoPicker() {
  const host = $('demo-samples');
  if (!host || !_demoSamples) return;
  host.textContent = '';
  _demoSamples.forEach((sample) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'demo-option';
    const name = document.createElement('span');
    name.className = 'demo-option-name';
    name.textContent = sample.label || sample.id;
    const desc = document.createElement('span');
    desc.className = 'demo-option-desc';
    desc.textContent = sample.approxSize
      ? t('demo.sampleSize', { size: sample.approxSize },
          sample.approxSize + ' download — cached for offline replay after the first view')
      : '';
    btn.appendChild(name);
    btn.appendChild(desc);
    btn.addEventListener('click', () => openDemoSample(sample));
    host.appendChild(btn);
  });
}

/**
 * Honest availability pre-flight for a sample splat: a 1-byte ranged GET.
 * Online it answers from the network (206/200); offline it answers from
 * sw.js's raku-demo-splats-v1 cache if the sample was viewed once before
 * (the SW serves cached demo assets cache-first, ignoring the Range header,
 * which HTTP permits). If neither works, the caller shows an explicit
 * localized message instead of handing the viewer a URL that renders blank.
 */
async function _probeDemoSplat(url) {
  let timer = null;
  try {
    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    if (ctrl) timer = setTimeout(() => ctrl.abort(), 8000);
    const resp = await fetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-0' },
      signal: ctrl ? ctrl.signal : undefined,
    });
    // Release the stream — the probe only needs the status line.
    resp.body?.cancel().catch(() => { /* best-effort */ });
    return { ok: resp.ok || resp.status === 206, status: resp.status };
  } catch (err) {
    return { ok: false, error: err };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Sync the ?demo= query param to the current demo view (a sample id, or '1'
 * for the picker) without a navigation, so the address bar is always a
 * correct deep link for Share. Best-effort: history can be unavailable or
 * throw in embedded contexts, and the URL is cosmetic there.
 */
function _setDemoUrlParam(value) {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('demo', value);
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    // Keep the error screen's exit link in step: its href is seeded from the
    // STARTUP query string in enterDemoMode, so without this a reload via
    // "Back to start" would resurrect whatever ?demo= the page was opened
    // with rather than the state the user actually left.
    const exitErr = $('btn-exit-error');
    if (exitErr) exitErr.setAttribute('href', url.pathname + url.search + url.hash);
  } catch (err) { /* best-effort — Share falls back to the entry URL */ }
}

/** Open one pre-baked sample in the existing interactive Spark viewer. */
async function openDemoSample(sample) {
  const run = resetRun();
  state.captureId = null;
  // splatUrl/cleanupSplatUrl stay null: 'Clean up' is hidden in demo mode and
  // 'Share' then shares the page URL (the ?demo= deep link), not the asset.
  state.splatUrl = null;
  state.cleanupSplatUrl = null;
  _setDemoStatus(null);
  // Keep the address bar a true deep link to the open sample, so Share (which
  // shares the page URL in demo mode) shares this sample, not the picker.
  _setDemoUrlParam(sample.id);

  showPhase(Phase.READY);
  state.viewerStatus = 'loading';
  state.viewerOfflineFile = null;
  applyViewerStatus();

  const probe = await _probeDemoSplat(sample.url);
  if (run !== state.runToken) return;
  if (!probe.ok) {
    // Back to the picker with an explicit, localized reason — never a blank
    // canvas, never fake success.
    showPhase(Phase.DEMO);
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    _setDemoStatus(
      offline ? 'demo.splatUnavailableOffline' : 'demo.splatUnreachable',
      { name: sample.label || sample.id });
    return;
  }

  try {
    // Same viewer path as a finished scan; a Spark/three CDN miss degrades to
    // the labelled 2D placeholder via cdn_fallback.js, which is also honest.
    // autoFocus = false: booth demo samples are the same curated, origin-centred
    // public splats as the intro preview, sized for the default orbit — only a
    // real capture result (arbitrary world coords) needs the recenter/refit.
    const teardown = await loadSplatViewer($('viewer-canvas'), sample.url, true, null, false);
    if (run !== state.runToken) { teardown(); return; }
    state.viewerTeardown = teardown;
  } catch (err) {
    if (run !== state.runToken) return;
    console.warn('[RakuCapture] demo: viewer failed:', err);
    showPhase(Phase.DEMO);
    _setDemoStatus('demo.splatUnreachable', { name: sample.label || sample.id });
  }
}

/**
 * Enter booth demo mode. Called from the DOMContentLoaded handler INSTEAD of
 * the normal intro/deep-link startup when ?demo= is present.
 */
async function enterDemoMode() {
  document.body.classList.add('demo-mode');
  // Show the demo screen synchronously so the intro (auth, compute toggle,
  // capture CTA) never flashes while the manifest loads.
  showPhase(Phase.DEMO);

  // Honest badge over the viewer canvas — a sample is never a live scan.
  const badge = $('viewer-demo-badge');
  if (badge) badge.hidden = false;

  // Repurpose 'New capture' as 'Back to samples'. bindEvents' original
  // listener (registered first) still resets the run + shows INTRO; this
  // second listener immediately routes onward to the demo picker, so the net
  // effect is "reset, then back to the sample picker". Swapping the data-i18n
  // key keeps the new label correct across locale switches.
  const backBtn = $('btn-new-capture');
  if (backBtn) {
    backBtn.setAttribute('data-i18n', 'demo.backToSamples');
    backBtn.textContent = t('demo.backToSamples', null, 'Back to samples');
    backBtn.addEventListener('click', () => {
      _setDemoUrlParam('1'); // back on the picker — share the picker, not the last sample
      showPhase(Phase.DEMO);
    });
  }
  // The error screen's exits also return to the demo picker / demo URL.
  const retryBtn = $('btn-retry');
  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      _setDemoUrlParam('1'); // also lands on the picker
      showPhase(Phase.DEMO);
    });
  }
  const exitErr = $('btn-exit-error');
  if (exitErr) {
    try { exitErr.setAttribute('href', window.location.pathname + window.location.search + window.location.hash); }
    catch (err) { /* keep the default href */ }
  }

  const samples = await _loadDemoSamples();
  if (!samples) {
    // Explicit failure: offline with no cached shell, or a malformed
    // manifest. The picker stays empty and says exactly why.
    _setDemoStatus('demo.manifestError');
    return;
  }
  renderDemoPicker();

  if (DEMO.sampleId) {
    const pick = samples.find((s) => s.id === DEMO.sampleId);
    if (pick) { openDemoSample(pick); return; }
    // Unknown id in the URL: say so and fall back to the picker — do not
    // silently substitute a different sample.
    _setDemoStatus('demo.unknownSample', { id: DEMO.sampleId });
  }
}
