#!/usr/bin/env python3
"""Nav-parity guard for the public site's primary "Solutions" mega-menu.

Runs in CI on every push/PR alongside scripts/html_validity_check.py. Scans
every *.html file (root + locale dirs) that carries the primary site nav and
FAILS (exit 1) if any such page is missing one of the canonical Solutions
destinations. Standard library only -- fast, cheap, no browser, no npm.

Rationale: the Solutions mega-menu drifts. The "Raku Capture" Platform item
once went missing from 42 pages and had to be re-added by hand; the same class
of bug -- a stable Platform/Audience link silently vanishing from a subset of
pages -- recurs whenever a page is hand-edited or cloned from a stale template.
The Playwright e2e suite only exercises a curated set of pages and does not
catch this. This guard does, by asserting that every nav-bearing page links to
the full canonical destination set on every commit.

Canonical set (NOT hardcoded blindly): the English root index.html is the
source of truth. We parse its #panel-solutions block and collect every
<a href="...slug.html"> target inside it (smart-glasses, llm-makers,
enterprise, creator, robotics, insurance, compare, capture, spatial-engine,
ai-systems, xr-features). The REQUIRED set is that candidate set minus
ROLLOUT_IN_PROGRESS (below).

Matching is tolerant of localized link TEXT and paths: we detect the primary
nav by the stable id="panel-solutions" marker, then check each required slug by
href TARGET -- href="<anything>slug.html" -- not by visible label text. A
locale page may use a bare relative (smart-glasses.html), parent-relative
(../smart-glasses.html), or root-absolute (/smart-glasses.html) href; all match
on the slug, and localized labels are ignored.

Pages without the #panel-solutions marker are skipped automatically: those are
the standalone surfaces that legitimately carry no primary nav (admin, auth
callbacks, the capture-app PWA shell, the demo room, the engine redirect stub).
See SKIP_NOTE below for the enumerated current set.

ROLLOUT_IN_PROGRESS: three Solutions items -- robotics, insurance, capture --
are mid-rollout across the ~360 nav pages and are NOT yet present on every page
(present on 223 / 223 / 171 when this guard was added). Forcing them onto every
page would be a site-wide content change, not a CI guard's job, and would
collide with the locale-content lanes rolling them out. They are EXCLUDED from
the required set for now. As each reaches 100% coverage, delete it from this set
in a one-line change and the guard starts enforcing it -- locking in parity the
moment the rollout lands.

Usage:
  python3 scripts/nav_parity_check.py [root_dir]
Exit code 0 = all nav pages carry the required destinations; 1 = violations.
"""

from __future__ import annotations

import os
import re
import sys

SKIP_DIRS = {".git", ".github", "node_modules", "tests"}
NAV_MARKER = 'id="panel-solutions"'
# Robust matcher for the marker: tolerates single/double quotes and
# whitespace around "=" so a page is never silently skipped on a quoting quirk.
NAV_MARKER_RE = re.compile(rb'id\s*=\s*["\']panel-solutions["\']', re.IGNORECASE)
PANEL_END_ANCHOR = "panel-developers"
PANEL_FALLBACK_BYTES = 6000
ROOT_INDEX = "index.html"
ROLLOUT_IN_PROGRESS = {"robotics", "insurance", "capture"}
SLUG_HREF_RE = re.compile(rb'href\s*=\s*["\'][^"\']*?([a-z0-9-]+)\.html(?:[?#][^"\']*)?["\']', re.IGNORECASE)

# SKIP_NOTE -- pages with no #panel-solutions marker, skipped by design (the
# skip is automatic via marker-absence; this is a record, not an allow-list):
#   admin/dashboard.html, admin/login.html, admin/setup.html,
#   auth/google/callback.html, auth/google/callback/index.html,
#   capture-app/connect.html, capture-app/help.html, capture-app/index.html,
#   demo/talk-to-a-room/index.html, engine/index.html


def find_html_files(root: str) -> list[str]:
    out = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fn in filenames:
            if fn.endswith(".html"):
                out.append(os.path.join(dirpath, fn))
    return sorted(out)


def extract_panel(data: bytes) -> "bytes | None":
    """Return the bytes of the #panel-solutions block, or None if absent."""
    m = NAV_MARKER_RE.search(data)
    if m is None:
        return None
    i = m.start()
    j = data.find(PANEL_END_ANCHOR.encode(), i)
    if j < 0:
        j = i + PANEL_FALLBACK_BYTES
    return data[i:j]


def slugs_in_panel(panel: bytes) -> set[str]:
    return {m.group(1).decode("ascii", "replace").lower() for m in SLUG_HREF_RE.finditer(panel)}


def derive_required(root: str) -> tuple[set[str], set[str]]:
    path = os.path.join(root, ROOT_INDEX)
    with open(path, "rb") as fh:
        panel = extract_panel(fh.read())
    if panel is None:
        raise SystemExit(
            "nav_parity_check: FATAL -- {!r} has no {}; cannot derive the "
            "canonical nav set.".format(ROOT_INDEX, NAV_MARKER)
        )
    candidate = slugs_in_panel(panel)
    return candidate, candidate - ROLLOUT_IN_PROGRESS


def main(argv: list[str]) -> int:
    root = argv[1] if len(argv) > 1 else "."
    candidate, required = derive_required(root)
    if not required:
        print("nav_parity_check: FATAL -- derived required set is empty.", file=sys.stderr)
        return 1

    nav_pages = 0
    total_violations = 0
    for path in find_html_files(root):
        with open(path, "rb") as fh:
            panel = extract_panel(fh.read())
        if panel is None:
            continue  # no primary nav -- skipped by design
        nav_pages += 1
        missing = sorted(required - slugs_in_panel(panel))
        if missing:
            print("FAIL  {}: Solutions nav missing {}".format(
                os.path.relpath(path, root), ", ".join(missing)))
            total_violations += 1

    req_str = ", ".join(sorted(required))
    skipped = ", ".join(sorted(candidate & ROLLOUT_IN_PROGRESS)) or "(none)"
    if total_violations:
        print(
            "\nnav_parity_check: {} page(s) missing a required Solutions "
            "destination across {} nav page(s).\nRequired set (from {}): {}\n"
            "Rollout-in-progress (not yet enforced): {}".format(
                total_violations, nav_pages, ROOT_INDEX, req_str, skipped),
            file=sys.stderr)
        return 1

    print("nav_parity_check: OK -- {} nav page(s) carry the required Solutions "
          "destinations [{}]. Rollout-in-progress (not yet enforced): {}.".format(
              nav_pages, req_str, skipped))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
