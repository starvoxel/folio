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
export CAP_OUT="$out" CAP_MODE="$mode" CAP_IPV6_OFF="${CAP_IPV6_OFF:-}"
unshare --net --mount-proc bash -c '
  set -euo pipefail
  ip link set lo up
  if [ -n "${CAP_IPV6_OFF:-}" ]; then sysctl -qw net.ipv6.conf.all.disable_ipv6=1 net.ipv6.conf.default.disable_ipv6=1 || true; fi
  if [ "$CAP_MODE" = sink ]; then
    ip link add d0 type veth peer name d1
    ip addr add 10.99.0.2/24 dev d0
    ip link set d0 up
    ip link set d1 up
    ip neigh add 10.99.0.1 lladdr 02:00:00:00:00:01 dev d0 nud permanent
    ip route add default via 10.99.0.1 dev d0
    # IPv6 sink as well, where the kernel has IPv6 (GitHub runners do; the dev sandbox used for the spike does not).
    if [ -d /proc/sys/net/ipv6 ]; then
      ip -6 addr add fd99::2/64 dev d0 nodad || true
      ip -6 neigh add fd99::1 lladdr 02:00:00:00:00:01 dev d0 nud permanent || true
      ip -6 route add default via fd99::1 dev d0 || true
    fi
  fi
  ip -br addr > "$CAP_OUT/interfaces.txt"; ip route > "$CAP_OUT/routes.txt" || true
  tcpdump -i any -n -tttt -w "$CAP_OUT/capture.pcap" >"$CAP_OUT/tcpdump.log" 2>&1 &
  TCPDUMP=$!
  # Live text dump: interface names in it are correct (reading the pcap from outside the namespace maps interface indexes to the wrong names).
  tcpdump -i any -n -l -tttt >"$CAP_OUT/capture.txt" 2>/dev/null &
  TCPDUMP2=$!
  sleep 1
  set +e
  strace -f -tt -qq -e trace=network -o "$CAP_OUT/strace.log" "$@"
  rc=$?
  set -e
  sleep 1
  kill -INT $TCPDUMP $TCPDUMP2; wait $TCPDUMP $TCPDUMP2 2>/dev/null || true
  exit $rc
' capture-inner "$@"
