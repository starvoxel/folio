#!/usr/bin/python3.12
"""Dump the AT-SPI accessibility tree of the running FolioSlice app (what the OS reports, not what the code says).
Usage: atspi_dump.py [--app NAME] [--max-depth N] [--max-children N] [--focus]
Needs python3-gi, gir1.2-atspi-2.0, a session bus with the AT-SPI bus running, and the app started with accessibility on."""
import argparse, json, sys, time
import gi
gi.require_version("Atspi", "2.0")
from gi.repository import Atspi

def states(o):
    ss = o.get_state_set()
    return [s.value_nick for s in [Atspi.StateType(i) for i in range(0, 45)] if ss.contains(s)]

def info(o, depth, a):
    d = {"role": o.get_role_name(), "name": o.get_name(), "states": states(o)}
    try: d["index_in_parent"] = o.get_index_in_parent()
    except Exception: pass
    try:
        t = o.get_text_iface() or None
    except Exception: t = None
    try:
        v = o.get_value_iface()
        if v: d["value"] = v.get_current_value()
    except Exception: pass
    try:
        ti = o.get_table_iface()
        if ti: d["table"] = {"n_rows": ti.get_n_rows(), "n_columns": ti.get_n_columns()}
    except Exception: pass
    try:
        tc = o.get_table_cell()
        if tc: d["table_cell"] = {"row": tc.get_row_span() and tc.get_position()[1], "col": tc.get_position()[2], "row_span": tc.get_row_span(), "col_span": tc.get_column_span()}
    except Exception: pass
    try:
        d["interfaces"] = list(o.get_interfaces())
    except Exception: pass
    try:
        if o.get_text_iface() is not None:
            n = o.get_text_iface().get_character_count()
            d["text"] = o.get_text_iface().get_text(0, min(n, 200))
    except Exception: pass
    try:
        at = o.get_attributes()
        if at: d["attributes"] = dict(at)
    except Exception: pass
    d["child_count"] = o.get_child_count()
    if depth < a.max_depth:
        kids = []
        for i in range(min(o.get_child_count(), a.max_children)):
            try: kids.append(info(o.get_child_at_index(i), depth + 1, a))
            except Exception as e: kids.append({"error": str(e)})
        d["children"] = kids
    return d

def find_focus(o):
    try:
        if o.get_state_set().contains(Atspi.StateType.FOCUSED): return o
        for i in range(o.get_child_count()):
            r = find_focus(o.get_child_at_index(i))
            if r: return r
    except Exception: pass
    return None

ap = argparse.ArgumentParser()
ap.add_argument("--app", default="FolioSlice"); ap.add_argument("--max-depth", type=int, default=14); ap.add_argument("--max-children", type=int, default=12)
ap.add_argument("--focus", action="store_true")
a = ap.parse_args()
Atspi.init()
desk = Atspi.get_desktop(0)
apps = [desk.get_child_at_index(i) for i in range(desk.get_child_count())]
print("# applications on the bus:", [x.get_name() for x in apps if x], file=sys.stderr)
for app in apps:
    if app and a.app.lower() in (app.get_name() or "").lower():
        if a.focus:
            f = find_focus(app); print(json.dumps({"focused": info(f, 99, a) if f else None}, indent=1)); break
        print(json.dumps(info(app, 0, a), indent=1)); break
else:
    print("app not found", file=sys.stderr); sys.exit(2)
