// SPDX-License-Identifier: MIT
//
// Raku Capture -- hosted connect UX (Wave 3 Lane 3A).
//
// Standalone, self-contained mini-app that drives the raku-api
// ``/api/v1/connect/*`` endpoints from the browser. Loaded by
// ``connect.html`` only -- intentionally separate from ``capture_app.js``
// so this lane does not collide with Lanes 3B / 3C / 3C-fix (which
// own ``capture_app.js``).
//
// REAL / SEAM honesty (mirrors the backend's Lane 3A):
// - The /connect/begin + /complete + /status + /revoke calls are REAL.
// - The raw_key returned by /complete is REAL today: a user can paste
//   it as the ``X-Raku-API-Key`` header on ``/api/raku/*`` calls.
// - The *hosted MCP relay URL* (``mcp_endpoint``) is a SEAM until
//   ``RAKU_MCP_RELAY_BASE_URL`` is set on the API. When the API
//   reports ``hosted_relay_state: "seam"`` this UI renders an honest
//   "what a human must supply" notice and shows the stdio / raw-header
//   instructions as the available paths. Never fake success.
//
// No third-party imports. Vanilla DOM + fetch. The Spark / three.js
// dependencies live in the capture app; the connect page is intentionally
// dependency-light so the consumer flow loads instantly even on a flaky
// network.

