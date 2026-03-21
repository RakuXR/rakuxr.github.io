/**
 * RakuAI Share Flow Integration (J.7)
 *
 * End-to-end share flow:
 * 1. User clicks Share → generate shareable URL
 * 2. Recipient opens URL → game loads in browser
 * 3. Social sharing (native, clipboard, social cards)
 *
 * Depends on: api-client.js (RakuAPI)
 */

const RakuShare = (function () {
    'use strict';

    const SHARE_BASE = window.location.origin;

    /**
     * Generate a shareable URL for a game.
     *
     * @param {string} gameId - The game ID
     * @param {Object} config - Optional raku_config for URL params fallback
     * @returns {string} Shareable URL
     */
    function getShareUrl(gameId, config) {
        if (gameId) {
            return `${SHARE_BASE}/share.html?id=${encodeURIComponent(gameId)}`;
        }
        // Fallback: embed config metadata in URL params
        if (config) {
            const params = new URLSearchParams();
            if (config.title) params.set('title', config.title);
            if (config.genre) params.set('genre', config.genre);
            if (config.description) params.set('desc', config.description.slice(0, 200));
            return `${SHARE_BASE}/share.html?${params.toString()}`;
        }
        return `${SHARE_BASE}/share.html`;
    }

    /**
     * Generate a play URL that directly loads the game in browser.
     *
     * @param {string} gameId - The game ID
     * @returns {string} Play URL
     */
    function getPlayUrl(gameId) {
        return `${SHARE_BASE}/play.html?id=${encodeURIComponent(gameId)}`;
    }

    /**
     * Share via the Web Share API (native share dialog).
     *
     * @param {Object} options - { gameId, title, description, config }
     * @returns {Promise<boolean>} True if shared successfully
     */
    async function shareNative(options) {
        const { gameId, title, description } = options;
        const url = getShareUrl(gameId, options.config);

        if (navigator.share) {
            try {
                await navigator.share({
                    title: title || 'Check out this game on RakuAI',
                    text: description || 'I created this game by describing it to AI. Try it!',
                    url: url,
                });
                return true;
            } catch (e) {
                if (e.name !== 'AbortError') {
                    console.warn('Share failed:', e);
                }
                return false;
            }
        }
        // Fallback to clipboard
        return copyToClipboard(url);
    }

    /**
     * Copy URL to clipboard.
     *
     * @param {string} url - URL to copy
     * @returns {Promise<boolean>}
     */
    async function copyToClipboard(url) {
        try {
            await navigator.clipboard.writeText(url);
            return true;
        } catch {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = url;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            const success = document.execCommand('copy');
            document.body.removeChild(textarea);
            return success;
        }
    }

    /**
     * Generate social sharing URLs.
     *
     * @param {string} gameId - The game ID
     * @param {Object} config - raku_config with title/description
     * @returns {Object} URLs for each platform
     */
    function getSocialUrls(gameId, config) {
        const url = encodeURIComponent(getShareUrl(gameId, config));
        const title = encodeURIComponent(config?.title || 'My AI-Generated Game');
        const text = encodeURIComponent(
            config?.description || 'I created this game by describing it to AI on RakuAI!'
        );

        return {
            twitter: `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
            facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
            linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
            whatsapp: `https://wa.me/?text=${text}%20${url}`,
            discord: null, // Discord embeds use OG tags automatically
        };
    }

    /**
     * Load a shared game from URL parameters.
     * Used by share.html and play.html to resolve game data.
     *
     * @returns {Promise<Object|null>} Game data or null
     */
    async function loadSharedGame() {
        const params = new URLSearchParams(window.location.search);
        const gameId = params.get('id');

        if (!gameId) {
            // Try to build from URL params
            const title = params.get('title');
            const genre = params.get('genre');
            const desc = params.get('desc');
            if (title || genre) {
                return { title, genre, description: desc, _fromParams: true };
            }
            return null;
        }

        // Fetch from API
        try {
            if (typeof RakuAPI !== 'undefined') {
                const game = await RakuAPI.getGame(gameId);
                return game.raku_config || game;
            }
            // Fallback: direct fetch without auth
            const resp = await fetch(
                `${window.RAKU_API_BASE || 'https://api.raku.games'}/api/v1/games/${gameId}`
            );
            if (resp.ok) {
                const game = await resp.json();
                return game.raku_config || game;
            }
        } catch (e) {
            console.warn('Failed to load shared game:', e);
        }

        return null;
    }

    return {
        getShareUrl,
        getPlayUrl,
        shareNative,
        copyToClipboard,
        getSocialUrls,
        loadSharedGame,
    };
})();
