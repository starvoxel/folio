#!/bin/bash
# Run inside `dbus-run-session --`: starts the AT-SPI bus, then the platform a11y dump scenario under Xvfb.
# usage: dbus-run-session -- scripts/atspi-run.sh <exe> <outDir>
/usr/libexec/at-spi-bus-launcher --launch-immediately &
BUS=$!
sleep 2
/usr/libexec/at-spi2-registryd &
REG=$!
sleep 1
gsettings set org.gnome.desktop.interface toolkit-accessibility true 2>/dev/null || true
xvfb-run -a -s "-screen 0 1440x900x24" node "$(dirname "$0")/a11y-platform.mjs" "$1" "$2"
rc=$?
kill $REG $BUS 2>/dev/null
exit $rc
