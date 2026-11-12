#!/bin/bash
# Test build: shipped config + e2e overlay (withGlobalTauri, wdio capability) + the `automation` feature, in its own target dir.
set -e
cd "$(dirname "$0")/.."
npx vite build --mode e2e
cd src-tauri
TAURI_CONFIG="$(cat tauri.e2e.conf.json)" cargo build --release --features automation --target-dir target/e2e
