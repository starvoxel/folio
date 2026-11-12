#!/usr/bin/env bash
# G1 privacy capture on Linux (run as root, needs strace tcpdump iproute2 xvfb). Usage: g1-privacy.sh <outdir> [idle-seconds]
#  A. whole slice scenario in a network namespace that has only loopback (no route anywhere else)
#  B. same scenario plus an idle period in the normal namespace, with strace logging every network syscall of the
#     app process tree and tcpdump on all interfaces
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
out="$(realpath -m "$1")"; idle="${2:-300}"; mkdir -p "$out"
C="$here/Cli/bin/Release/net10.0/folio-slice-cli"; APP="$here/Slice/bin/Release/net10.0/FolioSlice"
DATA="$here/../fixtures"
cat > "$out/strace-app.sh" <<EOS
#!/usr/bin/env bash
exec strace -f -qq -e trace=network -o "\${G1_STRACE_OUT:?}" "$APP" "\$@"
EOS
chmod +x "$out/strace-app.sh"

echo "== A: loopback-only network namespace"
G1_STRACE_OUT="$out/strace-netns.log" unshare -n bash -c "ip link set lo up; ip -o addr show; ip route; ip route get 1.1.1.1 2>&1 | head -1; xvfb-run -a -s '-screen 0 1440x900x24' '$C' selftest '$out/strace-app.sh' '$DATA' '$out/netns-selftest' --oskeys" > "$out/netns.txt" 2>&1
tail -3 "$out/netns.txt"

echo "== B: normal namespace, idle ${idle}s, tcpdump + strace"
tcpdump -i any -n -w "$out/idle.pcap" > "$out/tcpdump.log" 2>&1 &
TD=$!; sleep 2
G1_STRACE_OUT="$out/strace-idle.log" xvfb-run -a -s '-screen 0 1440x900x24' "$C" selftest "$out/strace-app.sh" "$DATA" "$out/idle-selftest" --oskeys --idle "$idle" > "$out/idle.txt" 2>&1
sleep 2; kill $TD; wait $TD 2>/dev/null
tail -3 "$out/idle.txt"

echo "== analysis"
{
  for f in strace-netns.log strace-idle.log; do
    echo "--- $f: $(wc -l < "$out/$f") network syscalls"
    echo "address families used by connect/sendto/bind:"; grep -oE 'sa_family=AF_[A-Z0-9]+' "$out/$f" | sort | uniq -c
    echo "connect/sendto/sendmsg to an AF_INET/AF_INET6 address that is not loopback:"
    grep -E 'connect\(|sendto\(|sendmsg\(' "$out/$f" | grep -E 'AF_INET6?' | grep -vE 'sin_addr=inet_addr\("127\.|sin6_addr=.*"::1"|sin6_addr=.*"::"' || echo "  none"
  done
  echo "--- tcpdump (all interfaces, whole capture incl. this machine's other traffic):"
  tcpdump -n -r "$out/idle.pcap" 2>/dev/null | wc -l
  echo "non-loopback packets:"; tcpdump -n -r "$out/idle.pcap" 'not (host 127.0.0.1 or host ::1)' 2>/dev/null | head -20
} > "$out/analysis.txt" 2>&1
cat "$out/analysis.txt"
