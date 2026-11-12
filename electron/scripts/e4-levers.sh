#!/bin/bash
# E4: memory levers, separate from the baseline. Same PSS method and scenario points (P1, P3, P4), one variant per run.
# usage: e4-levers.sh <test exe> <outdir>   (Linux, under xvfb)
EXE=$1; OUT=$2; mkdir -p "$OUT"
run() { n=$1; shift; echo "### $n: $*"; xvfb-run -a -s "-screen 0 1440x900x24" node "$(dirname "$0")/mem-points.mjs" "$EXE" "$OUT/$n.json" --label "$n" --points P1,P3,P4 --args "$*" 2>&1 | grep -E "^P[0-9]"; }
run baseline ""
run disable-gpu "--disable-gpu"
run in-process-gpu "--in-process-gpu"
run network-in-process "--enable-features=NetworkServiceInProcess2"
run v8-heap-96mb "--js-flags=--max-old-space-size=96"
run no-zygote "--no-zygote"
run lean-combo "--disable-gpu --enable-features=NetworkServiceInProcess2 --no-zygote"
run lean-combo-v8 "--disable-gpu --enable-features=NetworkServiceInProcess2 --no-zygote --js-flags=--max-old-space-size=96"
