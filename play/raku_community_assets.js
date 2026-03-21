// raku_community_assets.js — Community Asset Browser for Raku Browser Player
// Copyright (c) 2026 RakuAI, LLC. All rights reserved.
//
// Provides a slide-in panel for browsing, selecting, and hot-swapping
// community 3D models from Meshy.ai into running games.
//
// Track B — Community Asset Integration (B.2)

'use strict';

const RakuCommunityAssets = {
  _apiBase: '',
  _authToken: '',
  _panel: null,
  _grid: null,
  _searchInput: null,
  _categorySelect: null,
  _styleSelect: null,
  _sortSelect: null,
  _previewModal: null,
  _processingOverlay: null,
  _currentPage: 1,
  _totalPages: 1,
  _selectedModel: null,
  _genre: '',
  _wasmModule: null,
  _debounceTimer: null,
  _isOpen: false,

  /**
   * Initialize the community asset browser.
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
  },

  // ---- Panel Construction ----

  _buildPanel() {
    // Create the slide-in panel
    const panel = document.createElement('aside');
    panel.id = 'community-assets-panel';
    panel.className = 'ca-panel ca-panel-closed';
    panel.innerHTML = `
      <div class="ca-header">
        <h3>Community Models</h3>
        <button class="ca-close-btn" aria-label="Close">&times;</button>
      </div>
      <div class="ca-filters">
        <input type="text" class="ca-search" placeholder="Search models..." maxlength="200" autocomplete="off">
        <div class="ca-filter-row">
          <select class="ca-select ca-category">
            <option value="">All Categories</option>
            <option value="characters">Characters</option>
            <option value="creatures">Creatures</option>
            <option value="vehicles">Vehicles</option>
            <option value="props">Props</option>
            <option value="environments">Environments</option>
          </select>
          <select class="ca-select ca-style">
            <option value="">All Styles</option>
            <option value="realistic">Realistic</option>
            <option value="stylized">Stylized</option>
            <option value="anime">Anime</option>
            <option value="low-poly">Low-Poly</option>
          </select>
          <select class="ca-select ca-sort">
            <option value="relevance">Relevance</option>
            <option value="popular">Most Popular</option>
            <option value="recent">Most Recent</option>
            <option value="top_rated">Top Rated</option>
          </select>
        </div>
      </div>
      <div class="ca-grid" role="list"></div>
      <div class="ca-pagination">
        <button class="ca-page-btn ca-prev" disabled>Prev</button>
        <span class="ca-page-info">Page 1</span>
        <button class="ca-page-btn ca-next" disabled>Next</button>
      </div>
      <div class="ca-empty hidden">
        <p>No models found. Try a different search.</p>
      </div>
      <div class="ca-loading hidden">
        <div class="ca-spinner"></div>
        <p>Searching...</p>
      </div>
      <div class="ca-pro-gate hidden">
        <p>Community character customization requires a <strong>Pro</strong> subscription.</p>
        <a href="/pricing.html" class="ca-upgrade-btn">Upgrade to Pro</a>
      </div>
    `;

    // Preview modal
    const preview = document.createElement('div');
    preview.id = 'ca-preview-modal';
    preview.className = 'ca-modal hidden';
    preview.innerHTML = `
      <div class="ca-modal-content">
        <div class="ca-modal-header">
          <h4 class="ca-preview-name"></h4>
          <button class="ca-modal-close" aria-label="Close">&times;</button>
        </div>
        <div class="ca-preview-body">
          <img class="ca-preview-img" alt="Model preview" loading="lazy">
          <div class="ca-preview-info">
            <p class="ca-preview-creator"></p>
            <p class="ca-preview-stats"></p>
            <p class="ca-preview-tags"></p>
          </div>
        </div>
        <div class="ca-modal-actions">
          <button class="ca-btn ca-btn-cancel">Cancel</button>
          <button class="ca-btn ca-btn-use">Use This Character</button>
        </div>
      </div>
    `;

    // Processing overlay
    const processing = document.createElement('div');
    processing.id = 'ca-processing';
    processing.className = 'ca-processing hidden';
    processing.innerHTML = `
      <div class="ca-processing-content">
        <div class="ca-spinner"></div>
        <p class="ca-processing-msg">Processing model...</p>
        <div class="ca-progress-bar"><div class="ca-progress-fill"></div></div>
      </div>
    `;

    const container = document.getElementById('player-container');
    if (container) {
      container.appendChild(panel);
      container.appendChild(preview);
      container.appendChild(processing);
    }

    this._panel = panel;
    this._grid = panel.querySelector('.ca-grid');
    this._searchInput = panel.querySelector('.ca-search');
    this._categorySelect = panel.querySelector('.ca-category');
    this._styleSelect = panel.querySelector('.ca-style');
    this._sortSelect = panel.querySelector('.ca-sort');
    this._previewModal = preview;
    this._processingOverlay = processing;
  },

  _bindEvents() {
    const panel = this._panel;
    if (!panel) return;

    // Close
    panel.querySelector('.ca-close-btn').addEventListener('click', () => this.close());

    // Search with debounce
    this._searchInput.addEventListener('input', () => {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = setTimeout(() => {
        this._currentPage = 1;
        this._search();
      }, 300);
    });

    // Filters
    this._categorySelect.addEventListener('change', () => { this._currentPage = 1; this._search(); });
    this._styleSelect.addEventListener('change', () => { this._currentPage = 1; this._search(); });
    this._sortSelect.addEventListener('change', () => { this._currentPage = 1; this._search(); });

    // Pagination
    panel.querySelector('.ca-prev').addEventListener('click', () => {
      if (this._currentPage > 1) { this._currentPage--; this._search(); }
    });
    panel.querySelector('.ca-next').addEventListener('click', () => {
      if (this._currentPage < this._totalPages) { this._currentPage++; this._search(); }
    });

    // Preview modal
    this._previewModal.querySelector('.ca-modal-close').addEventListener('click', () => this._closePreview());
    this._previewModal.querySelector('.ca-btn-cancel').addEventListener('click', () => this._closePreview());
    this._previewModal.querySelector('.ca-btn-use').addEventListener('click', () => this._selectModel());

    // Grid clicks (delegated)
    this._grid.addEventListener('click', (e) => {
      const card = e.target.closest('.ca-card');
      if (card) this._openPreview(card.dataset.modelId);
    });
  },

  // ---- Open / Close ----

  open() {
    if (this._isOpen) return;
    this._isOpen = true;
    this._panel.classList.remove('ca-panel-closed');
    this._panel.classList.add('ca-panel-open');
    this._search();
  },

  close() {
    this._isOpen = false;
    this._panel.classList.remove('ca-panel-open');
    this._panel.classList.add('ca-panel-closed');
  },

  toggle() {
    if (this._isOpen) this.close(); else this.open();
  },

  // ---- API Calls ----

  async _fetch(path, opts) {
    const headers = { 'Content-Type': 'application/json' };
    if (this._authToken) headers['Authorization'] = 'Bearer ' + this._authToken;
    const resp = await fetch(this._apiBase + path, { ...opts, headers });
    if (resp.status === 401) {
      this._showMessage('Please log in to browse community models.');
      throw new Error('Unauthorized');
    }
    if (resp.status === 403) {
      const data = await resp.json().catch(() => ({}));
      if (data.detail && data.detail.error === 'pro_required') {
        this._showProGate();
        throw new Error('Pro required');
      }
    }
    if (!resp.ok) throw new Error('API error: ' + resp.status);
    return resp.json();
  },

  async _search() {
    const loading = this._panel.querySelector('.ca-loading');
    const empty = this._panel.querySelector('.ca-empty');
    loading.classList.remove('hidden');
    empty.classList.add('hidden');
    this._panel.querySelector('.ca-pro-gate').classList.add('hidden');
    this._grid.innerHTML = '';

    try {
      const data = await this._fetch('/api/v1/community-assets/search', {
        method: 'POST',
        body: JSON.stringify({
          query: this._searchInput.value.trim(),
          category: this._categorySelect.value || null,
          style: this._styleSelect.value || null,
          sort: this._sortSelect.value,
          page: this._currentPage,
          per_page: 12,
        }),
      });

      loading.classList.add('hidden');

      if (!data.results || data.results.length === 0) {
        empty.classList.remove('hidden');
        return;
      }

      this._totalPages = Math.ceil(data.total / 12);
      this._updatePagination();
      this._renderGrid(data.results);
    } catch (e) {
      loading.classList.add('hidden');
      if (e.message !== 'Unauthorized' && e.message !== 'Pro required') {
        this._showMessage('Failed to load models. Please try again.');
      }
    }
  },

  _renderGrid(models) {
    this._grid.innerHTML = models.map(m => `
      <div class="ca-card" data-model-id="${m.id}" role="listitem" tabindex="0">
        <div class="ca-card-img-wrapper">
          <img class="ca-card-img" src="${m.thumbnail_url}" alt="${m.name}" loading="lazy"
               onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2280%22 height=%2280%22><rect fill=%22%231e1e2e%22 width=%2280%22 height=%2280%22/><text x=%2240%22 y=%2245%22 text-anchor=%22middle%22 fill=%22%2394a3b8%22 font-size=%2212%22>No Preview</text></svg>'">
        </div>
        <div class="ca-card-info">
          <span class="ca-card-name">${m.name}</span>
          <span class="ca-card-meta">${(m.downloads || 0).toLocaleString()} downloads</span>
        </div>
      </div>
    `).join('');
  },

  _updatePagination() {
    const info = this._panel.querySelector('.ca-page-info');
    const prev = this._panel.querySelector('.ca-prev');
    const next = this._panel.querySelector('.ca-next');
    info.textContent = 'Page ' + this._currentPage + ' of ' + this._totalPages;
    prev.disabled = this._currentPage <= 1;
    next.disabled = this._currentPage >= this._totalPages;
  },

  // ---- Preview ----

  async _openPreview(modelId) {
    try {
      const model = await this._fetch('/api/v1/community-assets/' + modelId + '/preview', { method: 'GET' });
      this._selectedModel = model;

      const modal = this._previewModal;
      modal.querySelector('.ca-preview-name').textContent = model.name;
      modal.querySelector('.ca-preview-img').src = model.thumbnail_url;
      modal.querySelector('.ca-preview-creator').textContent = 'By ' + (model.creator || 'Unknown');
      modal.querySelector('.ca-preview-stats').textContent =
        (model.poly_count || 0).toLocaleString() + ' polys · ' +
        (model.downloads || 0).toLocaleString() + ' downloads · ' +
        (model.likes || 0).toLocaleString() + ' likes';
      modal.querySelector('.ca-preview-tags').textContent =
        (model.tags || []).map(t => '#' + t).join(' ');

      modal.classList.remove('hidden');
    } catch (e) {
      console.warn('[CommunityAssets] Preview failed:', e.message);
    }
  },

  _closePreview() {
    this._previewModal.classList.add('hidden');
    this._selectedModel = null;
  },

  // ---- Select + Process ----

  async _selectModel() {
    if (!this._selectedModel) return;
    this._closePreview();
    this._showProcessing('Starting...', 0);

    try {
      const result = await this._fetch(
        '/api/v1/community-assets/' + this._selectedModel.id + '/select',
        {
          method: 'POST',
          body: JSON.stringify({
            rig_type: 'humanoid',
            animation_set: this._genre,
          }),
        }
      );

      if (result.cached) {
        this._onProcessingComplete(result.result);
        return;
      }

      if (result.status === 'complete') {
        // Simulated pipeline completed synchronously
        const status = await this._fetch(
          '/api/v1/community-assets/' + this._selectedModel.id + '/status?task_id=' + result.task_id,
          { method: 'GET' }
        );
        if (status.result) {
          this._onProcessingComplete(status.result);
        } else {
          this._hideProcessing();
          this._showMessage('Processing complete but no result returned.');
        }
        return;
      }

      // Poll for completion
      this._pollStatus(this._selectedModel.id, result.task_id);
    } catch (e) {
      this._hideProcessing();
      if (e.message !== 'Pro required') {
        this._showMessage('Failed to process model: ' + e.message);
      }
    }
  },

  async _pollStatus(modelId, taskId) {
    const maxPolls = 60; // 2 minutes at 2s intervals
    for (let i = 0; i < maxPolls; i++) {
      await new Promise(r => setTimeout(r, 2000));

      try {
        const status = await this._fetch(
          '/api/v1/community-assets/' + modelId + '/status?task_id=' + taskId,
          { method: 'GET' }
        );

        const progress = status.progress || 0;
        const msg = status.message || status.stage || 'Processing...';
        this._showProcessing(msg, progress);

        if (status.stage === 'complete' && status.result) {
          this._onProcessingComplete(status.result);
          return;
        }
        if (status.stage === 'failed') {
          this._hideProcessing();
          this._showMessage('Processing failed: ' + (status.error || 'Unknown error'));
          return;
        }
      } catch (e) {
        this._hideProcessing();
        this._showMessage('Lost connection during processing.');
        return;
      }
    }

    this._hideProcessing();
    this._showMessage('Processing timed out. Please try again.');
  },

  _onProcessingComplete(result) {
    this._hideProcessing();
    this.close();

    if (result.glb_url && this._wasmModule) {
      this._hotSwapAsset(result.glb_url);
    }
  },

  // ---- Hot-Swap Integration (B.4) ----

  _hotSwapAsset(glbUrl) {
    const mod = this._wasmModule;
    if (!mod) {
      console.warn('[CommunityAssets] No WASM module for hot-swap');
      return;
    }

    // Use existing hot-reload infrastructure
    // raku_hot_reload_config accepts a JSON config update
    // We send a config patch that updates the player character asset URL
    try {
      const configPatch = JSON.stringify({
        asset_override: {
          type: 'character',
          source: 'community',
          glb_url: glbUrl,
          hot_swap: true
        }
      });

      if (mod._raku_hot_reload_config) {
        const len = mod.lengthBytesUTF8(configPatch) + 1;
        const ptr = mod._malloc(len);
        mod.stringToUTF8(configPatch, ptr, len);
        mod._raku_hot_reload_config(ptr, len);
        mod._free(ptr);
        console.log('[CommunityAssets] Hot-swap config injected:', glbUrl);
        this._showToast('Character swapped!');
      } else if (mod.cwrap) {
        // Try cwrap approach (same as raku_chat.js)
        const hotReload = mod.cwrap('raku_hot_reload_config', 'number', ['string', 'number']);
        hotReload(configPatch, configPatch.length);
        console.log('[CommunityAssets] Hot-swap via cwrap:', glbUrl);
        this._showToast('Character swapped!');
      } else {
        console.warn('[CommunityAssets] No hot-reload function available');
        this._showToast('Model ready (restart to apply)');
      }
    } catch (e) {
      console.warn('[CommunityAssets] Hot-swap failed:', e.message);
      this._showToast('Model ready (restart to apply)');
    }
  },

  // ---- UI Helpers ----

  _showProcessing(msg, progress) {
    const overlay = this._processingOverlay;
    overlay.classList.remove('hidden');
    overlay.querySelector('.ca-processing-msg').textContent = msg;
    overlay.querySelector('.ca-progress-fill').style.width = (progress * 100) + '%';
  },

  _hideProcessing() {
    this._processingOverlay.classList.add('hidden');
  },

  _showProGate() {
    this._panel.querySelector('.ca-loading').classList.add('hidden');
    this._panel.querySelector('.ca-pro-gate').classList.remove('hidden');
  },

  _showMessage(text) {
    const empty = this._panel.querySelector('.ca-empty');
    empty.querySelector('p').textContent = text;
    empty.classList.remove('hidden');
  },

  _showToast(text) {
    // Reuse existing toast from play page
    const toast = document.getElementById('share-toast');
    if (toast) {
      toast.textContent = text;
      toast.classList.remove('hidden');
      toast.classList.add('visible');
      setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.classList.add('hidden'), 300);
      }, 2000);
    }
  }
};
