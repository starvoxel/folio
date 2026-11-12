#!/bin/bash
# Full F1 (P0..P5) on Linux for the default graphics path and two WebKit variants. Results: test-results/perf-linux-<variant>.json
cd "$(dirname "$0")/../e2e"
for v in default dmabuf-off compositing-off; do
  case $v in
    default) E="";;
    dmabuf-off) E="WEBKIT_DISABLE_DMABUF_RENDERER=1";;
    compositing-off) E="WEBKIT_DISABLE_COMPOSITING_MODE=1";;
  esac
  FOLIO_WEBKIT_ENV="$E" FOLIO_PERF_SUFFIX="-$v" FOLIO_SPEC=./specs/perf.e2e.ts xvfb-run -a -s "-screen 0 1440x900x24" npx wdio run wdio.conf.ts > ../test-results/perf-$v.out 2>&1
done
