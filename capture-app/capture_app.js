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
// i18n shim
// ============================================================================
// window.RakuI18n is installed by i18n.js (loaded before this module). The
// shim degrades gracefully if i18n.js is somehow absent: t() echoes a sensible
// English-ish fallback string, raw() returns the fallback list. This keeps the
// app functional even when the locale layer fails to load.

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
  return 'https://raku-api.fly.dev';
}

const API_BASE = detectApiBase();

// Spark renderer pinned CDN module URL. Spark is an MIT-licensed 3D Gaussian
// splat renderer for three.js (https://github.com/sparkjsdev/spark).
// Tracks Spark's @latest tag; pin to @sparkjsdev/spark@X.Y.Z before production.
const SPARK_CDN_URL = 'https://cdn.jsdelivr.net/npm/@sparkjsdev/spark@latest/dist/spark.module.js';
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
  GUIDE: 'guide',
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
  introSampleName: null,  // label of the intro preview sample, for its caption
};

// DOM lookup helper ----------------------------------------------------------
const $ = (id) => document.getElementById(id);

const screens = {
  [Phase.INTRO]: 'screen-intro',
  [Phase.GUIDE]: 'screen-guide',
  [Phase.CAPTURE]: 'camera-stage',
  [Phase.UPLOADING]: 'screen-uploading',
  [Phase.PROCESSING]: 'screen-processing',
  [Phase.READY]: 'viewer-stage',
  [Phase.ERROR]: 'screen-error',
};

