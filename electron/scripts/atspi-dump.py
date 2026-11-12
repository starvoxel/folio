#!/usr/bin/python3.12
"""Dump the AT-SPI accessibility tree of a running app (what a Linux screen reader sees).
usage: atspi-dump.py <app-name-substring> <out.txt> [--max-nodes N] [--max-depth D]
Needs python3-gi, gir1.2-atspi-2.0, a session bus with at-spi-bus-launcher, and the app started with accessibility on.
"""
import sys, time
import gi
gi.require_version('Atspi', '2.0')
from gi.repository import Atspi

name_sub, out = sys.argv[1], sys.argv[2]
max_nodes = int(sys.argv[sys.argv.index('--max-nodes') + 1]) if '--max-nodes' in sys.argv else 1500
max_depth = int(sys.argv[sys.argv.index('--max-depth') + 1]) if '--max-depth' in sys.argv else 30

def find_app():
    desk = Atspi.get_desktop(0)
    for i in range(desk.get_child_count()):
        a = desk.get_child_at_index(i)
        if a and name_sub.lower() in (a.get_name() or '').lower():
            return a
    return None

app = None
for _ in range(30):
    app = find_app()
    if app: break
    time.sleep(1)
lines = []
if not app:
    desk = Atspi.get_desktop(0)
    lines.append('APP NOT FOUND. Desktop children: ' + ', '.join((desk.get_child_at_index(i).get_name() or '?') for i in range(desk.get_child_count())))
    open(out, 'w').write('\n'.join(lines) + '\n'); sys.exit(2)

def states(n):
    ss = n.get_state_set()
    keep = ['SELECTED', 'FOCUSED', 'FOCUSABLE', 'CHECKED', 'EXPANDED', 'COLLAPSED', 'SELECTABLE', 'MODAL', 'ENABLED', 'SHOWING', 'VISIBLE', 'MULTISELECTABLE', 'READ_ONLY', 'EDITABLE', 'ACTIVE']
    out_ = []
    for k in keep:
        try:
            if ss.contains(getattr(Atspi.StateType, k)): out_.append(k)
        except Exception: pass
    return ','.join(out_)

count = [0]
def walk(n, depth):
    if count[0] >= max_nodes or depth > max_depth: return
    count[0] += 1
    role = n.get_role_name()
    extra = []
    try:
        attrs = n.get_attributes() or {}
        if attrs: extra.append('attrs=' + ';'.join(f'{k}={v}' for k, v in sorted(attrs.items()) if k in ('xml-roles', 'rowindex', 'colindex', 'rowcount', 'colcount', 'level', 'posinset', 'setsize', 'sort', 'sort-direction', 'live', 'tag', 'id', 'class')))
    except Exception: pass
    try:
        t = n.get_table_iface()
        if t: extra.append(f'TABLE rows={t.get_n_rows()} cols={t.get_n_columns()}')
    except Exception: pass
    try:
        c = n.get_table_cell_iface()
        if c: extra.append(f'CELL row={c.get_row_index()} col={c.get_column_index()} rowspan={c.get_row_span()} (table rows={c.get_table().get_n_rows() if c.get_table() else "?"})')
    except Exception: pass
    try:
        v = n.get_value_iface()
        if v: extra.append(f'VALUE={v.get_current_value()}')
    except Exception: pass
    try:
        tx = n.get_text_iface()
        if tx and tx.get_character_count() and role in ('text', 'entry', 'password text'):
            extra.append('TEXT=' + repr(tx.get_text(0, min(tx.get_character_count(), 60))))
    except Exception: pass
    try:
        ac = n.get_action_iface()
        if ac and ac.get_n_actions(): extra.append('ACTIONS=' + '|'.join(ac.get_action_name(i) for i in range(ac.get_n_actions())))
    except Exception: pass
    lines.append('  ' * depth + f'[{role}] name={n.get_name()!r}' + (f' desc={n.get_description()!r}' if n.get_description() else '') + f' states={states(n)} ' + ' '.join(extra))
    try:
        for i in range(n.get_child_count()):
            ch = n.get_child_at_index(i)
            if ch: walk(ch, depth + 1)
    except Exception as e:
        lines.append('  ' * depth + f'  (children error: {e})')

walk(app, 0)
if count[0] >= max_nodes: lines.append(f'... truncated at {max_nodes} nodes')
open(out, 'w').write('\n'.join(lines) + '\n')
print(f'{count[0]} nodes -> {out}')
