#!/bin/bash
# F2: best-effort network observation of the app on macOS. The hosted runner has its own background traffic, so we attribute by process.
# usage: mac-net.sh <app executable> <outdir>      (needs sudo for tcpdump/nettop/lsof)
set +e
EXE=$(realpath "$1"); OUT=$2; mkdir -p "$OUT"; OUT=$(cd "$OUT" && pwd)
ROOT=$(cd "$(dirname "$0")/.." && pwd)
sudo tcpdump -i any -n -w "$OUT/capture.pcap" >"$OUT/tcpdump.log" 2>&1 &
TD=$!
sleep 2
# sample which processes hold sockets, every 5 s, for the whole run
( while true; do date +%T; sudo lsof -nP -i 2>/dev/null | grep -iE "Folio|COMMAND" ; sleep 5; done ) >"$OUT/lsof-samples.txt" 2>&1 &
LS=$!
( while true; do date +%T; sudo nettop -P -L 1 -n -x 2>/dev/null | grep -iE "Folio|bytes_in" ; sleep 30; done ) >"$OUT/nettop-samples.txt" 2>&1 &
NT=$!
CAPTURE_IDLE_S=300 node "$ROOT/scripts/idle-capture.mjs" "$EXE" "$ROOT/../fixtures" 2>&1 | tee "$OUT/driver-timeline.log"
sleep 2
kill $LS $NT 2>/dev/null; sudo kill -INT $TD 2>/dev/null; sleep 2
sudo chmod a+r "$OUT"/* 2>/dev/null
echo "--- packets by remote address (excluding loopback), whole capture, NOT attributed to a process:"
tcpdump -nr "$OUT/capture.pcap" 2>/dev/null | grep -v "127.0.0.1\|::1" | awk '{for(i=1;i<=NF;i++) if ($i==">") {print $(i+1)}}' | sed -E 's/\.[0-9]+:?$//' | sort | uniq -c | sort -rn | head -20 | tee "$OUT/remote-addresses.txt"
echo "--- app sockets seen by lsof (non-loopback):"
grep -iE "Folio" "$OUT/lsof-samples.txt" | grep -v "127.0.0.1\|\[::1\]\|->127\." | sort | uniq -c | head -20 | tee "$OUT/app-nonloopback-sockets.txt"
echo "(empty above = no non-loopback socket from the app seen at 5 s sampling)"
true
