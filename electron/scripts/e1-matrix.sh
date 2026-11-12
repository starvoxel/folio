#!/bin/bash
# E1: which variants emit a non-loopback connect() or packet? Runs on Linux as root (needs capture.sh prerequisites).
# usage: e1-matrix.sh <release-exe> <outdir>   (needs node_modules/electron/dist and dist/ from `npm run build`)
set -uo pipefail
REL=$(realpath "$1"); OUT=$2; mkdir -p "$OUT"; OUT=$(realpath "$OUT")
ROOT=$(cd "$(dirname "$0")/.." && pwd)
SCR=$(mktemp -d)
cp -r "$ROOT/dist" "$ROOT/package.json" "$SCR/"
python3 - "$SCR" <<'PY'
import sys
p=sys.argv[1]+'/dist/main/hardening.js'
s=open(p).read()
a=s.index('ses.setSpellCheckerEnabled(false)')
b=s.index('\n',s.index('setSpellChecker',s.index('setSpellCheckerLanguages')))+1 if 'setSpellCheckerLanguages' in s else None
# replace whichever spellcheck lines are present with a variant switch (scratch copy only, never shipped)
lines=s.split('\n'); out=[]
for l in lines:
    if 'ses.setSpellChecker' in l: continue
    out.append(l)
    if 'ses.setDevicePermissionHandler' in l:
        out.append("    const V = process.env.E1_VARIANT || 'fixed';")
        out.append("    if (V === 'fixed') { ses.setSpellCheckerEnabled(false); ses.setSpellCheckerLanguages([]); }")
        out.append("    else if (V === 'disable-only') { ses.setSpellCheckerEnabled(false); }")
        out.append("    else if (V === 'loopback-url') { ses.setSpellCheckerEnabled(false); ses.setSpellCheckerDictionaryDownloadURL('http://127.0.0.1:9/disabled/'); }")
open(p,'w').write('\n'.join(out))
PY
ELECTRON="$ROOT/node_modules/electron/dist/electron"
run() { # name variant mode ipv6off extra-args...
  local name=$1 variant=$2 mode=$3 off=$4; shift 4
  echo "##### $name (variant=$variant mode=$mode ipv6off=${off:-0} args=$*)"
  rm -rf "$OUT/$name"
  CAP_IPV6_OFF=$off "$ROOT/scripts/capture.sh" "$mode" "$OUT/$name" env E1_VARIANT=$variant xvfb-run -a timeout -s INT 40 "$ELECTRON" --no-sandbox "$@" "$SCR" --data-dir="$ROOT/../fixtures" >/dev/null 2>&1
  node "$ROOT/scripts/analyze-capture.mjs" "$OUT/$name" | tee "$OUT/$name.analysis.txt" | cut -c1-260
  gzip -f "$OUT/$name/strace.log"; rm -f "$OUT/$name/capture.pcap"
}
run v0-fixed            fixed        sink   ""
run v1-disable-only     disable-only sink   ""
run v2-loopback-url     loopback-url sink   ""
run v3-loopback-url-ipv6off loopback-url sink 1
run v4-loopback-url-override loopback-url sink "" --enable-features=EnableIPv6ReachabilityOverride
run v5-loopback-url-hostrules loopback-url sink "" "--host-resolver-rules=MAP * ~NOTFOUND"
# The real release binary (fuses on, no flags), as shipped:
echo "##### v6-release-binary"
rm -rf "$OUT/v6-release-binary"
"$ROOT/scripts/capture.sh" sink "$OUT/v6-release-binary" xvfb-run -a timeout -s INT 40 "$REL" --no-sandbox --data-dir="$ROOT/../fixtures" >/dev/null 2>&1
node "$ROOT/scripts/analyze-capture.mjs" "$OUT/v6-release-binary" | tee "$OUT/v6-release-binary.analysis.txt" | cut -c1-260
gzip -f "$OUT/v6-release-binary/strace.log"; rm -f "$OUT/v6-release-binary/capture.pcap"
true
