import { _electron as electron } from '@playwright/test';
const out = process.argv[2];
const app = await electron.launch({ args: ['.', '--no-sandbox'], env: { ...process.env, FOLIO_AUTOMATION: '1', FOLIO_DATA_DIR: '../fixtures', FOLIO_USER_DATA: '/tmp/folio-ud' } });
const win = await app.firstWindow();
win.on('console', (m) => console.log('console', m.type(), m.text().slice(0, 300)));
win.on('pageerror', (e) => console.log('pageerror', e.message));
await win.waitForFunction(() => window.__folio?.getState().ready, null, { timeout: 20000 });
for (const p of ['overview', 'transactions', 'reporting', 'settings']) {
  await win.evaluate((p) => { window.__folio.navigate(p); return window.__folio.settled(); }, p);
  await win.screenshot({ path: `${out}/${p}.png` });
  console.log(JSON.stringify(await win.evaluate(() => window.__folio.getState())).slice(0, 600));
}
console.log('blocked', await app.evaluate(() => globalThis.__folioBlocked));
await app.close();
