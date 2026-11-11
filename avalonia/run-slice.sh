#!/usr/bin/env bash
# Helper: start the app detached with its output in a file. Usage: run-slice.sh <outdir> [app args...]
# Env: SLICE_BIN (default avalonia/Slice/bin/Release/net10.0/FolioSlice), FOLIO_DATA (default fixtures)
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
out="$1"; shift; mkdir -p "$out"
bin="${SLICE_BIN:-$here/Slice/bin/Release/net10.0/FolioSlice}"
data="${FOLIO_DATA:-$here/../fixtures}"
rm -f "$out/discovery.json"
nohup "$bin" --data "$data" --automation --discovery "$out/discovery.json" "$@" > "$out/app.log" 2>&1 < /dev/null &
echo $! > "$out/app.pid"
