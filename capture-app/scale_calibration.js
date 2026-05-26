// scale_calibration.js — Raku Capture metric-scale calibration helpers
// Copyright (c) 2026 RakuAI, LLC. All rights reserved.
//
// ----------------------------------------------------------------------------
// Metric scale for a phone-only capture (no LiDAR).
//
// Why this exists
// ===============
// Structure-from-Motion reconstructs a scene up to an unknown global SCALE: the
// geometry is correct in shape but arbitrary in size, so an AI assistant cannot
// give absolute measurements ("the wall is 3.2 m") from it. To resolve that
// scale without a depth sensor, the capture includes a few seconds of footage
// of an object whose real-world size is known exactly — a credit card or a
// standard sheet of paper. Downstream, the reconstruction backend detects that
// object in the reconstructed scene, compares its solved size to the known
// real-world size, and multiplies the whole scene by the ratio.
//
// HONEST SCOPE BOUNDARY
// =====================
// This module, and the capture PWA as a whole, does NOT solve metric scale.
// All it does is:
//   1. hold the table of known real-world reference dimensions, and
//   2. produce a small, well-formed `scaleReference` metadata object that the
//      capture POST attaches to its `meta` JSON.
// The actual scale solve — detecting the reference in the frames, measuring its
// reconstructed size, computing and applying the ratio — happens server-side in
// the reconstruction pipeline. Until that backend step ships, attaching this
// metadata does NOT by itself make a capture measurable; it records the
// operator's intent and the ground-truth dimensions the solver will need.
//
// No build step, no framework: a plain ES module imported by capture_app.js.
// ----------------------------------------------------------------------------

'use strict';

// ============================================================================
// Reference dimension table
// ============================================================================
// Every reference is a rigid, planar, mass-produced object with a tightly
// specified real-world size, so its dimensions are ground truth the backend
// can trust. Dimensions are millimetres. `longMm`/`shortMm` are the planar
// extents.
//
// To add a reference: append an entry here AND a matching `scale.ref.<id>.*`
// string set in every locales/<code>.json. Nothing else changes.

/**
 * @typedef {Object} ScaleReference
 * @property {string} id          stable identifier, stored in the metadata
 * @property {number} longMm      longer planar edge, millimetres
 * @property {number} shortMm     shorter planar edge, millimetres
 * @property {number} thicknessMm nominal thickness, millimetres (0 ~ a sheet)
 * @property {string} standard    the spec the dimensions come from
 * @property {string} i18nKey     locale key prefix for this reference's copy
 */

/** @type {Readonly<Record<string, Readonly<ScaleReference>>>} */
const SCALE_REFERENCES = Object.freeze({
  // ISO/IEC 7810 ID-1 — credit / debit / ID cards. The single most reliable
  // household reference: rigid, ubiquitous, and dimensioned to +/-0.1 mm.
  credit_card: Object.freeze({
    id: 'credit_card',
    longMm: 85.60,
    shortMm: 53.98,
    thicknessMm: 0.76,
    standard: 'ISO/IEC 7810 ID-1',
    i18nKey: 'scale.ref.creditCard',
  }),

  // ISO 216 A4 — the international standard sheet (most of the world).
  paper_a4: Object.freeze({
    id: 'paper_a4',
    longMm: 297.0,
    shortMm: 210.0,
    thicknessMm: 0.0,
    standard: 'ISO 216 A4',
    i18nKey: 'scale.ref.paperA4',
  }),

  // ANSI/ASME Y14.1 "Letter" — the standard sheet in the US & Canada.
  paper_letter: Object.freeze({
    id: 'paper_letter',
    longMm: 279.4,
    shortMm: 215.9,
    thicknessMm: 0.0,
    standard: 'ANSI Letter (8.5 x 11 in)',
    i18nKey: 'scale.ref.paperLetter',
  }),
});

// Order the reference picker presents options in. Credit card first: it is the
// most reliable reference and the one the coaching copy recommends.
const SCALE_REFERENCE_ORDER = Object.freeze([
  'credit_card',
  'paper_a4',
  'paper_letter',
]);

// Schema version for the emitted metadata. Bump when the shape changes so the
// reconstruction backend can branch on older captures.
const SCALE_METADATA_VERSION = 1;

// Recommended dwell time, in milliseconds, that the reference should stay in
// frame. Long enough for the solver to get several clean views of it.
const SCALE_CAPTURE_MS = 3000;

// ============================================================================
// Lookups
// ============================================================================

/**
 * Look up a reference by id.
 * @param {string} id
 * @returns {Readonly<ScaleReference>|null}
 */
function getScaleReference(id) {
  if (!id) return null;
  return Object.prototype.hasOwnProperty.call(SCALE_REFERENCES, id)
    ? SCALE_REFERENCES[id]
    : null;
}

/**
 * All references in display order — for rendering the picker.
 * @returns {Readonly<ScaleReference>[]}
 */
function listScaleReferences() {
  return SCALE_REFERENCE_ORDER.map((id) => SCALE_REFERENCES[id]);
}

// ============================================================================
// Metadata builder
// ============================================================================

/**
 * Build the `scaleReference` object that the capture POST attaches to its
 * `meta` JSON. This is the ONLY thing the capture side contributes to metric
 * scale — see the scope boundary at the top of this file.
 *
 * Two shapes:
 *   - skipped:  { version, present:false, skipped:true }
 *               — the user opted out (e.g. a LiDAR phone, or no reference to
 *                 hand). The backend treats the capture as scale-unknown.
 *   - captured: { version, present:true, skipped:false, referenceId,
 *                 standard, dimensionsMm:{long,short,thickness},
 *                 dwellMs, frameCount, capturedAt }
 *               — ground truth for the solver: which object to find and its
 *                 exact real-world size.
 *
 * @param {Object}  opts
 * @param {string} [opts.referenceId] id of the chosen reference; omit to skip
 * @param {boolean}[opts.skipped]     true when the user explicitly skipped
 * @param {number} [opts.frameCount]  how many dedicated reference frames were
 *                                    grabbed (0 is valid — the solver can also
 *                                    use the reference if it appears in the
 *                                    main sweep)
 * @param {number} [opts.dwellMs]     how long the reference was held in frame
 * @returns {Object} the `scaleReference` metadata object
 */
function buildScaleMetadata(opts) {
  const o = opts || {};

  // Skip path — explicit opt-out, or no usable reference id supplied.
  const ref = getScaleReference(o.referenceId);
  if (o.skipped || !ref) {
    return {
      version: SCALE_METADATA_VERSION,
      present: false,
      skipped: true,
    };
  }

  const frameCount = Math.max(0, Math.floor(Number(o.frameCount) || 0));
  const dwellMs = Math.max(0, Math.floor(Number(o.dwellMs) || 0));

  return {
    version: SCALE_METADATA_VERSION,
    present: true,
    skipped: false,
    referenceId: ref.id,
    standard: ref.standard,
    dimensionsMm: {
      long: ref.longMm,
      short: ref.shortMm,
      thickness: ref.thicknessMm,
    },
    dwellMs: dwellMs,
    frameCount: frameCount,
    capturedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Exports
// ============================================================================

export {
  SCALE_REFERENCES,
  SCALE_REFERENCE_ORDER,
  SCALE_METADATA_VERSION,
  SCALE_CAPTURE_MS,
  getScaleReference,
  listScaleReferences,
  buildScaleMetadata,
};
