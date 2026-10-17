#!/usr/bin/env bash
# Run one headless Blender under an exclusive machine-wide lock (8 GB RAM: never two renders at once).
#   scripts/films/rack/blender-lock.sh [blender args…]   e.g. … -b scene.blend --python scene.py -- render …
# Waits (up to LOCK_WAIT seconds, default 1800) for other holders; always releases the lock, even on failure.
set -uo pipefail
BLENDER=${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}
LOCK=${BLENDER_LOCK:-/tmp/soltani-rack-blender.lock}
waited=0
while ! mkdir "$LOCK" 2>/dev/null; do
  if [[ -f $LOCK/pid ]] && ! kill -0 "$(cat "$LOCK/pid")" 2>/dev/null; then rm -rf "$LOCK"; continue; fi   # stale holder
  sleep 2; waited=$((waited + 2))
  if (( waited >= ${LOCK_WAIT:-1800} )); then echo "blender-lock: gave up after ${waited}s waiting for $LOCK" >&2; exit 75; fi
done
echo $$ > "$LOCK/pid"
trap 'rm -rf "$LOCK"' EXIT
caffeinate -i "$BLENDER" --factory-startup "$@"
