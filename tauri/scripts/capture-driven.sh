#!/bin/bash
# Entry point run inside the capture namespace: the driven scenario through wdio (as root, as in the Electron capture).
cd "$(dirname "$0")/../e2e"
FOLIO_SPEC=./specs/capture.e2e.ts xvfb-run -a -s "-screen 0 1440x900x24" npx wdio run wdio.conf.ts
