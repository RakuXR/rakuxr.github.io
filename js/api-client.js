/**
 * RakuAI API Client — Centralized API + Auth (J.2 + J.6)
 *
 * Single source of truth for:
 * - API base URL configuration
 * - Auth token storage (standardized key)
 * - User profile storage
 * - Authenticated fetch wrapper
 * - Token refresh handling
 *
 * All pages should use this instead of direct fetch() + custom token keys.
 */

const RakuAPI = (function () {
    'use strict';

    // --- Configuration ---
    const API_BASE = window.RAKU_API_BASE || 'https://api.raku.games';
    const TOKEN_KEY = 'raku_access_token';
    const REFRESH_KEY = 'raku_refresh_token';
    const USER_KEY = 'raku_user';

    // --- Token Management (J.6) ---

    function getToken() {
        return localStorage.getItem(TOKEN_KEY);
    }

    function setToken(accessToken, refreshToken) {
        localStorage.setItem(TOKEN_KEY, accessToken);
        if (refreshToken) {
            localStorage.setItem(REFRESH_KEY, refreshToken);
        }
    }

    function clearAuth() {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_KEY);
        localStorage.removeItem(USER_KEY);
    }

    function getUser() {
        try {
            return JSON.parse(localStorage.getItem(USER_KEY));
        } catch {
            return null;
        }
    }

    function setUser(user) {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
    }

    function isLoggedIn() {
        return !!getToken();
    }

    // --- Migration: move tokens from old keys to standard key ---
    (function migrateTokens() {
        const oldKeys = ['raku_auth_token', 'raku_token'];
        for (const key of oldKeys) {
            // Check both localStorage and sessionStorage
            const fromLocal = localStorage.getItem(key);
            const fromSession = sessionStorage.getItem(key);
            const token = fromLocal || fromSession;

            if (token && !getToken()) {
                setToken(token);
            }
            // Clean up old keys
            localStorage.removeItem(key);
            sessionStorage.removeItem(key);
        }
        // Also migrate from sessionStorage version of new key
        const sessionToken = sessionStorage.getItem(TOKEN_KEY);
        if (sessionToken && !getToken()) {
            setToken(sessionToken);
        }
        sessionStorage.removeItem(TOKEN_KEY);
    })();

    // --- Authenticated Fetch Wrapper ---

    async function apiFetch(path, options = {}) {
        const url = `${API_BASE}${path}`;
        const headers = options.headers || {};

        const token = getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(options.body);
        }

        const response = await fetch(url, { ...options, headers });

        // Handle 401 — clear auth and redirect to login
        if (response.status === 401) {
            clearAuth();
            // Don't redirect on API-only pages or background requests
            if (!options.silent) {
                window.dispatchEvent(new CustomEvent('raku:auth-expired'));
            }
        }

        return response;
    }

    // --- Auth Endpoints (J.6) ---

    async function register(email, password, displayName) {
        const resp = await apiFetch('/api/v1/auth/register', {
            method: 'POST',
            body: { email, password, display_name: displayName },
        });

        if (!resp.ok) {
            const err = await resp.json();
            throw new Error(err.detail || 'Registration failed');
        }

        const data = await resp.json();
        setToken(data.access_token, data.refresh_token);
        setUser(data.user);
        return data;
    }

    async function login(email, password) {
        const resp = await apiFetch('/api/v1/auth/login', {
            method: 'POST',
            body: { email, password },
        });

        if (!resp.ok) {
            const err = await resp.json();
            throw new Error(err.detail || 'Login failed');
        }

        const data = await resp.json();
        setToken(data.access_token, data.refresh_token);
        setUser(data.user);
        return data;
    }

    async function googleAuth(idToken) {
        const resp = await apiFetch('/api/v1/auth/google', {
            method: 'POST',
            body: { id_token: idToken },
        });

        if (!resp.ok) {
            const err = await resp.json();
            throw new Error(err.detail || 'Google auth failed');
        }

        const data = await resp.json();
        setToken(data.access_token, data.refresh_token);
        setUser(data.user);
        return data;
    }

    function logout() {
        clearAuth();
        window.dispatchEvent(new CustomEvent('raku:logged-out'));
    }

    // --- Game Generation (J.3) ---

    async function generate(prompt, preferences) {
        const resp = await apiFetch('/api/v1/generate', {
            method: 'POST',
            body: { prompt, preferences },
        });

        if (!resp.ok) {
            const err = await resp.json();
            throw new Error(err.detail || 'Generation failed');
        }

        return resp.json();
    }

    function generateProgressSSE(gameId, onEvent) {
        const token = getToken();
        const url = `${API_BASE}/api/v1/generate/${gameId}/progress${token ? '?token=' + token : ''}`;
        const source = new EventSource(url);

        source.addEventListener('stage', (e) => {
            onEvent({ type: 'stage', data: JSON.parse(e.data) });
        });
        source.addEventListener('complete', (e) => {
            onEvent({ type: 'complete', data: JSON.parse(e.data) });
            source.close();
        });
        source.addEventListener('error_event', (e) => {
            onEvent({ type: 'error', data: JSON.parse(e.data) });
            source.close();
        });
        source.onerror = () => {
            onEvent({ type: 'error', data: { message: 'Connection lost' } });
            source.close();
        };

        return source;
    }

    async function getGenerationStatus(gameId) {
        const resp = await apiFetch(`/api/v1/generate/${gameId}/status`, { silent: true });
        if (!resp.ok) throw new Error('Failed to get status');
        return resp.json();
    }

    // --- Iterate (J.5) ---

    async function iterate(gameId, message, currentConfig) {
        const resp = await apiFetch('/api/v1/iterate', {
            method: 'POST',
            body: { game_id: gameId, message, current_config: currentConfig },
        });

        if (!resp.ok) {
            const err = await resp.json();
            throw new Error(err.detail || 'Iteration failed');
        }

        return resp.json();
    }

    // --- Games CRUD ---

    async function listGames(offset = 0, limit = 20) {
        const resp = await apiFetch(`/api/v1/games?offset=${offset}&limit=${limit}`);
        if (!resp.ok) throw new Error('Failed to list games');
        return resp.json();
    }

    async function getGame(gameId) {
        const resp = await apiFetch(`/api/v1/games/${gameId}`, { silent: true });
        if (!resp.ok) throw new Error('Failed to get game');
        return resp.json();
    }

    async function deleteGame(gameId) {
        const resp = await apiFetch(`/api/v1/games/${gameId}`, { method: 'DELETE' });
        if (!resp.ok) throw new Error('Failed to delete game');
        return true;
    }

    // --- Usage ---

    async function getUsage() {
        const resp = await apiFetch('/api/v1/usage', { silent: true });
        if (!resp.ok) return null;
        return resp.json();
    }

    // --- Billing ---

    async function createCheckoutSession(billingPeriod, options = {}) {
        const resp = await apiFetch('/api/v1/billing/create-checkout-session', {
            method: 'POST',
            body: {
                billing_period: billingPeriod || 'monthly',
                enable_trial: options.enableTrial !== false,
                promo_code: options.promoCode || null,
                referral_code: options.referralCode || null,
            },
        });
        if (!resp.ok) {
            const err = await resp.json();
            throw new Error(err.detail || 'Checkout failed');
        }
        return resp.json();
    }

    async function getSubscription() {
        const resp = await apiFetch('/api/v1/billing/subscription', { silent: true });
        if (!resp.ok) return null;
        return resp.json();
    }

    // --- CDN / Asset URLs (J.8) ---

    function getWasmUrl(genre, version) {
        const cdnBase = window.RAKU_CDN_BASE || 'https://cdn.raku.games';
        version = version || 'latest';
        return `${cdnBase}/wasm/v1/genre_${genre}.wasm?v=${version}`;
    }

    function getAssetUrl(packName, assetPath) {
        const cdnBase = window.RAKU_CDN_BASE || 'https://cdn.raku.games';
        return `${cdnBase}/assets/v1/${packName}/${assetPath}`;
    }

    // --- Public API ---

    return {
        API_BASE,
        // Auth
        getToken,
        setToken,
        clearAuth,
        getUser,
        setUser,
        isLoggedIn,
        register,
        login,
        googleAuth,
        logout,
        // Generate (J.3)
        generate,
        generateProgressSSE,
        getGenerationStatus,
        // Iterate (J.5)
        iterate,
        // Games
        listGames,
        getGame,
        deleteGame,
        // Usage
        getUsage,
        // Billing
        createCheckoutSession,
        getSubscription,
        // CDN (J.8)
        getWasmUrl,
        getAssetUrl,
        // Low-level
        apiFetch,
    };
})();
