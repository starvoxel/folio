#!/usr/bin/env bash
# F2/A5-style best-effort network observation on macOS: tcpdump on all interfaces plus lsof sampling attributed to the app's PID.
# Usage: mac-netwatch.sh <outdir> <seconds>   (needs sudo for tcpdump)
out="$1"; secs="${2:-480}"; mkdir -p "$out"
sudo tcpdump -i any -n -w "$out/idle.pcap" > "$out/tcpdump.log" 2>&1 &
TD=$!
end=$(( $(date +%s) + secs )); : > "$out/lsof-app.txt"; : > "$out/lsof-all-nonloopback.txt"
while [ "$(date +%s)" -lt "$end" ]; do
  pid=$(pgrep -x FolioSlice | head -1)
  if [ -n "$pid" ]; then echo "# $(date +%T) pid=$pid" >> "$out/lsof-app.txt"; sudo lsof -nP -i -a -p "$pid" >> "$out/lsof-app.txt" 2>&1; fi
  sudo lsof -nP -iTCP -iUDP 2>/dev/null | grep -vE '127\.0\.0\.1|\[::1\]|LISTEN|\*:' | awk 'NR>1 {print $1, $9}' | sort -u >> "$out/lsof-all-nonloopback.txt"
  sleep 1
done
sudo kill $TD 2>/dev/null; sleep 1
sort -u "$out/lsof-all-nonloopback.txt" -o "$out/lsof-all-nonloopback.txt"
{ echo "packets total: $(sudo tcpdump -n -r "$out/idle.pcap" 2>/dev/null | wc -l)"; echo "non-loopback remote endpoints (tcpdump, all processes):"; sudo tcpdump -n -r "$out/idle.pcap" 'not (host 127.0.0.1 or host ::1)' 2>/dev/null | grep -oE '> [0-9a-f:.]+\.[0-9]+:' | sort | uniq -c | sort -rn | head -20; } > "$out/summary.txt" 2>&1
sudo chown -R "$(id -u)" "$out" 2>/dev/null
