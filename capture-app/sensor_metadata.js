// sensor_metadata.js — Raku Capture per-frame device-sensor metadata
// Copyright (c) 2026 RakuAI, LLC. All rights reserved.
//
// ----------------------------------------------------------------------------
// Collects the sensor data the phone already knows at capture time — per-frame
// timestamps, IMU samples (gravity direction, rotation rate, orientation
// quaternion) and best-effort camera intrinsics — and packages it as the
// `capture_metadata.json` multipart part that rides along with the frame
// upload. The GPU reconstruction worker uses it to SKIP or CONSTRAIN COLMAP
// structure-from-motion (pose priors, gravity alignment, known intrinsics),
// cutting reconstruction from minutes to tens of seconds.
//
// CONTRACT (shared with the raku-api capture endpoint and the recon worker —
// do NOT rename fields; bump `schema_version` for breaking changes):
//
//   {
//     "schema_version": 1,
//     "client":  { "app_version", "ua", "platform" },           // ios|android|other
//     "camera":  { "width", "height", "focal_length_px",
//                  "intrinsics_source",                          // track-settings|device-lookup|none
//                  "device_model_hint", "zoom" },
//     "movement": { "score", "confidence" },                    // additive (see below)
//     "frames": [{ "index", "filename", "t_ms", "pose",
//                  "imu": { "gravity", "rotation_rate", "orientation_quat" } }]
//   }
//
//   - `movement` (ADDITIVE, schema_version unchanged): the client-side
//     translation/parallax estimate from motion_check.js. `score` is 0..1
//     (how much real camera translation the sweep showed) or null when it
//     could not be measured; `confidence` is 0..1 and is 0 exactly when
//     score is null. The backend quality gate can use it to predict
//     zero-baseline ("starburst") failures before burning GPU time.
//
//   - `frames[].filename` matches the as-uploaded multipart part filename
//     (`frame_<index>.jpg`) so the worker can join metadata to images.
//   - `t_ms` is a MONOTONIC timestamp (performance.now()) in ms, relative to
//     the start of the capture sweep (frame 0's grab is near t_ms 0).
//   - `camera.width`/`height` are the dimensions of the UPLOADED frames
//     (after the client-side downscale), NOT the native sensor resolution —
//     so any focal length derived from a device lookup must be scaled to
//     these dimensions before use.
//   - `pose` is null today. When WebXR 6DOF capture lands it becomes
//     {"position":[x,y,z],"quaternion":[x,y,z,w],"source":"webxr"}.
//   - Nulls are EXPLICIT: a missing sensor yields null, never a fake zero.
//
// What is honestly obtainable per platform (verified against specs, not
// hardware, 2026-06-11 — re-verify on devices):
//   - iOS Safari: devicemotion (rotationRate deg/s, accelerationIncludingGravity
//     m/s²) and deviceorientation (alpha/beta/gamma -> quaternion), BOTH gated
//     behind ONE user-gesture permission prompt (DeviceMotionEvent /
//     DeviceOrientationEvent .requestPermission() share the single iOS
//     "Motion & Orientation" grant). No camera focal length, no UA-CH model
//     hint (every iPhone UA says "iPhone") — intrinsics need a server-side
//     guess from the uploaded EXIF-less JPEG dims + `client.ua` iOS version.
//   - Android Chrome: devicemotion/deviceorientation with NO permission
//     prompt; UA-CH high-entropy `model` gives a real device string for a
//     server-side intrinsics lookup; MediaTrackSettings may expose `zoom`.
//     `focalLength` is NOT part of MediaTrackSettings in any shipping
//     browser — `focal_length_px` stays null unless a UA ships it.
//   - WebXR immersive-ar 6DOF poses: NOT integrated. An immersive-ar session
//     takes over the camera and the render loop, which conflicts with the
//     existing getUserMedia <video> + canvas keyframe pipeline. Documented
//     follow-up — see README "Sensor metadata" section.
//
// IMU↔frame association: listeners keep the LATEST sample (sensors fire at
// ~60 Hz; keyframes are grabbed every ~400 ms), and the keyframe grab
// snapshots it at drawImage() time — so each frame carries the sensor sample
// nearest its pixels (≤ ~16 ms skew), without buffering a full sample stream.
//
// Everything here is feature-detected and fails SOFT: a device with no
// sensors, a denied permission, or a throwing API still captures and uploads
// normally — the metadata just carries explicit nulls. Never break capture.
//
// No build step, no framework: a plain ES module imported by capture_app.js.
// ----------------------------------------------------------------------------

