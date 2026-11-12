#!/bin/bash
# E2: why does the Chromium sandbox not start on ubuntu-24.04, and what makes it start? Runs as the (non-root) CI user with sudo.
# usage: e2-sandbox-ci.sh <packaged-app-dir>      (e.g. out/Folio-linux-x64)
set +e
APP=$(realpath "$1"); FIX=$(realpath "$(dirname "$0")/../../fixtures")
SBX="$(dirname "$0")/sbx-check.sh"
echo "### environment"; id; uname -r; lsb_release -d 2>/dev/null
sysctl kernel.apparmor_restrict_unprivileged_userns kernel.unprivileged_userns_clone 2>&1
unshare -U true && echo "unprivileged user namespaces: allowed" || echo "unprivileged user namespaces: DENIED"
ls -la "$APP/chrome-sandbox"
echo; echo "### A. packaged app, ordinary user, no flags, chrome-sandbox not setuid"
"$SBX" A-default "$APP/Folio" --data-dir="$FIX"
echo; echo "### B. same, chrome-sandbox owned by root with mode 4755 (setuid helper)"
sudo chown root "$APP/chrome-sandbox" && sudo chmod 4755 "$APP/chrome-sandbox"; ls -la "$APP/chrome-sandbox"
"$SBX" B-setuid "$APP/Folio" --data-dir="$FIX"
sudo chmod 0755 "$APP/chrome-sandbox"
echo; echo "### C. no setuid, but the AppArmor userns restriction switched off system-wide (sysctl)"
sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0
"$SBX" C-sysctl "$APP/Folio" --data-dir="$FIX"
sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=1
echo; echo "### D. no setuid, restriction ON, an AppArmor profile that grants userns to this one binary"
cat <<PROFILE | sudo tee /etc/apparmor.d/folio-spike-test >/dev/null
abi <abi/4.0>,
include <tunables/global>
profile folio-spike-test "$APP/Folio" flags=(unconfined) {
  userns,
}
PROFILE
sudo apparmor_parser -r /etc/apparmor.d/folio-spike-test && echo "profile loaded"
"$SBX" D-apparmor-profile "$APP/Folio" --data-dir="$FIX"
sudo apparmor_parser -R /etc/apparmor.d/folio-spike-test; sudo rm -f /etc/apparmor.d/folio-spike-test
echo; echo "### E. electron-builder .deb installed with dpkg, run by the ordinary user"
DEB=$(ls release-pkg/*.deb 2>/dev/null | head -1)
if [ -n "$DEB" ]; then
  ls -la "$DEB"
  sudo dpkg -i "$DEB" 2>&1 | tail -3
  ls -la /opt/Folio/chrome-sandbox; ls -la /etc/apparmor.d/folio-spike 2>&1
  "$SBX" E-deb /usr/bin/folio-spike --data-dir="$FIX"
else echo "no deb built"; fi
echo; echo "### F. electron-builder AppImage, ordinary user (--appimage-extract-and-run because the runner has no FUSE 2)"
AI=$(ls release-pkg/*.AppImage 2>/dev/null | head -1)
if [ -n "$AI" ]; then
  ls -la "$AI"; chmod +x "$AI"
  "$SBX" F-appimage "$AI" --appimage-extract-and-run --data-dir="$FIX"
else echo "no AppImage built"; fi
true
