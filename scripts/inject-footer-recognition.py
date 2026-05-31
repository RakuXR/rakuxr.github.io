#!/usr/bin/env python3
"""Inject the NVIDIA Inception Member recognition badge into the existing
<footer> on every HTML page that has one.

Why this exists: rakuai.com has 33 distinct footer variants across locale
subdirs and the dev portal (it grew organically before we had a shared
include). We want the NVIDIA Inception badge to appear at the bottom of
every page on the site so visitors carry the recognition with them
regardless of which surface they landed on, but we can't safely flatten
all 33 variants in a single change without risking locale-specific link
text getting clobbered.

Strategy: instead of replacing the footer, we INSERT a tiny new block
right before </footer> on every page that:
  - has a <footer> tag
  - hasn't already had the block injected (idempotent)

Marker comments wrap the block so re-runs are safe:
  <!-- nv-inception:start -->...<!-- nv-inception:end -->

Run from the repo root:
    python3 scripts/inject-footer-recognition.py            # dry-run
    python3 scripts/inject-footer-recognition.py --write    # actually edit
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Repo-relative directories to skip - these don't carry the main marketing footer
SKIP_DIRS = {'.git', 'node_modules', 'capture-app', '_blog'}

# Marker comments so re-runs are no-ops
START_MARKER = '<!-- nv-inception:start -->'
END_MARKER = '<!-- nv-inception:end -->'

# Locale-aware copy. EN is the default; locale dirs get the localized line.
# The badge img path is computed per file based on directory depth (so
# /press.html uses branding/..., /ja/press.html uses ../branding/..., etc.)
LOCALE_COPY = {
    'en':     'NVIDIA Inception Member',
    'ja':     'NVIDIA Inception メンバー',
    'es':     'Miembro de NVIDIA Inception',
    'fr':     'Membre de NVIDIA Inception',
    'de':     'NVIDIA Inception Mitglied',
    'ko':     'NVIDIA Inception 회원',
    'pt-BR':  'Membro do NVIDIA Inception',
    'zh-CN':  'NVIDIA Inception 成员',
    'zh-TW':  'NVIDIA Inception 成員',
}


def detect_locale(rel_path: str) -> str:
    """Pick the locale from the first path segment, or 'en' if no locale dir."""
    parts = rel_path.split(os.sep)
    if parts and parts[0] in LOCALE_COPY and parts[0] != 'en':
        return parts[0]
    return 'en'


def badge_src(rel_path: str) -> str:
    """Compute relative path to branding/nvidia-inception-member.svg from this file."""
    depth = rel_path.count(os.sep)
    return ('../' * depth) + 'branding/nvidia-inception-member.svg'


def press_href(rel_path: str) -> str:
    """Link to the press page from this file. Locale-aware: ja/index.html
    links to press.html (same-dir if ja/press.html exists) or ../press.html
    if it doesn't. Conservative default: go to root press.html."""
    depth = rel_path.count(os.sep)
    return ('../' * depth) + 'press.html#nvidia-inception'


def make_block(rel_path: str) -> str:
    locale = detect_locale(rel_path)
    label = LOCALE_COPY.get(locale, LOCALE_COPY['en'])
    src = badge_src(rel_path)
    href = press_href(rel_path)
    return (
        f'{START_MARKER}\n'
        f'        <div class="footer-recognition" style="display:flex; align-items:center; justify-content:center; gap:14px; margin: 20px 0 8px; opacity: 0.9;">\n'
        f'            <a href="{href}" aria-label="{label} - read more on the press page" style="line-height: 0;">\n'
        f'                <img src="{src}" alt="{label}" width="160" height="40" style="height: 40px; width: auto; display: block;">\n'
        f'            </a>\n'
        f'        </div>\n'
        f'        {END_MARKER}'
    )


def process_file(path: str, rel_path: str, write: bool) -> str | None:
    """Returns a status string if the file was changed (or would be), None otherwise."""
    try:
        with open(path, encoding='utf-8') as f:
            src = f.read()
    except UnicodeDecodeError:
        return None
    if '<footer' not in src:
        return None
    if START_MARKER in src:
        return None  # already injected
    block = make_block(rel_path)
    # Insert right before </footer>. There can be multiple, but we only touch the first.
    new = re.sub(r'(\s*)</footer>', '\n        ' + block + r'\1</footer>', src, count=1)
    if new == src:
        return None
    if write:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new)
    return rel_path


def main():
    write = '--write' in sys.argv
    changed = []
    skipped = 0
    for root, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for fn in files:
            if not fn.endswith('.html'):
                continue
            path = os.path.join(root, fn)
            rel = os.path.relpath(path, ROOT)
            result = process_file(path, rel, write)
            if result:
                changed.append(result)
            else:
                skipped += 1
    verb = 'changed' if write else 'would change'
    print(f'{verb}: {len(changed)} files; skipped (no footer, already injected, or unreadable): {skipped}')
    if not write:
        print('Dry-run. Re-run with --write to apply.')
    if changed[:10]:
        print('First 10:')
        for p in changed[:10]:
            print(f'  {p}')


if __name__ == '__main__':
    main()
