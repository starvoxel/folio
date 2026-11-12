#!/bin/bash
# G1 on macOS: tcpdump for the whole run plus lsof sampling of sockets owned by the app and by the WebKit helper processes
# (WKWebView helpers are not children of the app, so they are matched by name). usage: mac-net-tauri.sh <outdir>   (needs sudo)
set +e
OUT=$1; mkdir -p "$OUT"; OUT=$(cd "$OUT" && pwd)
ROOT=$(cd "$(dirname "$0")/.." && pwd)
sudo tcpdump -i any -n -w "$OUT/capture.pcap" >"$OUT/tcpdump.log" 2>&1 &
TD=$!
sleep 2
( while true; do date +%T; sudo lsof -nP -i 2>/dev/null | grep -E "^(COMMAND|folio|com\.apple\.W|WebKit|Safari)" ; sleep 3; done ) >"$OUT/lsof-samples.txt" 2>&1 &
LS=$!
( cd "$ROOT/e2e" && CAPTURE_IDLE_S=${CAPTURE_IDLE_S:-300} FOLIO_SPEC=./specs/capture.e2e.ts npx wdio run wdio.conf.ts 2>&1 | grep -E "LAUNCHED|PAGE|USED|IDLE|passing|failing" ) | tee "$OUT/driver-timeline.log"
sleep 2
kill $LS 2>/dev/null; sudo kill -INT $TD 2>/dev/null; sleep 2
sudo chmod a+r "$OUT"/* 2>/dev/null
tcpdump -nr "$OUT/capture.pcap" 2>/dev/null | wc -l | sed 's/^/total packets in capture (whole machine): /' | tee "$OUT/summary.txt"
echo "--- non-loopback sockets held by folio or WebKit helpers (lsof, every 3 s):" | tee -a "$OUT/summary.txt"
grep -E "^(folio|com\.apple\.W|WebKit)" "$OUT/lsof-samples.txt" | grep -v "127.0.0.1\|\[::1\]\|->127\.\|->\[::1\]" | awk '{print $1, $5, $8, $9, $10}' | sort | uniq -c | sort -rn | head -30 | tee -a "$OUT/summary.txt"
echo "(no rows above = no non-loopback socket from the app or its WebKit helpers seen at 3 s sampling)" | tee -a "$OUT/summary.txt"
true
