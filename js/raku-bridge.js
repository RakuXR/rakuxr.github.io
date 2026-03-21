/**
 * RakuAI Browser Runtime Bridge (J.4)
 *
 * Bridges the gap between the frontend (API-generated .raku configs)
 * and the browser WASM runtime (raku_loader.js / genre_*.wasm).
 *
 * Responsibilities:
 * - Load .raku config into browser WASM runtime
 * - Handle config hot-reload for iterate flow (J.5)
 * - Provide game launch/stop lifecycle
 * - CDN asset URL resolution (J.8)
 *
 * Usage:
 *   // After generating a game via RakuAPI.generate()
 *   const bridge = new RakuBridge('#game-canvas');
 *   await bridge.loadGame(rakuConfig);
 *
 *   // After iterating via RakuAPI.iterate()
 *   bridge.hotReload(updatedConfig);
 */

const RakuBridge = (function () {
    'use strict';

    const CDN_BASE = window.RAKU_CDN_BASE || 'https://cdn.raku.games';
    const WASM_PATH = '/wasm/v1';

    /**
     * Map of genre names to WASM module files.
     * Each genre has: .js (Emscripten glue), .wasm (binary), .data (assets)
     */
    const GENRE_MODULES = {
        space_shooter: 'genre_space_shooter',
        puzzle: 'genre_puzzle',
        card_battle: 'genre_card_battle',
        platformer: 'genre_platformer',
        runner: 'genre_runner',
        rpg: 'genre_rpg',
        tower_defense: 'genre_tower_defense',
        rhythm: 'genre_rhythm',
        arena_combat: 'genre_arena_combat',
        racing: 'genre_racing',
        survival: 'genre_survival',
        sandbox: 'genre_sandbox',
        strategy: 'genre_strategy',
    };

    class Bridge {
        constructor(canvasSelector) {
            this.canvas = typeof canvasSelector === 'string'
                ? document.querySelector(canvasSelector)
                : canvasSelector;
            this.module = null;
            this.genre = null;
            this.config = null;
            this.state = 'idle'; // idle | loading | running | error
            this._onStateChange = null;
        }

        /**
         * Load and start a game from a .raku config.
         *
         * @param {Object} rakuConfig - The raku_config from API generate response
         * @returns {Promise<void>}
         */
        async loadGame(rakuConfig) {
            if (!rakuConfig || !rakuConfig.genre) {
                throw new Error('Invalid raku_config: missing genre');
            }

            this.config = rakuConfig;
            this.genre = rakuConfig.genre.toLowerCase();
            this._setState('loading');

            try {
                // 1. Resolve WASM module for this genre
                const moduleName = GENRE_MODULES[this.genre];
                if (!moduleName) {
                    throw new Error(`Unsupported genre: ${this.genre}`);
                }

                // 2. Build WASM URLs
                const wasmBase = window.RAKU_WASM_BASE || `${CDN_BASE}${WASM_PATH}`;
                const jsUrl = `${wasmBase}/${moduleName}.js`;
                const wasmUrl = `${wasmBase}/${moduleName}.wasm`;

                // 3. Load Emscripten module
                this.module = await this._loadWasmModule(jsUrl, wasmUrl, rakuConfig);

                // 4. Inject initial config
                this._injectConfig(rakuConfig);

                this._setState('running');
            } catch (err) {
                this._setState('error');
                throw err;
            }
        }

        /**
         * Hot-reload a config change into a running game (J.5).
         *
         * @param {Object} updatedConfig - The updated raku_config from iterate
         * @returns {boolean} True if reload succeeded
         */
        hotReload(updatedConfig) {
            if (this.state !== 'running' || !this.module) {
                console.warn('RakuBridge: Cannot hot-reload — game not running');
                return false;
            }

            this.config = updatedConfig;
            return this._injectConfig(updatedConfig);
        }

        /**
         * Stop the running game and clean up.
         */
        stop() {
            if (this.module) {
                // Try to call WASM shutdown if available
                try {
                    if (this.module._raku_shutdown) {
                        this.module._raku_shutdown();
                    }
                } catch (e) {
                    // Ignore shutdown errors
                }
                this.module = null;
            }
            this.config = null;
            this.genre = null;
            this._setState('idle');
        }

        /**
         * Set a state change callback.
         * @param {Function} callback - Called with (newState, oldState)
         */
        onStateChange(callback) {
            this._onStateChange = callback;
        }

        /**
         * Get the current game config.
         * @returns {Object|null}
         */
        getConfig() {
            return this.config;
        }

        /**
         * Download current config as a .raku file.
         */
        downloadConfig() {
            if (!this.config) return;

            const blob = new Blob(
                [JSON.stringify(this.config, null, 2)],
                { type: 'application/json' }
            );
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${this.config.title || 'game'}.raku`;
            a.click();
            URL.revokeObjectURL(url);
        }

        // --- Internal ---

        _setState(state) {
            const old = this.state;
            this.state = state;
            if (this._onStateChange) {
                this._onStateChange(state, old);
            }
        }

        async _loadWasmModule(jsUrl, wasmUrl, config) {
            // Check if the Emscripten module factory is already loaded
            const factoryName = `RakuGenre_${this.genre}`;

            if (!window[factoryName]) {
                // Dynamically load the Emscripten glue JS
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = jsUrl;
                    script.onload = resolve;
                    script.onerror = () => reject(new Error(`Failed to load WASM glue: ${jsUrl}`));
                    document.head.appendChild(script);
                });
            }

            const factory = window[factoryName];
            if (!factory) {
                throw new Error(`WASM module factory not found: ${factoryName}`);
            }

            // Instantiate the module with canvas
            const moduleConfig = {
                canvas: this.canvas,
                locateFile: (path) => {
                    if (path.endsWith('.wasm')) return wasmUrl;
                    const wasmBase = window.RAKU_WASM_BASE || `${CDN_BASE}${WASM_PATH}`;
                    return `${wasmBase}/${path}`;
                },
                // Pass initial config as environment variable
                preRun: [(mod) => {
                    if (mod.ENV) {
                        mod.ENV.RAKU_CONFIG = JSON.stringify(config);
                    }
                }],
            };

            return factory(moduleConfig);
        }

        _injectConfig(config) {
            if (!this.module) return false;

            const json = JSON.stringify(config);

            // Method 1: Call exported hot_reload function (preferred)
            try {
                if (this.module._raku_hot_reload_config) {
                    const ptr = this.module.allocateUTF8(json);
                    const result = this.module._raku_hot_reload_config(ptr, json.length);
                    this.module._free(ptr);
                    return result === 0;
                }
            } catch (e) {
                console.warn('RakuBridge: hot_reload_config failed:', e);
            }

            // Method 2: Try cwrap (Emscripten convenience)
            try {
                if (this.module.cwrap) {
                    const hotReload = this.module.cwrap('raku_hot_reload_config', 'number', ['string', 'number']);
                    const result = hotReload(json, json.length);
                    return result === 0;
                }
            } catch (e) {
                // cwrap not available or function not exported
            }

            // Method 3: Set config via environment (for next frame pickup)
            try {
                if (this.module.ENV) {
                    this.module.ENV.RAKU_CONFIG = json;
                    return true;
                }
            } catch (e) {
                // ENV not accessible
            }

            console.warn('RakuBridge: No config injection method available');
            return false;
        }
    }

    return Bridge;
})();
