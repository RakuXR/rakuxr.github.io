// i18n.js — Raku Capture lightweight localization runtime
// Copyright (c) 2026 RakuAI, LLC. All rights reserved.
//
// ----------------------------------------------------------------------------
// Dependency-free i18n for the Raku Capture PWA. No build step, no framework.
//
// What it does:
//   - Loads a locale JSON file from ./locales/<code>.json.
//   - Detects the preferred locale: ?lang= override > saved choice
//     (localStorage) > navigator.language > 'en'.
//   - Applies translations declaratively to the DOM via data-i18n* attributes
//     (see applyTranslations below), and exposes t() for imperative strings
//     used by capture_app.js (status messages, hints, errors).
//   - Renders a <select> language switcher into any [data-i18n-switcher] host
//     and persists the user's choice.
//
// Adding a locale is trivial: drop a new locales/<code>.json (copy en.json,
// translate the values, set _meta.code/name/nativeName) and add the code to
// SUPPORTED below. Nothing else changes.
//
// Loaded as a classic script BEFORE capture_app.js so window.RakuI18n exists
// when the app module runs. The app awaits RakuI18n.ready before first paint.
// ----------------------------------------------------------------------------

(function () {
  'use strict';

  // Locales shipped with the app. Order is the order shown in the switcher.
  // The first entry is the ultimate fallback when detection finds nothing.
  // Region-tagged codes are lowercased here to match normalize()/the
  // locales/<code>.json filenames (e.g. 'pt-BR' -> 'pt-br.json').
  var SUPPORTED = ['en', 'ja', 'es', 'fr', 'de', 'ko', 'pt-br', 'zh-cn', 'zh-tw'];
  var FALLBACK = 'en';
  var STORAGE_KEY = 'rakuCapture.lang';

  // ---- detection ----------------------------------------------------------

  // Map an arbitrary BCP-47 tag ('ja-JP', 'en-US') to a supported code.
  function normalize(tag) {
    if (!tag) return null;
    var lower = String(tag).toLowerCase();
    if (SUPPORTED.indexOf(lower) !== -1) return lower;
    var base = lower.split('-')[0];
    return SUPPORTED.indexOf(base) !== -1 ? base : null;
  }

  function detectLocale() {
    // 1. explicit ?lang= override (useful for testing / deep links)
    try {
      var qs = new URLSearchParams(window.location.search).get('lang');
      var fromQs = normalize(qs);
      if (fromQs) return fromQs;
    } catch (e) { /* URLSearchParams unavailable - ignore */ }

    // 2. saved choice from a previous visit
    try {
      var saved = normalize(window.localStorage.getItem(STORAGE_KEY));
      if (saved) return saved;
    } catch (e) { /* localStorage blocked - ignore */ }

    // 3. browser languages, most-preferred first
    var langs = (navigator.languages && navigator.languages.length)
      ? navigator.languages
      : [navigator.language || navigator.userLanguage];
    for (var i = 0; i < langs.length; i++) {
      var hit = normalize(langs[i]);
      if (hit) return hit;
    }

    // 4. give up - fall back
    return FALLBACK;
  }

  // ---- string lookup ------------------------------------------------------

  // Resolve a dotted key path ('error.cameraDenied') against a locale object.
  function dig(obj, path) {
    var parts = path.split('.');
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null || typeof cur !== 'object') return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  // Substitute {name} placeholders from a params object.
  function interpolate(str, params) {
    if (!params || typeof str !== 'string') return str;
    return str.replace(/\{(\w+)\}/g, function (m, k) {
      return Object.prototype.hasOwnProperty.call(params, k) ? params[k] : m;
    });
  }

  // ---- runtime state ------------------------------------------------------

  var state = {
    code: FALLBACK,
    messages: {},        // active locale
    fallback: {},        // FALLBACK locale, for missing-key resolution
  };

  // Listeners notified after every locale change (initial load included).
  var listeners = [];

  function fetchLocale(code) {
    return fetch('./locales/' + code + '.json', { cache: 'no-cache' })
      .then(function (resp) {
        if (!resp.ok) throw new Error('locale ' + code + ' HTTP ' + resp.status);
        return resp.json();
      });
  }

  /**
   * Translate a key. Missing keys fall back to the FALLBACK locale, then to
   * the key string itself, so a partial locale never blanks the UI.
   * @param {string} key dotted path, e.g. 'error.cameraDenied'
   * @param {object} [params] {name} placeholder values
   */
  function t(key, params) {
    var val = dig(state.messages, key);
    if (val === undefined) val = dig(state.fallback, key);
    if (val === undefined) return key; // last resort - visible, not blank
    return interpolate(val, params);
  }

  /** Raw (non-interpolated) value - used for arrays like capture.hints. */
  function raw(key) {
    var val = dig(state.messages, key);
    if (val === undefined) val = dig(state.fallback, key);
    return val;
  }

  // ---- DOM application ----------------------------------------------------

  // Apply translations to every element carrying a data-i18n* attribute:
  //   data-i18n="key"            -> element.textContent
  //   data-i18n-html="key"       -> element.innerHTML (for strings with tags)
  //   data-i18n-attr="a:k;b:k2"  -> set attribute a=t(k), b=t(k2)
  function applyTranslations(root) {
    var scope = root || document;

    scope.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });

    scope.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      el.innerHTML = t(el.getAttribute('data-i18n-html'));
    });

    scope.querySelectorAll('[data-i18n-attr]').forEach(function (el) {
      el.getAttribute('data-i18n-attr').split(';').forEach(function (pair) {
        var bits = pair.split(':');
        if (bits.length === 2) {
          el.setAttribute(bits[0].trim(), t(bits[1].trim()));
        }
      });
    });

    // Keep the document chrome in sync with the active locale.
    var meta = state.messages._meta || state.fallback._meta || {};
    document.documentElement.lang = state.code;
    if (meta.dir) document.documentElement.dir = meta.dir;
  }

  // metaByCode is filled lazily as locales are fetched, so the switcher can
  // show every language in its own native name without loading them all.
  var metaByCode = {};

  // Build / refresh the language <select> in every switcher host.
  function renderSwitchers() {
    document.querySelectorAll('[data-i18n-switcher]').forEach(function (host) {
      host.textContent = '';

      var label = document.createElement('label');
      label.className = 'i18n-switcher';
      label.setAttribute('title', t('lang.switcherTitle'));

      var span = document.createElement('span');
      span.className = 'i18n-switcher-label';
      span.textContent = t('lang.label');

      var select = document.createElement('select');
      select.className = 'i18n-switcher-select';
      select.setAttribute('aria-label', t('lang.switcherTitle'));

      SUPPORTED.forEach(function (code) {
        var opt = document.createElement('option');
        opt.value = code;
        var m = metaByCode[code] || {};
        opt.textContent = m.nativeName || m.name || code;
        if (code === state.code) opt.selected = true;
        select.appendChild(opt);
      });

      select.addEventListener('change', function () {
        setLocale(select.value, true);
      });

      label.appendChild(span);
      label.appendChild(select);
      host.appendChild(label);
    });
  }

  function preloadMeta() {
    // Best-effort: fetch just enough of each locale to label the switcher.
    // A failed fetch simply falls back to the bare code in the dropdown.
    return Promise.all(SUPPORTED.map(function (code) {
      if (metaByCode[code]) return Promise.resolve();
      return fetchLocale(code)
        .then(function (data) { metaByCode[code] = data._meta || { code: code }; })
        .catch(function () { metaByCode[code] = { code: code, name: code }; });
    }));
  }

  /**
   * Switch to a locale: fetch it, apply it, optionally persist the choice,
   * and notify listeners. Returns a promise that resolves when applied.
   */
  function setLocale(code, persist) {
    var target = normalize(code) || FALLBACK;
    return fetchLocale(target)
      .then(function (data) {
        state.code = target;
        state.messages = data;
        metaByCode[target] = data._meta || { code: target };
        if (persist) {
          try { window.localStorage.setItem(STORAGE_KEY, target); } catch (e) {}
        }
        applyTranslations(document);
        renderSwitchers();
        listeners.forEach(function (fn) {
          try { fn(target); } catch (e) { console.warn('[RakuI18n] listener failed:', e); }
        });
      })
      .catch(function (err) {
        console.warn('[RakuI18n] could not load locale ' + target + ':', err);
        // If the active locale failed but we have *something*, keep going.
        if (!state.messages || !Object.keys(state.messages).length) {
          applyTranslations(document);
        }
      });
  }

  // ---- bootstrap ----------------------------------------------------------

  // Load the FALLBACK locale first (so t() always has a safety net), then the
  // detected locale. ready resolves once the UI has been localized once.
  var detected = detectLocale();

  var ready = fetchLocale(FALLBACK)
    .then(function (fb) {
      state.fallback = fb;
      metaByCode[FALLBACK] = fb._meta || { code: FALLBACK };
    })
    .catch(function (err) {
      console.warn('[RakuI18n] fallback locale failed to load:', err);
    })
    .then(function () {
      return setLocale(detected, false);
    })
    .then(function () {
      // Fill in the remaining locales' meta for the switcher, off the
      // critical path - the UI is already localized at this point.
      preloadMeta().then(function () { renderSwitchers(); });
    });

  // ---- public API ---------------------------------------------------------

  window.RakuI18n = {
    ready: ready,                       // Promise - resolves after first apply
    t: t,                               // t(key, params) -> string
    raw: raw,                           // raw(key) -> any (arrays, etc.)
    setLocale: function (code) { return setLocale(code, true); },
    locale: function () { return state.code; },
    supported: function () { return SUPPORTED.slice(); },
    apply: function (root) { applyTranslations(root); },
    onChange: function (fn) { if (typeof fn === 'function') listeners.push(fn); },
  };
})();
