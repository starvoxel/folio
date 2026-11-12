import { _electron as electron } from '@playwright/test';
const exe = process.argv[2];
const t = Date.now();
try {
  const app = await electron.launch({ executablePath: exe, args: ['--no-sandbox'], timeout: 20000, env: { ...process.env, FOLIO_AUTOMATION: '1', FOLIO_DATA_DIR: '../fixtures', FOLIO_USER_DATA: '/tmp/folio-ud2' } });
  const win = await app.firstWindow();
  await win.waitForFunction(() => window.__folio?.getState().ready, null, { timeout: 20000 });
  console.log('ATTACHED ok in', Date.now() - t, 'ms', JSON.stringify((await win.evaluate(() => window.__folio.getState())).page));
  await app.close();
} catch (e) { console.log('FAILED', String(e).slice(0, 600)); }