'use strict';

// Version string stamped into client.app_version so the worker can reason
// about client-side behavior changes (downscale size, sampling cadence...).
export const SENSOR_APP_VERSION = 'raku-capture-web/1';

export const METADATA_FILENAME = 'capture_metadata.json';

// ============================================================================
// IMU tracking — latest-sample model
// ============================================================================

let _latestMotion = null;      // { gravity:[x,y,z]|null, rotationRate:[a,b,g]|null }
let _latestQuat = null;        // [x,y,z,w] from the most recent deviceorientation
let _onMotion = null;          // bound listeners, for clean removal
let _onOrientation = null;

/** Read {x,y,z}-shaped sensor data into a finite [x,y,z] array, or null. */
function _vec3(v) {
  if (!v) return null;
  const out = [v.x, v.y, v.z];
  return out.every((n) => typeof n === 'number' && Number.isFinite(n)) ? out : null;
}

/** rotationRate is {alpha,beta,gamma} in deg/s. -> [alpha,beta,gamma] or null. */
function _rate3(r) {
  if (!r) return null;
  const out = [r.alpha, r.beta, r.gamma];
  return out.every((n) => typeof n === 'number' && Number.isFinite(n)) ? out : null;
}

/**
 * Convert deviceorientation Tait-Bryan angles (intrinsic Z-X'-Y'' order per
 * the W3C spec: alpha about Z, beta about X, gamma about Y; degrees) to a
 * unit quaternion [x, y, z, w]. This is the W3C-documented conversion.
 */
function _eulerToQuaternion(alpha, beta, gamma) {
  const d2r = Math.PI / 180;
  const _x = (beta || 0) * d2r / 2;
  const _y = (gamma || 0) * d2r / 2;
  const _z = (alpha || 0) * d2r / 2;
  const cX = Math.cos(_x), sX = Math.sin(_x);
  const cY = Math.cos(_y), sY = Math.sin(_y);
  const cZ = Math.cos(_z), sZ = Math.sin(_z);
  return [
    sX * cY * cZ - cX * sY * sZ, // x
    cX * sY * cZ + sX * cY * sZ, // y
    cX * cY * sZ + sX * sY * cZ, // z
    cX * cY * cZ - sX * sY * sZ, // w
  ];
}

function _handleMotion(e) {
  // accelerationIncludingGravity is the gravity-direction signal: when the
  // phone is near-still it ≈ -gravity in device coords (m/s²). Recorded raw —
  // the worker does any still-frame filtering/averaging.
  const gravity = _vec3(e.accelerationIncludingGravity);
  const rotationRate = _rate3(e.rotationRate);
  if (gravity || rotationRate) _latestMotion = { gravity, rotationRate };
}

function _handleSensorOrientation(e) {
  if (typeof e.alpha !== 'number' || !Number.isFinite(e.alpha)) return;
  _latestQuat = _eulerToQuaternion(e.alpha, e.beta, e.gamma);
}

/**
 * Ask for the DeviceMotion permission (iOS 13+ gates the IMU behind a
 * user-gesture prompt; on iOS this is the SAME underlying "Motion &
 * Orientation" grant as DeviceOrientationEvent.requestPermission, so the
 * user sees one prompt, not two). Resolves 'granted'/'denied'; platforms
 * without the gate (Android Chrome, desktop) resolve 'granted'.
 * Best-effort — a denial just leaves the IMU fields null.
 */
export function ensureMotionPermission() {
  try {
    const DME = typeof window !== 'undefined' && window.DeviceMotionEvent;
    if (DME && typeof DME.requestPermission === 'function') {
      return DME.requestPermission().catch(() => 'denied');
    }
  } catch (e) { /* ignore — no gating here */ }
  return Promise.resolve('granted');
}

/**
 * Begin IMU tracking for a fresh capture sweep. Attaches devicemotion +
 * deviceorientation listeners (feature-detected; a denied permission means
 * the events simply never fire and every sample stays null — honest, never
 * fabricated). Also kicks off the async UA-CH device-model lookup so it is
 * resolved by upload time.
 */
