#!/usr/bin/python3.12
"""Summarise the table part of an atspi_dump.py JSON file: role, interfaces, Table interface counts, header, first rows,
selected rows, position attributes and cell info. Usage: atspi_table_summary.py <dump.json> [name]"""
import json, sys
d = json.load(open(sys.argv[1])); want = sys.argv[2] if len(sys.argv) > 2 else "Transactions table"
def find(n):
    if n.get("name") == want: return n
    for c in n.get("children", []):
        r = find(c)
        if r: return r
def line(n, ind=0):
    keep = {k: v for k, v in (n.get("attributes") or {}).items() if k in ("posinset", "setsize", "level", "explicit-name")}
    ifs = [i.split(".")[-1] if isinstance(i, str) else i for i in n.get("interfaces", [])]
    s = " " * ind + f"{n.get('role')} | '{n.get('name')}' | states={','.join(x for x in n.get('states', []) if x in ('selected','selectable','focused','focusable','showing'))} | ifaces={ifs} | kids={n.get('child_count')}"
    if keep: s += f" | attrs={keep}"
    if "table" in n: s += f" | TABLE n_rows={n['table']['n_rows']} n_cols={n['table']['n_columns']}"
    if "table_cell" in n: s += f" | CELL {n['table_cell']}"
    return s
def rowlike(n): return n.get("role") in ("table row", "list item", "table cell") or "row" in (n.get("role") or "")
t = find(d)
if not t: print("table node not found:", want); sys.exit(1)
print(line(t))
# rows can sit several wrapper levels below the table, so collect every descendant that looks like a row (named with the row text or carrying a position attribute)
rows, heads = [], []
def walk(n, path):
    nm = n.get("name") or ""
    at = n.get("attributes") or {}
    if "posinset" in at or (nm.count(", ") >= 3 and n.get("role") in ("table cell", "list item", "table row", "tree item", "row")): rows.append((n, path))
    elif n.get("role") in ("column header", "table column header", "header", "push button") and nm: heads.append((n, path))
    else:
        for c in n.get("children", []): walk(c, path + [n.get("role")])
for c in t.get("children", []): walk(c, [])
print(f"-- row-like nodes found: {len(rows)}; header-like nodes: {len(heads)}")
for n, path in heads[:6]: print(line(n, 2), "| via", ">".join(path))
for i, (n, path) in enumerate(rows):
    if i < 3 or "selected" in n.get("states", []) or i == len(rows) - 1:
        print(line(n, 2), "| via", ">".join(path))
        for c in n.get("children", [])[:2]: print(line(c, 4))
