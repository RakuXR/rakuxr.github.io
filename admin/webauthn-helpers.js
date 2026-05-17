// WebAuthn JS helpers — base64url <-> ArrayBuffer translation.
//
// py-webauthn emits options with base64url-encoded byte fields
// (challenge, user.id, allowCredentials[].id, excludeCredentials[].id).
// The browser's WebAuthn API needs those as ArrayBuffer. The browser's
// response gives back ArrayBuffer for clientDataJSON, attestationObject,
// authenticatorData, signature, userHandle — which we need to base64url
// before posting to the server.
//
// These helpers are deliberately self-contained: no deps, no minification
// requirement, ~80 lines.

(function (root) {
    'use strict';

    function b64urlToBytes(s) {
        s = s.replace(/-/g, '+').replace(/_/g, '/');
        var pad = 4 - (s.length % 4);
        if (pad !== 4) s += '='.repeat(pad);
        var raw = atob(s);
        var out = new Uint8Array(raw.length);
        for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
        return out;
    }

    function bytesToB64url(buf) {
        var u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
        var s = '';
        for (var i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
        return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    function toBuffer(b64) { return b64urlToBytes(b64).buffer; }

    function decodeRegistrationOptions(opts) {
        // Decode the fields navigator.credentials.create needs as
        // BufferSource. Keep everything else intact.
        var out = JSON.parse(JSON.stringify(opts));  // shallow clone
        out.challenge = toBuffer(out.challenge);
        if (out.user && out.user.id) out.user.id = toBuffer(out.user.id);
        if (Array.isArray(out.excludeCredentials)) {
            out.excludeCredentials = out.excludeCredentials.map(function (c) {
                return Object.assign({}, c, { id: toBuffer(c.id) });
            });
        }
        return out;
    }

    function decodeAuthenticationOptions(opts) {
        var out = JSON.parse(JSON.stringify(opts));
        out.challenge = toBuffer(out.challenge);
        if (Array.isArray(out.allowCredentials)) {
            out.allowCredentials = out.allowCredentials.map(function (c) {
                return Object.assign({}, c, { id: toBuffer(c.id) });
            });
        }
        return out;
    }

    function encodeRegistrationResponse(cred) {
        var resp = cred.response;
        var out = {
            id: cred.id,
            rawId: bytesToB64url(cred.rawId),
            type: cred.type,
            response: {
                attestationObject: bytesToB64url(resp.attestationObject),
                clientDataJSON: bytesToB64url(resp.clientDataJSON),
            },
        };
        if (typeof resp.getTransports === 'function') {
            try { out.response.transports = resp.getTransports(); } catch (_) {}
        }
        if (cred.authenticatorAttachment) out.authenticatorAttachment = cred.authenticatorAttachment;
        if (typeof cred.getClientExtensionResults === 'function') {
            try { out.clientExtensionResults = cred.getClientExtensionResults() || {}; } catch (_) { out.clientExtensionResults = {}; }
        } else {
            out.clientExtensionResults = {};
        }
        return out;
    }

    function encodeAuthenticationResponse(cred) {
        var resp = cred.response;
        var out = {
            id: cred.id,
            rawId: bytesToB64url(cred.rawId),
            type: cred.type,
            response: {
                authenticatorData: bytesToB64url(resp.authenticatorData),
                clientDataJSON: bytesToB64url(resp.clientDataJSON),
                signature: bytesToB64url(resp.signature),
            },
        };
        if (resp.userHandle) out.response.userHandle = bytesToB64url(resp.userHandle);
        if (cred.authenticatorAttachment) out.authenticatorAttachment = cred.authenticatorAttachment;
        if (typeof cred.getClientExtensionResults === 'function') {
            try { out.clientExtensionResults = cred.getClientExtensionResults() || {}; } catch (_) { out.clientExtensionResults = {}; }
        } else {
            out.clientExtensionResults = {};
        }
        return out;
    }

    root.rakuWebAuthn = {
        decodeRegistrationOptions: decodeRegistrationOptions,
        decodeAuthenticationOptions: decodeAuthenticationOptions,
        encodeRegistrationResponse: encodeRegistrationResponse,
        encodeAuthenticationResponse: encodeAuthenticationResponse,
        b64urlToBytes: b64urlToBytes,
        bytesToB64url: bytesToB64url,
    };
})(window);
