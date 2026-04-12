/**
 * RakuAI Arcade Games Shared Library
 * ===================================
 * Provides shared functionality for all 80s arcade games:
 * - Debug overlay with live API call log (F2 to toggle)
 * - Sound manager (Web Audio API, no files)
 * - Gamepad support with auto-detection
 * - Launcher integration (?launcher=1 URL param, postMessage)
 * - CRT scanline toggle (F1)
 * - Pause overlay (P)
 * - High score manager (localStorage)
 * - API client with automatic logging
 *
 * Usage:
 *   import { GameLib } from '/games/lib/gamelib.js';
 *   const lib = new GameLib({ gameName: 'Meteor Storm', gameId: 'meteor-storm' });
 *   lib.init();
 *   lib.sound.play('fire');
 *   lib.debug.log('POST', '/api/raku/worlds', 42, 200);
 *   lib.onQuit(() => { ... });
 */

// ============================================================================
// Sound Manager — Web Audio API tone generator
// ============================================================================
export class SoundManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.volume = 0.3;
    this.muted = false;
    this.sounds = new Map();
    this._musicOsc = null;
    this._musicGain = null;
  }

  _ensureContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : this.volume;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.masterGain) this.masterGain.gain.value = this.muted ? 0 : this.volume;
  }

  setMuted(m) {
    this.muted = m;
    if (this.masterGain) this.masterGain.gain.value = m ? 0 : this.volume;
  }

  /**
   * Play a procedural sound effect.
   * @param {string} name - 'fire', 'explode', 'thrust', 'hit', 'blip', 'boom', 'coin', 'levelup', 'death', 'jump'
   */
  play(name) {
    if (this.muted) return;
    this._ensureContext();
    const ctx = this.ctx;
    const t0 = ctx.currentTime;

    switch (name) {
      case 'fire': // short laser zap
        this._beep(880, 0.08, 'square', 0.2);
        break;
      case 'explode': // noise burst
        this._noise(0.3, 0.3, 400);
        break;
      case 'hit': // quick blip
        this._beep(440, 0.05, 'square', 0.15);
        break;
      case 'blip':
        this._beep(660, 0.04, 'square', 0.1);
        break;
      case 'boom': // big explosion
        this._noise(0.5, 0.5, 200);
        break;
      case 'coin': // ascending blip
        this._beep(660, 0.08, 'square', 0.2);
        setTimeout(() => this._beep(990, 0.1, 'square', 0.2), 80);
        break;
      case 'levelup': // fanfare
        this._beep(440, 0.1, 'square', 0.2);
        setTimeout(() => this._beep(550, 0.1, 'square', 0.2), 100);
        setTimeout(() => this._beep(660, 0.1, 'square', 0.2), 200);
        setTimeout(() => this._beep(880, 0.2, 'square', 0.2), 300);
        break;
      case 'death': // descending
        this._slide(440, 110, 0.5, 'sawtooth', 0.25);
        break;
      case 'jump':
        this._slide(440, 880, 0.15, 'square', 0.15);
        break;
      case 'thrust':
        this._noise(0.1, 0.08, 150);
        break;
      case 'powerup':
        for (let i = 0; i < 5; i++) {
          setTimeout(() => this._beep(440 + i * 110, 0.06, 'square', 0.15), i * 50);
        }
        break;
      case 'hurt':
        this._slide(330, 165, 0.2, 'sawtooth', 0.2);
        break;
    }
  }

  _beep(freq, duration, type = 'square', gain = 0.2) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(t0);
    osc.stop(t0 + duration + 0.01);
  }

  _slide(fromFreq, toFreq, duration, type = 'square', gain = 0.2) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(fromFreq, t0);
    osc.frequency.exponentialRampToValueAtTime(toFreq, t0 + duration);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(t0);
    osc.stop(t0 + duration + 0.01);
  }

  _noise(duration, gain = 0.2, filterFreq = 400) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);
    src.start(t0);
    src.stop(t0 + duration);
  }

  /** Start a simple looping bass line. */
  startMusic(bpm = 120) {
    this._ensureContext();
    this.stopMusic();
    const notes = [220, 220, 330, 220, 277, 220, 330, 277]; // A,A,E,A,C#,A,E,C#
    const beatDur = 60 / bpm;
    let i = 0;
    this._musicInterval = setInterval(() => {
      this._beep(notes[i % notes.length], beatDur * 0.5, 'triangle', 0.1);
      i++;
    }, beatDur * 500);
  }

  stopMusic() {
    if (this._musicInterval) {
      clearInterval(this._musicInterval);
      this._musicInterval = null;
    }
  }
}

