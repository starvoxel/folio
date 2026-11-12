#!/bin/bash
# CI only: copy a job's result files into tauri/evidence/ci/<name>/ and push them to the spike branch, so they can be read with git
# instead of through artifact downloads. Retries on push races between jobs (each job writes its own directory, so rebase is clean).
# usage: ci-commit.sh <name> [extra paths relative to tauri/ ...]
set -u
name=$1; shift
cd "$(dirname "$0")/.."
dest=evidence/ci/$name
mkdir -p "$dest"
if [ -d test-results ]; then
  (cd test-results && find . -type f \( -name '*.json' -o -name '*.txt' -o -name '*.log' -o -name '*.png' \) \
     -not -path './wdio-logs/*' -not -path './prev-shots/*' -not -path './shots-run1/*' -print0 | xargs -0 -I{} cp --parents {} "../$dest/")
fi
for p in "$@"; do [ -e "$p" ] && cp -r --parents "$p" "$dest/"; done
for f in $(find "$dest" -name 'strace.log' -size +200k); do gzip -f "$f"; done
find "$dest" -name '*.log' -size +2M -delete
git config user.name "tauri-spike-ci"; git config user.email "ci@example.invalid"
git add -f "$dest"
git commit -qm "CI evidence: $name (run ${GITHUB_RUN_ID:-local})" || exit 0
for i in 1 2 3 4 5 6; do
  git pull -q --rebase origin "${GITHUB_REF_NAME:-spike/slice-tauri}" && git push -q origin "HEAD:${GITHUB_REF_NAME:-spike/slice-tauri}" && exit 0
  sleep $((RANDOM % 8 + 2))
done
echo "could not push evidence"; exit 0
