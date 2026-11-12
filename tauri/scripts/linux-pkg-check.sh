#!/bin/bash
# Linux packaging and web view sandbox checks on ubuntu-24.04. Run after `tauri build --bundles deb,rpm,appimage`.
# 1. what apt would pull in for the deb, 2. install as an ordinary user's sudo apt, 3. launch under Xvfb, screenshot, and
# 4. inspect the WebKit processes (command lines, seccomp, namespaces, bubblewrap), 5. AppImage launch.
set -u
OUT=${1:-test-results/linux-pkg}; mkdir -p "$OUT"; OUT=$(cd "$OUT" && pwd)
BUNDLE=$(cd "$(dirname "$0")/.." && pwd)/src-tauri/target/release/bundle
FIX=$(cd "$(dirname "$0")/../.." && pwd)/fixtures
DEB=$(ls "$BUNDLE"/deb/*.deb | head -1)
{
  echo "== deb: $DEB"; ls -l "$DEB"; dpkg-deb -I "$DEB" | grep -E "Depends|Installed-Size|Package|Version"
  echo "== apt simulation (what gets pulled in)"; sudo apt-get install -s "$DEB" | grep -E "^(Inst|The following NEW|[0-9]+ upgraded)" | head -80
  echo "== kernel / userns policy"; uname -r; sysctl kernel.apparmor_restrict_unprivileged_userns kernel.unprivileged_userns_clone 2>&1
  echo "== webkit"; dpkg -s libwebkit2gtk-4.1-0 | grep Version; dpkg -l | grep -E "bubblewrap|xdg-dbus-proxy" ; which bwrap
} 2>&1 | tee "$OUT/deb-info.txt"
sudo apt-get install -y "$DEB" 2>&1 | tail -5 | tee "$OUT/deb-install.txt"
dpkg -L folio | head -20 | tee "$OUT/deb-files.txt"

cat > "$OUT/probe-inner.sh" <<'INNER'
#!/bin/bash
# args: label out-dir command...
label=$1; out=$2; shift 2
"$@" >"$out/$label.log" 2>&1 &
sleep 12
import -window root "$out/$label.png"
{ echo "mean brightness (1.0 = blank white):"; convert "$out/$label.png" -format "%[fx:mean]\n" info:
  for p in $(pgrep -f "WebKit(Web|Network|GPU)Process|bwrap|folio"); do
    echo "--- pid $p: $(tr '\0' ' ' < /proc/$p/cmdline | cut -c1-200)"
    grep -E "^(Seccomp|NoNewPrivs|Uid)" /proc/$p/status
    echo "ns: $(readlink /proc/$p/ns/user) $(readlink /proc/$p/ns/pid) $(readlink /proc/$p/ns/net)"
  done; } > "$out/$label-procs.txt" 2>&1
kill %1
INNER
chmod +x "$OUT/probe-inner.sh"
probe() { # label, launch command words...
  local label=$1; shift
  FOLIO_DATA_DIR=$FIX xvfb-run -a -s "-screen 0 1440x900x24" "$OUT/probe-inner.sh" "$label" "$OUT" "$@"
}
probe deb-installed /usr/bin/folio
cat "$OUT/deb-installed-procs.txt"

APPIMG=$(ls "$BUNDLE"/appimage/*.AppImage 2>/dev/null | head -1)
if [ -n "$APPIMG" ]; then
  ls -l "$APPIMG" | tee "$OUT/appimage-size.txt"
  chmod +x "$APPIMG"
  probe appimage "$APPIMG" --appimage-extract-and-run
  cat "$OUT/appimage-procs.txt"
fi
true