// ============================================================================
// Debug Overlay — Live API call log in corner
// ============================================================================
export class DebugOverlay {
  constructor(gameName = '') {
    this.gameName = gameName;
    this.visible = false;
    this.calls = [];
    this.maxCalls = 50;
    this.el = null;
    this.listEl = null;
    this.badgeEl = null;
    this.paused = false;
  }

  init() {
    // Create overlay panel
    this.el = document.createElement('div');
    this.el.className = 'raku-debug-overlay';
    this.el.innerHTML = `
      <style>
        .raku-debug-overlay {
          position: fixed; top: 10px; right: 10px;
          width: 340px; max-height: 300px;
          background: rgba(0, 0, 0, 0.85);
          border: 1px solid #0ff;
          border-radius: 4px;
          font: 10px/1.4 'Courier New', monospace;
          color: #0ff;
          z-index: 9999;
          display: none;
          box-shadow: 0 0 20px rgba(0,255,255,0.3);
        }
        .raku-debug-overlay.visible { display: block; }
        .raku-debug-overlay .header {
          padding: 6px 10px;
          background: rgba(0, 255, 255, 0.1);
          border-bottom: 1px solid #0ff;
          display: flex; justify-content: space-between; align-items: center;
        }
        .raku-debug-overlay .title { font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
        .raku-debug-overlay .controls button {
          background: transparent; border: 1px solid #0ff;
          color: #0ff; font: inherit; padding: 1px 6px;
          cursor: pointer; margin-left: 4px;
        }
        .raku-debug-overlay .controls button:hover { background: rgba(0,255,255,0.2); }
        .raku-debug-overlay .list {
          max-height: 250px; overflow-y: auto; padding: 4px 8px;
        }
        .raku-debug-overlay .list::-webkit-scrollbar { width: 6px; }
        .raku-debug-overlay .list::-webkit-scrollbar-thumb { background: #0ff; }
        .raku-debug-overlay .call {
          padding: 2px 0; border-bottom: 1px dotted rgba(0,255,255,0.2);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .raku-debug-overlay .call.s200 { color: #0f0; }
        .raku-debug-overlay .call.s300 { color: #ff0; }
        .raku-debug-overlay .call.s400 { color: #f80; }
        .raku-debug-overlay .call.s500 { color: #f00; }
        .raku-debug-overlay .call .m { display: inline-block; width: 45px; }
        .raku-debug-overlay .call .l { display: inline-block; width: 40px; text-align: right; }
        .raku-debug-overlay .empty { padding: 20px; text-align: center; opacity: 0.5; }
        .raku-debug-badge {
          position: fixed; top: 10px; right: 10px;
          padding: 4px 10px;
          background: rgba(0, 0, 0, 0.7);
          border: 1px solid #0ff;
          border-radius: 3px;
          font: bold 10px 'Courier New', monospace;
          color: #0ff;
          cursor: pointer;
          z-index: 9998;
          user-select: none;
          transition: transform 0.1s;
        }
        .raku-debug-badge:hover { transform: scale(1.05); }
        .raku-debug-badge.pulsing { animation: raku-pulse 0.3s; }
        @keyframes raku-pulse {
          0% { background: rgba(0,255,255,0.5); }
          100% { background: rgba(0,0,0,0.7); }
        }
      </style>
      <div class="header">
        <span class="title">🔌 API • ${this.gameName}</span>
        <div class="controls">
          <button data-action="pause">⏸</button>
          <button data-action="clear">✕</button>
          <button data-action="close">×</button>
        </div>
      </div>
      <div class="list"></div>
    `;
    document.body.appendChild(this.el);
    this.listEl = this.el.querySelector('.list');

    // Create small badge that pulses on activity
    this.badgeEl = document.createElement('div');
    this.badgeEl.className = 'raku-debug-badge';
    this.badgeEl.textContent = 'API';
    this.badgeEl.title = 'Press F2 for debug overlay';
    this.badgeEl.addEventListener('click', () => this.toggle());
    document.body.appendChild(this.badgeEl);

    // Wire up buttons
    this.el.querySelector('[data-action="pause"]').addEventListener('click', () => {
      this.paused = !this.paused;
      this.el.querySelector('[data-action="pause"]').textContent = this.paused ? '▶' : '⏸';
    });
    this.el.querySelector('[data-action="clear"]').addEventListener('click', () => {
      this.calls = [];
      this.render();
    });
    this.el.querySelector('[data-action="close"]').addEventListener('click', () => this.hide());

    // F2 key to toggle
    window.addEventListener('keydown', (e) => {
      if (e.key === 'F2') {
        e.preventDefault();
        this.toggle();
      }
    });

    this.render();
  }

  toggle() { this.visible ? this.hide() : this.show(); }
  show() {
    this.visible = true;
    this.el.classList.add('visible');
    this.badgeEl.style.display = 'none';
  }
  hide() {
    this.visible = false;
    this.el.classList.remove('visible');
    this.badgeEl.style.display = 'block';
  }

