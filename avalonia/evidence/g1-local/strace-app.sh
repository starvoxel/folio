#!/usr/bin/env bash
exec strace -f -qq -e trace=network -o "${G1_STRACE_OUT:?}" "/home/user/folio/avalonia/Slice/bin/Release/net10.0/FolioSlice" "$@"
