// capture-share.js
// Share surface for the capture.html splat viewer.
//
// Design notes (read before editing):
//   * Progressive enhancement only. If the viewer never mounts (PENDING, no
//     WebGL, CDN blocked) this module renders nothing -- it waits for the
//     `raku-splat-ready` event from splat-viewer.js and only then draws the
//     share panel. It must never imply a capture is shareable when none rendered.
//   * Embeds suppress the UI. When the page is loaded with ?noui=1 (the param
//     our own embed snippet sets) the panel is not drawn, so an iframe is a
//     clean viewer with no chrome.
//   * No bundler, no new CDN dependency, ASCII-only -- same rules as
//     splat-viewer.js. Clipboard + Web Share + MediaRecorder are all native.
//   * "Save clip" is feature-detected. If MediaRecorder or canvas.captureStream
//     is unavailable the button is omitted rather than shown-and-broken.

(function () {
  'use strict';

  var PANEL_ID = 'splat-share';

  function params() {
    try { return new URLSearchParams(window.location.search); } catch (e) { return null; }
  }

  // The link that reproduces what is on screen: this page, loaded with the
  // splat URL as ?splat=. splat-viewer.js reads that param on the recipient's
  // side. CSP connect-src still governs which hosts can actually be fetched, so
  // an arbitrary ?splat= host that is not allowlisted simply will not load --
  // the param is not a new fetch-surface beyond the existing CSP.
  function shareUrl(splatUrl) {
    var base = window.location.origin + window.location.pathname;
    return base + '?splat=' + encodeURIComponent(splatUrl);
  }

  function embedSnippet(splatUrl) {
    var src = shareUrl(splatUrl) + '&noui=1';
    return '<iframe src="' + src + '" width="640" height="420" ' +
      'style="border:0;border-radius:14px" allow="xr-spatial-tracking; fullscreen" ' +
      'title="Raku Capture splat"></iframe>';
  }

  function flash(btn, msg) {
    var prev = btn.textContent;
    btn.textContent = msg;
    btn.disabled = true;
    setTimeout(function () { btn.textContent = prev; btn.disabled = false; }, 1400);
  }

  function copy(text, btn) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () { flash(btn, 'Copied'); },
        function () { fallbackCopy(text, btn); }
      );
    } else {
      fallbackCopy(text, btn);
    }
  }

  function fallbackCopy(text, btn) {
    // execCommand path for older/locked-down browsers without async clipboard.
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'absolute';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    flash(btn, ok ? 'Copied' : 'Copy failed');
  }

  function canRecord(handle) {
    return !!(handle && handle.canvas && handle.canvas.captureStream &&
      typeof window.MediaRecorder !== 'undefined');
  }

  function pickMimeType() {
    var prefs = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    for (var i = 0; i < prefs.length; i++) {
      if (window.MediaRecorder.isTypeSupported &&
          window.MediaRecorder.isTypeSupported(prefs[i])) {
        return prefs[i];
      }
    }
    return '';
  }

  // Record a short turntable clip of exactly what is rendering -- no server, no
  // re-render. We spin the model via the viewer's auto-orbit, capture the live
  // canvas stream, and hand back a downloadable file. This is the social-card
  // artifact (feeds accept video, not WebGL embeds).
  function recordClip(handle, btn) {
    if (!canRecord(handle)) { return; }
    var stream;
    try { stream = handle.canvas.captureStream(30); } catch (e) { flash(btn, 'Cannot record'); return; }
    var mime = pickMimeType();
    var rec;
    try { rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream); }
    catch (e) { flash(btn, 'Cannot record'); return; }
    var chunks = [];
    rec.ondataavailable = function (ev) { if (ev.data && ev.data.size) { chunks.push(ev.data); } };
    rec.onstop = function () {
      handle.stopAutoOrbit();
      // iOS Safari records MP4/H.264 by default (it ignores our webm request),
      // so name the file from the ACTUAL container, not a hardcoded .webm.
      var actualMime = rec.mimeType || mime || 'video/webm';
      var isMp4 = actualMime.indexOf('mp4') !== -1;
      var blob = new Blob(chunks, { type: actualMime });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = isMp4 ? 'raku-capture-orbit.mp4' : 'raku-capture-orbit.webm';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      btn.textContent = 'Save orbit clip';
      btn.disabled = false;
    };
    btn.textContent = 'Recording...';
    btn.disabled = true;
    handle.startAutoOrbit();
    // rec.start() can throw (security/invalid-state/unsupported tracks); if it
    // does, restore the UI and auto-orbit instead of getting stuck on
    // "Recording...".
    try {
      rec.start();
    } catch (e) {
      handle.stopAutoOrbit();
      btn.textContent = 'Save orbit clip';
      btn.disabled = false;
      flash(btn, 'Cannot record');
      return;
    }
    // ~6s turntable: long enough for a full-ish rotation at 0.01 rad/frame.
    setTimeout(function () { try { rec.stop(); } catch (e) { /* already stopped */ } }, 6000);
  }

  function button(label) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'splat-share-btn';
    b.textContent = label;
    return b;
  }

  function buildPanel(handle) {
    var host = document.getElementById(PANEL_ID);
    if (!host) {
      // No dedicated container on the page -- nothing to attach to. We do not
      // invent a position; capture.html provides #splat-share where it wants it.
      return;
    }
    host.innerHTML = '';
    var url = handle.splatUrl;

    var copyLink = button('Copy link');
    copyLink.addEventListener('click', function () { copy(shareUrl(url), copyLink); });

    var copyEmbed = button('Copy embed');
    copyEmbed.addEventListener('click', function () { copy(embedSnippet(url), copyEmbed); });

    host.appendChild(copyLink);
    host.appendChild(copyEmbed);

    if (navigator.share) {
      var nativeShare = button('Share');
      nativeShare.addEventListener('click', function () {
        navigator.share({
          title: 'Raku Capture',
          text: 'A 3D scan you can orbit and talk to.',
          url: shareUrl(url),
        }).catch(function () { /* user dismissed -- not an error */ });
      });
      host.appendChild(nativeShare);
    }

    if (canRecord(handle)) {
      var clip = button('Save orbit clip');
      clip.addEventListener('click', function () { recordClip(handle, clip); });
      host.appendChild(clip);
    }
  }

  function start() {
    var p = params();
    if (p && (p.get('noui') === '1' || p.get('noui') === 'true')) {
      // Embedded view -- no chrome.
      return;
    }
    if (window.rakuSplatViewer) {
      buildPanel(window.rakuSplatViewer);
      return;
    }
    // The viewer mounts asynchronously (dynamic import of Spark). Wait for its
    // ready signal so we only ever show share controls over a real render.
    document.addEventListener('raku-splat-ready', function () {
      if (window.rakuSplatViewer) { buildPanel(window.rakuSplatViewer); }
    }, { once: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
