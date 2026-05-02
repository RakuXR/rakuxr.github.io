#!/usr/bin/env python3
"""Insert a 'Blog' nav link after the 'Press' link on every top-level HTML page.

Idempotent: skips files that already contain the link.
Run: python scripts/add_blog_nav.py
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Match a line that contains a Press anchor, capturing leading whitespace so we
# preserve indentation exactly. Tolerates href variants and quote styles.
PRESS_RE = re.compile(
    r'^(?P<indent>[ \t]*)(?P<line><a\s+href=(?:"|\')\.?/?press\.html(?:"|\')[^>]*>\s*Press\s*</a>)\s*$',
    re.IGNORECASE,
)

BLOG_LINK_PATTERNS = [
    re.compile(r'<a\s+href=(?:"|\')/?blog/?(?:"|\')', re.IGNORECASE),
]


def has_blog_link(text: str) -> bool:
    return any(p.search(text) for p in BLOG_LINK_PATTERNS)


def inject(text: str, file_uses_root_relative: bool) -> tuple[str, bool]:
    if has_blog_link(text):
        return text, False
    href = "/blog/" if file_uses_root_relative else "blog/"
    lines = text.splitlines(keepends=True)
    out = []
    inserted = False
    for line in lines:
        out.append(line)
        if inserted:
            continue
        m = PRESS_RE.match(line.rstrip("\r\n"))
        if m:
            indent = m.group("indent")
            newline = "\r\n" if line.endswith("\r\n") else "\n"
            out.append(f'{indent}<a href="{href}">Blog</a>{newline}')
            inserted = True
    return "".join(out), inserted


def main() -> int:
    targets = sorted(p for p in ROOT.glob("*.html"))
    changed = 0
    skipped = 0
    no_nav = 0
    for path in targets:
        text = path.read_text(encoding="utf-8")
        # Detect href style on this page: if the existing nav uses absolute /
        # (e.g., href="/press.html") use that, otherwise use relative blog/.
        absolute = bool(re.search(r'href=(?:"|\')/press\.html', text))
        new_text, did = inject(text, absolute)
        if did:
            path.write_text(new_text, encoding="utf-8")
            changed += 1
            print(f"  + {path.name}")
        elif has_blog_link(text):
            skipped += 1
        else:
            no_nav += 1
            print(f"  ! {path.name} (no Press link found)")
    print(f"\nUpdated {changed}, already-had-blog {skipped}, no-press-link {no_nav}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
