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
# prototype-facing README that must not overwrite ours. Guard the copy: on a
# first run (or if the README was removed) $DEST/README.md may not exist, and
# an unguarded `cp` would abort the whole script under `set -e`.
TMP_README=""
if [ -f "$DEST/README.md" ]; then
  TMP_README=$(mktemp)
  cp "$DEST/README.md" "$TMP_README"
fi

# Mirror the canonical source into $DEST. rsync --delete removes files that
# were deleted upstream so the hosted copy never accumulates stale assets; a
# plain `cp -R` only ever adds/overwrites. README.md is excluded so the
# hosted-copy README below is never clobbered or deleted by the mirror.
if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete --exclude 'README.md' "$SRC"/ "$DEST"/
else
  echo "warning: rsync not found - falling back to cp (stale files not pruned)" >&2
  cp -R "$SRC"/. "$DEST"/
fi

# Restore the hosted-copy README if we stashed one above.
if [ -n "$TMP_README" ]; then
  cp "$TMP_README" "$DEST/README.md"
  rm -f "$TMP_README"
fi

echo "Synced capture app: $SRC -> $DEST"
echo "Review the diff, then commit."
