// Memory of the Tauri app, counting the OS web view processes. One definition per OS; everything printed as JSON.
//
//   node scripts/memtree.mjs find <exe-name>                 -> prints the root pid
//   node scripts/memtree.mjs baseline <file>                 -> macOS: record existing WebKit helper pids before launch
//   node scripts/memtree.mjs measure <root-pid> [baseline]   -> {app, all, ...}
//
// "app" = the app's own process only (what a naive tool reports for Tauri).
// "all" = every process that belongs to the app including its web view:
//  linux : app + all descendants (WebKitWebProcess, WebKitNetworkProcess are children). Cross-check: any WebKit* process
//          that is NOT a descendant is listed in `orphans` (expected: none).
//  win32 : app + descendants + every msedgewebview2.exe whose command line carries the app's WebView2 user-data folder
//          (identifier "invalid.example.folio.spike"). Cross-check: `notDescendants` lists the ones found by command line only.
//  darwin: app + descendants + every com.apple.WebKit.* helper (WebContent, Networking, GPU) that was not in the pre-launch
//          baseline. WKWebView helpers are launched by launchd/XPC, not as children. Cross-check: they disappear after quit.
// Metrics: linux PSS (smaps_rollup) with RSS; windows private working set (WorkingSetPrivate) with total working set;
// macOS physical footprint (`footprint -p`) with RSS (`ps`).
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';

const MB = 1024 * 1024;
const sh = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 1 << 26 });
const ID = 'invalid.example.folio.spike';
const round = (n) => +n.toFixed(1);

function findPid(name) {
  if (process.platform === 'win32') {
    const out = sh('powershell', ['-NoProfile', '-Command', `(Get-Process -Name '${name.replace(/\.exe$/, '')}' -ErrorAction SilentlyContinue | Sort-Object StartTime | Select-Object -First 1).Id`]).trim();
    return Number(out);
  }
  const out = sh('pgrep', ['-x', name]).trim().split('\n')[0];
  return Number(out);
}

function psTable() {
  // pid ppid rss comm (full command last)
  return sh('ps', ['-axo', process.platform === 'darwin' ? 'pid=,ppid=,rss=,command=' : 'pid=,ppid=,rss=,args='])
    .split('\n').filter(Boolean).map((l) => {
      const m = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/.exec(l);
      return m ? { pid: +m[1], ppid: +m[2], rssKB: +m[3], cmd: m[4] } : null;
    }).filter(Boolean);
}
const descendants = (tab, root) => {
  const ids = [root];
  for (let i = 0; i < ids.length; i++) for (const p of tab) if (p.ppid === ids[i] && !ids.includes(p.pid)) ids.push(p.pid);
  return ids;
};

function linuxMeasure(root) {
  const tab = psTable();
  const tree = descendants(tab, root);
  const orphans = tab.filter((p) => /WebKit(Web|Network|GPU)Process/.test(p.cmd) && !tree.includes(p.pid)).map((p) => p.pid);
  const read = (pid) => {
    try {
      const t = fs.readFileSync(`/proc/${pid}/smaps_rollup`, 'utf8');
      return { pid, comm: fs.readFileSync(`/proc/${pid}/comm`, 'utf8').trim(), pss: +/^Pss:\s+(\d+)/m.exec(t)[1], rss: +/^Rss:\s+(\d+)/m.exec(t)[1] };
    } catch { return null; }
  };
  const rows = [...tree, ...orphans].map(read).filter(Boolean);
  const sum = (rs, k) => round(rs.reduce((a, r) => a + r[k], 0) / 1024);
  const appOnly = rows.filter((r) => r.pid === root);
  return {
    metric: 'PSS (MB), RSS (MB)',
    app: { primaryMB: sum(appOnly, 'pss'), secondaryMB: sum(appOnly, 'rss'), processes: appOnly.length },
    all: { primaryMB: sum(rows, 'pss'), secondaryMB: sum(rows, 'rss'), processes: rows.length },
    detail: rows.map((r) => `${r.comm}[${r.pid}]:${(r.pss / 1024).toFixed(0)}`),
    orphans,
  };
}

