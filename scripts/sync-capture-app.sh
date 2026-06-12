#!/usr/bin/env sh
# sync-capture-app.sh - regenerate the hosted capture app from canonical source.
#
# SINGLE SOURCE OF TRUTH
# ----------------------
# The canonical Raku Capture PWA lives in raku-runtime/web/capture/. The copy
# under capture-app/ in this repo is the GitHub Pages deployment mirror served
# at https://rakuai.com/capture-app/.
#
# capture-app/ is NOT hand-edited. It is GENERATED:
#
#     capture-app/  ==  raku-runtime/web/capture/   (verbatim)
#                       + deterministic hosting adaptations
#                         (scripts/capture-app-adaptations.py)
#                       + two preserved mirror-only files:
#                         README.md, qr-capture-app.svg
#
# Because the adaptations are deterministic, the output is reproducible, and
# .github/workflows/verify-capture-app-sync.yml re-runs this script in CI and
# fails the build if the committed capture-app/ differs from the output. That
# is what makes silent drift impossible: drift == a red build.
#
# Pull canonical changes into the mirror:
#   scripts/sync-capture-app.sh /path/to/raku-runtime   (local checkout)
#   scripts/sync-capture-app.sh                         (auto-clones canonical)
# then review the diff and commit.
set -eu

REPO_ROOT=$(cd "$(dirname "$0")/.." && pwd)
DEST="$REPO_ROOT/capture-app"
ADAPT="$REPO_ROOT/scripts/capture-app-adaptations.py"

# --- locate (or fetch) the canonical source -------------------------------
CLEANUP_CLONE=""
RT="${1:-}"
if [ -z "$RT" ]; then
  RT=$(mktemp -d)
  CLEANUP_CLONE="$RT"
  echo "No raku-runtime path given - shallow-cloning canonical source..."
  GIT_LFS_SKIP_SMUDGE=1 git clone --depth 1 --filter=blob:none \
    https://github.com/RakuXR/raku-runtime.git "$RT" >/dev/null 2>&1
fi

SRC="$RT/web/capture"
if [ ! -d "$SRC" ]; then
  echo "error: $SRC not found - is \$RT a raku-runtime checkout?" >&2
  [ -n "$CLEANUP_CLONE" ] && rm -rf "$CLEANUP_CLONE"
  exit 1
fi

# --- preserve the two mirror-only files -----------------------------------
TMP_README=""
if [ -f "$DEST/README.md" ]; then
  TMP_README=$(mktemp); cp "$DEST/README.md" "$TMP_README"
fi
TMP_QR=""
if [ -f "$DEST/qr-capture-app.svg" ]; then
  TMP_QR=$(mktemp); cp "$DEST/qr-capture-app.svg" "$TMP_QR"
fi

# --- mirror canonical verbatim --------------------------------------------
# rsync --delete prunes files removed upstream so the mirror never keeps stale
# assets. README.md / qr-capture-app.svg are excluded: they are mirror-only.
# (capture_debug.js, the former mirror-only debug overlay, was retired when
# canonical web/capture/ shipped debug_log.js — it is no longer preserved.)
mkdir -p "$DEST"
if ! command -v rsync >/dev/null 2>&1; then
  echo "error: rsync is required (cp cannot prune stale files)." >&2
  [ -n "$CLEANUP_CLONE" ] && rm -rf "$CLEANUP_CLONE"
  exit 1
fi
rsync -a --delete --exclude README.md --exclude qr-capture-app.svg \
  "$SRC"/ "$DEST"/

# --- restore the mirror-only files ----------------------------------------
if [ -n "$TMP_README" ]; then cp "$TMP_README" "$DEST/README.md"; rm -f "$TMP_README"; fi
if [ -n "$TMP_QR" ]; then cp "$TMP_QR" "$DEST/qr-capture-app.svg"; rm -f "$TMP_QR"; fi

# --- apply the deterministic hosting adaptations --------------------------
python3 "$ADAPT" "$DEST"

[ -n "$CLEANUP_CLONE" ] && rm -rf "$CLEANUP_CLONE"

echo "Synced + adapted capture app: $SRC -> $DEST"
echo "Review the diff, then commit."
