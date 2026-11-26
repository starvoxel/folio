#!/usr/bin/env bash
# Runs the privacy capture scenario (tests/e2e/privacy-capture.e2e.ts) in an isolated Linux
# network namespace, as root (AD-18). Inside it the only route leads to a sink interface that has
# no peer, so any attempt to reach the outside is emitted where tcpdump can see it, and every
# DNS lookup goes to a resolver address that never answers. Needs: ip, strace, tcpdump, xvfb-run.
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "run-linux.sh must run as root (namespaces, strace and tcpdump need it)" >&2
  exit 2
fi

namespace="folio-capture"
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

cleanup() {
  ip netns delete "$namespace" 2>/dev/null || true
  rm -rf "/etc/netns/$namespace"
}
trap cleanup EXIT
cleanup

ip netns add "$namespace"
mkdir -p "/etc/netns/$namespace"
echo "nameserver 10.99.0.2" > "/etc/netns/$namespace/resolv.conf"

in_ns() { ip netns exec "$namespace" "$@"; }

in_ns ip link set lo up
# A veth pair whose far end just drops frames; a dummy interface is not built into every kernel.
in_ns ip link add sink0 type veth peer name sink1
in_ns ip link set sink1 up
in_ns ip addr add 10.99.0.1/24 dev sink0
in_ns ip link set sink0 up
# A permanent neighbour entry lets the kernel send frames to the absent gateway instead of
# waiting for an ARP reply, so a connection attempt is emitted and visible.
in_ns ip neigh add 10.99.0.2 lladdr 02:00:00:00:00:02 dev sink0 nud permanent
in_ns ip route add default via 10.99.0.2 dev sink0

cd "$root"
in_ns xvfb-run --auto-servernum -- npm run test:capture
