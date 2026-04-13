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
