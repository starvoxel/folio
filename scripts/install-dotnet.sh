#!/usr/bin/env bash
# Installs the pinned .NET SDK for cloud sessions. global.json only sets a floor (10.0.100 with
# rollForward latestFeature), so this pins the version CI resolves. To bump: change the version
# and the sha512 together (the hash is in
# https://builds.dotnet.microsoft.com/dotnet/release-metadata/10.0/releases.json, under the SDK's
# "dotnet-sdk-linux-x64.tar.gz" file).
#
# Idempotent and safe to run concurrently (a second run waits for the first). Verifies the
# download against the hardcoded sha512 before installing; a mismatch or a placeholder hash
# installs nothing. Always exits 0 so a failure never blocks a session; read the log lines.
#
# Test hooks (not for normal use): DOTNET_INSTALL_DIR, DOTNET_URL, DOTNET_LINK_DIR.
set -uo pipefail

DOTNET_VERSION="10.0.404"
DOTNET_SHA512="577d0eb17fec33d029104c5c63a1ab0accc3e28776274abef2218dbac5af18d2109b5406d26b31d76f5c245215e3ba0926a94c20246c672c41847c9e1eb1dc50"
DOTNET_INSTALL_DIR="${DOTNET_INSTALL_DIR:-/usr/share/dotnet}"
DOTNET_LINK_DIR="${DOTNET_LINK_DIR:-/usr/local/bin}"
DOTNET_URL="${DOTNET_URL:-https://builds.dotnet.microsoft.com/dotnet/Sdk/${DOTNET_VERSION}/dotnet-sdk-${DOTNET_VERSION}-linux-x64.tar.gz}"

log() { echo "install-dotnet: $*"; }
err() { echo "install-dotnet: ERROR: $*" >&2; }

installed_version() {
  [ -x "$DOTNET_INSTALL_DIR/dotnet" ] || return 0
  (cd / && "$DOTNET_INSTALL_DIR/dotnet" --version 2>/dev/null) || true
}

install_sdk() {
  if [ "$(installed_version)" = "$DOTNET_VERSION" ]; then
    log "dotnet $DOTNET_VERSION already installed, skipped"
    return 0
  fi
  case "$DOTNET_SHA512" in
    PASTE_SHA512_HERE | "")
      err "no sha512 pinned in $0, nothing installed"
      return 1
      ;;
  esac

  local work
  work="$(mktemp -d)" || { err "cannot create temp directory"; return 1; }
  trap 'rm -rf "$work"' RETURN
  log "dotnet $DOTNET_VERSION: downloading"
  curl -fsSL -o "$work/sdk.tar.gz" "$DOTNET_URL" || { err "download failed"; return 1; }
  echo "$DOTNET_SHA512  $work/sdk.tar.gz" | sha512sum -c - >/dev/null 2>&1 \
    || { err "checksum mismatch, not installed"; return 1; }

  local staging="$DOTNET_INSTALL_DIR.new.$$"
  rm -rf "$staging"
  mkdir -p "$staging" && tar -xzf "$work/sdk.tar.gz" -C "$staging" \
    || { rm -rf "$staging"; err "extract failed"; return 1; }
  rm -rf "$DOTNET_INSTALL_DIR" && mv "$staging" "$DOTNET_INSTALL_DIR" \
    || { rm -rf "$staging"; err "install failed"; return 1; }
  mkdir -p "$DOTNET_LINK_DIR" && ln -sf "$DOTNET_INSTALL_DIR/dotnet" "$DOTNET_LINK_DIR/dotnet" \
    || { err "could not link dotnet into $DOTNET_LINK_DIR"; return 1; }
  log "dotnet $DOTNET_VERSION: installed to $DOTNET_INSTALL_DIR"
}

lock="${TMPDIR:-/tmp}/install-dotnet.lock"
(
  flock 9
  install_sdk
) 9>"$lock" || err "dotnet is not installed; the session continues without it"
exit 0
