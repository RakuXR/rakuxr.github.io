#!/usr/bin/env python3
"""Apply the hosting adaptations to a freshly-synced capture-app/ directory.

capture-app/ is GENERATED, never hand-edited: it equals raku-runtime's
web/capture/ verbatim plus exactly the deterministic adaptations applied here
(and two preserved mirror-only files: README.md, qr-capture-app.svg).

Every adaptation is idempotent so the output is reproducible, which is what
lets verify-capture-app-sync.yml fail CI on any silent drift.

Usage:  scripts/capture-app-adaptations.py <capture-app-dir>
"""
import io
import sys

VIEWPORT = ('  <meta name="viewport" content="width=device-width, '
            'initial-scale=1.0, viewport-fit=cover">')

# (1) index.html CSP: the public host needs a policy; the Spark/three ES
# modules load from cdn.jsdelivr.net and the app fetches api.rakuai.com.
# 2026-06-07: Spark's renderer instantiates WebAssembly, which needs
# 'wasm-unsafe-eval' in script-src; the sample splats now load from
# storage.googleapis.com and sparkjs.dev (see samples/manifest.json, while
# cdn.raku.games self-hosting is not yet live) so both are allowed in
# connect-src, plus data: for the inline decode worker payloads.
# 2026-06-07 (b): finished captures serve their .spz from the private Azure
# Blob captures container via a SAS-token URL on
# rakuaistore.blob.core.windows.net, which the Spark viewer fetch()es — it
# must be in connect-src or the browser blocks the request pre-flight
# (instant "Load failed", no round-trip).
INDEX_CSP = (
    '  <meta http-equiv="Content-Security-Policy" content="'
    "default-src 'self'; "
    "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://cdn.jsdelivr.net; "
    "style-src 'self' 'unsafe-inline'; "
    "img-src 'self' data: blob: https://api.qrserver.com; "
    "font-src 'self'; "
    "connect-src 'self' data: https://api.rakuai.com http://localhost:8000 "
    "https://cdn.jsdelivr.net https://cdn.raku.games "
    "https://storage.googleapis.com https://sparkjs.dev "
    "https://rakuaistore.blob.core.windows.net; "
    "worker-src 'self' blob:; "
    "manifest-src 'self'; "
    "base-uri 'self'; "
    "form-action 'self'; "
    "object-src 'none';"
    '">')

# (2) help.html CSP: a same-origin-only static page, no CDN or API needed.
HELP_CSP = (
    '  <meta http-equiv="Content-Security-Policy" content="'
    "default-src 'self'; "
    "script-src 'self'; "
    "style-src 'self' 'unsafe-inline'; "
    "img-src 'self' data:; "
    "font-src 'self'; "
    "connect-src 'self'; "
    "base-uri 'self'; "
    "form-action 'self'; "
    "object-src 'none';"
    '">')

# (3) sw.js service-worker scope fix.
SW_OLD = "  const isRoot = url.pathname.endsWith('/');"
SW_NEW = (
    "  // isRoot must match ONLY the app root ('/capture-app/'), not every\n"
    "  // sub-directory (e.g. '/capture-app/locales/'): a bare endsWith('/')\n"
    "  // test would wrongly treat those as the shell and shell-cache them.\n"
    "  const rootPath = new URL('./', self.registration.scope).pathname;\n"
    "  const isRoot = url.pathname === rootPath;")


def _read(path):
    with io.open(path, encoding='utf-8') as fh:
        return fh.read()


def _write(path, text):
    with io.open(path, 'w', encoding='utf-8', newline='\n') as fh:
        fh.write(text)


def inject_csp(path, csp, label):
    text = _read(path)
    if 'Content-Security-Policy' in text:
        return  # already adapted (idempotent)
    if VIEWPORT not in text:
        sys.exit('error: viewport meta not found in %s - canonical layout '
                 'changed; update capture-app-adaptations.py' % label)
    _write(path, text.replace(VIEWPORT, VIEWPORT + '\n' + csp, 1))


