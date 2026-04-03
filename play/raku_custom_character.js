// raku_custom_character.js — Custom Character Generation UI for Raku Browser Player
// Copyright (c) 2026 RakuAI, LLC. All rights reserved.
//
// Provides a slide-in panel for generating custom 3D characters from text
// descriptions via Meshy Text-to-3D. Integrates with the hot-swap system.
//
// Track C — User Character Customization (C.4)

'use strict';

const RakuCustomCharacter = {
  _apiBase: '',
  _authToken: '',
  _panel: null,
  _descInput: null,
  _charCount: null,
  _genBtn: null,
  _genre: '',
  _wasmModule: null,
  _isOpen: false,
  _generating: false,

  /**
   * Initialize the custom character generator.
   * @param {Object} opts
   * @param {string} opts.apiBase   - Backend API base URL
   * @param {string} opts.genre     - Current game genre
   * @param {Object} opts.module    - Emscripten WASM module instance
   */
  init(opts) {
    this._apiBase = opts.apiBase || '';
    this._genre = opts.genre || 'platformer';
    this._wasmModule = opts.module || null;
    this._authToken = localStorage.getItem('raku_access_token') || '';

    this._buildPanel();
    this._bindEvents();
    this._loadQuota();
  },

  _buildPanel() {
    const panel = document.createElement('aside');
    panel.id = 'custom-char-panel';
    panel.className = 'cc-panel cc-panel-closed';
    panel.innerHTML = `
      <div class="cc-header">
        <h3>Create Character</h3>
        <button class="cc-close-btn" aria-label="Close">&times;</button>
      </div>
      <div class="cc-body">
        <div class="cc-input-area">
          <label class="cc-label">Describe your character</label>
          <textarea class="cc-desc" placeholder="A samurai cat with glowing blue armor..."
                    maxlength="200" rows="3"></textarea>
          <div class="cc-input-meta">
            <span class="cc-char-count">0/200</span>
            <span class="cc-cost">~80 credits</span>
          </div>
        </div>
        <div class="cc-type-row">
          <label class="cc-label">Type</label>
          <select class="cc-type-select">
            <option value="hero">Hero</option>
            <option value="villain">Villain</option>
            <option value="npc">NPC</option>
            <option value="creature">Creature</option>
            <option value="companion">Companion</option>
            <option value="vehicle">Vehicle</option>
          </select>
        </div>
        <div class="cc-quota">
          <span class="cc-quota-text">Loading quota...</span>
        </div>
        <button class="cc-generate-btn" disabled>Generate Character</button>
        <div class="cc-defaults-section">
          <p class="cc-defaults-label">Or pick a popular default:</p>
          <div class="cc-defaults-grid"></div>
        </div>
        <div class="cc-library-section">
          <p class="cc-library-label">Your characters:</p>
          <div class="cc-library-grid"></div>
        </div>
      </div>
      <div class="cc-processing hidden">
        <div class="cc-spinner"></div>
        <p class="cc-processing-msg">Generating...</p>
        <div class="cc-progress-bar"><div class="cc-progress-fill"></div></div>
        <p class="cc-processing-stage"></p>
      </div>
      <div class="cc-result hidden">
        <p class="cc-result-msg"></p>
        <div class="cc-result-actions">
          <button class="cc-btn cc-btn-use">Use This Character</button>
          <button class="cc-btn cc-btn-retry">Try Again</button>
        </div>
      </div>
      <div class="cc-error hidden">
        <p class="cc-error-msg"></p>
        <button class="cc-btn cc-btn-dismiss">OK</button>
      </div>
    `;

    const container = document.getElementById('player-container');
    if (container) container.appendChild(panel);
    this._panel = panel;
    this._descInput = panel.querySelector('.cc-desc');
    this._charCount = panel.querySelector('.cc-char-count');
    this._genBtn = panel.querySelector('.cc-generate-btn');
  },

  _bindEvents() {
    const panel = this._panel;
    if (!panel) return;

    panel.querySelector('.cc-close-btn').addEventListener('click', () => this.close());

    this._descInput.addEventListener('input', () => {
      const len = this._descInput.value.length;
      this._charCount.textContent = len + '/200';
      this._genBtn.disabled = len < 3 || this._generating;
    });

    this._genBtn.addEventListener('click', () => this._generate());

    panel.querySelector('.cc-btn-retry').addEventListener('click', () => {
      panel.querySelector('.cc-result').classList.add('hidden');
      this._descInput.focus();
    });

    panel.querySelector('.cc-btn-dismiss').addEventListener('click', () => {
      panel.querySelector('.cc-error').classList.add('hidden');
    });
  },

  open() {
    if (this._isOpen) return;
    this._isOpen = true;
    this._panel.classList.remove('cc-panel-closed');
    this._panel.classList.add('cc-panel-open');
    this._loadQuota();
    this._loadLibrary();
    this._descInput.focus();
  },

  close() {
    this._isOpen = false;
    this._panel.classList.remove('cc-panel-open');
    this._panel.classList.add('cc-panel-closed');
  },

  toggle() {
    if (this._isOpen) this.close(); else this.open();
  },

  // ---- API ----

  async _fetch(path, opts) {
    const headers = { 'Content-Type': 'application/json' };
    if (this._authToken) headers['Authorization'] = 'Bearer ' + this._authToken;
    const resp = await fetch(this._apiBase + path, { ...opts, headers });
    if (resp.status === 401) {
      this._showError('Please log in to create custom characters.');
      throw new Error('Unauthorized');
    }
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      throw { status: resp.status, detail: data.detail || data };
    }
    return resp.json();
  },

  async _loadQuota() {
    try {
      const data = await this._fetch('/api/v1/customize-character', { method: 'GET' });
      const quota = this._panel.querySelector('.cc-quota-text');
      quota.textContent = data.remaining_today + ' of ' + data.daily_limit + ' remaining today';
      if (data.remaining_today <= 0) {
        quota.textContent += ' (resets at midnight UTC)';
        this._genBtn.disabled = true;
      }
    } catch (e) {
      if (e.message !== 'Unauthorized') {
        this._panel.querySelector('.cc-quota-text').textContent = 'Could not load quota';
      }
    }
  },

  async _loadLibrary() {
    try {
      const data = await this._fetch('/api/v1/customize-character', { method: 'GET' });
      const grid = this._panel.querySelector('.cc-library-grid');
      if (!data.characters || data.characters.length === 0) {
        grid.innerHTML = '<p class="cc-empty-lib">No characters yet</p>';
        return;
      }
      grid.innerHTML = data.characters.map(c => `
        <div class="cc-lib-card" data-url="${c.glb_url}" title="${c.description}">
          <div class="cc-lib-name">${c.description.substring(0, 30)}${c.description.length > 30 ? '...' : ''}</div>
        </div>
      `).join('');

      grid.querySelectorAll('.cc-lib-card').forEach(card => {
        card.addEventListener('click', () => {
          this._hotSwap(card.dataset.url);
          this.close();
        });
      });
    } catch (e) { console.warn('Custom character library load failed:', e); }
  },

  async _generate() {
    if (this._generating) return;
    const desc = this._descInput.value.trim();
    if (desc.length < 3) return;

    this._generating = true;
    this._genBtn.disabled = true;
    this._showProcessing('Starting generation...', 0);

    try {
      const result = await this._fetch('/api/v1/customize-character', {
        method: 'POST',
        body: JSON.stringify({
          game_id: 'game_browser',
          genre: this._genre,
          description: desc,
          character_type: this._panel.querySelector('.cc-type-select').value,
          animate: true,
        }),
      });

      if (result.cache_hit) {
        this._hideProcessing();
        this._showResult(result.result, true);
        return;
      }

      if (result.status === 'complete') {
        const status = await this._fetch(
          '/api/v1/customize-character/' + result.customization_id,
          { method: 'GET' }
        );
        this._hideProcessing();
        if (status.result) {
          this._showResult(status.result, false);
        }
        return;
      }

      // Poll
      await this._pollStatus(result.customization_id);
    } catch (e) {
      this._hideProcessing();
      const detail = e.detail || {};
      if (detail.error === 'safety_blocked') {
        this._showError(detail.detail || 'Description blocked by safety filter.');
      } else if (detail.error === 'daily_limit') {
        this._showError(detail.detail || 'Daily limit reached.');
      } else {
        this._showError('Generation failed. Please try again.');
      }
    } finally {
      this._generating = false;
      this._genBtn.disabled = this._descInput.value.length < 3;
      this._loadQuota();
    }
  },

  async _pollStatus(custId) {
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 2000));
      try {
        const status = await this._fetch(
          '/api/v1/customize-character/' + custId,
          { method: 'GET' }
        );
        this._showProcessing(
          status.message || status.status,
          status.progress || 0
        );
        if (status.status === 'complete' && status.result) {
          this._hideProcessing();
          this._showResult(status.result, false);
          return;
        }
        if (status.status === 'failed') {
          this._hideProcessing();
          this._showError(status.error || 'Generation failed.');
          return;
        }
      } catch (e) {
        this._hideProcessing();
        this._showError('Lost connection during generation.');
        return;
      }
    }
    this._hideProcessing();
    this._showError('Generation timed out.');
  },

  _showResult(result, cached) {
    const section = this._panel.querySelector('.cc-result');
    const msg = this._panel.querySelector('.cc-result-msg');
    msg.textContent = cached
      ? 'Loaded from cache (no credits used)'
      : 'Character ready! (' + (result.credits_used || 0) + ' credits used)';
    section.classList.remove('hidden');

    const useBtn = this._panel.querySelector('.cc-btn-use');
    useBtn.onclick = () => {
      this._hotSwap(result.glb_url);
      section.classList.add('hidden');
      this.close();
    };
  },

  _hotSwap(glbUrl) {
    const mod = this._wasmModule;
    if (!mod) return;

    try {
      const patch = JSON.stringify({
        asset_override: {
          type: 'character',
          source: 'custom',
          glb_url: glbUrl,
          hot_swap: true
        }
      });

      if (mod._raku_hot_reload_config) {
        var len = mod.lengthBytesUTF8(patch) + 1;
        var ptr = mod._malloc(len);
        mod.stringToUTF8(patch, ptr, len);
        mod._raku_hot_reload_config(ptr, len);
        mod._free(ptr);
        this._showToast('Custom character applied!');
      } else if (mod.cwrap) {
        var hotReload = mod.cwrap('raku_hot_reload_config', 'number', ['string', 'number']);
        hotReload(patch, patch.length);
        this._showToast('Custom character applied!');
      } else {
        this._showToast('Character ready (restart to apply)');
      }
    } catch (e) {
      this._showToast('Character ready (restart to apply)');
    }
  },

  // ---- UI helpers ----

  _showProcessing(msg, progress) {
    var section = this._panel.querySelector('.cc-processing');
    section.classList.remove('hidden');
    section.querySelector('.cc-processing-msg').textContent = msg;
    section.querySelector('.cc-progress-fill').style.width = (progress * 100) + '%';
  },

  _hideProcessing() {
    this._panel.querySelector('.cc-processing').classList.add('hidden');
  },

  _showError(msg) {
    var section = this._panel.querySelector('.cc-error');
    section.querySelector('.cc-error-msg').textContent = msg;
    section.classList.remove('hidden');
  },

  _showToast(text) {
    var toast = document.getElementById('share-toast');
    if (toast) {
      toast.textContent = text;
      toast.classList.remove('hidden');
      toast.classList.add('visible');
      setTimeout(function() {
        toast.classList.remove('visible');
        setTimeout(function() { toast.classList.add('hidden'); }, 300);
      }, 2000);
    }
  }
};
