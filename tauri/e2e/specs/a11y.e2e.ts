// F3: dump what the OS accessibility API reports for the running app, at the same six states as the Electron slice.
// The dumper per OS is the Electron slice's script, unchanged: atspi-dump.py (Linux), uia-dump.ps1 (Windows), ax-dump.swift (macOS).
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { goto, press, resultsDir, settle } from './helpers';

const scripts = path.resolve(process.cwd(), '..', 'scripts');
const outDir = path.join(resultsDir, 'a11y-platform', process.platform);
fs.mkdirSync(outDir, { recursive: true });
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const log: string[] = [];

function dump(label: string, pid: number) {
  const f = path.join(outDir, `${label}.txt`);
  let r;
  if (process.platform === 'linux') r = spawnSync('/usr/bin/python3.12', [path.join(scripts, 'atspi-dump.py'), 'folio', f, '--max-nodes', '2500'], { encoding: 'utf8', timeout: 120000 });
  else if (process.platform === 'win32') r = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(scripts, 'uia-dump.ps1'), '-ProcessId', String(pid), '-Out', f], { encoding: 'utf8', timeout: 180000 });
  else r = spawnSync('swift', [path.join(scripts, 'ax-dump.swift'), String(pid), f], { encoding: 'utf8', timeout: 240000 });
  log.push(`${label}: exit ${r.status} ${(r.stdout || '').trim().slice(0, 200)} ${(r.stderr || '').trim().slice(0, 300)}`);
  console.log(log[log.length - 1]);
}

describe('platform accessibility tree', () => {
  it('dumps six states', async function () {
    await browser.waitUntil(async () => browser.execute(() => window.__folio?.getState().ready === true), { timeout: 60_000 });
    const exe = process.platform === 'win32' ? 'folio.exe' : 'folio';
    const pid = Number(execFileSync('node', [path.join(scripts, 'memtree.mjs'), 'find', exe], { encoding: 'utf8' }).trim());
    await wait(1500);
    dump('01-overview-nav', pid);
    await goto('Transactions'); await wait(1000);
    dump('02-transactions-no-selection', pid);
    await (await $$('.grid-row'))[3]!.click(); await wait(800);
    dump('03-transactions-row-selected', pid);
    await browser.execute(() => { document.querySelector<HTMLElement>('[data-testid="grid-scroll"]')!.scrollTop = 200000; }); await wait(800);
    dump('04-transactions-scrolled-far', pid);
    await goto('Reporting'); await wait(1000);
    dump('05-reporting', pid);
    await goto('Settings'); await wait(800);
    await (await $('//button[contains(normalize-space(.),"Reset settings")]')).click(); await wait(1200);
    await settle();
    dump('06-dialog-open', pid);
    await press('Escape');
    fs.writeFileSync(path.join(outDir, 'run-log.txt'), log.join('\n') + '\n');
  });
});
