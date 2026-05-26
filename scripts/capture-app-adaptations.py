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
# modules load from cdn.jsdelivr.net and the app fetches raku-api.fly.dev.
INDEX_CSP = (
    '  <meta http-equiv="Content-Security-Policy" content="'
    "default-src 'self'; "
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
    "style-src 'self' 'unsafe-inline'; "
    "img-src 'self' data: blob: https://api.qrserver.com; "
    "font-src 'self'; "
    "connect-src 'self' https://raku-api.fly.dev http://localhost:8000 "
    "https://cdn.jsdelivr.net https://cdn.raku.games; "
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


def main():
    if len(sys.argv) != 2:
        sys.exit('usage: capture-app-adaptations.py <capture-app-dir>')
    dest = sys.argv[1].rstrip('/')
    inject_csp(dest + '/index.html', INDEX_CSP, 'index.html')
    inject_csp(dest + '/help.html', HELP_CSP, 'help.html')
    fix_sw_scope(dest + '/sw.js')
    print('Applied hosting adaptations to ' + dest)


if __name__ == '__main__':
    main()