  /**
   * Log an API call.
   * @param {string} method - HTTP method
   * @param {string} path - URL path
   * @param {number} latencyMs - Latency in milliseconds
   * @param {number} status - HTTP status code (200, 404, 500, etc.)
   * @param {string} note - Optional note
   */
  log(method, path, latencyMs = 0, status = 200, note = '') {
    if (this.paused) return;
    const call = {
      time: new Date().toLocaleTimeString('en-US', { hour12: false }),
      method: method.toUpperCase(),
      path,
      latency: latencyMs,
      status,
      note,
    };
    this.calls.unshift(call);
    if (this.calls.length > this.maxCalls) this.calls.pop();
    this.render();
    this._pulse();
  }

  _pulse() {
    if (!this.badgeEl) return;
    this.badgeEl.classList.add('pulsing');
    setTimeout(() => this.badgeEl?.classList.remove('pulsing'), 300);
  }

  render() {
    if (!this.listEl) return;
    if (this.calls.length === 0) {
      this.listEl.innerHTML = '<div class="empty">No API calls yet. Press F2 to hide.</div>';
      return;
    }
    this.listEl.innerHTML = this.calls.map(c => {
      const cls = c.status >= 500 ? 's500' : c.status >= 400 ? 's400' : c.status >= 300 ? 's300' : 's200';
      const p = c.path.length > 35 ? '…' + c.path.slice(-34) : c.path;
      return `<div class="call ${cls}"><span class="m">${c.method}</span>${p}<span class="l">${c.latency}ms</span></div>`;
    }).join('');
  }
}

// ============================================================================
// Gamepad Manager — Auto-detect and poll
// ============================================================================
export class GamepadManager {
  constructor() {
    this.connected = false;
    this.index = -1;
    this._listeners = [];
  }

  init() {
    window.addEventListener('gamepadconnected', (e) => {
      this.connected = true;
      this.index = e.gamepad.index;
      this._listeners.forEach(fn => fn({ type: 'connected', index: e.gamepad.index }));
    });
    window.addEventListener('gamepaddisconnected', (e) => {
      if (e.gamepad.index === this.index) {
        this.connected = false;
        this.index = -1;
      }
      this._listeners.forEach(fn => fn({ type: 'disconnected' }));
    });
  }

  /** Poll current gamepad state. Returns { axes, buttons } or null. */
  poll() {
    if (!this.connected) return null;
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = gamepads[this.index];
    if (!gp) return null;
    return {
      axes: gp.axes,
      buttons: gp.buttons.map(b => ({ pressed: b.pressed, value: b.value })),
      // Common aliases for retro games
      left: gp.buttons[14]?.pressed || gp.axes[0] < -0.5,
      right: gp.buttons[15]?.pressed || gp.axes[0] > 0.5,
      up: gp.buttons[12]?.pressed || gp.axes[1] < -0.5,
      down: gp.buttons[13]?.pressed || gp.axes[1] > 0.5,
      a: gp.buttons[0]?.pressed, // A / Cross
      b: gp.buttons[1]?.pressed, // B / Circle
      x: gp.buttons[2]?.pressed, // X / Square
      y: gp.buttons[3]?.pressed, // Y / Triangle
      start: gp.buttons[9]?.pressed,
      select: gp.buttons[8]?.pressed,
    };
  }

  onChange(cb) { this._listeners.push(cb); }
}

// ============================================================================
// Launcher Integration — Back button + postMessage
// ============================================================================
export class LauncherIntegration {
  constructor(gameName) {
    this.gameName = gameName;
    this.isEmbedded = new URLSearchParams(location.search).get('launcher') === '1';
    this.onQuitCallbacks = [];
  }

  init() {
    // Create back-to-launcher button
    const backBtn = document.createElement('button');
    backBtn.className = 'raku-back-button';
    backBtn.innerHTML = '← ARCADE';
    backBtn.style.cssText = `
      position: fixed; top: 10px; left: 10px;
      padding: 6px 14px;
      background: rgba(0,0,0,0.7);
      border: 1px solid #f0f;
      color: #f0f;
      font: bold 11px 'Courier New', monospace;
      cursor: pointer;
      z-index: 9998;
      letter-spacing: 1px;
      border-radius: 3px;
    `;
    backBtn.addEventListener('mouseenter', () => {
      backBtn.style.background = 'rgba(255,0,255,0.2)';
    });
    backBtn.addEventListener('mouseleave', () => {
      backBtn.style.background = 'rgba(0,0,0,0.7)';
    });
    backBtn.addEventListener('click', () => this.quitToLauncher());
    document.body.appendChild(backBtn);

    // Esc key also quits to launcher
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.quitToLauncher();
    });
  }

  quitToLauncher(finalScore = 0) {
    this.onQuitCallbacks.forEach(fn => fn(finalScore));
    // Notify parent window via postMessage
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'quit', game: this.gameName, score: finalScore }, '*');
    } else {
      // Standalone: go to launcher
      window.location.href = '/games/';
    }
  }

  notifyGameOver(score) {
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'gameover', game: this.gameName, score }, '*');
    }
  }

  onQuit(cb) { this.onQuitCallbacks.push(cb); }
}

