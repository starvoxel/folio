#!/usr/bin/env bash
# Claude Code SessionStart hook: installs the pinned Node in cloud sessions, enables this repo's git hooks, builds the arc42 index, and, in
# cloud sessions, installs the aif bundles named in AIF_BUNDLES. Every step only warns on failure.
set -uo pipefail

cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}" || exit 0

# Cloud sessions: make sure the pinned Node and npm 12 are there (a no-op when they already are).
if [ "${CLAUDE_CODE_REMOTE:-}" = "true" ] && [ -x scripts/install-node.sh ]; then
  bash scripts/install-node.sh || echo "WARNING: install-node.sh failed" >&2
  # /opt/node22/bin comes before /usr/local/bin on the cloud image, so put the pinned Node first
  # for the rest of the session (Claude Code reads CLAUDE_ENV_FILE after this hook).
  if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
    echo 'export PATH="/usr/local/lib/nodejs/bin:$PATH"' >> "$CLAUDE_ENV_FILE"
  fi
fi

git config core.hooksPath .githooks || echo "WARNING: could not set core.hooksPath" >&2

if command -v aif >/dev/null 2>&1; then
  aif index architecture || echo "WARNING: aif index architecture failed" >&2
  if [ "${CLAUDE_CODE_REMOTE:-}" = "true" ] && [ -n "${AIF_BUNDLES:-}" ]; then
    aif install -B "$AIF_BUNDLES" -H claude --skip-project || echo "WARNING: aif install failed for $AIF_BUNDLES" >&2
  fi
else
  echo "WARNING: aif is not on PATH; skipping index and bundle install" >&2
fi
exit 0
