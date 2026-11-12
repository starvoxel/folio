// Drives the app to the states listed in FOLLOWUP-SPEC F3 and calls a platform dumper at each.
// usage: node scripts/a11y-platform.mjs <exe> <outDir>
// linux: atspi-dump.py (AT-SPI). win32: scripts/uia-dump.ps1 (UI Automation). darwin: scripts/ax-dump.swift (AX API).
import { _electron as electron } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const [exe, outDir] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const fixtures = path.resolve(here, '..', '..', 'fixtures');
const args = [...(process.platform === 'linux' ? ['--no-sandbox'] : []), '--force-renderer-accessibility'];
const app = await electron.launch({ executablePath: exe, args, timeout: 60000, env: { ...process.env, ACCESSIBILITY_ENABLED: '1', GTK_MODULES: 'gail:atk-bridge', FOLIO_AUTOMATION: '1', FOLIO_DATA_DIR: fixtures, FOLIO_USER_DATA: fs.mkdtempSync(path.join(os.tmpdir(), 'folio-a11y-')) } });
const page = await app.firstWindow();
await page.waitForFunction(() => window.__folio?.getState().ready, null, { timeout: 60000 });
const pid = app.process().pid;
const nav = (n) => page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: n, exact: true }).click();
const log = [];

function dump(label) {
  const f = path.join(outDir, `${label}.txt`);
  let r;
  if (process.platform === 'linux') r = spawnSync('/usr/bin/python3.12', [path.join(here, 'atspi-dump.py'), 'folio', f, '--max-nodes', '2500'], { encoding: 'utf8', timeout: 120000 });
  else if (process.platform === 'win32') r = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(here, 'uia-dump.ps1'), '-ProcessId', String(pid), '-Out', f], { encoding: 'utf8', timeout: 180000 });
  else r = spawnSync('swift', [path.join(here, 'ax-dump.swift'), String(pid), f], { encoding: 'utf8', timeout: 240000 });
  log.push(`${label}: exit ${r.status} ${(r.stdout || '').trim().slice(0, 200)} ${(r.stderr || '').trim().slice(0, 300)}`);
  console.log(log[log.length - 1]);
}

await page.waitForTimeout(1500);
dump('01-overview-nav');
await nav('Transactions'); await page.waitForTimeout(1000);
dump('02-transactions-no-selection');
await page.locator('.grid-row').nth(3).click(); await page.waitForTimeout(800);
dump('03-transactions-row-selected');
await page.locator('[data-testid="grid-scroll"]').evaluate((el) => { el.scrollTop = 200000; }); await page.waitForTimeout(800);
dump('04-transactions-scrolled-far');
await nav('Reporting'); await page.waitForTimeout(1000);
dump('05-reporting');
await nav('Settings'); await page.waitForTimeout(800);
await page.getByRole('button', { name: 'Reset settings…' }).click(); await page.waitForTimeout(1200);
dump('06-dialog-open');
fs.writeFileSync(path.join(outDir, 'run-log.txt'), log.join('\n') + '\n');
await app.close();
