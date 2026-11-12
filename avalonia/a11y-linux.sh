#!/usr/bin/env bash
# Dump the AT-SPI tree of the running app in several states. Run under xvfb-run. Usage: a11y-linux.sh <outdir> [app args...]
# Needs: dbus-run-session at-spi2-core python3-gi gir1.2-atspi-2.0 (python3.12 with gi) and the built app + CLI.
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
out="$(realpath -m "$1")"; shift; mkdir -p "$out"
export OUT="$out" HERE="$here" APPARGS="$*"
dbus-run-session -- bash -c '
set -u
/usr/libexec/at-spi-bus-launcher --launch-immediately & sleep 4
export FOLIO_DISCOVERY="$OUT/discovery.json"
C="$HERE/Cli/bin/Release/net10.0/folio-slice-cli"
PY="${ATSPI_PYTHON:-/usr/bin/python3.12}"
"$HERE/run-slice.sh" "$OUT" --size 1440x900 $APPARGS
"$C" wait-ready > /dev/null; sleep 2
dump() { "$PY" "$HERE/tools/atspi_dump.py" --app Avalonia --max-depth 30 --max-children "${3:-12}" ${2:-} > "$OUT/$1.json" 2> "$OUT/$1.err"; }
"$C" navigate Transactions > /dev/null; sleep 2; dump transactions
"$C" invoke "{\"action\":\"select\",\"id\":\"tx-00002\"}" > /dev/null; sleep 1; dump transactions-selected
"$C" invoke '{"action":"scrollEnd"}' > /dev/null; sleep 2; dump transactions-end
"$C" navigate Reporting > /dev/null; sleep 2; dump reporting "" 25
"$C" navigate Settings > /dev/null; sleep 2; dump settings
"$C" invoke "{\"action\":\"openDialog\"}" > /dev/null; sleep 2; dump dialog; dump dialog-focus --focus
"$C" quit > /dev/null
'
