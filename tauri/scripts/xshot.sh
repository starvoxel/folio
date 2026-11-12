#!/bin/bash
# usage: xshot.sh <out.png> [ENV=VAL ...]   Launch the Linux binary under Xvfb, wait, screenshot the root window.
out=$1; shift
BIN=${FOLIO_BIN:-./src-tauri/target/release/folio}
FOLIO_DATA_DIR=${FOLIO_DATA_DIR:-$(cd "$(dirname "$0")/../.." && pwd)/fixtures} xvfb-run -a -s "-screen 0 1440x900x24" env "$@" bash -c "$BIN >/tmp/xshot.log 2>&1 & sleep ${WAIT:-7}; import -window root $out; kill %1"
