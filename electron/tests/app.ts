import { _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export const root = path.resolve(__dirname, '..');
export const fixtures = path.resolve(root, '..', 'fixtures');

/** The binary under test: the packaged, fuse-hardened app (see scripts/package.mjs). */
export function exePath(): string {
  if (process.env.FOLIO_EXE) return path.resolve(process.env.FOLIO_EXE);
  const dir = path.join(root, process.env.FOLIO_TEST_OUT ?? 'out-test');
  const name = { linux: 'Folio-linux-x64/Folio', win32: 'Folio-win32-x64/Folio.exe', darwin: 'Folio-darwin-arm64/Folio.app/Contents/MacOS/Folio' }[process.platform as 'linux' | 'win32' | 'darwin'];
  return path.join(dir, name);
}

export interface Launched {
  app: ElectronApplication;
  page: Page;
  coldStartMs: number;
  exited: Promise<number | null>;
  userData: string;
}

export async function launch(extraEnv: Record<string, string> = {}): Promise<Launched> {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'folio-ud-'));
  const t0 = Date.now();
  // --no-sandbox only on Linux CI/containers where the setuid chrome-sandbox helper is unavailable.
  const args = process.platform === 'linux' ? ['--no-sandbox'] : [];
  const app = await electron.launch({
    executablePath: exePath(),
    args,
    timeout: 30_000,
    env: { ...process.env, FOLIO_AUTOMATION: '1', FOLIO_DATA_DIR: fixtures, FOLIO_USER_DATA: userData, ...extraEnv } as Record<string, string>,
  });
  const proc = app.process();
  const exited = new Promise<number | null>((res) => proc.once('exit', (code) => res(code)));
  const page = await app.firstWindow();
  await page.waitForFunction(() => window.__folio?.getState().ready === true, null, { timeout: 30_000 });
  const coldStartMs = Date.now() - t0;
  return { app, page, coldStartMs, exited, userData };
}

export async function state(page: Page) {
  return page.evaluate(() => window.__folio!.getState());
}

export async function settle(page: Page) {
  await page.evaluate(() => window.__folio!.settled());
}

export async function goto(page: Page, label: string) {
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: label, exact: true }).click();
  await settle(page);
}

/** Sum of all Electron processes. workingSet double-counts shared pages; PSS (Linux) does not. */
export async function memoryMB(app: ElectronApplication) {
  const metrics = await app.evaluate(({ app }) => app.getAppMetrics().map((m) => ({ pid: m.pid, type: m.type, workingSetKB: m.memory.workingSetSize, privateKB: m.memory.privateBytes ?? 0 })));
  const workingSetMB = metrics.reduce((a, m) => a + m.workingSetKB, 0) / 1024;
  let pssMB: number | null = null;
  if (process.platform === 'linux') {
    let kb = 0;
    for (const m of metrics) {
      try {
        const t = fs.readFileSync(`/proc/${m.pid}/smaps_rollup`, 'utf8');
        const hit = /^Pss:\s+(\d+) kB/m.exec(t);
        if (hit) kb += Number(hit[1]);
      } catch { /* process gone */ }
    }
    pssMB = kb / 1024;
  }
  return { workingSetMB, pssMB, processes: metrics.length, byType: metrics.map((m) => `${m.type}:${(m.workingSetKB / 1024).toFixed(0)}`) };
}