export function startSensorCapture() {
  stopSensorCapture();
  _latestMotion = null;
  _latestQuat = null;
  _resolveDeviceModelHint(); // fire-and-forget; cached for buildCaptureMetadata
  if (typeof window === 'undefined') return;
  if ('DeviceMotionEvent' in window) {
    _onMotion = _handleMotion;
    window.addEventListener('devicemotion', _onMotion);
  }
  if ('DeviceOrientationEvent' in window) {
    _onOrientation = _handleSensorOrientation;
    window.addEventListener('deviceorientation', _onOrientation);
  }
}

/** Stop IMU tracking and detach listeners. Idempotent. */
export function stopSensorCapture() {
  if (typeof window === 'undefined') return;
  if (_onMotion) { window.removeEventListener('devicemotion', _onMotion); _onMotion = null; }
  if (_onOrientation) { window.removeEventListener('deviceorientation', _onOrientation); _onOrientation = null; }
}

/**
 * Snapshot a per-frame sensor record at keyframe-grab time (call this at
 * drawImage() time, NOT in the async toBlob callback, so the sample matches
 * the pixels). `t0` is the capture sweep's performance.now() origin.
 *
 * @param {number} t0 performance.now() at capture-sweep start
 * @returns {{t_ms:number, pose:null, imu:object}} schema frame record
 *          (minus index/filename, which are assigned at upload time)
 */
export function sensorFrameRecord(t0) {
  const m = _latestMotion;
  return {
    t_ms: Math.round(performance.now() - (t0 || 0)),
    pose: null, // WebXR 6DOF not integrated — see module header
    imu: {
      gravity: (m && m.gravity) || null,
      rotation_rate: (m && m.rotationRate) || null,
      orientation_quat: _latestQuat ? _latestQuat.slice() : null,
    },
  };
}

// ============================================================================
// Camera intrinsics — best effort
// ============================================================================

let _deviceModelHint = null;   // UA-CH high-entropy model (Android Chrome), or null
let _modelHintRequested = false;

/** Kick off the async UA-CH model lookup once; cache the result. */
function _resolveDeviceModelHint() {
  if (_modelHintRequested) return;
  _modelHintRequested = true;
  try {
    const uad = typeof navigator !== 'undefined' && navigator.userAgentData;
    if (uad && typeof uad.getHighEntropyValues === 'function') {
      uad.getHighEntropyValues(['model'])
        .then((v) => { if (v && v.model) _deviceModelHint = String(v.model); })
        .catch(() => { /* hint stays null */ });
    }
  } catch (e) { /* hint stays null */ }
}

/** 'ios' | 'android' | 'other' from the UA (iPadOS masquerades as Mac). */
export function detectClientPlatform() {
  try {
    const ua = navigator.userAgent || '';
    if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
    if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return 'ios'; // iPadOS
    if (/Android/i.test(ua)) return 'android';
  } catch (e) { /* fall through */ }
  return 'other';
}

/**
 * Snapshot camera-track settings while the stream is still LIVE (after
 * stopCamera() getSettings() returns {}). Call from the capture loop start.
 *
 * @param {MediaStream|null} stream the live getUserMedia stream
 * @returns {{width:number|null, height:number|null, focal_length_px:number|null, zoom:number|null}}
 */
export function snapshotCameraSettings(stream) {
  const out = { width: null, height: null, focal_length_px: null, zoom: null };
  try {
    const track = stream && stream.getVideoTracks && stream.getVideoTracks()[0];
    const s = track && track.getSettings ? track.getSettings() : null;
    if (s) {
      if (Number.isFinite(s.width)) out.width = s.width;
      if (Number.isFinite(s.height)) out.height = s.height;
      // No shipping browser exposes focal length via MediaTrackSettings; the
      // defensive read keeps us forward-compatible if one starts to.
      if (Number.isFinite(s.focalLength)) out.focal_length_px = s.focalLength;
      if (Number.isFinite(s.zoom)) out.zoom = s.zoom;
    }
  } catch (e) { /* nulls stay null */ }
  return out;
}

// ============================================================================
// Metadata assembly + pre-warm
// ============================================================================

