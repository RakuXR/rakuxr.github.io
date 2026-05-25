#!/usr/bin/env sh
# sync-capture-app.sh - re-sync the hosted capture app from its canonical source.
#
# Canonical Raku Capture PWA lives in raku-runtime/web/capture/. The copy
# under capture-app/ in this repo is a GitHub Pages deployment mirror served
# at https://rakuai.com/capture-app/. This script refreshes that mirror.
#
# Usage (from the repo root):
#   scripts/sync-capture-app.sh /path/to/raku-runtime
set -eu

RT="${1:-}"
if [ -z "$RT" ]; then
  echo "usage: scripts/sync-capture-app.sh /path/to/raku-runtime" >&2
  exit 1
fi

SRC="$RT/web/capture"
if [ ! -d "$SRC" ]; then
  echo "error: $SRC not found - is \$RT a raku-runtime checkout?" >&2
  exit 1
fi

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
DEST="$SCRIPT_DIR/../capture-app"
mkdir -p "$DEST"

# Preserve the hosted-copy README - the canonical source has its own
# prototype-facing README that must not overwrite ours.
TMP_README=$(mktemp)
cp "$DEST/README.md" "$TMP_README"

cp -R "$SRC"/. "$DEST"/

cp "$TMP_README" "$DEST/README.md"
rm -f "$TMP_README"

echo "Synced capture app: $SRC -> $DEST"
echo "Review the diff, then commit."
