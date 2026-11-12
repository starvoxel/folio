#!/bin/bash
# usage: sbx-check.sh <label> <command...>   Launches the app under Xvfb and reports whether Chromium's sandbox is active.
# Sandboxed renderer = "Seccomp: 2" in /proc/<pid>/status. An app that cannot start its sandbox exits with a FATAL log line.
label=$1; shift
log=/tmp/sbx-$label.log
setsid xvfb-run -a "$@" >"$log" 2>&1 &
PG=$!
sleep 12
echo "=== $label: $*"
echo "renderer processes:"
for pid in $(pgrep -f -- '--type=renderer'); do
  echo "  cmdline has --no-sandbox: $(tr '\0' ' ' < /proc/$pid/cmdline | grep -c -- '--no-sandbox')"
  echo "  pid=$pid uid=$(awk '/^Uid:/{print $2}' /proc/$pid/status) $(grep -E '^(Seccomp|NoNewPrivs):' /proc/$pid/status | tr '\n\t' '  ') userns=$(readlink /proc/$pid/ns/user)"
done
n=$(pgrep -f -- '--type=renderer' | wc -l); [ "$n" = 0 ] && echo "  (none: app did not start a renderer)"
echo "log (sandbox/fatal lines):"; grep -iE "sandbox|FATAL|namespace" "$log" | head -5 | sed 's/^/  /'
kill -- -$PG 2>/dev/null; sleep 1; kill -9 -- -$PG 2>/dev/null; sleep 1
