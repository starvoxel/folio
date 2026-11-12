// F1: memory at points P0..P5 for the packaged app, same scenario as the G2 test.
// usage: node scripts/mem-points.mjs <exe> <out.json> [--a11y] [--args "--flag --flag2"] [--label name] [--points P0,P1,...]
// env: MEM_SOAK (default 20), MEM_IDLE_S (default 60)
import { _electron as electron } from '@playwright/test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { measureTree } from './memtree.mjs';

const argv = process.argv.slice(2);
const exe = argv[0], outFile = argv[1];
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const a11y = argv.includes('--a11y');
const extra = (opt('--args', '') || '').split(/\s+/).filter(Boolean);
const label = opt('--label', a11y ? 'a11y-forced' : 'default');
const wanted = new Set((opt('--points', 'P0,P1,P2,P3,P4,P5')).split(','));
const SOAK = Number(process.env.MEM_SOAK ?? 20), IDLE = Number(process.env.MEM_IDLE_S ?? 60) * 1000;
const fixtures = path.resolve(process.argv[1], '..', '..', '..', 'fixtures');

const args = [...(process.platform === 'linux' ? ['--no-sandbox'] : []), ...(a11y ? ['--force-renderer-accessibility'] : []), ...extra];
const app = await electron.launch({ executablePath: exe, args, timeout: 60000, env: { ...process.env, FOLIO_AUTOMATION: '1', FOLIO_DATA_DIR: fixtures, FOLIO_USER_DATA: fs.mkdtempSync(path.join(os.tmpdir(), 'folio-mem-')) } });
const page = await app.firstWindow();
await page.waitForFunction(() => window.__folio?.getState().ready, null, { timeout: 60000 });
const pid = app.process().pid;
const nav = (n) => page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: n, exact: true }).click();
const wait = (ms) => page.waitForTimeout(ms);
const points = {};
const snap = (p) => { if (wanted.has(p)) { points[p] = measureTree(pid); console.log(p, label, JSON.stringify({ [points[p].primaryName]: points[p].primaryMB, [points[p].secondaryName]: points[p].secondaryMB, n: points[p].processes })); } };

const scroll = () => page.evaluate(() => new Promise((resolve) => {
  const el = document.querySelector('[data-testid="grid-scroll"]'); el.scrollTop = 0;
  const max = el.scrollHeight - el.clientHeight; let frames = 0;
  const tick = () => { frames++; if (el.scrollTop >= max) return resolve(frames); el.scrollTop = Math.min(max, el.scrollTop + 600); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}));

await wait(5000); snap('P0');                      // Overview, 5 s after ready
await nav('Transactions'); await wait(5000); snap('P1');
await scroll(); await wait(3000); snap('P2');
await scroll(); await wait(3000); snap('P3');
await scroll(); await wait(IDLE); snap('P4');
if (wanted.has('P5')) {
  const cols = ['amount', 'description', 'date', 'category', 'account'];
  const cats = ['groceries', 'dining', 'housing', 'transport', 'shopping'];
  for (let i = 0; i < SOAK; i++) {
    await page.locator(`.head-btn[data-col="${cols[i % cols.length]}"]`).click();                 // one sort change
    await page.getByRole('combobox', { name: 'Category filter' }).selectOption(cats[i % cats.length]); // one filter change
    await wait(150);
    await page.getByRole('combobox', { name: 'Category filter' }).selectOption('');               // back to all 10,000 rows
    await wait(150);
    await scroll();
  }
  await wait(IDLE); snap('P5');
}
fs.writeFileSync(outFile, JSON.stringify({ label, platform: process.platform, soak: SOAK, idleS: IDLE / 1000, args, points }, null, 2));
await app.close();
