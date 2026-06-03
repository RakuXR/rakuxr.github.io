#!/usr/bin/env python3
"""Badge-parity guard for the public site's NVIDIA Inception + AWS recognition.

Runs in CI on every push/PR alongside scripts/html_validity_check.py and
scripts/nav_parity_check.py. Scans every *.html file (root + locale dirs +
subtrees) and FAILS (exit 1) if any page violates one of the badge-parity
invariants below. Standard library only -- fast, cheap, no browser, no npm.

Rationale: PR #377 had to normalize a recurring set of badge regressions:
  - a duplicated hero "Member of NVIDIA Inception" pill (two pills stacked in
    the hero of a page), and
  - a footer recognition lockup that drifted out of parity -- a page carrying
    the footer NVIDIA Inception logo WITHOUT the side-by-side "Powered by AWS"
    logo, or two stacked footer-recognition divs left behind by a clone/merge.
The Playwright e2e suite only exercises a curated set of pages and does not
catch this. This guard does, by asserting the badge shape of every page on
every commit.

Checks (per file):

  (1) HERO PILL <= 1. The hero NVIDIA Inception pill is marked by
      `aria-label="Member of NVIDIA Inception`. A page must carry 0 or 1 of
      them -- never >= 2. Two pills is the duplicate-pill regression #377 fixed.

  (2) FOOTER LOCKUP IS UNIFIED. The footer recognition lockup is the
      `class="footer-recognition"` div (wrapped by the `nv-inception:start /
      nv-inception:end` comment markers on the canonical pages). If a page
      contains a footer-recognition div, then:
        (a) there must be exactly ONE such div (two stacked divs is the
            split-lockup regression), and
        (b) the footer recognition region must contain BOTH the NVIDIA logo
            (img/href referencing `nvidia-inception-member`) AND the AWS logo
            (referencing `powered-by-aws`) -- i.e. no page ships a footer
            NVIDIA logo without a side-by-side AWS logo.
      The "footer recognition region" is detected specifically: it is the
      `nv-inception:start..nv-inception:end` marker block when present, else
      the footer-recognition div's own extent. This deliberately does NOT look
      at every NVIDIA/AWS mention on the page, so the standalone AWS Activate
      body sections (see below) cannot satisfy or break the footer check.

  (3) NO ORPHAN MARKERS. The `nv-inception:start` and `nv-inception:end`
      comment markers must be balanced (equal counts) so a half-deleted lockup
      cannot slip through. The standalone `aws-activate:start/end` body
      markers are likewise checked for balance, but are NOT required to be part
      of the footer lockup -- they legitimately stand alone on the press pages.

Tolerated legitimate special cases (NOT false-positived):
  - The press.html pages (root + 8 locales) carry a full STANDALONE AWS
    Activate body section -- extra `powered-by-aws` / `aws-activate` markers
    there are expected and ignored, because the footer check only inspects the
    footer recognition region, not the page body.
  - Root press.html and pricing.html use a card/prose recognition layout
    rather than the footer-recognition lockup; pages with no footer-recognition
    div are simply skipped for the footer check (the hero-pill check still
    applies if a pill is present).
  - Pages with neither a footer-recognition div nor a hero pill are fully
    skipped -- standalone surfaces (admin, auth callbacks, the capture-app PWA
    shell, the demo room) carry no badges by design.

Usage:
  python3 scripts/badge_parity_check.py [root_dir]
Exit code 0 = all pages badge-parity clean; 1 = one or more violations.
"""

from __future__ import annotations

import os
import re
import sys

SKIP_DIRS = {".git", ".github", "node_modules", "tests"}

# (1) Hero pill marker. Tolerant of single/double quote on the attribute.
HERO_PILL_RE = re.compile(rb'aria-label\s*=\s*["\']Member of NVIDIA Inception', re.IGNORECASE)

# (2) Footer lockup. The recognition div class, and the wrapping markers.
FOOTER_DIV_RE = re.compile(rb'class\s*=\s*["\'][^"\']*\bfooter-recognition\b[^"\']*["\']', re.IGNORECASE)
NV_START_RE = re.compile(rb'<!--\s*nv-inception:start\s*-->', re.IGNORECASE)
NV_END_RE = re.compile(rb'<!--\s*nv-inception:end\s*-->', re.IGNORECASE)
NV_BLOCK_RE = re.compile(rb'<!--\s*nv-inception:start\s*-->(.*?)<!--\s*nv-inception:end\s*-->', re.DOTALL | re.IGNORECASE)

# (3) Standalone AWS Activate body markers (balance-only check).
AWS_START_RE = re.compile(rb'<!--\s*aws-activate:start\s*-->', re.IGNORECASE)
AWS_END_RE = re.compile(rb'<!--\s*aws-activate:end\s*-->', re.IGNORECASE)

