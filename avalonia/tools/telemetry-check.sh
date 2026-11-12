#!/usr/bin/env bash
# A2: observe what a clean build does on the network, with and without AVALONIA_TELEMETRY_OPTOUT, inside a network
# namespace that has only loopback (so nothing leaves the machine; attempts are still visible to strace).
# Usage (as root, from avalonia/): tools/telemetry-check.sh <outdir>
set -uo pipefail
out="$(realpath -m "$1")"; mkdir -p "$out"
bs="${XDG_DATA_HOME:-$HOME/.local/share}/AvaloniaUI/BuildServices"
for mode in default optout exclude override; do
  dotnet build-server shutdown > /dev/null 2>&1; pkill -f Collector.dll 2>/dev/null
  rm -rf Slice/obj Slice/bin "$bs"
  extra=""; [ "$mode" = optout ] && extra="AVALONIA_TELEMETRY_OPTOUT=1"
  props=""; [ "$mode" = exclude ] && props="-p:TelemetryVariant=exclude"; [ "$mode" = override ] && props="-p:TelemetryVariant=override"
  dotnet restore Slice $props > /dev/null   # restore needs the network, so it runs before entering the namespace
  unshare -n bash -c "
    ip link set lo up
    unset HTTPS_PROXY HTTP_PROXY https_proxy http_proxy ALL_PROXY AVALONIA_TELEMETRY_OPTOUT
    export DOTNET_CLI_USE_MSBUILD_SERVER=0 MSBUILDDISABLENODEREUSE=1 $extra
    strace -f -qq -s 400 -e trace=execve,connect,sendto,sendmsg -o '$out/strace-$mode.log' dotnet build Slice -c Release --no-restore -nodeReuse:false -p:UseSharedCompilation=false $props > '$out/build-$mode.txt' 2>&1
    sleep 35   # the collector process lives up to 30 s after the build
  "
  echo "== $mode: files left in $bs:"; ls -la "$bs" 2>&1 | tee "$out/files-$mode.txt"
  echo "-- collector started? $(grep -c 'Avalonia.BuildServices.Collector.dll' "$out/strace-$mode.log") execve(s)"
  echo "-- non-local connects / DNS:"; grep -E 'connect\(' "$out/strace-$mode.log" | grep -E 'AF_INET' | grep -v '127.0.0.1' | head
  grep -aoE 'av-build-tel[a-z0-9.-]*|avaloniaui\.net' "$out/strace-$mode.log" | sort | uniq -c
  grep -c 'Avalonia Accelerate' "$out/build-$mode.txt" | sed 's/^/-- accelerate messages in build output: /'
  grep -c 'AvaloniaStats' "$out/build-$mode.txt" | sed 's/^/-- AvaloniaStats mentions in build log: /'
done
# leave the tree restored normally
dotnet restore Slice > /dev/null
