import { _electron as electron } from '@playwright/test';
const app = await electron.launch({ executablePath: process.argv[2], args: ['--no-sandbox'], env: { ...process.env, FOLIO_AUTOMATION: '1', FOLIO_DATA_DIR: '../fixtures', FOLIO_USER_DATA: '/tmp/folio-ud3' } });
const win = await app.firstWindow();
await win.waitForFunction(() => window.__folio?.getState().ready);
console.log(await win.locator('body').ariaSnapshot());
await win.getByText('Transactions', {exact:true}).first().click();
await win.waitForTimeout(500);
console.log((await win.locator('body').ariaSnapshot()).split('\n').slice(0,40).join('\n'));
await app.close();
