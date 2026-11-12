#!/bin/bash
# Run any command under Xvfb with an AT-SPI bus. usage: dbus-run-session -- scripts/atspi-wrap.sh <command...>
/usr/libexec/at-spi-bus-launcher --launch-immediately &
BUS=$!
sleep 2
/usr/libexec/at-spi2-registryd &
REG=$!
sleep 1
gsettings set org.gnome.desktop.interface toolkit-accessibility true 2>/dev/null || true
export ACCESSIBILITY_ENABLED=1 GTK_MODULES=gail:atk-bridge
xvfb-run -a -s "-screen 0 1440x900x24" "$@"
rc=$?
kill $REG $BUS 2>/dev/null
exit $rc
