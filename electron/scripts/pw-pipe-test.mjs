import { chromium } from '@playwright/test';
const exe = process.argv[2];
const browser = await chromium.launch({ executablePath: exe, ignoreDefaultArgs: true, args: ['--remote-debugging-pipe', '--no-sandbox', '--data-dir=/home/user/folio/fixtures'], env: { ...process.env, FOLIO_AUTOMATION: '1', FOLIO_USER_DATA: '/tmp/folio-pw-pipe' }, timeout: 30000, handleSIGINT: false });
await new Promise((r) => setTimeout(r, 3000));
const ctx = browser.contexts();
console.log('contexts', ctx.length, 'pages', ctx.map((c) => c.pages().map((p) => p.url())));
const page = ctx[0]?.pages()[0];
if (page) {
  await page.waitForFunction(() => window.__folio?.getState().ready);
  console.log('state page:', await page.evaluate(() => window.__folio.getState().page));
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Transactions', exact: true }).click();
  console.log('after click:', await page.evaluate(() => window.__folio.getState().page));
  await page.screenshot({ path: '/tmp/pw-pipe.png' });
  console.log('screenshot ok');
}
await browser.close().catch((e) => console.log('close err', String(e).slice(0, 100)));