function showPhase(phase) {
  const leavingIntro = state.phase === Phase.INTRO && phase !== Phase.INTRO;
  const enteringIntro = state.phase !== Phase.INTRO && phase === Phase.INTRO;
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
function showError(message) {
  let text;
  if (message && typeof message === 'object') {
    state.errorMessageKey = message.key || null;
    state.errorMessageParams = message.params || null;
    state.errorMessageText = null;
    text = t(message.key, message.params, message.fallback);
  } else {
    state.errorMessageKey = null;
    state.errorMessageParams = null;
    state.errorMessageText = message || null;
    text = message || t('error.generic', null, 'Something went wrong.');
  }
  $('error-message').textContent = text;
  showPhase(Phase.ERROR);
}

/** Re-render the error screen's message in the active locale. */
function applyErrorMessage() {
  const el = $('error-message');
  if (!el) return;
  if (state.errorMessageKey) {
    el.textContent = t(state.errorMessageKey, state.errorMessageParams);
  } else if (state.errorMessageText != null) {
    el.textContent = state.errorMessageText; // literal text — not localizable
  } else {
    el.textContent = t('error.generic', null, 'Something went wrong.');
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
// Camera + guided capture
// ============================================================================

async function requestCamera() {
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
  state.coverage = 0;
  state.capturedFrames = [];
  updateCoverage(0);
  $('btn-finish-capture').disabled = true;

  // Heuristic coverage tick. Real impl: SLAM/pose-spread from the frames.
  // This stub advances steadily so all guidance states are exercised; each
  // tick also grabs a real keyframe so there is genuine footage to upload.
  coverageTimer = setInterval(() => {
    state.coverage = Math.min(1, state.coverage + 0.04 + Math.random() * 0.02);
    captureKeyframe();
    updateCoverage(state.coverage);
    if (state.coverage >= 0.6) $('btn-finish-capture').disabled = false;
    if (state.coverage >= 1) stopCaptureLoop();
  }, 400);
}

function stopCaptureLoop() {
  if (coverageTimer) { clearInterval(coverageTimer); coverageTimer = null; }
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
  _keyframeCanvas.toBlob(
    (blob) => {
      if (blob && state.capturedFrames.length < MAX_KEYFRAMES) {
        state.capturedFrames.push(blob);
      }
    },
    'image/jpeg',
    0.72
  );
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
// Upload — POST /api/v1/capture  (live)
// ============================================================================

/**
 * Upload captured keyframes to the reconstruction service.
 *
 * @param {Blob[]} frames captured JPEG keyframes
 * @param {(pct:number)=>void} onProgress 0..1 upload progress
 * @returns {Promise<string>} captureId
 */
function uploadCapture(frames, onProgress) {
  return new Promise((resolve, reject) => {
    if (!frames || !frames.length) {
      reject(new Error(t('error.noFrames', null,
        'No frames were captured — try scanning the room again.')));
      return;
    }
    const form = new FormData();
    frames.forEach((blob, i) => form.append('frames', blob, `frame_${i}.jpg`));
    form.append(
      'meta',
      JSON.stringify({
        device: navigator.userAgent,
        frameCount: frames.length,
        coverage: state.coverage,
      })
    );

    // XHR (not fetch) so the progress bar reflects real upload progress.
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/api/v1/capture`);
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
  const POLL_MS = 2000;
  const MAX_MS = 10 * 60 * 1000;
  const MAX_CONSECUTIVE_FAILURES = 5;
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
        throw new Error(job.error || t('error.reconstructionFailed', null,
          'Reconstruction failed.'));
      }
      if (job.status === 'cancelled') {
        return null; // user cancelled — handled quietly, not an error
      }
      // queued | analyzing | reconstructing
      const stage = job.status === 'queued' ? 'analyzing' : job.status;
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
  if (!captureId) return;
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
async function loadSplatViewer(canvas, splatUrl, trackStatus) {
  // When trackStatus is true this is the REAL capture viewer: record the
  // viewer status in `state` so relocalizeDynamic() can re-render the toolbar
  // on a locale switch. The intro preview passes false — it must not touch the
  // capture viewer's shared status state (it also shields the DOM, see
  // loadSplatViewerInto).
  function viewerStatus(status, offlineFile) {
    if (trackStatus) {
      state.viewerStatus = status;
      state.viewerOfflineFile = offlineFile || null;
    }
  }
  viewerStatus('loading');
  $('viewer-meta').textContent = t('viewer.metaLoading', null, 'Loading splat…');

  // Spherical orbit camera state, shared with the input controller.
  const cam = { theta: 0.6, phi: 1.3, radius: 2.8, autoRotate: true };

  try {
    const THREE = await import(/* @vite-ignore */ THREE_CDN_URL);
    const spark = await import(/* @vite-ignore */ SPARK_CDN_URL);
    const { SplatMesh } = spark;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    resizeRendererToCanvas(renderer, canvas);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);

    const splats = new SplatMesh({ url: splatUrl });
    scene.add(splats);

    const onResize = () => resizeRendererToCanvas(renderer, canvas);
    window.addEventListener('resize', onResize);
    const detachControls = attachViewerControls(canvas, cam);

    let running = true;
    (function frame() {
      if (!running) return; // teardown stops the loop
      if (cam.autoRotate) cam.theta += 0.0016;
      cam.phi = Math.max(0.18, Math.min(Math.PI - 0.18, cam.phi));
      cam.radius = Math.max(0.7, Math.min(8, cam.radius));

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
    $('viewer-note').hidden = true;
    $('viewer-meta').textContent =
      t('viewer.metaControls', null, 'Drag to orbit · scroll or pinch to zoom');

    return () => {
      running = false;
      window.removeEventListener('resize', onResize);
      detachControls();
      try { renderer.dispose(); } catch (e) { /* best effort */ }
    };
  } catch (err) {
    // Fallback: Spark/three CDN not reachable in this environment.
    console.warn('[RakuCapture] Spark viewer unavailable, using placeholder:', err);
    drawViewerPlaceholder(canvas, splatUrl);
    const offlineFile = splatUrl.split('/').pop();
    viewerStatus('placeholder', offlineFile);
    $('viewer-note').hidden = false;
    $('viewer-note').textContent =
      t('viewer.noteOffline', { file: offlineFile },
        'Spark viewer offline — placeholder for ' + offlineFile);
    $('viewer-meta').textContent =
      t('viewer.metaReadyPlaceholder', null, 'Splat ready (placeholder)');
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
    // loadSplatViewer returns a teardown fn; it falls back to a labelled
    // placeholder if the Spark/three CDN modules are unreachable.
    const teardown = await loadSplatViewerInto(canvas, sample.url);
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
 * Thin wrapper around loadSplatViewer for the intro canvas. loadSplatViewer
 * writes status into #viewer-meta / #viewer-note (the *capture* viewer's DOM);
 * for the intro we don't want those touched, so we shield them with temporary
 * detached stand-ins and restore them after.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {string} url
 * @returns {Promise<()=>void>} teardown
 */
async function loadSplatViewerInto(canvas, url) {
  const realMeta = $('viewer-meta');
  const realNote = $('viewer-note');
  // Stand-in nodes so loadSplatViewer's $('viewer-meta')/$('viewer-note')
  // writes land somewhere harmless instead of mutating the capture toolbar.
  const stub = (id) => {
    const el = document.createElement('span');
    el.id = id;
    el.style.display = 'none'; // never let stub status text paint on the page
    return el;
  };
  if (realMeta) realMeta.id = '__viewer-meta-real';
  if (realNote) realNote.id = '__viewer-note-real';
  const tmpMeta = stub('viewer-meta');
  const tmpNote = stub('viewer-note');
  document.body.appendChild(tmpMeta);
  document.body.appendChild(tmpNote);
  try {
    // trackStatus = false: the intro preview must not touch the capture
    // viewer's shared status state.
    return await loadSplatViewer(canvas, url, false);
  } finally {
    tmpMeta.remove();
    tmpNote.remove();
    if (realMeta) realMeta.id = 'viewer-meta';
    if (realNote) realNote.id = 'viewer-note';
  }
}

// ============================================================================
// Orchestration — run the pipeline after capture finishes
// ============================================================================

async function runPipeline() {
  // Take a run token; if the user navigates away, resetRun() bumps it and the
  // stale-token checks below abandon this run without touching the new UI.
  const run = resetRun();
  try {
    state.uploadPct = null;          // null until the first progress event
    showPhase(Phase.UPLOADING);
    setFill('upload-fill', 0);
    applyUploadLabel();              // 'Preparing…' in the active locale
    state.captureId = await uploadCapture(state.capturedFrames, (pct) => {
      state.uploadPct = pct;
      setFill('upload-fill', pct);
      applyUploadLabel();
    });
    if (run !== state.runToken) return;

    state.procStage = null;          // no stage reported yet
    state.procPct = 0;
    showPhase(Phase.PROCESSING);
    applyProcessingLabels();         // default copy in the active locale
    state.splatUrl = await pollReconstruction(
      state.captureId,
      (stage, pct) => {
        state.procStage = stage;
        state.procPct = pct;
        setFill('processing-fill', pct);
        applyProcessingLabels();
      },
      () => run !== state.runToken
    );
    if (run !== state.runToken || !state.splatUrl) return;

    showPhase(Phase.READY);
    state.cleanupSplatUrl = state.splatUrl; // the 'Clean up' button acts on this
    state.viewerStatus = 'loading';
    state.viewerOfflineFile = null;
    const teardown = await loadSplatViewer($('viewer-canvas'), state.splatUrl, true);
    if (run !== state.runToken) {
      teardown(); // user left while the splat was loading
      return;
    }
    state.viewerTeardown = teardown;
  } catch (err) {
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
    const pct = Math.round(state.uploadPct * 100);
    el.textContent = t('uploading.progress', { pct: pct }, 'Uploading ' + pct + '%');
  }
}

/** PROCESSING — stage-specific title + label, or the default copy pre-stage. */
function applyProcessingLabels() {
  const titleEl = $('processing-title');
  const labelEl = $('processing-label');
  const stage = state.procStage;

  if (titleEl) {
    const titleKey = stage == null
      ? 'processing.titleDefault'
      : stage === 'analyzing'
        ? 'processing.titleAnalyzing'
        : stage === 'reconstructing'
          ? 'processing.titleReconstructing'
          : 'processing.titleGeneric';
    titleEl.textContent = t(titleKey, null, 'Processing');
  }

  if (labelEl) {
    if (stage == null) {
      labelEl.textContent =
        t('processing.labelDefault', null, 'This usually takes a minute or two…');
    } else {
      const pct = Math.round((state.procPct || 0) * 100);
      const labelKey = stage === 'reconstructing'
        ? 'processing.labelReconstructing'
        : 'processing.labelAnalyzing';
      const fallbackBase = stage === 'reconstructing'
        ? 'Building Gaussian splats'
        : 'Finding camera poses and features';
      labelEl.textContent =
        t(labelKey, { pct: pct }, fallbackBase + '… ' + pct + '%');
    }
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

function bindEvents() {
  // Intro -> guide (camera permission is requested on the guide screen).
  $('btn-grant-camera').addEventListener('click', () => {
    showPhase(Phase.GUIDE);
  });

  // Guide -> request camera + open capture stage.
  $('btn-begin-capture').addEventListener('click', async () => {
    const ok = await requestCamera();
    if (!ok) return;
    showPhase(Phase.CAPTURE);
    startCaptureLoop();
  });

  // Capture controls.
  $('btn-cancel-capture').addEventListener('click', () => {
    stopCaptureLoop();
    stopCamera();
    showPhase(Phase.INTRO);
  });

  $('btn-finish-capture').addEventListener('click', () => {
    stopCaptureLoop();
    stopCamera();
    runPipeline();
  });

  $('btn-cancel-processing').addEventListener('click', () => {
    cancelReconstruction(state.captureId);
    resetRun(); // abandon the in-flight pipeline so it cannot reappear
    showPhase(Phase.INTRO);
  });

  // Viewer toolbar.
  $('btn-new-capture').addEventListener('click', () => {
    resetRun(); // tears down the viewer's render loop + listeners
    state.captureId = null;
    state.splatUrl = null;
    state.cleanupSplatUrl = null;
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
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url).catch(() => {});
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

    case Phase.CAPTURE:
      // Re-renders #coverage-label and #capture-hint at the live coverage.
      updateCoverage(state.coverage);
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
      showPhase(Phase.INTRO);
      initIntroPreview();
    });
});
