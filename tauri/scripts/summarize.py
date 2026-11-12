#!/usr/bin/env python3
"""Print markdown tables from tauri/evidence/ci for the results files. usage: python3 -I scripts/summarize.py"""
import glob, json, os, re

E = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'evidence', 'ci')

def load(p):
    try:
        with open(os.path.join(E, p), encoding='utf-8-sig') as f:
            return json.load(f)
    except Exception:
        return None

def points(d, which):
    return {k: v[which] for k, v in d['points'].items()}

def table(title, rows, headers):
    print(f'\n### {title}\n')
    print('| ' + ' | '.join(headers) + ' |')
    print('|' + '---|' * len(headers))
    for r in rows:
        print('| ' + ' | '.join(str(x) for x in r) + ' |')

runs = {
    'Linux default': 'slice-Linux/perf-linux-default.json',
    'Linux DMABUF off': 'slice-Linux/perf-linux-dmabuf-off.json',
    'Windows': 'slice-Windows/perf-win32-default.json',
    'macOS': 'slice-macOS/perf-darwin-default.json',
}
for name, p in runs.items():
    d = load(p)
    if not d:
        print(f'\n(no data for {name})')
        continue
    rows = []
    for k in ['P0', 'P1', 'P2', 'P3', 'P4', 'P5']:
        v = d['points'][k]
        rows.append([k, v['app']['primaryMB'], v['all']['primaryMB'], v['all']['secondaryMB'], v['all']['processes']])
    m = d['points']['P0']['metric']
    table(f'{name}: {m}', rows, ['Point', 'app only (primary)', 'all processes (primary)', 'all processes (secondary)', 'processes'])
    print(f"\nworst frame per pass (ms): {[round(p['worstFrameMs']) for p in d['passes']]}, frames over 100 ms: {[p['framesOver100ms'] for p in d['passes']]}, soak worst frame {round(d['soakWorstFrameMs'])} ms")
    print(f"sort worst of 3 (ms): { {k: round(v) for k, v in d['sortMsWorstPerColumn'].items()} }; selection after scroll {round(d['selectionMs'])} ms")
