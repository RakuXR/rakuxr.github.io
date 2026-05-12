/**
 * RakuAI Arcade — shared mini-library for games
 * ==============================================
 * Inline-friendly helpers used by every game in /games/:
 *   - installApiOverlay({ gameName })     → top-left API badge + F2 overlay
 *   - createSound()                        → Web Audio beep/noise/slide, gesture-unlocked
 *   - installLauncherIntegration(gameName) → ESC / back button, postMessage
 *   - ensureIframeFocus()                  → window.focus() on click/key/message
 *   - relayApiCallsToParent(engine)        → forward engine 'api' events
 *
 * Usage (in each game):
 *   import { installApiOverlay, createSound, installLauncherIntegration,
 *            ensureIframeFocus, relayApiCallsToParent } from '/games/lib/game-shared.js';
 *
 *   const overlay = installApiOverlay({ gameName: 'Meteor Storm' });
 *   const sound   = createSound();
 *   installLauncherIntegration('Meteor Storm');
 *   ensureIframeFocus();
 *   // If using RakuEngine:
 *   relayApiCallsToParent(engine);
 *   engine.on('api', (e) => overlay.log(e));
 */

// ---------------------------------------------------------------------------
// API overlay — top-left pulsing API badge, F2 to toggle full panel
// ---------------------------------------------------------------------------
export function installApiOverlay({ gameName = 'Raku Game', maxEntries = 40 } = {}) {
  if (document.getElementById('raku-api-overlay')) {
    // Already installed
    return window.__rakuApiOverlay;
  }

  const style = document.createElement('style');
  style.textContent = `
    #raku-api-badge {
      position: fixed; top: 10px; left: 10px;
      background: #00ffff; color: #000;
      font-family: 'Press Start 2P', 'Courier New', monospace;
      font-size: 9px; padding: 6px 10px;
      z-index: 99996; cursor: pointer;
      border: none; border-radius: 4px;
      animation: rakuApiPulse 1.6s infinite;
      box-shadow: 0 0 10px rgba(0,255,255,0.7);
      user-select: none;
    }
    #raku-api-badge:hover { transform: scale(1.05); }
    @keyframes rakuApiPulse {
      0%,100% { box-shadow: 0 0 8px rgba(0,255,255,0.7); }
      50%     { box-shadow: 0 0 22px rgba(0,255,255,1); }
    }
    #raku-api-overlay {
      position: fixed; top: 46px; left: 10px;
      width: 300px; max-height: 55vh;
      background: rgba(0,0,0,0.88);
      border: 1px solid #00ffff; border-radius: 4px;
      color: #00ffff;
      font-family: 'Courier New', monospace;
      font-size: 10px; padding: 8px;
      z-index: 99997; display: none;
      box-shadow: 0 0 14px rgba(0,255,255,0.4);
    }
    #raku-api-overlay.visible { display: block; }
    #raku-api-overlay .title {
      color: #ffff00; font-weight: bold; font-size: 11px;
      margin-bottom: 4px; border-bottom: 1px solid #00ffff;
      padding-bottom: 3px;
      display: flex; justify-content: space-between; align-items: center;
    }
    #raku-api-overlay .title small { color:#888; font-weight:normal; font-size:8px; }
    #raku-api-list {
      max-height: calc(55vh - 40px); overflow-y: auto; padding-right: 3px;
    }
    #raku-api-list::-webkit-scrollbar { width: 6px; }
    #raku-api-list::-webkit-scrollbar-thumb { background: #00ffff; }
    #raku-api-list .row {
      padding: 2px 0; border-bottom: 1px dashed rgba(0,255,255,0.15);
      display: flex; gap: 4px; flex-wrap: wrap; line-height: 1.4;
    }
    #raku-api-list .method { color: #ffcc00; font-weight: bold; min-width: 38px; }
    #raku-api-list .path { color: #fff; flex: 1 1 auto; word-break: break-all; }
    #raku-api-list .ok   { color: #66ff66; }
    #raku-api-list .warn { color: #ffdd66; }
    #raku-api-list .bad  { color: #ff6666; }
    #raku-api-list .ts   { color: #888; font-size: 8px; }
    #raku-api-list .empty { color:#666; padding:8px; text-align:center; }
  `;
  document.head.appendChild(style);

  const badge = document.createElement('button');
  badge.id = 'raku-api-badge';
  badge.textContent = 'API';
  badge.title = 'Toggle API debug (F2)';
  document.body.appendChild(badge);

  const panel = document.createElement('div');
  panel.id = 'raku-api-overlay';
  panel.setAttribute('aria-live', 'polite');
  panel.innerHTML =
    `<div class="title">RakuEngine API <small>${gameName} • F2 hide</small></div>` +
    `<div id="raku-api-list"></div>`;
  document.body.appendChild(panel);

  const listEl = panel.querySelector('#raku-api-list');
  let entries = [];
  let visible = false;

  function latencyClass(ms) {
    if (ms < 50) return 'ok';
    if (ms < 200) return 'warn';
    return 'bad';
  }

  function render() {
    if (!entries.length) {
      listEl.innerHTML = '<div class="empty">No API calls yet.</div>';
      return;
    }
    listEl.innerHTML = entries.slice(0, maxEntries).map(e => {
      const lat = (e.latency | 0) + 'ms';
      const cls = latencyClass(e.latency);
      const ts  = new Date(e.time || Date.now()).toLocaleTimeString().slice(-8);
      return `<div class="row">` +
             `<span class="method">${e.method || 'GET'}</span>` +
             `<span class="path">${e.path || ''}</span>` +
             `<span class="${cls}">${lat}</span>` +
             `<span class="ts">${ts}</span></div>`;
    }).join('');
  }

  function log(entry) {
    entries.unshift(entry);
    if (entries.length > maxEntries) entries.length = maxEntries;
    badge.style.animationDuration = '0.4s';
    setTimeout(() => { badge.style.animationDuration = '1.6s'; }, 400);
    if (visible) render();
  }

  function show() { visible = true; panel.classList.add('visible'); render(); }
  function hide() { visible = false; panel.classList.remove('visible'); }
  function toggle() { visible ? hide() : show(); }

  badge.addEventListener('click', toggle);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F2') { e.preventDefault(); toggle(); }
  });

  const api = { log, show, hide, toggle, get entries() { return entries; } };
  window.__rakuApiOverlay = api;
  return api;
}