def fix_sw_scope(path):
    text = _read(path)
    if SW_NEW in text:
        return  # already adapted (idempotent)
    if SW_OLD not in text:
        sys.exit('error: sw.js isRoot line not found - canonical sw.js '
                 'changed; update capture-app-adaptations.py')
    _write(path, text.replace(SW_OLD, SW_NEW, 1))



# (4) capture_debug.js debug overlay (mirror-only tooling). The standalone
# capture_debug.js file is PRESERVED by sync/verify (like README.md), and the
# two integration points are injected here so the mirror stays reproducible
# from canonical + deterministic adaptations (never a silent hand-edit):
#   - index.html: a <script src="./capture_debug.js"> tag, loaded first.
#   - capture_app.js: two RakuDebug hooks (apiBase + state-transition), each a
#     no-op when window.RakuDebug is absent (i.e. on canonical without the file).
DEBUG_I18N_ANCHOR = ('  <!-- i18n runtime. Classic script, loaded BEFORE the '
                     'app module so')
DEBUG_SCRIPT_BLOCK = (
    '  <!-- Debug log overlay. Classic script, loaded FIRST (before i18n.js and the\n'
    '       app module) so its fetch / XHR / EventSource interceptors are installed\n'
    '       before any app code runs \u2014 no network call or state transition is missed.\n'
    '       Installs window.RakuDebug; a persistent DEBUG button (F2) toggles a\n'
    '       dark, scrollable, copyable log panel on every screen of the flow. -->\n'
    '  <script src="./capture_debug.js"></script>\n\n')

APP_APIBASE_ANCHOR = 'const API_BASE = detectApiBase();\n'
APP_APIBASE_HOOK = (
    '// Hand the resolved API base to the debug overlay (capture_debug.js, loaded\n'
    '// first) so it probes GPU-worker availability against the right host.\n'
    'if (window.RakuDebug) window.RakuDebug.apiBase = API_BASE;\n')

APP_STATE_ANCHOR = ('  const enteringIntro = state.phase !== Phase.INTRO && '
                    'phase === Phase.INTRO;\n')
APP_STATE_HOOK = (
    '  // Debug overlay hook (capture_debug.js): record every state-machine\n'
    '  // transition. No-op when the debug logger is not loaded.\n'
    '  if (window.RakuDebug) window.RakuDebug.state(state.phase, phase);\n')


def inject_debug_script(path):
    text = _read(path)
    if 'capture_debug.js' in text:
        return  # already adapted (idempotent)
    if DEBUG_I18N_ANCHOR not in text:
        sys.exit('error: i18n runtime <script> anchor not found in index.html '
                 '- canonical layout changed; update capture-app-adaptations.py')
    _write(path, text.replace(DEBUG_I18N_ANCHOR,
                              DEBUG_SCRIPT_BLOCK + DEBUG_I18N_ANCHOR, 1))


def inject_app_debug_hooks(path):
    text = _read(path)
    if 'window.RakuDebug' in text:
        return  # already adapted (idempotent)
    for anchor, hook, label in (
        (APP_APIBASE_ANCHOR, APP_APIBASE_HOOK, 'API_BASE'),
        (APP_STATE_ANCHOR, APP_STATE_HOOK, 'showPhase'),
    ):
        if anchor not in text:
            sys.exit('error: capture_app.js %s anchor not found - canonical '
                     'changed; update capture-app-adaptations.py' % label)
        text = text.replace(anchor, anchor + hook, 1)
    _write(path, text)


def main():
    if len(sys.argv) != 2:
        sys.exit('usage: capture-app-adaptations.py <capture-app-dir>')
    dest = sys.argv[1].rstrip('/')
    inject_csp(dest + '/index.html', INDEX_CSP, 'index.html')
    inject_csp(dest + '/help.html', HELP_CSP, 'help.html')
    fix_sw_scope(dest + '/sw.js')
    inject_debug_script(dest + '/index.html')
    inject_app_debug_hooks(dest + '/capture_app.js')
    print('Applied hosting adaptations to ' + dest)


if __name__ == '__main__':
    main()