// ============================================================================
// High Score Manager
// ============================================================================
export class HighScoreManager {
  constructor(gameId) {
    this.key = `raku-arcade-${gameId}`;
  }

  get() {
    try { return JSON.parse(localStorage.getItem(this.key) || '[]'); }
    catch { return []; }
  }

  save(name, score, level = 1) {
    const scores = this.get();
    scores.push({ name, score, level, date: new Date().toISOString() });
    scores.sort((a, b) => b.score - a.score);
    const top = scores.slice(0, 10);
    localStorage.setItem(this.key, JSON.stringify(top));
    return top;
  }

  topScore() {
    const scores = this.get();
    return scores.length ? scores[0].score : 0;
  }
}

// ============================================================================
// CRT Scanline Overlay
// ============================================================================
export class CRTEffect {
  constructor() {
    this.enabled = localStorage.getItem('raku-crt-on') !== 'false';
    this.el = null;
  }

  init() {
    this.el = document.createElement('div');
    this.el.className = 'raku-crt-overlay';
    this.el.style.cssText = `
      position: fixed; inset: 0;
      pointer-events: none;
      z-index: 9997;
      background:
        repeating-linear-gradient(
          0deg,
          rgba(0,0,0,0.12),
          rgba(0,0,0,0.12) 1px,
          transparent 1px,
          transparent 3px
        );
      mix-blend-mode: multiply;
    `;
    document.body.appendChild(this.el);
    if (!this.enabled) this.el.style.display = 'none';

    window.addEventListener('keydown', (e) => {
      if (e.key === 'F1') {
        e.preventDefault();
        this.toggle();
      }
    });
  }

  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem('raku-crt-on', this.enabled);
    this.el.style.display = this.enabled ? 'block' : 'none';
  }
}

// ============================================================================
// API Client with automatic debug logging
// ============================================================================
export class ApiClient {
  constructor(debugOverlay) {
    this.debug = debugOverlay;
    this.base = 'https://raku-api-staging.fly.dev';
    this.apiKey = '';
    this.enabled = false;
  }

  setBase(url) { this.base = url; }
  setKey(key) { this.apiKey = key; this.enabled = !!key; }

  async call(method, path, body = null) {
    const t0 = performance.now();
    let status = 0;
    try {
      if (!this.enabled) {
        // Simulate call for demo purposes
        const latency = Math.random() * 50 + 10;
        this.debug?.log(method, path, Math.round(latency), 200, 'demo');
        return null;
      }
      const headers = { 'Content-Type': 'application/json' };
      if (this.apiKey) headers['X-Raku-API-Key'] = this.apiKey;
      const opts = { method, headers };
      if (body) opts.body = JSON.stringify(body);
      const resp = await fetch(`${this.base}${path}`, opts);
      status = resp.status;
      const data = resp.ok ? await resp.json() : null;
      this.debug?.log(method, path, Math.round(performance.now() - t0), status);
      return data;
    } catch (e) {
      this.debug?.log(method, path, Math.round(performance.now() - t0), status || 500, e.message);
      return null;
    }
  }
}

// ============================================================================
// Main GameLib — orchestrates everything
// ============================================================================
export class GameLib {
  constructor({ gameName, gameId }) {
    this.gameName = gameName;
    this.gameId = gameId;
    this.sound = new SoundManager();
    this.debug = new DebugOverlay(gameName);
    this.gamepad = new GamepadManager();
    this.launcher = new LauncherIntegration(gameName);
    this.scores = new HighScoreManager(gameId);
    this.crt = new CRTEffect();
    this.api = new ApiClient(this.debug);
  }

  init() {
    this.debug.init();
    this.gamepad.init();
    this.launcher.init();
    this.crt.init();

    // Log initial API calls (simulated)
    this.api.call('POST', '/api/raku/worlds', { name: this.gameId });
    this.api.call('POST', `/api/raku/worlds/${this.gameId}/entities`, { type: 'player' });

    // Expose help message to console
    console.log(`%c🕹  ${this.gameName} — RakuAI Arcade`, 'color:#0ff;font-size:16px;font-weight:bold;');
    console.log('%cKeyboard: F1=CRT F2=Debug P=Pause Esc=Quit to Launcher', 'color:#888');
  }

  logApi(method, path, latency = 0, status = 200) {
    this.debug.log(method, path, latency, status);
  }
}
