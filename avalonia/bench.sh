#!/usr/bin/env bash
# G2 benchmark: launches the app, records idle memory, scrolls the whole grid twice, sorts every column both ways.
# Usage: bench.sh <outdir>   (under xvfb-run on Linux)
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
out="$1"; mkdir -p "$out"
export FOLIO_DISCOVERY="$out/discovery.json"
C="$here/Cli/bin/Release/net10.0/folio-slice-cli"
start=$(date +%s%N)
"$here/run-slice.sh" "$out" "${@:2}"
"$C" wait-ready > "$out/ready.json"
echo "cold start wall ms: $(( ($(date +%s%N) - start) / 1000000 ))" | tee "$out/coldstart.txt"
sleep 3
"$C" status > "$out/status-idle.json"
"$C" navigate Transactions > /dev/null
sleep 2
"$C" status > "$out/status-before-scroll.json"
"$C" bench-scroll > "$out/scroll1.json"
"$C" status > "$out/status-after-scroll1.json"
"$C" bench-scroll > "$out/scroll2.json"
"$C" status > "$out/status-after-scroll2.json"
: > "$out/sorts.jsonl"
for col in Date Description Account Category Amount; do
  for dir in asc desc; do "$C" bench-sort "$col" "$dir" | tr -d '\n ' >> "$out/sorts.jsonl"; echo >> "$out/sorts.jsonl"; done
done
"$C" screenshot "$out/after-bench.png" > /dev/null
"$C" quit > /dev/null