# The two logo identifiers, matched as substrings of an href/src anywhere in
# the detected footer recognition region.
NVIDIA_LOGO = b'nvidia-inception-member'
AWS_LOGO = b'powered-by-aws'


def find_html_files(root):
    out = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fn in filenames:
            if fn.endswith(".html"):
                out.append(os.path.join(dirpath, fn))
    return sorted(out)


def footer_region(data):
    """Return the bytes of the footer recognition region, or None if the page
    has no footer-recognition lockup.

    Region detection, in priority order:
      1) the nv-inception:start..nv-inception:end marker block (canonical), or
      2) the extent of the single footer-recognition div (from its <div ...>
         open to the matching </div>), as a fallback for any page that carries
         the div without the markers.
    """
    m = NV_BLOCK_RE.search(data)
    if m is not None:
        return m.group(1)
    fm = FOOTER_DIV_RE.search(data)
    if fm is None:
        return None
    start = data.rfind(b"<div", 0, fm.start())
    if start < 0:
        start = fm.start()
    depth = 0
    end = len(data)
    tag = re.compile(rb"</?div\b", re.IGNORECASE)
    for tm in tag.finditer(data, start):
        if data[tm.start():tm.start() + 2].lower() == b"</":
            depth -= 1
            if depth == 0:
                gt = data.find(b">", tm.start())
                end = gt + 1 if gt >= 0 else tm.end()
                break
        else:
            depth += 1
    return data[start:end]


def check_file(path, root, data):
    rel = os.path.relpath(path, root)
    problems = []

    pill_count = len(HERO_PILL_RE.findall(data))
    has_pill = pill_count >= 1
    footer_divs = len(FOOTER_DIV_RE.findall(data))
    nv_s, nv_e = len(NV_START_RE.findall(data)), len(NV_END_RE.findall(data))
    aws_s, aws_e = len(AWS_START_RE.findall(data)), len(AWS_END_RE.findall(data))

    # Fully skip pages with no badge surface AND no badge markers at all --
    # standalone surfaces (admin, auth callbacks, the capture-app PWA shell,
    # the demo room) carry nothing to check. A page that has only orphan
    # markers (a half-deleted lockup: markers left behind, div removed) is NOT
    # skipped, so the marker-balance check below still catches it.
    if not has_pill and footer_divs == 0 and nv_s == 0 and nv_e == 0 \
            and aws_s == 0 and aws_e == 0:
        return problems

    # (1) Hero pill <= 1.
    if pill_count >= 2:
        problems.append(
            "{}: {} hero NVIDIA Inception pills (duplicate-pill regression; "
            "expected 0 or 1)".format(rel, pill_count))

    # (3) Marker balance (runs even with no pill/div, to catch orphan markers).
    if nv_s != nv_e:
        problems.append(
            "{}: unbalanced nv-inception markers (start={}, end={})".format(
                rel, nv_s, nv_e))
    if aws_s != aws_e:
        problems.append(
            "{}: unbalanced aws-activate markers (start={}, end={})".format(
                rel, aws_s, aws_e))

    if footer_divs >= 1:
        if footer_divs >= 2:
            problems.append(
                "{}: {} footer-recognition divs (split-lockup regression; "
                "expected exactly 1)".format(rel, footer_divs))
        region = footer_region(data)
        if region is None:
            problems.append(
                "{}: footer-recognition div present but recognition region "
                "could not be located".format(rel))
        else:
            has_nv = NVIDIA_LOGO in region
            has_aws = AWS_LOGO in region
            if not (has_nv and has_aws):
                missing = []
                if not has_nv:
                    missing.append("NVIDIA Inception logo")
                if not has_aws:
                    missing.append("Powered-by-AWS logo")
                problems.append(
                    "{}: footer recognition region missing {} (the lockup must "
                    "carry both logos side by side)".format(
                        rel, " + ".join(missing)))

    return problems


def main(argv):
    root = argv[1] if len(argv) > 1 else "."
    files = find_html_files(root)
    badge_pages = 0
    all_problems = []
    for path in files:
        with open(path, "rb") as fh:
            data = fh.read()
        if HERO_PILL_RE.search(data) or FOOTER_DIV_RE.search(data):
            badge_pages += 1
        all_problems.extend(check_file(path, root, data))

    if all_problems:
        for p in all_problems:
            print("FAIL  " + p)
        print(
            "\nbadge_parity_check: {} violation(s) across {} badge-bearing "
            "page(s).".format(len(all_problems), badge_pages),
            file=sys.stderr)
        return 1

    print(
        "badge_parity_check: OK -- {} badge-bearing page(s) checked across {} "
        "HTML file(s); hero pill <= 1, footer lockup unified (one "
        "footer-recognition div carrying both NVIDIA + AWS logos), markers "
        "balanced.".format(badge_pages, len(files)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
