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



# (4) debug_log.js Copy-export header. Canonical debug_log.js (which replaced
# the retired mirror-only capture_debug.js overlay) copies the bare entry list
# to the clipboard. The hosted operator workflow pastes that export into bug
# reports and expects the "Raku Capture debug log" header (timestamp, UA, URL,
# entry count) the old overlay produced \u2014 prepend it here so the export stays
# self-identifying.
DBGCOPY_OLD = '      const text = formatEntries();\n'
DBGCOPY_NEW = (
    '      // Hosted-mirror adaptation: prepend the self-identifying header\n'
    '      // (timestamp, UA, URL, entry count) the bug-report workflow expects.\n'
    "      const text = 'Raku Capture debug log \\u2014 ' + new Date().toISOString() +\n"
    "        '\\nUA: ' + ((typeof navigator !== 'undefined' && navigator.userAgent) || '') +\n"
    "        '\\nURL: ' + ((typeof location !== 'undefined' && location.href) || '') +\n"
    "        '\\nentries: ' + entries.length +\n"
    "        '\\n' + '-'.repeat(60) + '\\n' +\n"
    "        formatEntries() + '\\n';\n")


def fix_debug_copy_header(path):
    text = _read(path)
    if DBGCOPY_NEW in text:
        return  # already adapted (idempotent)
    if DBGCOPY_OLD not in text:
        sys.exit('error: debug_log.js Copy-handler line not found - canonical '
                 'debug_log.js changed; update capture-app-adaptations.py')
    _write(path, text.replace(DBGCOPY_OLD, DBGCOPY_NEW, 1))


def main():
    if len(sys.argv) != 2:
        sys.exit('usage: capture-app-adaptations.py <capture-app-dir>')
    dest = sys.argv[1].rstrip('/')
    inject_csp(dest + '/index.html', INDEX_CSP, 'index.html')
    inject_csp(dest + '/help.html', HELP_CSP, 'help.html')
    fix_sw_scope(dest + '/sw.js')
    fix_debug_copy_header(dest + '/debug_log.js')
    print('Applied hosting adaptations to ' + dest)


if __name__ == '__main__':
    main()
