#!/usr/bin/env bash
# macOS accessibility hierarchy dumps of the running app via tools/ax-dump.swift. Usage: a11y-mac.sh <outdir> [app args...]
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"; mkdir -p "$1"; out="$(cd "$1" && pwd)"; shift; mkdir -p "$out"
export FOLIO_DISCOVERY="$out/discovery.json"; C="$here/Cli/bin/Release/net10.0/folio-slice-cli"
swiftc -O "$here/tools/ax-dump.swift" -o "$out/ax-dump" 2> "$out/swiftc.txt" || { echo "swiftc failed"; cat "$out/swiftc.txt"; exit 1; }
"$here/run-slice.sh" "$out" --size 1440x900 "$@"; "$C" wait-ready > /dev/null; sleep 3
pid=$(cat "$out/app.pid")
dump() { "$out/ax-dump" "$pid" 30 12 > "$out/$1.txt" 2>&1; }
"$C" navigate Transactions > /dev/null; sleep 2; dump transactions
"$C" invoke '{"action":"select","id":"tx-00002"}' > /dev/null; sleep 1; dump transactions-selected
"$C" navigate Reporting > /dev/null; sleep 2; dump reporting
"$C" navigate Settings > /dev/null; sleep 2; dump settings
"$C" invoke '{"action":"openDialog"}' > /dev/null; sleep 2; dump dialog
"$C" quit > /dev/null