// ---------------------------------------------------------------------------
// Sound helper — gesture-unlocked Web Audio with simple effect primitives
// ---------------------------------------------------------------------------
export function createSound() {
  let ctx = null;
  let master = null;
  let muted = false;
  let volume = 0.4;

  function ensure() {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createGain();
        master.gain.value = muted ? 0 : volume;
        master.connect(ctx.destination);
      } catch (e) { /* ignored */ }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  // Unlock on first user gesture (required by Chrome/Safari autoplay policy).
  const unlock = () => ensure();
  ['click', 'keydown', 'touchstart', 'pointerdown'].forEach(ev => {
    window.addEventListener(ev, unlock, { once: false, passive: true });
  });
  // Expose the unlock function on a well-known global so other modules
  // (e.g. the touch overlay) can call it directly inside their own native
  // input handlers — synthetic KeyboardEvents are NOT trusted user
  // gestures and won't unlock AudioContext on iOS Safari, so the touch
  // overlay needs to call this from its real pointerdown handlers.
  try { window.__rakuSoundEnsure = ensure; } catch (e) { /* ignore */ }

  function beep(freq, ms, type = 'square', vol = 0.4) {
    const c = ensure();
    if (!c || muted) return;
    const t0 = c.currentTime;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + ms / 1000);
    osc.connect(g); g.connect(master);
    osc.start(t0);
    osc.stop(t0 + ms / 1000 + 0.02);
  }

  function slide(fromHz, toHz, ms, type = 'square', vol = 0.4) {
    const c = ensure();
    if (!c || muted) return;
    const t0 = c.currentTime;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(fromHz, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(toHz, 1), t0 + ms / 1000);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + ms / 1000);
    osc.connect(g); g.connect(master);
    osc.start(t0);
    osc.stop(t0 + ms / 1000 + 0.02);
  }

  function noise(ms, vol = 0.3, filterHz = 800) {
    const c = ensure();
    if (!c || muted) return;
    const t0 = c.currentTime;
    const bufSize = Math.max(1, Math.floor(c.sampleRate * ms / 1000));
    const buf = c.createBuffer(1, bufSize, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const filt = c.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = filterHz;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + ms / 1000);
    src.connect(filt); filt.connect(g); g.connect(master);
    src.start(t0);
    src.stop(t0 + ms / 1000);
  }

  // Canned effects
  function fire()    { beep(880, 80, 'square', 0.3); setTimeout(() => beep(660, 60, 'square', 0.2), 30); }
  function boom()    { noise(500, 0.5, 400); slide(220, 60, 500, 'sawtooth', 0.3); }
  function explode() { noise(350, 0.4, 500); }
  function blip()    { beep(660, 40, 'square', 0.2); }
  function hit()     { beep(330, 70, 'square', 0.25); }
  function coin()    { beep(660, 80, 'square', 0.25); setTimeout(() => beep(990, 100, 'square', 0.25), 90); }
  function jump()    { slide(440, 880, 140, 'square', 0.2); }
  function thrust()  { noise(80, 0.08, 150); }
  function death()   { slide(440, 110, 600, 'sawtooth', 0.3); }
  function levelup() { [0,1,2,3].forEach(i => setTimeout(() => beep(440 + i*110, 120, 'square', 0.25), i*100)); }
  function powerup() { [0,1,2,3,4].forEach(i => setTimeout(() => beep(330 + i*110, 70, 'square', 0.2), i*55)); }
  function hurt()    { slide(330, 165, 220, 'sawtooth', 0.25); }
  function shield()  { beep(880, 50, 'triangle', 0.2); setTimeout(() => beep(1175, 80, 'triangle', 0.2), 50); }

  return {
    ensure, beep, slide, noise,
    fire, boom, explode, blip, hit, coin, jump, thrust, death, levelup, powerup, hurt, shield,
    setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : volume; },
    isMuted() { return muted; },
    toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : volume; return muted; },
  };
}

