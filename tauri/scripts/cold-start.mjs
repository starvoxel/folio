// Cold start of the shipped binary: process spawn to the first time the page reports "ready" is not observable without a driver,
// so this uses the window's own signal: the renderer (automation mode only) does not exist in the shipped path. Instead we time
// spawn -> the web view's main frame painting something, approximated by polling the OS for the window and then the first
// WebKit/WebView2 child. Kept simple on purpose; the driver-based figure (spec start to ready) is the primary one.
// Here: spawn -> process still alive after 5 s, plus spawn -> web view process exists.
import { spawn, execFileSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const exe = path.resolve(here, '..', 'src-tauri', 'target', 'release', process.platform === 'win32' ? 'folio.exe' : 'folio');
const env = { ...process.env, FOLIO_DATA_DIR: path.resolve(here, '..', '..', 'fixtures') };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const webviewUp = () => {
  try {
    if (process.platform === 'win32') return execFileSync('powershell', ['-NoProfile', '-Command', "(Get-Process msedgewebview2 -ErrorAction SilentlyContinue | Measure-Object).Count"], { encoding: 'utf8' }).trim() !== '0';
    return /WebKitWebProcess|com\.apple\.WebKit\.WebContent/.test(execFileSync('ps', ['-axo', 'command'], { encoding: 'utf8' }));
  } catch { return false; }
};
const samples = [];
for (let i = 0; i < 5; i++) {
  const t0 = Date.now();
  const child = process.platform === 'linux' ? spawn('xvfb-run', ['-a', '-s', '-screen 0 1440x900x24', exe], { env, stdio: 'ignore' }) : spawn(exe, [], { env, stdio: 'ignore' });
  let up = null;
  while (Date.now() - t0 < 15000) { if (webviewUp()) { up = Date.now() - t0; break; } await sleep(25); }
  samples.push(up);
  try { process.platform === 'win32' ? execFileSync('taskkill', ['/F', '/T', '/PID', String(child.pid)]) : execFileSync('pkill', ['-f', exe]); } catch { /* gone */ }
  await sleep(3000);
}
console.log(JSON.stringify({ metric: 'ms from spawn to first web view process present', samples }));
