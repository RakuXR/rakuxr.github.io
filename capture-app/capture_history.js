// capture_history.js -- localStorage capture history for Raku Capture (W2A).
// Copyright (c) 2026 RakuAI, LLC. All rights reserved.
//
// raku-runtime/web/capture/
//
// A scan must be recoverable after the browser tab closes. The capture PWA
// is anonymous-first: most users never sign in, so the raku-api
// GET /api/v1/captures list (JWT-gated) cannot help them. This module is
// the anonymous recovery path -- it records every capture the user starts
// in localStorage so My Captures can list and re-open them next visit.
//
// Mirrors the store pattern in web/glasses/anchors.js: a versioned
// localStorage key, a corrupt-data-tolerant load, an in-memory fallback so
// the module imports cleanly under Node, and a small CaptureHistory class.
//
// REAL: localStorage survives a tab close, a reload, a reboot. A capture
//   started in session 1 is listed and re-openable in session 2.
// SEAM: localStorage is per-device and per-origin. Cross-device recovery is
//   the signed-in path (raku-api owner_account_id); mergeServerCaptures()
//   below is the wiring point for the lane that adds account login.

'use strict';

const STORAGE_KEY = 'raku.capture.history.v1';
const SCHEMA_VERSION = 1;
const MAX_ENTRIES = 60;

const STATUS = Object.freeze({
  PROCESSING: 'processing',
  READY: 'ready',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
});

// The error `code` the capture pipeline stamps onto the Error it throws for a
// *terminal* reconstruction failure -- i.e. the server itself reported
// job.status === 'failed'. Callers persist STATUS.FAILED only when
// isTerminalFailure(err) is true. A transient error -- lost contact (a 404 or
// a run of network blips), a client-side timeout while the server is still
// working, or a viewer-load (WebGL) error on an otherwise-ready splat -- is
// NOT terminal: it must leave the record PROCESSING and recoverable, never
// poison it as a stale 'failed' that re-renders as a current failure on the
// next visit.
const RECON_FAILED_CODE = 'reconstruction-failed';

function isTerminalFailure(err) {
  return !!(err && err.code === RECON_FAILED_CODE);
}


function defaultStore() {
  if (typeof localStorage !== 'undefined') return localStorage;
  const mem = new Map();
  return {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
  };
}

class CaptureHistory {
  constructor(opts) {
    const o = opts || {};
    this._store = o.store || defaultStore();
    this._entries = this._load();
  }

  _load() {
    let raw;
    try { raw = this._store.getItem(STORAGE_KEY); }
    catch (err) { console.warn('[CaptureHistory] read failed:', err.message); return []; }
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.schema !== SCHEMA_VERSION || !Array.isArray(parsed.captures)) {
        console.warn('[CaptureHistory] stored data unrecognised'); return [];
      }
      const valid = parsed.captures.filter(
        (c) => c && typeof c.captureId === 'string' && c.captureId);
      // Cap on read: a hand-edited / oversized store cannot blow past
      // MAX_ENTRIES. Newest kept (sort by createdAt, take the tail).
      valid.sort((a, b) =>
        (a.createdAt || '').localeCompare(b.createdAt || ''));
      return valid.slice(-MAX_ENTRIES);
    } catch (err) { console.warn('[CaptureHistory] not valid JSON'); return []; }
  }

  _persist() {
    const payload = JSON.stringify({ schema: SCHEMA_VERSION, captures: this._entries });
    try { this._store.setItem(STORAGE_KEY, payload); return true; }
    catch (err) { console.warn('[CaptureHistory] write failed:', err.message); return false; }
  }

  list() {
    return this._entries.slice()
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .map((c) => ({ ...c }));
  }

  get(captureId) {
    const found = this._entries.find((c) => c.captureId === captureId);
    return found ? { ...found } : null;
  }

  get count() { return this._entries.length; }

  add(spec) {
    if (!spec || !spec.captureId) throw new Error('CaptureHistory.add: captureId required');
    const now = new Date().toISOString();
    if (this._entries.find((c) => c.captureId === spec.captureId)) {
      return this.update(spec.captureId, spec);
    }
    const entry = {
      captureId: spec.captureId,
      label: spec.label || defaultLabel(now),
      status: spec.status || STATUS.PROCESSING,
      splatUrl: spec.splatUrl || null,
      thumbnail: spec.thumbnail || null,
      device: spec.device || null,
      createdAt: now,
      updatedAt: now,
    };
    this._entries.push(entry);
    if (this._entries.length > MAX_ENTRIES) {
      this._entries.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
      this._entries = this._entries.slice(this._entries.length - MAX_ENTRIES);
    }
    this._persist();
    return { ...entry };
  }

  update(captureId, patch) {
    const e = this._entries.find((c) => c.captureId === captureId);
    if (!e) return null;
    const p = patch || {};
    if (typeof p.label === 'string') e.label = p.label;
    if (typeof p.status === 'string') e.status = p.status;
    if (p.splatUrl !== undefined) e.splatUrl = p.splatUrl || null;
    if (p.thumbnail !== undefined) e.thumbnail = p.thumbnail || null;
    if (p.device !== undefined && p.device) e.device = p.device;
    e.updatedAt = new Date().toISOString();
    this._persist();
    return { ...e };
  }

  remove(captureId) {
    const before = this._entries.length;
    this._entries = this._entries.filter((c) => c.captureId !== captureId);
    if (this._entries.length === before) return false;
    this._persist();
    return true;
  }

  clear() {
    this._entries = [];
    try { this._store.removeItem(STORAGE_KEY); }
    catch (err) { console.warn('[CaptureHistory] clear failed:', err.message); }
  }

  mergeServerCaptures(serverCaptures) {
    if (!Array.isArray(serverCaptures)) return;
    for (const sc of serverCaptures) {
      if (!sc || !sc.capture_id) continue;
      const status = mapServerStatus(sc.status);
      if (this.get(sc.capture_id)) {
        this.update(sc.capture_id, { status, splatUrl: sc.splat_url });
      } else {
        this.add({ captureId: sc.capture_id, status, splatUrl: sc.splat_url || null, device: sc.device || null });
      }
    }
  }
}

function defaultLabel(iso) {
  try {
    const d = new Date(iso);
    return 'Capture - ' + d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  } catch (err) { return 'Capture'; }
}

function mapServerStatus(s) {
  switch (s) {
    case 'complete': return STATUS.READY;
    case 'failed': return STATUS.FAILED;
    case 'expired': return STATUS.FAILED;
    default: return STATUS.PROCESSING;
  }
}

export {
  CaptureHistory, STORAGE_KEY, SCHEMA_VERSION, MAX_ENTRIES, STATUS,
  RECON_FAILED_CODE, isTerminalFailure,
  defaultLabel, mapServerStatus,
};
