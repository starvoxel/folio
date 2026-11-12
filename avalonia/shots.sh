#!/usr/bin/env bash
# Take screenshots of the main pages. Usage: shots.sh <outdir> <theme light|dark>   (run under xvfb-run on Linux)
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
out="$1"; theme="$2"; mkdir -p "$out"
export FOLIO_DISCOVERY="$out/discovery.json"
C="$here/Cli/bin/Release/net10.0/folio-slice-cli"
"$here/run-slice.sh" "$out" --theme "$theme" --size 1440x960
"$C" wait-ready >/dev/null
for p in Overview Transactions Reporting Settings; do "$C" navigate "$p" >/dev/null; "$C" screenshot "$out/$p-$theme.png"; done
"$C" quit >/dev/null
