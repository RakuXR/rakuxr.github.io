#!/usr/bin/env sh
# verify-capture-app.sh - fail if the hosted capture-app/ has drifted from the
# canonical raku-runtime source.
#
# How it works: regenerate capture-app/ into a throwaway working tree using the
# exact same logic as scripts/sync-capture-app.sh (rsync verbatim + the
# deterministic hosting adaptations), then diff that against the committed
# capture-app/. Any difference - a hand-edit to the mirror, or an un-synced
# canonical change - is reported and the script exits non-zero.
#
# Run by .github/workflows/verify-capture-app-sync.yml on every push and PR, so
# mirror drift can never land silently: drift == a failed build.
#
# Usage:
#   scripts/verify-capture-app.sh /path/to/raku-runtime   (local checkout)
#   scripts/verify-capture-app.sh                         (auto-clones canonical)
set -eu

REPO_ROOT=$(cd "$(dirname "$0")/.." && pwd)
COMMITTED="$REPO_ROOT/capture-app"
ADAPT="$REPO_ROOT/scripts/capture-app-adaptations.py"

if [ ! -d "$COMMITTED" ]; then
  echo "error: $COMMITTED not found." >&2
  exit 1
fi

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

if ! command -v rsync >/dev/null 2>&1; then
  echo "error: rsync is required." >&2
  [ -n "$CLEANUP_CLONE" ] && rm -rf "$CLEANUP_CLONE"
  exit 1
fi

EXPECTED=$(mktemp -d)
cleanup() {
  rm -rf "$EXPECTED"
  [ -n "$CLEANUP_CLONE" ] && rm -rf "$CLEANUP_CLONE"
}
trap cleanup EXIT INT TERM

# Verbatim canonical copy, minus the two mirror-only files...
rsync -a --delete --exclude README.md --exclude qr-capture-app.svg \
  "$SRC"/ "$EXPECTED"/
# ...carry the committed mirror-only files into the expected tree so the diff
# below ignores them (they are intentionally NOT canonical)...
[ -f "$COMMITTED/README.md" ] && cp "$COMMITTED/README.md" "$EXPECTED/README.md"
[ -f "$COMMITTED/qr-capture-app.svg" ] && cp "$COMMITTED/qr-capture-app.svg" "$EXPECTED/qr-capture-app.svg"
# ...then apply the same deterministic hosting adaptations.
python3 "$ADAPT" "$EXPECTED"

if diff -ru "$EXPECTED" "$COMMITTED" > /tmp/capture-app-drift.diff 2>&1; then
  echo "OK: capture-app/ matches canonical raku-runtime/web/capture/"
  echo "    (verbatim + the declared hosting adaptations)."
  exit 0
fi

echo "============================================================"
echo " MIRROR DRIFT DETECTED"
echo "============================================================"
echo "The committed capture-app/ does not match what regenerating it"
echo "from canonical raku-runtime/web/capture/ produces."
echo ""
echo "Fix it - do NOT hand-edit capture-app/:"
echo "  * canonical changed?   -> run scripts/sync-capture-app.sh and commit"
echo "  * a new hosting tweak? -> add it to scripts/capture-app-adaptations.py"
echo ""
echo "Drift (- expected/canonical, + committed/mirror):"
echo "------------------------------------------------------------"
cat /tmp/capture-app-drift.diff
echo "------------------------------------------------------------"
exit 1
