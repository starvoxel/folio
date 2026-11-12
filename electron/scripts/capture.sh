#!/usr/bin/env bash
# G1 network capture on Linux. Runs a command in a fresh network namespace and records every packet and
# every network syscall. Needs root (unshare -n), ip, tcpdump, strace, xvfb-run.
#
# usage: capture.sh <mode> <outdir> <command...>
#   mode "noroute": namespace with loopback only. Any non-loopback attempt fails with ENETUNREACH and shows in strace.
#   mode "sink":    loopback plus a veth interface d0 (peer d1) that carries the default route to a fake gateway with a
#                   permanent neighbour entry, so outbound packets (DNS, SYN, QUIC...) are really emitted and tcpdump sees them.
set -euo pipefail
mode=$1; out=$2; shift 2
mkdir -p "$out"
out=$(cd "$out" && pwd)
export CAP_OUT="$out" CAP_MODE="$mode"
unshare --net --mount-proc bash -c '
  set -euo pipefail
  ip link set lo up
  if [ "$CAP_MODE" = sink ]; then
    ip link add d0 type veth peer name d1
    ip addr add 10.99.0.2/24 dev d0
    ip link set d0 up
    ip link set d1 up
    ip neigh add 10.99.0.1 lladdr 02:00:00:00:00:01 dev d0 nud permanent
    ip route add default via 10.99.0.1 dev d0
  fi
  ip -br addr > "$CAP_OUT/interfaces.txt"; ip route > "$CAP_OUT/routes.txt" || true
  tcpdump -i any -n -tttt -w "$CAP_OUT/capture.pcap" >"$CAP_OUT/tcpdump.log" 2>&1 &
  TCPDUMP=$!
  sleep 1
  set +e
  strace -f -tt -qq -e trace=network -o "$CAP_OUT/strace.log" "$@"
  rc=$?
  set -e
  sleep 1
  kill -INT $TCPDUMP; wait $TCPDUMP 2>/dev/null || true
  exit $rc
' capture-inner "$@"
