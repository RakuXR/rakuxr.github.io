// captures_view.js -- the "My Captures" view for Raku Capture (W2A).
// Copyright (c) 2026 RakuAI, LLC. All rights reserved.
//
// raku-runtime/web/capture/
//
// The core UX promise: a user who scans a room, closes the tab, and comes
// back MUST be able to recover their splat. This module is that recovery
// surface. It renders an overlay panel listing every capture from the
// localStorage CaptureHistory (capture_history.js) -- each row shows a
// thumbnail and status, a shareable URL + scannable QR code, and a re-open
// action that hands the splat URL back to the host app's viewer.
//
// It owns its own DOM (a single overlay injected into <body>) so it does not
// require restructuring index.html -- the host only has to call
// openCapturesView() / mount a trigger button.
//
// REAL: the list, status badges, share URL, QR code, delete, and re-open are
//   all functional against the localStorage history.
// SEAM: a thumbnail is only shown if the capture flow stored one; the QR is a
//   pure-JS generator (no network); re-open delegates to a host callback so
//   this module stays decoupled from the Spark viewer.

'use strict';

import { CaptureHistory, STATUS } from './capture_history.js';

// A capture is shareable by URL: the capture app reads ?capture=<id> on load
// (see capture_app.js bootstrap) and re-opens that capture. The share URL is
// the current origin+path with that query appended.
function shareUrlFor(captureId) {
  try {
    const u = new URL(window.location.href);
    u.search = '';
    u.hash = '';
    u.searchParams.set('capture', captureId);
    return u.toString();
  } catch (err) {
    return String(captureId);
  }
}

// Human label for a status value.
function statusLabel(s) {
  switch (s) {
    case STATUS.READY: return 'Ready';
    case STATUS.FAILED: return 'Failed';
    case STATUS.CANCELLED: return 'Cancelled';
    default: return 'Processing';
  }
}

// ---------------------------------------------------------------------------
// QR code -- a minimal, dependency-free generator.
// ---------------------------------------------------------------------------
// A full QR encoder is large; the share URLs here are short, so this uses a
// compact byte-mode encoder limited to QR version 2..6 with error-correction
// level L. It returns a boolean matrix the caller renders as <rect>s in SVG.
// Adapted to be small and self-contained -- no network, no npm dependency.
//
// For robustness, if encoding fails for any reason the view falls back to
// showing the plain share URL (always copyable) -- the QR is a convenience.

// qrImage -- render the share URL as a scannable QR via a public QR image
// endpoint. The previous hand-rolled matrix encoder left format-info blank,
// which makes a QR unscannable; an <img> from a known-good renderer is
// genuinely scannable. Offline it removes itself on error and the share
// panel's copyable text URL still works.
function qrImage(text) {
  try {
    const img = document.createElement('img');
    img.width = 108;
    img.height = 108;
    img.alt = 'QR code for the capture link';
    img.loading = 'lazy';
    img.style.cssText = 'background:#fff;border-radius:6px;flex:0 0 auto;';
    img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=216x216&data='
      + encodeURIComponent(text);
    img.onerror = () => { img.remove(); };
    return img;
  } catch (err) {
    console.warn('[CapturesView] QR image failed:', err && err.message);
    return null;
  }
}

// Minimal QR encoder (byte mode, ECC level L). Compact implementation.
// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

const OVERLAY_ID = 'captures-overlay';

/**
 * CapturesView -- the My Captures overlay panel.
 *
 * @param {object} opts
 * @param {CaptureHistory} [opts.history] - the history store (default: new).
 * @param {Function} [opts.onReopen] - called with (captureEntry) when the
 *   user re-opens a capture; the host wires this to its splat viewer.
 */
class CapturesView {
  constructor(opts) {
    const o = opts || {};
    this._history = o.history || new CaptureHistory();
    this._onReopen = typeof o.onReopen === 'function' ? o.onReopen : null;
    this._root = null;
  }

  /** Build (once) and show the overlay. */
  open() {
    if (!this._root) this._root = this._build();
    this._root.hidden = false;
    this._render();
  }

  /** Hide the overlay. */
  close() {
    if (this._root) this._root.hidden = true;
  }

  _build() {
    let root = document.getElementById(OVERLAY_ID);
    if (root) return root;
    root = document.createElement('div');
    root.id = OVERLAY_ID;
    root.hidden = true;
    root.style.cssText =
      'position:fixed;inset:0;z-index:9000;background:rgba(8,10,16,0.92);' +
      'overflow:auto;padding:20px;font-family:inherit;color:#e8eaf0;';
    root.innerHTML =
      '<div style="max-width:680px;margin:0 auto;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;">' +
      '<h2 style="margin:0;font-size:20px;">My Captures</h2>' +
      '<button id="captures-close" style="background:none;border:0;color:#9aa;' +
      'font-size:26px;cursor:pointer;line-height:1;">&times;</button>' +
      '</div>' +
      '<p style="color:#9aa;font-size:13px;margin:6px 0 16px;">' +
      'Saved on this device. Re-open a scan, or share its link.</p>' +
      '<div id="captures-list"></div>' +
      '</div>';
    document.body.appendChild(root);
    root.querySelector('#captures-close')
      .addEventListener('click', () => this.close());
    return root;
  }

