// Stretch F3: what does a real screen reader announce for the grid and the dialog? Windows: NVDA. macOS: VoiceOver. (Guidepup, MIT.)
// usage: node run.mjs <test exe> <out.txt>
import { _electron as electron } from '../../node_modules/@playwright/test/index.mjs';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const [exe, out] = process.argv.slice(2);
const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.resolve(here, '..', '..', '..', 'fixtures');
const lines = [];
const log = (s) => { lines.push(s); console.log(s); };
const sr = process.platform === 'win32' ? (await import('@guidepup/guidepup')).nvda : (await import('@guidepup/guidepup')).voiceOver;
const name = process.platform === 'win32' ? 'NVDA' : 'VoiceOver';

const app = await electron.launch({ executablePath: path.resolve(exe), args: ['--force-renderer-accessibility'], timeout: 60000, env: { ...process.env, FOLIO_AUTOMATION: '1', FOLIO_DATA_DIR: fixtures, FOLIO_USER_DATA: fs.mkdtempSync(path.join(os.tmpdir(), 'folio-sr-')) } });
const page = await app.firstWindow();
await page.waitForFunction(() => window.__folio?.getState().ready);
await page.bringToFront();
const nav = (n) => page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: n, exact: true });
try {
  await sr.start();
  log(`${name} started`);
  const say = async (label, action) => { const before = (await sr.spokenPhraseLog()).length; await action(); await page.waitForTimeout(1500); const all = await sr.spokenPhraseLog(); log(`--- ${label}\n${all.slice(before).map((p) => '  > ' + p).join('\n') || '  (nothing announced)'}`); };
  await say('go to Transactions (mouse click via Playwright)', () => nav('Transactions').click());
  await say('focus the grid body', () => page.locator('[data-testid="grid-scroll"]').focus());
  for (let i = 1; i <= 3; i++) await say(`ArrowDown ${i} in the grid (real key through the screen reader)`, () => sr.press('ArrowDown'));
  await say('End key (jump to last row)', () => sr.press('End'));
  await say('go to Settings and open the dialog', async () => { await nav('Settings').click(); await page.getByRole('button', { name: 'Reset settings…' }).click(); });
  await say('Tab inside the dialog', () => sr.press('Tab'));
  await say('Escape', () => sr.press('Escape'));
} catch (e) { log('ERROR: ' + String(e).slice(0, 500)); }
finally { try { await sr.stop(); } catch { /* ignore */ } await app.close().catch(() => undefined); fs.writeFileSync(out, lines.join('\n') + '\n'); }