function winMeasure(root) {
  const ps = `
$all = Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId, Name, CommandLine
$ids = New-Object System.Collections.Generic.List[int]; $ids.Add(${root}); $i = 0
while ($i -lt $ids.Count) { $p = $ids[$i]; $i++; foreach ($c in $all | Where-Object { $_.ParentProcessId -eq $p }) { if (-not $ids.Contains([int]$c.ProcessId)) { $ids.Add([int]$c.ProcessId) } } }
$byCmd = @($all | Where-Object { $_.Name -eq 'msedgewebview2.exe' -and $_.CommandLine -like '*${ID}*' } | ForEach-Object { [int]$_.ProcessId })
$union = New-Object System.Collections.Generic.List[int]; foreach ($x in $ids) { $union.Add($x) }; foreach ($x in $byCmd) { if (-not $union.Contains($x)) { $union.Add($x) } }
$notDesc = @($byCmd | Where-Object { -not $ids.Contains($_) })
$perf = Get-CimInstance Win32_PerfFormattedData_PerfProc_Process | Where-Object { $union.Contains([int]$_.IDProcess) }
$rows = @($perf | ForEach-Object { [pscustomobject]@{ pid = [int]$_.IDProcess; name = $_.Name; priv = [double]$_.WorkingSetPrivate; ws = [double]$_.WorkingSet } })
[pscustomobject]@{ rows = $rows; byCmdCount = $byCmd.Count; descCount = $ids.Count; notDescendants = $notDesc } | ConvertTo-Json -Compress -Depth 4`;
  const j = JSON.parse(sh('powershell', ['-NoProfile', '-Command', ps]).trim());
  const rows = Array.isArray(j.rows) ? j.rows : j.rows ? [j.rows] : [];
  const sum = (rs, k) => round(rs.reduce((a, r) => a + r[k], 0) / MB);
  const appOnly = rows.filter((r) => r.pid === root);
  return {
    metric: 'private working set (MB), total working set (MB)',
    app: { primaryMB: sum(appOnly, 'priv'), secondaryMB: sum(appOnly, 'ws'), processes: appOnly.length },
    all: { primaryMB: sum(rows, 'priv'), secondaryMB: sum(rows, 'ws'), processes: rows.length },
    detail: rows.map((r) => `${r.name}[${r.pid}]:${(r.priv / MB).toFixed(0)}`),
    webviewByCommandLine: j.byCmdCount, descendantCount: j.descCount, notDescendants: j.notDescendants,
  };
}

const WK = /com\.apple\.WebKit\.(WebContent|Networking|GPU)|WebKit\.(WebContent|Networking|GPU)/;
function macWebkitPids() { return psTable().filter((p) => WK.test(p.cmd)).map((p) => p.pid); }

function macMeasure(root, baselineFile) {
  const base = baselineFile && fs.existsSync(baselineFile) ? JSON.parse(fs.readFileSync(baselineFile, 'utf8')) : [];
  const tab = psTable();
  const tree = descendants(tab, root);
  const wk = tab.filter((p) => WK.test(p.cmd) && !base.includes(p.pid)).map((p) => p.pid);
  const footprint = (pid) => {
    try {
      const t = sh('footprint', ['-p', String(pid)]);
      const m = /Footprint:\s+([\d.,]+)\s*(B|KB|MB|GB)/i.exec(t);
      if (!m) return 0;
      return parseFloat(m[1].replace(/,/g, '')) * { B: 1, KB: 1024, MB, GB: 1024 * MB }[m[2].toUpperCase()];
    } catch { return 0; }
  };
  const mk = (ids) => ({
    primaryMB: round(ids.reduce((a, p) => a + footprint(p), 0) / MB),
    secondaryMB: round(tab.filter((p) => ids.includes(p.pid)).reduce((a, p) => a + p.rssKB, 0) / 1024),
    processes: ids.length,
  });
  const all = [...new Set([...tree, ...wk])];
  return {
    metric: 'physical footprint (MB), RSS (MB)',
    app: mk([root]),
    all: mk(all),
    detail: all.map((p) => `${(tab.find((x) => x.pid === p)?.cmd ?? '?').split('/').pop()?.slice(0, 40)}[${p}]:${(footprint(p) / MB).toFixed(0)}`),
    webkitHelpersNotDescendants: wk.filter((p) => !tree.includes(p)),
    baselineCount: base.length,
  };
}

export function measure(root, baselineFile) {
  if (process.platform === 'linux') return linuxMeasure(root);
  if (process.platform === 'win32') return winMeasure(root);
  if (process.platform === 'darwin') return macMeasure(root, baselineFile);
  throw new Error('unsupported platform');
}
export { findPid, macWebkitPids };

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('memtree.mjs')) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'find') console.log(findPid(a));
  else if (cmd === 'baseline') { fs.writeFileSync(a, JSON.stringify(process.platform === 'darwin' ? macWebkitPids() : [])); }
  else if (cmd === 'measure') console.log(JSON.stringify(measure(Number(a), b)));
}
