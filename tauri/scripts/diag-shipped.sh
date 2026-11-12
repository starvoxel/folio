#!/bin/bash
# Why does the shipped binary show no web view on the hosted runner? Launch variants under Xvfb as the runner user and report,
# every 3 s for 30 s: the process list, mapped X windows, and a screenshot at the end. usage: diag-shipped.sh <binary> <out-dir>
BIN=$1; OUT=$2; mkdir -p "$OUT"; OUT=$(cd "$OUT" && pwd)
FIX=$(cd "$(dirname "$0")/../.." && pwd)/fixtures
run() { # label, env assignments...
  local label=$1; shift
  cat > "$OUT/inner.sh" <<INNER
#!/bin/bash
$BIN >"$OUT/$label.log" 2>&1 &
APP=\$!
for i in \$(seq 1 30); do
  sleep 1
  echo "t=\${i}s procs: \$(ps -eo pid,comm | grep -cE 'WebKit(Web|Network|GPU)Process') webkit, app alive: \$(kill -0 \$APP 2>/dev/null && echo yes || echo NO), windows: \$(xwininfo -root -tree | grep -cE 'Folio|folio')" >> "$OUT/$label.timeline"
done
xwininfo -root -tree > "$OUT/$label.xwininfo"
import -window root "$OUT/$label.png"; convert "$OUT/$label.png" -format 'brightness %[fx:mean]\n' info: >> "$OUT/$label.timeline"
kill \$APP
INNER
  chmod +x "$OUT/inner.sh"
  FOLIO_DATA_DIR=$FIX xvfb-run -a -s "-screen 0 1440x900x24" env "$@" "$OUT/inner.sh"
  echo "=== $label ($*)"; cat "$OUT/$label.timeline"; tail -3 "$OUT/$label.log"
}
run plain A=1
run automation-env FOLIO_AUTOMATION=1
run dmabuf-off WEBKIT_DISABLE_DMABUF_RENDERER=1
run compositing-off WEBKIT_DISABLE_COMPOSITING_MODE=1
run sw-gl LIBGL_ALWAYS_SOFTWARE=1
run no-a11y NO_AT_BRIDGE=1
true
