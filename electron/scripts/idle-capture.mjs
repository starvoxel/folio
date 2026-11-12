// Drives the packaged app through every page and feature, then idles. Run inside the capture namespace
// (scripts/capture.sh). Prints a timeline so the capture can be correlated with app activity.
import { _electron as electron } from '@playwright/test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const exe = process.argv[2];
const idleS = Number(process.env.CAPTURE_IDLE_S ?? 300);
const fixtures = path.resolve(process.argv[3] ?? '../fixtures');
const ts = () => new Date().toISOString();
const log = (m) => console.log(`${ts()} ${m}`);

const app = await electron.launch({
  executablePath: exe,
  args: process.platform === 'linux' ? ['--no-sandbox'] : [],
  env: { ...process.env, FOLIO_AUTOMATION: '1', FOLIO_DATA_DIR: fixtures, FOLIO_USER_DATA: fs.mkdtempSync(path.join(os.tmpdir(), 'folio-cap-')) },
});
const page = await app.firstWindow();
await page.waitForFunction(() => window.__folio?.getState().ready);
log('LAUNCHED');
const nav = (n) => page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: n, exact: true });
for (const n of ['Overview', 'Transactions', 'Reporting', 'Net worth', 'Accounts', 'Rules & categories', 'Settings']) {
  await nav(n).click();
  await page.waitForTimeout(500);
  log(`PAGE ${n}`);
}
await nav('Transactions').click();
await page.getByRole('textbox', { name: 'Search transactions' }).fill('sobeys');
await page.getByRole('combobox', { name: 'Account filter' }).selectOption('acc-visa');
await page.locator('.head-btn[data-col="amount"]').click();
await page.locator('.grid-row').nth(2).click();
await page.waitForTimeout(500);
log('USED transactions search/filter/sort/select');
await nav('Reporting').click();
await page.locator('[data-testid="legend"] button').first().click();
await page.waitForTimeout(500);
await nav('Settings').click();
await page.getByRole('radio', { name: 'Dark' }).check();
await page.getByRole('button', { name: 'Reset settings…' }).click();
await page.getByRole('dialog').waitFor();
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
log('USED reporting click-through, theme, dialog');
log(`IDLE START ${idleS}s`);
await page.waitForTimeout(idleS * 1000);
log('IDLE END');
const blocked = await app.evaluate(() => globalThis.__folioBlocked);
log(`BLOCKED_REQUESTS ${JSON.stringify(blocked)}`);
await app.close();
log('CLOSED');
