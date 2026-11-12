// Sum memory over the whole process tree of the app, one definition per OS (see FOLLOWUP-RESULTS.md).
//  linux : PSS (primary) and RSS, from tools/measure-memory.py reading /proc/<pid>/smaps_rollup
//  win32 : private working set (primary, WMI Win32_PerfFormattedData_PerfProc_Process.WorkingSetPrivate) and total working set
//  darwin: physical footprint (primary, `footprint -p <pid>`) and RSS from `ps`
import { execFileSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const MB = 1024 * 1024;

function sh(cmd, args) { return execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 1 << 26 }); }

export function measureTree(rootPid) {
  if (process.platform === 'linux') {
    const j = JSON.parse(sh('python3', ['-I', path.resolve(here, '..', '..', 'tools', 'measure-memory.py'), String(rootPid)]));
    return { primaryName: 'PSS', primaryMB: j.pss_mb, secondaryName: 'RSS', secondaryMB: j.rss_mb, processes: j.process_count, detail: j.processes.map((p) => `${p.comm}:${(p.pss_kb / 1024).toFixed(0)}`) };
  }
  if (process.platform === 'win32') {
    const ps = `
$all = Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId
$ids = New-Object System.Collections.Generic.List[int]; $ids.Add(${rootPid}); $i = 0
while ($i -lt $ids.Count) { $p = $ids[$i]; $i++; foreach ($c in $all | Where-Object { $_.ParentProcessId -eq $p }) { if (-not $ids.Contains([int]$c.ProcessId)) { $ids.Add([int]$c.ProcessId) } } }
$perf = Get-CimInstance Win32_PerfFormattedData_PerfProc_Process | Where-Object { $ids.Contains([int]$_.IDProcess) }
$perf | ForEach-Object { [pscustomobject]@{ pid = $_.IDProcess; name = $_.Name; priv = [double]$_.WorkingSetPrivate; ws = [double]$_.WorkingSet } } | ConvertTo-Json -Compress`;
    const out = sh('powershell', ['-NoProfile', '-Command', ps]).trim();
    let rows = JSON.parse(out); if (!Array.isArray(rows)) rows = [rows];
    return { primaryName: 'private working set', primaryMB: +(rows.reduce((a, r) => a + r.priv, 0) / MB).toFixed(1), secondaryName: 'total working set', secondaryMB: +(rows.reduce((a, r) => a + r.ws, 0) / MB).toFixed(1), processes: rows.length, detail: rows.map((r) => `${r.name}:${(r.priv / MB).toFixed(0)}`) };
  }
  if (process.platform === 'darwin') {
    const tab = sh('ps', ['-axo', 'pid=,ppid=,rss=']).trim().split('\n').map((l) => l.trim().split(/\s+/).map(Number));
    const ids = [rootPid]; for (let i = 0; i < ids.length; i++) for (const [pid, ppid] of tab) if (ppid === ids[i] && !ids.includes(pid)) ids.push(pid);
    const rssKB = tab.filter(([pid]) => ids.includes(pid)).reduce((a, r) => a + r[2], 0);
    let foot = 0; const detail = []; let raw = '';
    for (const pid of ids) {
      try {
        const t = sh('footprint', ['-p', String(pid)]); raw += t;
        const m = /Footprint:\s+([\d.,]+)\s*(B|KB|MB|GB)/i.exec(t);
        if (m) { const v = parseFloat(m[1].replace(/,/g, '')); const mult = { B: 1, KB: 1024, MB: MB, GB: 1024 * MB }[m[2].toUpperCase()]; foot += v * mult; detail.push(`${pid}:${(v * mult / MB).toFixed(0)}`); }
      } catch (e) { detail.push(`${pid}:err`); }
    }
    return { primaryName: 'physical footprint', primaryMB: +(foot / MB).toFixed(1), secondaryName: 'RSS (ps)', secondaryMB: +(rssKB / 1024).toFixed(1), processes: ids.length, detail, raw: raw.slice(0, 3000) };
  }
  throw new Error('unsupported platform');
}