/**
 * Build the capture_metadata.json object (exact cross-lane schema — see the
 * module header). Frame indexes/filenames are assigned HERE, in upload order,
 * so they always match the `frame_<i>.jpg` part names uploadCapture emits.
 *
 * @param {object} opts
 * @param {number} opts.frameCount      number of room frames being uploaded
 * @param {Array<object>} opts.frameRecords  per-frame records from sensorFrameRecord(),
 *        parallel to the uploaded frames array (missing entries -> null fields)
 * @param {object|null} opts.cameraSettings  snapshotCameraSettings() result
 * @param {{width:number,height:number}|null} opts.uploadedFrameSize  dims of the
 *        as-uploaded (downscaled) JPEGs — preferred over native track dims
 * @param {{score:number|null, confidence:number}|null} [opts.movement]
 *        motion_check.js translation estimate; omitted -> honest
 *        { score: null, confidence: 0 } (unknown, never fabricated)
 * @returns {object} the schema_version 1 metadata object
 */
export function buildCaptureMetadata(opts) {
  const o = opts || {};
  const cam = o.cameraSettings || {};
  const up = o.uploadedFrameSize || null;
  const records = Array.isArray(o.frameRecords) ? o.frameRecords : [];
  const n = o.frameCount || 0;

  const frames = [];
  for (let i = 0; i < n; i++) {
    const r = records[i] || null;
    frames.push({
      index: i,
      filename: 'frame_' + i + '.jpg', // MUST match uploadCapture's part names
      t_ms: r && typeof r.t_ms === 'number' ? r.t_ms : null,
      pose: (r && r.pose) || null,
      imu: (r && r.imu) || { gravity: null, rotation_rate: null, orientation_quat: null },
    });
  }

  const focal = Number.isFinite(cam.focal_length_px) ? cam.focal_length_px : null;
  const intrinsicsSource = focal !== null
    ? 'track-settings'
    : (_deviceModelHint ? 'device-lookup' : 'none');

  let ua = '';
  try { ua = navigator.userAgent || ''; } catch (e) { /* keep '' */ }

  return {
    schema_version: 1,
    client: {
      app_version: SENSOR_APP_VERSION,
      ua: ua,
      platform: detectClientPlatform(),
    },
    camera: {
      // As-uploaded frame dims (post-downscale) — what the worker's SfM sees.
      width: (up && up.width) || cam.width || 0,
      height: (up && up.height) || cam.height || 0,
      focal_length_px: focal,
      intrinsics_source: intrinsicsSource,
      device_model_hint: _deviceModelHint,
      zoom: Number.isFinite(cam.zoom) ? cam.zoom : null,
    },
    // Translation/parallax estimate (motion_check.js). score null +
    // confidence 0 = could not be measured — explicit, never a fake zero.
    movement: (o.movement && typeof o.movement === 'object')
      ? {
          score: typeof o.movement.score === 'number' ? o.movement.score : null,
          confidence: typeof o.movement.confidence === 'number'
            ? o.movement.confidence : 0,
        }
      : { score: null, confidence: 0 },
    frames: frames,
  };
}

/**
 * Fire-and-forget GPU pre-warm ping at scan start, so a worker can be
 * spinning up while the user is still sweeping the room. The endpoint
 * (POST /api/v1/captures/session/start) is being built in parallel — a 404
 * (not deployed yet), a network error, or a CSP block are ALL silently
 * tolerated: this must never block or surface an error to the user.
 *
 * @param {string} apiBase   e.g. https://api.rakuai.com
 * @param {string|null} authToken  bearer token when signed in, else null
 * @param {(sessionId:string)=>void} [onSession]  called (best-effort) with the
 *        server-issued session_id when the response carries one — used by the
 *        client-log shipper to join client logs to the capture session. Never
 *        called when the endpoint is missing/erroring or has no session_id.
 */
export function prewarmCaptureSession(apiBase, authToken, onSession) {
  try {
    if (!apiBase || typeof fetch !== 'function') return;
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = 'Bearer ' + authToken;
    fetch(apiBase + '/api/v1/captures/session/start', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ client: SENSOR_APP_VERSION }),
      keepalive: true,
    }).then((resp) => {
      // 404 = endpoint not rolled out yet; anything non-OK is equally fine.
      if (resp && resp.ok) {
        console.info('[RakuCapture] recon pre-warm acknowledged');
        if (typeof onSession === 'function') {
          resp.json().then((data) => {
            const sid = data && (data.session_id || data.sessionId);
            if (sid) onSession(String(sid));
          }).catch(() => { /* no usable body — session stays unknown */ });
        }
      }
    }).catch(() => { /* advisory only — never surfaces */ });
  } catch (e) { /* never break capture for a pre-warm */ }
}