// ---------------------------------------------------------------------------
// Launcher integration — back button, ESC key, postMessage protocol
// ---------------------------------------------------------------------------
export function installLauncherIntegration(gameName) {
  const isEmbedded = new URLSearchParams(location.search).get('launcher') === '1';

  // Back-to-arcade button (only visible when embedded)
  if (isEmbedded && !document.getElementById('raku-launcher-btn')) {
    const btn = document.createElement('a');
    btn.id = 'raku-launcher-btn';
    btn.href = '/games/';
    btn.textContent = '← LAUNCHER';
    btn.title = 'Back to arcade (Esc)';
    btn.style.cssText = `
      position: fixed; top: 10px; left: 70px;
      padding: 6px 12px;
      background: rgba(0,0,0,0.7);
      border: 2px solid #ffff00;
      color: #ffff00;
      font: bold 9px 'Press Start 2P', 'Courier New', monospace;
      text-decoration: none;
      z-index: 99998;
      letter-spacing: 1px;
      border-radius: 4px;
      cursor: pointer;
      text-shadow: 0 0 4px #ffff00;
    `;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      quitToLauncher();
    });
    document.body.appendChild(btn);
  }

  function quitToLauncher(finalScore = 0) {
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'quit', game: gameName, score: finalScore }, '*');
    } else {
      window.location.href = '/games/';
    }
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      quitToLauncher();
    }
  });

  function notifyGameOver(score, level) {
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'gameover', game: gameName, score, level }, '*');
    }
  }
  function notifyScore(score) {
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'score', score }, '*');
    }
  }
  function notifyLevel(level) {
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'level', level }, '*');
    }
  }
  function notifyApiCall(method, path, ok = true) {
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'apicall', method, path, ok }, '*');
    }
  }

  return { quitToLauncher, notifyGameOver, notifyScore, notifyLevel, notifyApiCall, isEmbedded };
}

// ---------------------------------------------------------------------------
// Ensure iframe window receives focus so keyboard events are delivered to
// the game rather than the parent document.
// ---------------------------------------------------------------------------
export function ensureIframeFocus() {
  if (window.parent === window) return; // not embedded

  const grab = () => {
    try { window.focus(); } catch (e) { /* ignore */ }
  };

  // Grab focus when the page loads, when the user clicks, and periodically
  // until the user has interacted.
  grab();
  window.addEventListener('load', grab);
  window.addEventListener('pointerdown', grab, { capture: true });
  window.addEventListener('click', grab, { capture: true });
  window.addEventListener('touchstart', grab, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) grab();
  });

  // The launcher sends a 'focus' message after the iframe loads.
  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'focus') grab();
  });

  // Retry for the first couple of seconds to win over slow layouts.
  let retries = 0;
  const iv = setInterval(() => {
    grab();
    if (++retries > 8) clearInterval(iv);
  }, 250);
}

