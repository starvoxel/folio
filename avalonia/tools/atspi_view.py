#!/usr/bin/env python3
"""Print a compact outline of an atspi_dump.py JSON file. Usage: atspi_view.py tree.json [--skip-plain-panels]"""
import json, sys
d = json.load(open(sys.argv[1])); skip = "--skip-plain-panels" in sys.argv
def plain(n): return n.get("role") == "panel" and not n.get("name") in (None, "") and False
def show(n, ind=0):
    t = n.get("table"); tc = n.get("table_cell")
    keep = ("selected", "focused", "focusable", "selectable", "checked", "expanded", "enabled")
    line = f"{n.get('role')} | {n.get('name')!r}"
    if n.get("text"): line += f" | text={n['text']!r}"
    if n.get("value") is not None: line += f" | value={n['value']}"
    if t: line += f" | table={t}"
    if tc: line += f" | cell={tc}"
    st = [s for s in n.get("states", []) if s in keep]
    if st: line += " | " + ",".join(st)
    line += f" | kids={n.get('child_count')}"
    # skip anonymous layout panels without children of interest
    if not (skip and n.get("role") == "panel" and n.get("name") in ("Panel", "Border", "ContentPresenter", "Grid", "StackPanel", "DockPanel", "VisualLayerManager", "WindowChrome", "ContentControl", "AdornerDecorator", "ScrollContentPresenter", "") and not n.get("children")):
        print("  " * ind + line)
    for c in n.get("children", []): show(c, ind + 1)
show(d)
