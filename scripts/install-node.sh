#!/usr/bin/env bash
# Installs the pinned Node.js and npm for cloud sessions, the way install-dotnet.sh once did for
# the .NET SDK. .node-version only names the major (24); this pins the exact release CI resolves,
# and npm 12 on top of it, because no stable Node bundles npm 12 yet (plans/app-scaffold.md).
# To bump: change the versions and the sha256 together (the hash is in
# https://nodejs.org/dist/v<version>/SHASUMS256.txt, on the node-v<version>-linux-x64.tar.xz line).
# Prefer a Node release at least seven days old, to match min-release-age in .npmrc.
#
# Idempotent and safe to run concurrently (a second run waits for the first). Verifies the
# download against the hardcoded sha256 before installing; a mismatch or a placeholder hash
# installs nothing. Always exits 0 so a failure never blocks a session; read the log lines.
#
# Optional: FOLIO_INSTALL_E2E_DEPS=1 also installs Xvfb and the shared libraries Electron needs
# on Linux (for running the end-to-end tests in a cloud session; apt, needs root).
#
# Test hooks (not for normal use): NODE_INSTALL_DIR, NODE_URL, NODE_LINK_DIR.
set -uo pipefail

NODE_VERSION="24.22.2"
NODE_SHA256="48cc0e21e048790e54c0cf5749c2725005313d652651c40b7a21feb9697aaf75"
NPM_VERSION="12.2.2"
NODE_INSTALL_DIR="${NODE_INSTALL_DIR:-/usr/local/lib/nodejs}"
NODE_LINK_DIR="${NODE_LINK_DIR:-/usr/local/bin}"
NODE_URL="${NODE_URL:-https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz}"

log() { echo "install-node: $*"; }
err() { echo "install-node: ERROR: $*" >&2; }

installed_node_version() {
  [ -x "$NODE_INSTALL_DIR/bin/node" ] || return 0
  "$NODE_INSTALL_DIR/bin/node" --version 2>/dev/null | sed 's/^v//' || true
}

installed_npm_version() {
  [ -x "$NODE_INSTALL_DIR/bin/npm" ] || return 0
  PATH="$NODE_INSTALL_DIR/bin:$PATH" "$NODE_INSTALL_DIR/bin/npm" --version 2>/dev/null || true
}

install_node() {
  if [ "$(installed_node_version)" = "$NODE_VERSION" ]; then
    log "node $NODE_VERSION already installed, skipped"
    return 0
  fi
  case "$NODE_SHA256" in
    PASTE_SHA256_HERE | "")
      err "no sha256 pinned in $0, nothing installed"
      return 1
      ;;
  esac

  local work
  work="$(mktemp -d)" || { err "cannot create temp directory"; return 1; }
  trap 'rm -rf "$work"' RETURN
  log "node $NODE_VERSION: downloading"
  curl -fsSL -o "$work/node.tar.xz" "$NODE_URL" || { err "download failed"; return 1; }
  echo "$NODE_SHA256  $work/node.tar.xz" | sha256sum -c - >/dev/null 2>&1 \
    || { err "checksum mismatch, not installed"; return 1; }

  local staging="$NODE_INSTALL_DIR.new.$$"
  rm -rf "$staging"
  mkdir -p "$staging" && tar -xJf "$work/node.tar.xz" -C "$staging" --strip-components=1 \
    || { rm -rf "$staging"; err "extract failed"; return 1; }
  rm -rf "$NODE_INSTALL_DIR" && mv "$staging" "$NODE_INSTALL_DIR" \
    || { rm -rf "$staging"; err "install failed"; return 1; }
  log "node $NODE_VERSION: installed to $NODE_INSTALL_DIR"
}

link_tools() {
  mkdir -p "$NODE_LINK_DIR" || { err "cannot create $NODE_LINK_DIR"; return 1; }
  local tool
  for tool in node npm npx; do
    ln -sf "$NODE_INSTALL_DIR/bin/$tool" "$NODE_LINK_DIR/$tool" \
      || { err "could not link $tool into $NODE_LINK_DIR"; return 1; }
  done
}

install_npm() {
  if [ "$(installed_npm_version)" = "$NPM_VERSION" ]; then
    log "npm $NPM_VERSION already installed, skipped"
    return 0
  fi
  log "npm $NPM_VERSION: installing"
  PATH="$NODE_INSTALL_DIR/bin:$PATH" "$NODE_INSTALL_DIR/bin/npm" install -g "npm@$NPM_VERSION" >/dev/null 2>&1 \
    || { err "npm $NPM_VERSION install failed"; return 1; }
  log "npm $NPM_VERSION: installed"
}

install_e2e_dependencies() {
  [ "${FOLIO_INSTALL_E2E_DEPS:-}" = "1" ] || return 0
  command -v apt-get >/dev/null 2>&1 || { err "apt-get not found, skipped end-to-end dependencies"; return 1; }
  log "installing Xvfb and the libraries Electron needs"
  apt-get update -qq >/dev/null 2>&1 \
    && apt-get install -y -qq xvfb libgtk-3-0 libnss3 libasound2t64 libgbm1 libxss1 libxtst6 >/dev/null 2>&1 \
    || { err "end-to-end dependency install failed"; return 1; }
}

lock="${TMPDIR:-/tmp}/install-node.lock"
(
  flock 9
  install_node && link_tools && install_npm
  install_e2e_dependencies
) 9>"$lock" || err "node is not installed; the session continues without it"
exit 0
