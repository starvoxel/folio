// Keyboard reach and Chromium accessibility tree for the grid and the chart legend rows.
import { _electron as electron } from '@playwright/test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
const exe = process.argv[2]; const outDir = process.argv[3] ?? 'evidence';
fs.mkdirSync(outDir, { recursive: true });
const app = await electron.launch({ executablePath: exe, args: process.platform === 'linux' ? ['--no-sandbox'] : [], env: { ...process.env, FOLIO_AUTOMATION: '1', FOLIO_DATA_DIR: path.resolve('../fixtures'), FOLIO_USER_DATA: fs.mkdtempSync(path.join(os.tmpdir(), 'folio-a11y-')) } });
const page = await app.firstWindow();
await page.waitForFunction(() => window.__folio?.getState().ready);
const nav = (n) => page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: n, exact: true });
const describeFocus = () => page.evaluate(() => { const e = document.activeElement; return e ? `${e.tagName.toLowerCase()}${e.getAttribute('role') ? '[role=' + e.getAttribute('role') + ']' : ''} "${(e.getAttribute('aria-label') ?? e.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 50)}"` : 'none'; });
const report = {};
for (const p of ['Overview', 'Transactions', 'Reporting', 'Settings']) {
  await nav(p).click();
  await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
  // Start at the top of the document and Tab through everything.
  await page.evaluate(() => { document.body.setAttribute('tabindex', '-1'); document.body.focus(); document.body.removeAttribute('tabindex'); });
  const order = [];
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press('Tab');
    const f = await describeFocus();
    if (order.includes(f) && order.length > 3 && f === order[0]) break;
    order.push(f);
  }
  report[p] = order;
}
fs.writeFileSync(path.join(outDir, 'keyboard-tab-order.json'), JSON.stringify(report, null, 2));
// Chromium accessibility tree (CDP), the same tree platform APIs are built from.
const ctx = page.context();
const cdp = await ctx.newCDPSession(page);
await nav('Transactions').click();
await page.waitForTimeout(500);
const full = await cdp.send('Accessibility.getFullAXTree');
const interesting = full.nodes.filter((n) => ['grid', 'row', 'columnheader', 'gridcell'].includes(n.role?.value)).slice(0, 14).map((n) => ({ role: n.role.value, name: n.name?.value, props: (n.properties ?? []).map((p) => `${p.name}=${JSON.stringify(p.value.value)}`).join(' ') }));
fs.writeFileSync(path.join(outDir, 'ax-grid.json'), JSON.stringify({ totalNodes: full.nodes.length, sample: interesting }, null, 2));
fs.writeFileSync(path.join(outDir, 'aria-grid.txt'), (await page.locator('.grid').ariaSnapshot()).split('\n').slice(0, 24).join('\n'));
await nav('Reporting').click();
await page.waitForTimeout(500);
const full2 = await cdp.send('Accessibility.getFullAXTree');
const legend = full2.nodes.filter((n) => n.role?.value === 'button' && /Show transactions/.test(n.name?.value ?? '')).slice(0, 4).map((n) => ({ role: n.role.value, name: n.name.value, focusable: (n.properties ?? []).find((p) => p.name === 'focusable')?.value.value }));
const img = full2.nodes.filter((n) => ['img','image','graphics-document','SvgRoot'].includes(n.role?.value)).map((n) => ({ role: n.role.value, name: n.name?.value }));
fs.writeFileSync(path.join(outDir, 'ax-legend.json'), JSON.stringify({ legendButtons: legend, charts: img }, null, 2));
fs.writeFileSync(path.join(outDir, 'aria-reporting.txt'), (await page.locator('main').ariaSnapshot()).split('\n').slice(0, 40).join('\n'));
await app.close();
console.log(JSON.stringify(report, null, 1).slice(0, 3000));
