#!/usr/bin/env python3
"""Sum memory over a process tree on Linux, the same way for every stack.

Prints one JSON object: PSS (proportional set size, shared pages split between the processes
that share them), RSS (resident, shared pages counted in full each time), and the process list.
PSS is the primary figure for the spike's G2 comparison.

Usage: python3 tools/measure-memory.py <root-pid> [--label NAME]

Linux only. Windows and macOS need their own equivalents, described in FOLLOWUP-SPEC.md.
Reading another user's smaps_rollup needs the same user or root.
"""
import argparse
import json
import os
import sys


def children_map():
    kids = {}
    for name in os.listdir("/proc"):
        if not name.isdigit():
            continue
        try:
            with open(f"/proc/{name}/stat", "rb") as f:
                data = f.read().decode("utf-8", "replace")
            # the command name sits in parentheses and may contain spaces
            rest = data[data.rindex(")") + 2:].split()
            ppid = int(rest[1])
        except (OSError, ValueError, IndexError):
            continue
        kids.setdefault(ppid, []).append(int(name))
    return kids


def tree(root):
    kids = children_map()
    out, stack = [], [root]
    while stack:
        pid = stack.pop()
        out.append(pid)
        stack.extend(kids.get(pid, []))
    return out


def rollup(pid):
    pss = rss = 0
    try:
        with open(f"/proc/{pid}/smaps_rollup") as f:
            for line in f:
                if line.startswith("Pss:"):
                    pss = int(line.split()[1])
                elif line.startswith("Rss:"):
                    rss = int(line.split()[1])
        with open(f"/proc/{pid}/comm") as f:
            comm = f.read().strip()
    except OSError:
        return None
    return {"pid": pid, "comm": comm, "pss_kb": pss, "rss_kb": rss}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pid", type=int)
    ap.add_argument("--label", default="")
    args = ap.parse_args()
    if not sys.platform.startswith("linux"):
        sys.exit("measure-memory.py supports Linux only")
    procs = [p for p in (rollup(pid) for pid in tree(args.pid)) if p]
    if not procs:
        sys.exit(f"no readable process under pid {args.pid}")
    print(json.dumps({
        "label": args.label,
        "root_pid": args.pid,
        "process_count": len(procs),
        "pss_mb": round(sum(p["pss_kb"] for p in procs) / 1024, 1),
        "rss_mb": round(sum(p["rss_kb"] for p in procs) / 1024, 1),
        "processes": procs,
    }, indent=1))


if __name__ == "__main__":
    main()
