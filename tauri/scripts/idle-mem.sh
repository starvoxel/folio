#!/bin/bash
# Launch a binary under Xvfb with no driver, wait, and measure app-only vs all processes (Linux). usage: idle-mem.sh <bin> [seconds] [ENV=VAL ...]
BIN=$1; SECS=${2:-8}; shift 2
HERE="$(cd "$(dirname "$0")" && pwd)"
FOLIO_DATA_DIR="$HERE/../../fixtures" xvfb-run -a -s "-screen 0 1440x900x24" env "$@" bash -c "
$BIN >/dev/null 2>&1 & 
sleep $SECS; node $HERE/memtree.mjs measure \$(pgrep -x $(basename $BIN) | head -1); kill %1"