// ---------------------------------------------------------------------------
// Forward RakuEngine `api` events to the launcher's API display via postMessage.
// ---------------------------------------------------------------------------
export function relayApiCallsToParent(engine) {
  if (window.parent === window || !engine || typeof engine.on !== 'function') return;
  engine.on('api', (entry) => {
    try {
      window.parent.postMessage({
        type: 'apicall',
        method: entry.method || 'GET',
        path: entry.path || '',
        ok: (entry.status || 200) < 400,
      }, '*');
    } catch (e) { /* ignore */ }
  });
}

// ---------------------------------------------------------------------------
// Mobile touch-control overlay
// ---------------------------------------------------------------------------
// Installs a virtual D-pad + action button overlay on touch devices so that
// every arcade game becomes playable from a phone without modifying its
// keyboard or gamepad handlers.
//
//   const touch = installTouchOverlay({
//     engine,                    // optional: RakuEngine to also publishInput to
//     canvas: document.getElementById('game'),
//     dpad: '4way',              // '4way' | 'lr' | 'lr+ud' | 'lr+thrust' | 'none'
//     actions: [
//       { id: 'fire',  label: 'FIRE',  key: ' '      },
//       { id: 'jump',  label: 'JUMP',  key: ' '      },
//       { id: 'shield',label: 'SHIELD',key: 'Shift'  },
//     ],
//     pause: { key: 'p', label: 'II' },         // optional corner pause button
//     orientation: 'portrait',                   // 'portrait' | 'landscape' | 'any'
//   });
//
// Mechanics:
//   - Detects touch via matchMedia('(pointer: coarse)'). On desktop or
//     non-touch devices, returns a no-op stub and renders nothing.
//   - On pointerdown for each button: dispatches a synthetic `keydown` event
//     (so existing game handlers fire unchanged) AND calls engine.publishInput
//     (so the engine's input event channel sees the press too).
//   - On pointerup/cancel/leave: same, with `keyup`.
//   - Pointer events with setPointerCapture handle multi-touch correctly
//     (left + fire simultaneously is one finger per button, distinct
//     pointerIds, no conflict).
//   - Landscape gate: if orientation === 'landscape' and the screen is
//     portrait, shows a "Rotate your phone" message until the user rotates.
//   - Letterboxing is left to the page CSS — the overlay positions itself
//     fixed at the bottom of the viewport with a translucent background.
//
// Returns: { destroy(), isMobile, isVisible() }
// ---------------------------------------------------------------------------
export function installTouchOverlay(config = {}) {
  const noop = { destroy: () => {}, isMobile: false, isVisible: () => false };

  // Only render on touch devices. matchMedia('(pointer: coarse)') is the
  // correct way to ask "is this device's primary pointer a touch screen?"
  // (avoids triggering on touch laptops where a mouse is the primary input).
  let isMobile = false;
  try {
    isMobile = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  } catch (e) { /* ignore */ }
  // Manual override for testing: ?touch=1 in URL forces overlay on.
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('touch') === '1') isMobile = true;
    if (params.get('touch') === '0') isMobile = false;
  } catch (e) { /* ignore */ }
  if (!isMobile) return noop;

  if (document.getElementById('raku-touch-overlay')) {
    // Already installed (hot-reload guard).
    return window.__rakuTouchOverlay || noop;
  }

  const {
    engine = null,
    canvas = null,
    dpad = '4way',
    actions = [],
    pause = null,
    start = null,        // { key: 'Enter', label: 'START' } — for title-screen games
    orientation = 'any',
  } = config;

  // ---- styles ----------------------------------------------------------
  const style = document.createElement('style');
  style.textContent = `
    #raku-touch-overlay {
      position: fixed;
      left: 0; right: 0; bottom: 0;
      z-index: 9999;
      pointer-events: none;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding: 14px 18px calc(14px + env(safe-area-inset-bottom)) 18px;
      font-family: "Press Start 2P", "Courier New", monospace;
      user-select: none;
      -webkit-user-select: none;
      touch-action: none;
    }
    #raku-touch-overlay * { box-sizing: border-box; touch-action: none; }
    .rt-zone { pointer-events: auto; display: grid; gap: 8px; }
    .rt-btn {
      pointer-events: auto;
      background: rgba(20, 22, 30, 0.55);
      border: 2px solid rgba(255, 210, 74, 0.55);
      color: #ffd24a;
      width: 64px; height: 64px;
      border-radius: 14px;
      display: flex; align-items: center; justify-content: center;
      font-size: 12px;
      text-shadow: 1px 1px 0 #000;
      transition: transform 60ms ease, background 60ms ease;
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
    }
    .rt-btn.rt-pressed {
      background: rgba(255, 210, 74, 0.85);
      color: #000;
      transform: scale(0.92);
    }
    .rt-btn.rt-action { width: 72px; height: 72px; border-color: rgba(255, 64, 0, 0.7); color: #ff8040; }
    .rt-btn.rt-action.rt-pressed { background: rgba(255, 80, 32, 0.85); color: #000; }
    .rt-btn.rt-pause {
      width: 44px; height: 44px;
      position: fixed; top: 12px; right: 12px;
      font-size: 14px;
      pointer-events: auto;
      background: rgba(20, 22, 30, 0.55);
      border: 2px solid rgba(150, 230, 255, 0.55);
      color: #9fe;
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
    }
    .rt-btn.rt-start {
      width: auto; padding: 0 14px; height: 44px;
      position: fixed; top: 12px;
      /* default to left of pause if pause exists; otherwise right */
      right: 64px;
      font-size: 12px;
      pointer-events: auto;
      background: rgba(20, 22, 30, 0.55);
      border: 2px solid rgba(140, 255, 140, 0.65);
      color: #9fe89f;
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      letter-spacing: 1px;
    }
    .rt-btn.rt-start.rt-no-pause { right: 12px; }
    /* When the overlay is active:
       - body uses 100dvh (dynamic viewport height) so layout stays stable
         under iOS URL-bar show/hide. We don't touch html — overriding
         html.overflow:hidden + height:100dvh broke games like Alien
         Defense whose wrap layout relied on html being a normal block.
       - Scroll-lock is enforced by document-level touchmove preventDefault
         (installed by JS below), NOT by overflow:hidden on body. That
         turned out to be the only reliable way to stop iOS Safari from
         scrolling the iframe when a finger lands near the fire button.
       - In portrait, the overlay sits at the bottom — we shrink canvas
         max-height by overlay height.
       - In landscape, the overlay floats over the side corners — canvas
         can use the full viewport height. */
    body.rt-overlay-active {
      box-sizing: border-box !important;
      overscroll-behavior: none !important;
      touch-action: manipulation;
    }
    /* Portrait: bottom-mounted controls; canvas height shrinks. */
    @media (orientation: portrait) {
      body.rt-overlay-active {
        padding-bottom: var(--rt-overlay-h, 200px) !important;
      }
      body.rt-overlay-active canvas {
        max-height: calc(100dvh - var(--rt-overlay-h, 200px)) !important;
        max-width: 100vw !important;
      }
    }
    /* Landscape: controls float over the canvas corners. Canvas uses full
       viewport; we only cap width so it doesn't blow past 100vw. */
    @media (orientation: landscape) {
      body.rt-overlay-active {
        padding-bottom: 0 !important;
      }
      body.rt-overlay-active canvas {
        max-height: 100dvh !important;
        max-width: 100vw !important;
      }
      /* Translucent dim behind buttons so they stay readable over gameplay. */
      #raku-touch-overlay .rt-btn {
        background: rgba(20, 22, 30, 0.7) !important;
      }
    }
    .rt-dpad { display: grid; grid-template-columns: repeat(3, 64px); grid-template-rows: repeat(3, 64px); gap: 4px; }
    .rt-dpad .rt-btn { width: 100%; height: 100%; }
    .rt-dpad .rt-spacer { background: transparent; border: none; }
    .rt-actions { display: flex; gap: 10px; align-items: flex-end; }
    .rt-rotate-gate {
      position: fixed; inset: 0; z-index: 10000;
      background: rgba(0, 0, 0, 0.92);
      color: #ffd24a;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      font-family: "Press Start 2P", "Courier New", monospace;
      font-size: 14px; text-align: center; padding: 24px;
      gap: 16px;
    }
    .rt-rotate-gate .rt-rotate-icon {
      font-size: 48px;
      animation: rt-rotate 1.6s ease-in-out infinite;
    }
    @keyframes rt-rotate {
      0%, 100% { transform: rotate(-15deg); }
      50%      { transform: rotate(75deg); }
    }
  `;
  document.head.appendChild(style);

  // ---- overlay element ------------------------------------------------
  const root = document.createElement('div');
  root.id = 'raku-touch-overlay';

  // dpad zone
  const leftZone = document.createElement('div');
  leftZone.className = 'rt-zone rt-dpad-zone';
  if (dpad !== 'none') {
    const dpadGrid = document.createElement('div');
    dpadGrid.className = 'rt-dpad';
    // 3x3 grid: [., up, .] [left, ., right] [., down, .]
    const cells = [
      null, 'up',   null,
      'left', null, 'right',
      null, 'down', null,
    ];
    // For 'lr' dpads, hide up/down. For 'lr+thrust', up=thrust, down=shield-like.
    const showUp   = dpad === '4way' || dpad === 'lr+ud' || dpad === 'lr+thrust';
    const showDown = dpad === '4way' || dpad === 'lr+ud' || dpad === 'lr+thrust';
    for (const cell of cells) {
      const el = document.createElement('div');
      if (cell === null) {
        el.className = 'rt-spacer';
      } else if ((cell === 'up' && !showUp) || (cell === 'down' && !showDown)) {
        el.className = 'rt-spacer';
      } else {
        el.className = 'rt-btn rt-dpad-btn';
        el.dataset.dir = cell;
        el.textContent = cell === 'up' ? '▲' : cell === 'down' ? '▼' : cell === 'left' ? '◀' : '▶';
      }
      dpadGrid.appendChild(el);
    }
    leftZone.appendChild(dpadGrid);
  }
  root.appendChild(leftZone);

  // actions zone
  const rightZone = document.createElement('div');
  rightZone.className = 'rt-zone rt-actions';
  for (const a of actions) {
    const el = document.createElement('div');
    el.className = 'rt-btn rt-action';
    el.dataset.actionId = a.id;
    el.textContent = a.label || a.id.toUpperCase();
    rightZone.appendChild(el);
  }
  root.appendChild(rightZone);

  // pause button (corner)
  let pauseEl = null;
  if (pause) {
    pauseEl = document.createElement('div');
    pauseEl.className = 'rt-btn rt-pause';
    pauseEl.textContent = pause.label || 'II';
    document.body.appendChild(pauseEl);
  }

  // start button (corner — for games that gate behind "PRESS ENTER")
  let startEl = null;
  if (start) {
    startEl = document.createElement('div');
    startEl.className = 'rt-btn rt-start' + (pause ? '' : ' rt-no-pause');
    startEl.textContent = start.label || 'START';
    document.body.appendChild(startEl);
  }

  document.body.appendChild(root);

  // Mark body so the global CSS in this module's <style> can adjust the
  // canvas + padding for the overlay. We deliberately do NOT touch html
  // (overriding html.overflow:hidden / height:100dvh broke Alien Defense
  // in v4). Scroll-lock is installed below as a touchmove listener
  // outside any button — see the document.addEventListener('touchmove')
  // call after the overlay is appended.
  document.body.classList.add('rt-overlay-active');

  // ---- event plumbing -------------------------------------------------
  // Map of dpad direction → KeyboardEvent.key.
  const DPAD_KEYS = {
    left:  'ArrowLeft',
    right: 'ArrowRight',
    up:    'ArrowUp',
    down:  'ArrowDown',
  };

  function dispatchKey(type, key) {
    if (!key) return;
    const ev = new KeyboardEvent(type, {
      key, code: key,
      bubbles: true, cancelable: true,
    });
    window.dispatchEvent(ev);
  }

  function publishToEngine(field, value) {
    if (engine && typeof engine.publishInput === 'function') {
      try { engine.publishInput({ [field]: value }); } catch (e) { /* ignore */ }
    }
  }

  // Synthetic KeyboardEvents are NOT trusted user gestures and won't
  // unlock AudioContext on iOS Safari. The real touch (pointerdown on
  // a button) IS trusted, so we explicitly call the sound module's
  // unlock here while still inside that trusted event. We then play a
  // 1-sample silent buffer through the game's own AudioContext — iOS
  // Safari requires an actual buffer playback inside a trusted gesture
  // to fully unlock the context (resume() alone is insufficient).
  //
  // _audioUnlocked latches true ONLY after a successful src.start(0).
  // If anything earlier threw (e.g. createSound() hadn't finished wiring
  // up window.__rakuSoundEnsure yet, or createBuffer threw), the flag
  // stays false and the next press retries. This avoids the v4 bug
  // where the flag was set unconditionally after the first attempt.
  let _audioUnlocked = false;
  function unlockAudio() {
    if (_audioUnlocked) return;
    try {
      if (typeof window.__rakuSoundEnsure !== 'function') return;
      const ctx = window.__rakuSoundEnsure();
      if (!ctx || typeof ctx.createBuffer !== 'function') return;
      // ctx.resume() returns a Promise but iOS unlocks based on the
      // synchronous start() call below — we don't need to await.
      if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
        try { ctx.resume(); } catch (e) { /* ignore */ }
      }
      const buf = ctx.createBuffer(1, 1, ctx.sampleRate);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
      _audioUnlocked = true;
    } catch (e) { /* ignore */ }
  }

  // Registry of every wired button so a global pointerup safety net can
  // release any button that got stuck because its pointerup fired on a
  // different element (Safari occasionally loses pointer capture).
  const wiredButtons = [];

  function wireButton(el, { key, field, sticky = false, oneShot = false, oneShotMs = 80 }) {
    if (!el) return;
    let pointerId = null;
    let active = false;

    function forceRelease() {
      if (!active) return;
      active = false;
      el.classList.remove('rt-pressed');
      try { el.releasePointerCapture(pointerId); } catch (err) { /* ignore */ }
      pointerId = null;
      if (!sticky) {
        dispatchKey('keyup', key);
        publishToEngine(field, false);
      }
    }

    function press(e) {
      unlockAudio();  // trusted user gesture — unlock Web Audio here
      if (active) return;
      active = true;
      el.classList.add('rt-pressed');
      pointerId = e.pointerId;
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      if (sticky) {
        const toggled = !el.dataset.toggleOn;
        if (toggled) {
          el.dataset.toggleOn = '1';
          dispatchKey('keydown', key);
          publishToEngine(field, true);
        } else {
          delete el.dataset.toggleOn;
          dispatchKey('keyup', key);
          publishToEngine(field, false);
        }
      } else {
        dispatchKey('keydown', key);
        publishToEngine(field, true);
      }
      // For oneShot buttons (START/PAUSE/JUMP), release the key after a short
      // delay so the game sees it as a quick tap rather than a held press.
      // Per-button duration via oneShotMs lets us tune e.g. jump button
      // height (shorter press = lower jump on variable-jump platformers).
      if (oneShot) {
        setTimeout(() => {
          if (active) forceRelease();
        }, oneShotMs);
      }
      e.preventDefault();
    }
    function release(e) {
      if (!active) return;
      if (pointerId !== null && e.pointerId !== pointerId) return;
      forceRelease();
      e.preventDefault();
    }

    el.addEventListener('pointerdown', press, { passive: false });
    el.addEventListener('pointerup', release, { passive: false });
    el.addEventListener('pointercancel', release, { passive: false });
    // Note: we deliberately do NOT release on pointerleave when capture is
    // active — the button stays pressed even if the finger drags off, which
    // is the expected mobile-game-controller behaviour.
    el.addEventListener('contextmenu', (e) => e.preventDefault());

    wiredButtons.push({ el, forceRelease });
  }

  // Wire dpad buttons
  root.querySelectorAll('.rt-dpad-btn').forEach((el) => {
    const dir = el.dataset.dir;
    wireButton(el, { key: DPAD_KEYS[dir], field: dir });
  });

  // Wire action buttons
  root.querySelectorAll('.rt-action').forEach((el) => {
    const id = el.dataset.actionId;
    const def = actions.find((a) => a.id === id);
    if (!def) return;
    wireButton(el, {
      key: def.key,
      field: def.id,
      sticky: !!def.sticky,
      oneShot: !!def.oneShot,
      oneShotMs: def.oneShotMs || 80,
    });
  });

  // Wire pause + start as one-shot taps (auto-release after a short delay).
  if (pauseEl && pause) {
    wireButton(pauseEl, { key: pause.key, field: 'pause', oneShot: true });
  }
  if (startEl && start) {
    wireButton(startEl, { key: start.key || 'Enter', field: 'start', oneShot: true });
  }

  // Global pointerup safety net — if a button's own pointerup got lost
  // (Safari pointer-capture quirk), force-release any button still in
  // the pressed state.
  window.addEventListener('pointerup', () => {
    for (const b of wiredButtons) b.forceRelease();
  }, { passive: true });
  window.addEventListener('blur', () => {
    for (const b of wiredButtons) b.forceRelease();
  });

  // Scroll-lock the iframe. Without this, iOS Safari treats the iframe
  // as scrollable whenever body content + padding-bottom exceeds the
  // visible viewport — a finger landing near the bottom-mounted action
  // buttons can register as a drag and scroll the page, visibly jumping
  // the canvas mid-play (the bug the user captured in a screen recording).
  // overflow:hidden alone wasn't enough; touchmove preventDefault is.
  // The handler is a named function so destroy() can removeEventListener it;
  // it also no-ops if the overlay class is gone (defence-in-depth, so a
  // missed teardown doesn't permanently disable page scrolling).
  function scrollLockHandler(e) {
    if (!document.body.classList.contains('rt-overlay-active')) return;
    const t = e.target;
    if (t && t.closest && t.closest('#raku-touch-overlay, .rt-pause, .rt-start')) return;
    e.preventDefault();
  }
  document.addEventListener('touchmove', scrollLockHandler, { passive: false });

  // ---- orientation gate (landscape-required games) -------------------
  let rotateGate = null;
  function isPortrait() {
    return window.innerHeight > window.innerWidth;
  }
  function updateOrientationGate() {
    if (orientation !== 'landscape') return;
    const portrait = isPortrait();
    if (portrait && !rotateGate) {
      rotateGate = document.createElement('div');
      rotateGate.className = 'rt-rotate-gate';
      rotateGate.innerHTML = `
        <div class="rt-rotate-icon">📱</div>
        <div>ROTATE YOUR PHONE</div>
        <div style="font-size:10px;color:#9fe;">this game is best in landscape</div>
      `;
      document.body.appendChild(rotateGate);
    } else if (!portrait && rotateGate) {
      rotateGate.remove();
      rotateGate = null;
    }
  }
  if (orientation === 'landscape') {
    updateOrientationGate();
    window.addEventListener('resize', updateOrientationGate);
    window.addEventListener('orientationchange', updateOrientationGate);
  }

  // ---- letterbox the canvas so the overlay doesn't cover it ----------
  // Publish the measured overlay height as a CSS custom property so the
  // body-level rules in this module's <style> (which use !important to
  // override per-game 100vh containers) actually shrink the canvas wrapper
  // and the canvas itself.
  function applyLetterbox() {
    const overlayH = root.getBoundingClientRect().height || 200;
    document.documentElement.style.setProperty('--rt-overlay-h', `${overlayH + 16}px`);
  }
  requestAnimationFrame(applyLetterbox);
  window.addEventListener('resize', applyLetterbox);
  window.addEventListener('orientationchange', applyLetterbox);

  const api = {
    destroy() {
      root.remove();
      if (pauseEl) pauseEl.remove();
      if (startEl) startEl.remove();
      if (rotateGate) rotateGate.remove();
      style.remove();
      document.removeEventListener('touchmove', scrollLockHandler);
      document.body.classList.remove('rt-overlay-active');
      document.documentElement.classList.remove('rt-overlay-active');
      document.documentElement.style.removeProperty('--rt-overlay-h');
      delete window.__rakuTouchOverlay;
    },
    isMobile: true,
    isVisible: () => !!document.getElementById('raku-touch-overlay'),
  };
  window.__rakuTouchOverlay = api;
  return api;
}