(function () {
  'use strict';

  // ----- API base detection (mirrors capture_app.js exactly) ---------------

  /** @returns {string} The raku-api base URL. */
  function detectApiBase() {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:8000';
    }
    return 'https://api.rakuai.com';
  }

  const API_BASE = detectApiBase();

  // ----- DOM helpers --------------------------------------------------------

  /**
   * Get an element by id, or throw if it's missing -- the connect.html
   * page is the only caller and ships with every id below; a missing id
   * is a build break, not a runtime "maybe".
   */
  function $(id) {
    const el = document.getElementById(id);
    if (!el) throw new Error(`connect.js: missing #${id}`);
    return el;
  }

  /** Show / hide a section by id. */
  function show(id, visible) {
    const el = document.getElementById(id);
    if (!el) return;
    el.hidden = !visible;
  }

  /** Set the inner text of an element by id. No HTML, no XSS. */
  function setText(id, text) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text == null ? '' : String(text);
  }

  /**
   * Render a banner. ``state`` ∈ {info, success, error, warn, seam}; each
   * gets a coloured CSS class. Used at every step so the page never
   * lies about a partial failure.
   */
  function banner(state, message) {
    const el = $('connect-banner');
    el.className = `banner banner-${state}`;
    el.textContent = message;
    el.hidden = false;
  }

  function clearBanner() {
    const el = document.getElementById('connect-banner');
    if (el) el.hidden = true;
  }

  // ----- Credential storage (in-memory only) -------------------------------

  /**
   * Credentials are NEVER persisted to localStorage by this page. The
   * Bearer JWT a user pastes in lives in a closure here and is only sent
   * to the raku-api over TLS. If the user wants persistence they store
   * the raw_key returned at /connect/complete themselves (we even tell
   * them to in the next_steps).
   */
  const session = {
    jwt: '',
    apiKey: '',
    accountId: '',
    displayName: '',
    pendingConnectToken: '',
  };

  /** Headers for an authenticated call. JWT wins if both are set, mirroring
   *  resolve_identity's precedence rules on the server. */
  function authHeaders() {
    const h = { 'Content-Type': 'application/json' };
    if (session.jwt) {
      h['Authorization'] = `Bearer ${session.jwt}`;
    } else if (session.apiKey) {
      h['X-Raku-API-Key'] = session.apiKey;
    }
    return h;
  }

  function hasCreds() {
    return Boolean(session.jwt || session.apiKey);
  }

  // ----- Network calls -----------------------------------------------------

  /** POST /api/v1/connect/begin */
  async function callBegin(assistant, label) {
    const resp = await fetch(`${API_BASE}/api/v1/connect/begin`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ assistant, label: label || undefined }),
    });
    return readJson(resp);
  }

  /** POST /api/v1/connect/complete */
  async function callComplete(connect_token) {
    // /complete is anonymous-friendly (a vendor server may POST it with
    // only the token), but we also send the caller's creds so the
    // server can cross-check ownership.
    const resp = await fetch(`${API_BASE}/api/v1/connect/complete`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ connect_token }),
    });
    return readJson(resp);
  }

  /** GET /api/v1/connect/status */
  async function callStatus() {
    const resp = await fetch(`${API_BASE}/api/v1/connect/status`, {
      method: 'GET',
      headers: authHeaders(),
    });
    return readJson(resp);
  }

  /** POST /api/v1/connect/revoke */
  async function callRevoke(connector_id) {
    const resp = await fetch(`${API_BASE}/api/v1/connect/revoke`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ connector_id }),
    });
    return readJson(resp);
  }

  /** Read a JSON body + throw on non-2xx so the caller sees real status. */
  async function readJson(resp) {
    let body = null;
    try {
      body = await resp.json();
    } catch (_e) {
      body = null;
    }
    if (!resp.ok) {
      const detail = (body && body.detail) || resp.statusText || 'request failed';
      const err = new Error(`${resp.status} ${detail}`);
      err.status = resp.status;
      err.body = body;
      throw err;
    }
    return body;
  }

  // ----- Step 1: sign in (collect credentials) -----------------------------

  function bindSignIn() {
    $('btn-use-jwt').addEventListener('click', () => {
      const v = $('input-jwt').value.trim();
      if (!v) {
        banner('error', 'Paste a JWT (or use the API key option below).');
        return;
      }
      session.jwt = v;
      session.apiKey = '';
      onCredsSet();
    });
    $('btn-use-apikey').addEventListener('click', () => {
      const v = $('input-apikey').value.trim();
      if (!v) {
        banner('error', 'Paste a raku_ API key (or use the JWT option above).');
        return;
      }
      session.apiKey = v;
      session.jwt = '';
      onCredsSet();
    });
    $('btn-sign-out').addEventListener('click', () => {
      session.jwt = '';
      session.apiKey = '';
      session.accountId = '';
      session.displayName = '';
      show('step-signed-in', false);
      show('step-sign-in', true);
      show('step-connect', false);
      show('step-connectors', false);
      show('step-completed', false);
      $('input-jwt').value = '';
      $('input-apikey').value = '';
      clearBanner();
    });
  }

  /** Called once a credential is in hand. Calls /status to confirm. */
  async function onCredsSet() {
    clearBanner();
    show('step-sign-in', false);
    show('step-signed-in', true);
    show('step-connect', true);
    show('step-connectors', true);
    try {
      const s = await callStatus();
      session.accountId = s.account_id || '';
      session.displayName = s.account_display_name || '';
      setText('signed-in-name', session.displayName || '(no display name)');
      setText('signed-in-account', session.accountId);
      setText('signed-in-tier', s.tier);
      renderRelayState(s.hosted_relay_state);
      renderConnectorsList(s.connectors || []);
    } catch (e) {
      banner('error', `Couldn't read your account: ${e.message}.`);
      // Roll back the sign-in so the user sees something true.
      session.jwt = '';
      session.apiKey = '';
      show('step-sign-in', true);
      show('step-signed-in', false);
      show('step-connect', false);
      show('step-connectors', false);
    }
  }

  function renderRelayState(state) {
    const el = $('relay-state');
    if (state === 'real') {
      el.className = 'pill pill-real';
      el.textContent = 'Hosted MCP relay: REAL';
    } else {
      el.className = 'pill pill-seam';
      el.textContent = 'Hosted MCP relay: SEAM (not yet hosted)';
    }
  }

  // ----- Step 2: pick an assistant + begin ---------------------------------

  function bindBegin() {
    document.querySelectorAll('[data-assistant]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const assistant = btn.getAttribute('data-assistant');
        runBegin(assistant);
      });
    });
  }

  async function runBegin(assistant) {
    clearBanner();
    const label = $('input-label').value.trim();
    try {
      const out = await callBegin(assistant, label);
      session.pendingConnectToken = out.connect_token;
      setText('pending-assistant', out.assistant);
      setText('pending-expires', new Date(out.expires_at).toLocaleString());
      $('input-connect-token').value = out.connect_token;
      show('step-token-issued', true);
      banner('success', 'Connect token issued. Click "Exchange" to mint the durable key.');
    } catch (e) {
      banner('error', `Begin failed: ${e.message}`);
    }
  }

  // ----- Step 3: complete the exchange -------------------------------------

  function bindComplete() {
    $('btn-complete').addEventListener('click', async () => {
      clearBanner();
      const token = $('input-connect-token').value.trim();
      if (!token) {
        banner('error', 'Need a connect token (run Begin first).');
        return;
      }
      try {
        const out = await callComplete(token);
        renderCompletion(out);
        // Refresh the connector list so the new one appears.
        const s = await callStatus();
        renderConnectorsList(s.connectors || []);
      } catch (e) {
        banner('error', `Complete failed: ${e.message}`);
      }
    });
  }

  function renderCompletion(out) {
    show('step-completed', true);
    setText('completed-connector-id', out.connector_id);
    setText('completed-assistant', out.assistant);
    setText('completed-raw-key', out.api_key.raw_key);
    setText('completed-key-prefix', out.api_key.key_prefix);

    const hosted = out.install_instructions && out.install_instructions.hosted;
    if (out.hosted_relay_state === 'real' && out.mcp_endpoint) {
      show('completed-hosted', true);
      show('completed-seam', false);
      setText('completed-mcp-endpoint', out.mcp_endpoint);
      setText('completed-hosted-summary', (hosted && hosted.summary) || '');
    } else {
      show('completed-hosted', false);
      show('completed-seam', true);
      setText(
        'completed-seam-text',
        out.human_action_required ||
          'Hosted relay not yet provisioned. Use the raw key with X-Raku-API-Key.',
      );
    }
    // Stdio + raw sections are always honest about the dev option.
    const stdioDoc = (out.install_instructions && out.install_instructions.stdio &&
                      out.install_instructions.stdio.doc_url) ||
                     'https://github.com/RakuXR/raku-runtime/tree/main/mcp';
    $('completed-stdio-link').href = stdioDoc;

    banner('success', 'Connector created. Store the raw key now -- it is shown ONCE.');
  }

  // ----- Step 4: connectors list / revoke ----------------------------------

  function renderConnectorsList(connectors) {
    const tbody = $('connectors-tbody');
    tbody.innerHTML = '';
    if (!connectors.length) {
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td colspan="5" class="muted">No connectors yet. Begin a connect above.</td>';
      tbody.appendChild(tr);
      return;
    }
    for (const c of connectors) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(c.assistant)}</td>
        <td><code>${escapeHtml(c.key_prefix)}</code></td>
        <td>${escapeHtml(new Date(c.created_at).toLocaleString())}</td>
        <td>${c.is_active ? '<span class="pill pill-real">active</span>' :
                            '<span class="pill pill-seam">revoked</span>'}</td>
        <td>${c.is_active ? `<button data-revoke="${escapeAttr(c.connector_id)}">Revoke</button>` : ''}</td>
      `;
      tbody.appendChild(tr);
    }
    tbody.querySelectorAll('[data-revoke]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-revoke');
        try {
          await callRevoke(id);
          const s = await callStatus();
          renderConnectorsList(s.connectors || []);
          banner('info', 'Connector revoked.');
        } catch (e) {
          banner('error', `Revoke failed: ${e.message}`);
        }
      });
    });
  }

  // ----- Misc helpers ------------------------------------------------------

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function escapeAttr(s) {
    return escapeHtml(s);
  }

  /** Wire a "copy" button against an element id. */
  function bindCopyButtons() {
    document.querySelectorAll('[data-copy-target]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const targetId = btn.getAttribute('data-copy-target');
        const el = document.getElementById(targetId);
        // <input> / <textarea> hold the value in .value; <code> and other
        // elements expose it via textContent. Read both, prefer value
        // when the element actually has one (Copilot PR-1509 fix).
        let text = '';
        if (el) {
          if (typeof el.value === 'string' && el.value !== '') {
            text = el.value;
          } else {
            text = el.textContent || '';
          }
        }
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
          } else {
            // Fallback for HTTP / older browsers / contexts where
            // navigator.clipboard is unavailable. capture_app.js only
            // uses the modern Clipboard API and silently no-ops when
            // it is missing; the connect page is the consumer flow
            // so it is worth keeping the document.execCommand path
            // for the rare HTTP / file:// preview. The execCommand
            // API is deprecated but still widely shipped.
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
          }
          btn.textContent = 'Copied!';
          setTimeout(() => (btn.textContent = btn.dataset.copyLabel || 'Copy'), 1500);
        } catch (_e) {
          btn.textContent = 'Copy failed';
        }
      });
    });
  }

  // ----- Deep-link prefill --------------------------------------------------

  /**
   * If the page was loaded with ``?assistant=claude&connector_id=...`` from
   * the email/install_url flow, prefill the UI accordingly. The token
   * itself NEVER comes via the URL (would leak in browser history) --
   * the user pastes it; this just tilts the UI in the right direction.
   */
  function applyDeepLinkPrefill() {
    try {
      const u = new URL(window.location.href);
      const a = u.searchParams.get('assistant');
      if (a) {
        const btn = document.querySelector(`[data-assistant="${a}"]`);
        if (btn) btn.classList.add('highlight');
      }
      const cid = u.searchParams.get('connector_id');
      if (cid) {
        banner('info', `Deep-linked connector: ${cid}. Sign in to view it.`);
      }
    } catch (_e) {
      /* ignore */
    }
  }

  // ----- Entry point --------------------------------------------------------

  function boot() {
    setText('api-base', API_BASE);
    bindSignIn();
    bindBegin();
    bindComplete();
    bindCopyButtons();
    applyDeepLinkPrefill();
    show('step-sign-in', true);
    show('step-signed-in', false);
    show('step-connect', false);
    show('step-connectors', false);
    show('step-completed', false);
    show('step-token-issued', false);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