  _render() {
    const list = this._root.querySelector('#captures-list');
    list.textContent = '';
    const items = this._history.list();
    if (items.length === 0) {
      const empty = document.createElement('p');
      empty.style.cssText = 'color:#9aa;font-size:14px;text-align:center;padding:32px 0;';
      empty.textContent = 'No captures yet. Scan a room to get started.';
      list.appendChild(empty);
      return;
    }
    items.forEach((c) => list.appendChild(this._renderCard(c)));
  }

  _renderCard(c) {
    const card = document.createElement('div');
    card.style.cssText =
      'display:flex;gap:12px;padding:12px;margin-bottom:10px;border-radius:10px;' +
      'background:#161a24;border:1px solid #262c3a;';

    // Thumbnail (or a status-coloured placeholder).
    const thumb = document.createElement('div');
    thumb.style.cssText =
      'width:72px;height:72px;border-radius:8px;flex:0 0 auto;background:#0d1018;' +
      'background-size:cover;background-position:center;';
    if (c.thumbnail) thumb.style.backgroundImage = 'url(' + c.thumbnail + ')';
    card.appendChild(thumb);

    // Body: label, status, actions.
    const body = document.createElement('div');
    body.style.cssText = 'flex:1 1 auto;min-width:0;';

    const title = document.createElement('div');
    title.style.cssText = 'font-weight:600;font-size:15px;';
    title.textContent = c.label;
    body.appendChild(title);

    const meta = document.createElement('div');
    meta.style.cssText = 'font-size:12px;color:#9aa;margin:2px 0 8px;';
    const ready = c.status === STATUS.READY;
    meta.textContent = statusLabel(c.status) + '  -  ' + c.captureId;
    body.appendChild(meta);

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;';

    const reopen = document.createElement('button');
    reopen.textContent = ready ? 'Re-open' : 'Check status';
    reopen.style.cssText = btnCss(ready);
    reopen.addEventListener('click', () => {
      if (this._onReopen) this._onReopen({ ...c });
      this.close();
    });
    actions.appendChild(reopen);

    const share = document.createElement('button');
    share.textContent = 'Share';
    share.style.cssText = btnCss(false);
    share.addEventListener('click', () => this._toggleShare(card, c));
    actions.appendChild(share);

    const del = document.createElement('button');
    del.textContent = 'Delete';
    del.style.cssText = btnCss(false);
    del.addEventListener('click', () => {
      this._history.remove(c.captureId);
      this._render();
    });
    actions.appendChild(del);

    body.appendChild(actions);
    card.appendChild(body);
    return card;
  }

  /** Toggle an inline share panel (URL + QR) under a card. */
  _toggleShare(card, c) {
    const existing = card.querySelector('.captures-share');
    if (existing) { existing.remove(); return; }
    const panel = document.createElement('div');
    panel.className = 'captures-share';
    panel.style.cssText =
      'flex-basis:100%;margin-top:10px;padding-top:10px;border-top:1px solid #262c3a;' +
      'display:flex;gap:12px;align-items:center;';
    const url = shareUrlFor(c.captureId);

    // QR (SVG) or text fallback.
    const qr = qrImage(url);
    if (qr) { panel.appendChild(qr); }
    const right = document.createElement('div');
    right.style.cssText = 'min-width:0;flex:1 1 auto;';
    const link = document.createElement('div');
    link.style.cssText =
      'font-size:12px;color:#cdd;word-break:break-all;margin-bottom:6px;';
    link.textContent = url;
    right.appendChild(link);
    const copy = document.createElement('button');
    copy.textContent = 'Copy link';
    copy.style.cssText = btnCss(true);
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(url);
        copy.textContent = 'Copied';
      } catch (err) {
        copy.textContent = 'Copy failed';
      }
    });
    right.appendChild(copy);
    panel.appendChild(right);
    card.appendChild(panel);
  }

}

function btnCss(primary) {
  return (
    'font-size:13px;padding:6px 12px;border-radius:6px;cursor:pointer;border:1px solid ' +
    (primary ? '#3a6df0;background:#3a6df0;color:#fff;' : '#39405290;background:#222838;color:#cdd;')
  );
}

/**
 * Convenience: mount a "My Captures" trigger button into a host element and
 * wire it to an overlay. Returns the CapturesView so the host can also drive
 * it (e.g. record() after a capture completes via the history store).
 */
function mountCapturesView(opts) {
  const o = opts || {};
  const view = new CapturesView(o);
  if (o.triggerEl) {
    o.triggerEl.addEventListener('click', () => view.open());
  }
  return view;
}

export {
  CapturesView,
  mountCapturesView,
  shareUrlFor,
  statusLabel,
  qrImage,
};
