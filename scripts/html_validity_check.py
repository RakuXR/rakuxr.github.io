#!/usr/bin/env python3
"""Lightweight HTML structural-validity guard for the public site.

Runs in CI on every push/PR. Scans every *.html file (root + locale dirs) and
FAILS (exit 1) if any file violates one of the structural invariants below.
Zero external dependencies — standard library only — so it is fast and cheap.

Rationale: silent mid-file truncations once dropped the closing
`</body></html>` plus the trailing nav <script> tags on a handful of pages
(llm-makers / robotics / smart-glasses). The Playwright e2e suite, which only
exercises a curated set of pages, did not catch them. This guard does, by
checking the structural shape of every page on every commit.

Checks (per file):
  (a) The file ends with `</body></html>` (case-insensitive, trailing
      whitespace/newlines allowed, and arbitrary whitespace permitted between
      the two closing tags).
  (b) Every `<footer` open tag has a matching `</footer>` close tag (counts
      must be equal).
  (c) The `<!--` and `-->` HTML comment markers are balanced (equal counts).
  (d) No relative `src="js/..."` script reference: a script src that points
      into js/ must be root-absolute (`/js/...`) on root pages or relative
      (`../js/...`, `../../js/...`) on locale pages — i.e. a bare `js/` with
      no leading `/` or `../` is forbidden. Both single- and double-quoted
      attributes are checked.

Usage:
  python3 scripts/html_validity_check.py [root_dir]
Exit code 0 = all clean; 1 = one or more violations (details printed).
"""

from __future__ import annotations

import os
import re
import sys

# Directories that are not part of the published page set / should be skipped.
SKIP_DIRS = {".git", ".github", "node_modules", "tests"}

# (a) Must end with </body></html>, optional whitespace between/around, EOF ws ok.
END_RE = re.compile(rb"</body>\s*</html>\s*$", re.IGNORECASE)

# (d) Bare relative src="js/..." or src='js/...' (no leading / or ../).
# We match src= then a quote then "js/" directly. ../js and /js are fine
# because they start with '.' or '/', not 'j'.
BARE_JS_RE = re.compile(rb"""src\s*=\s*["']js/""", re.IGNORECASE)

OPEN_FOOTER_RE = re.compile(rb"<footer\b", re.IGNORECASE)
CLOSE_FOOTER_RE = re.compile(rb"</footer\s*>", re.IGNORECASE)


def find_html_files(root: str) -> list[str]:
    out: list[str] = []
    for dirpath, dirnames, filenames in os.walk(root):
        # Prune skip dirs in-place so os.walk does not descend into them.
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fn in filenames:
            if fn.endswith(".html"):
                out.append(os.path.join(dirpath, fn))
    return sorted(out)


def check_file(path: str) -> list[str]:
    """Return a list of human-readable violation strings for one file."""
    violations: list[str] = []
    with open(path, "rb") as fh:
        data = fh.read()

    # (a) closing tags at EOF
    if not END_RE.search(data):
        violations.append("does not end with </body></html>")

    # (b) balanced <footer> / </footer>
    n_open = len(OPEN_FOOTER_RE.findall(data))
    n_close = len(CLOSE_FOOTER_RE.findall(data))
    if n_open != n_close:
        violations.append(
            f"unbalanced footer tags: {n_open} <footer> vs {n_close} </footer>"
        )

    # (c) balanced comment markers
    n_open_c = data.count(b"<!--")
    n_close_c = data.count(b"-->")
    if n_open_c != n_close_c:
        violations.append(
            f"unbalanced comment markers: {n_open_c} '<!--' vs {n_close_c} '-->'"
        )

    # (d) bare relative js/ src
    if BARE_JS_RE.search(data):
        violations.append(
            'relative script src="js/..." found '
            "(must be /js/... on root pages or ../js/... on locale pages)"
        )

    return violations


def main(argv: list[str]) -> int:
    root = argv[1] if len(argv) > 1 else "."
    files = find_html_files(root)
    if not files:
        print(f"html_validity_check: no .html files found under {root!r}", file=sys.stderr)
        return 1

    total_violations = 0
    for path in files:
        rel = os.path.relpath(path, root)
        for v in check_file(path):
            print(f"FAIL  {rel}: {v}")
            total_violations += 1

    if total_violations:
        print(
            f"\nhtml_validity_check: {total_violations} violation(s) "
            f"across {len(files)} HTML file(s).",
            file=sys.stderr,
        )
        return 1

    print(f"html_validity_check: OK — {len(files)} HTML file(s) clean.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
