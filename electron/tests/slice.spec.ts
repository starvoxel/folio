import { test, expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { goto, launch, root, settle, state } from './app';
import type { Launched } from './app';

const shotDir = path.join(root, 'test-results', 'shots', process.platform);
fs.mkdirSync(shotDir, { recursive: true });

test.describe.configure({ mode: 'serial' });

let L: Launched;
test.beforeAll(async () => {
  L = await launch();
});
test.afterAll(async () => {
  // Clean exit: closing the app must end the process with code 0.
  await L.app.close();
  expect(await L.exited).toBe(0);
});

const PAGES = ['Overview', 'Transactions', 'Reporting', 'Net worth', 'Accounts', 'Rules & categories', 'Settings'];
const IDS = ['overview', 'transactions', 'reporting', 'networth', 'accounts', 'rules', 'settings'];

test('launch: real window, structured state, hardened settings', async () => {
  const s = await state(L.page);
  expect(s.ready).toBe(true);
  expect(s.shell.fileName).toBe('Household 2026.folio');
  expect(s.shell.navItems).toEqual(PAGES);
  // A real window exists (not a headless/no-window mode).
  const windows = await L.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map((w) => ({ visible: w.isVisible(), url: w.webContents.getURL() })));
  expect(windows).toHaveLength(1);
  expect(windows[0]!.visible).toBe(true);
  expect(windows[0]!.url).toBe('folio://app/');
  fs.writeFileSync(path.join(root, 'test-results', `cold-start-${process.platform}.json`), JSON.stringify({ coldStartMs: L.coldStartMs }));
});

test('renderer is isolated: no node, no electron, bridge is exactly two functions', async () => {
  const r = await L.page.evaluate(() => ({
    require: typeof (window as unknown as Record<string, unknown>)['require'],
    process: typeof (window as unknown as Record<string, unknown>)['process'],
    bridge: Object.keys(window.folio ?? {}).sort(),
  }));
  expect(r.require).toBe('undefined');
  expect(r.process).toBe('undefined');
  expect(r.bridge).toEqual(['getConfig', 'loadData']);
});

for (const [i, label] of PAGES.entries()) {
  test(`navigate to ${label}: state, screenshot`, async () => {
    await goto(L.page, label);
    const s = await state(L.page);
    expect(s.page).toBe(IDS[i]);
    expect(s.title).toBe(label);
    await expect(L.page.getByRole('heading', { level: 1, name: label })).toBeVisible();
    await L.page.screenshot({ path: path.join(shotDir, `${IDS[i]}-light.png`) });
  });
}

test('transactions: all 10,000 rows, search, filters, sort, selection, details', async () => {
  await goto(L.page, 'Transactions');
  let s = (await state(L.page)).transactions!;
  expect(s.totalRows).toBe(10000);
  expect(s.visibleRows).toBe(10000);
  expect(s.renderedRows).toBeLessThan(80); // virtualised

  // Selection fills the side panel.
  await L.page.locator('.grid-row').nth(3).click();
  s = (await state(L.page)).transactions!;
  expect(s.selected).not.toBeNull();
  expect(s.detailsPanel.text).toContain(s.selected!.description);
  expect(s.detailsPanel.text).toContain(s.selected!.account);
  expect(s.detailsPanel.text).toContain(s.selected!.category);

  // Search.
  await L.page.getByRole('textbox', { name: 'Search transactions' }).fill('sobeys');
  await settle(L.page);
  s = (await state(L.page)).transactions!;
  expect(s.visibleRows).toBeGreaterThan(0);
  expect(s.visibleRows).toBeLessThan(10000);
  await L.page.getByRole('textbox', { name: 'Search transactions' }).fill('');

  // Account and category filters.
  await L.page.getByRole('combobox', { name: 'Account filter' }).selectOption('acc-visa');
  await L.page.getByRole('combobox', { name: 'Category filter' }).selectOption('groceries');
  await settle(L.page);
  s = (await state(L.page)).transactions!;
  expect(s.filters).toMatchObject({ account: 'acc-visa', category: 'groceries' });
  expect(s.visibleRows).toBeGreaterThan(0);
  await L.page.getByRole('combobox', { name: 'Account filter' }).selectOption('');
  await L.page.getByRole('combobox', { name: 'Category filter' }).selectOption('');

  // Sorting by Amount orders the data.
  const head = L.page.locator('.head-btn[data-col="amount"]');
  await head.click();
  await head.click();
  await settle(L.page);
  s = (await state(L.page)).transactions!;
  expect(s.sort).toEqual({ col: 'amount', dir: 'asc' });
  const cents = s.firstRows.map((r) => r.amount);
  expect(cents[0]!.startsWith('-$')).toBe(true);

  // Mixed-script text survives to the DOM.
  await L.page.getByRole('textbox', { name: 'Search transactions' }).fill('全球速卖通');
  await settle(L.page);
  s = (await state(L.page)).transactions!;
  expect(s.visibleRows).toBeGreaterThan(0);
  await L.page.getByRole('textbox', { name: 'Search transactions' }).fill('');
});

test('reporting: donut data, click-through, legend by keyboard', async () => {
  await goto(L.page, 'Reporting');
  const r = (await state(L.page)).reporting!;
  expect(r.donut.length).toBeGreaterThan(3);
  expect(r.bars).toHaveLength(12);
  expect(r.legend.length).toBe(r.donut.length);
  expect(r.legend.every((l) => l.tabbable)).toBe(true);
  await L.page.screenshot({ path: path.join(shotDir, 'reporting-donut-light.png') });

  // Keyboard: focus the first legend row via Tab from the month picker, activate with Enter.
  await L.page.getByRole('combobox', { name: 'Report month' }).focus();
  for (let i = 0; i < 40; i++) {
    await L.page.keyboard.press('Tab');
    const f = (await state(L.page)).focus;
    if (f.label?.includes('Show transactions')) break;
  }
  const focus = (await state(L.page)).focus;
  expect(focus.label).toContain('Show transactions');
  await L.page.keyboard.press('Enter');
  await settle(L.page);
  const t = await state(L.page);
  expect(t.page).toBe('transactions');
  expect(t.transactions!.filters.category).toBe(r.donut[0]!.id);
  expect(t.transactions!.filters.month).toBe(r.month);
  const expectedRows = await L.page.evaluate(() => window.__folio!.getState().transactions!.visibleRows);
  expect(expectedRows).toBeGreaterThan(0);
});

test('reporting: bar and legend click open filtered Transactions', async () => {
  await goto(L.page, 'Reporting');
  const r = (await state(L.page)).reporting!;
  // Mouse click on a legend row.
  await L.page.locator('[data-testid="legend"] button').nth(1).click();
  await settle(L.page);
  let t = await state(L.page);
  expect(t.page).toBe('transactions');
  expect(t.transactions!.filters.category).toBe(r.donut[1]!.id);

  // Click a slice in the SVG donut (hit-tested by zrender at coordinates).
  await goto(L.page, 'Reporting');
  const box = (await L.page.locator('[data-testid="donut"]').boundingBox())!;
  // The first slice starts at 12 o'clock and runs clockwise: aim at 3 o'clock on the ring, inside slice 0 if it spans >25%.
  await L.page.mouse.click(box.x + box.width * 0.5 + box.width * 0.37, box.y + box.height * 0.5);
  await settle(L.page);
  t = await state(L.page);
  expect(t.page).toBe('transactions');
  expect(t.transactions!.filters.category).not.toBe('');

  // Click a bar: the month table buttons are the keyboard path; the SVG bar is the pointer path.
  await goto(L.page, 'Reporting');
  // Find the rendered SVG bars by colour (layout differs per OS/font, so no hard-coded geometry).
  const greens = await L.page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="bars"] svg path')]
      .filter((p) => (p.getAttribute('fill') ?? '').toLowerCase() === '#0f7b0f')
      .map((p) => p.getBoundingClientRect())
      .filter((r) => r.height > 20)
      .sort((a, b) => a.x - b.x)
      .map((r) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 })));
  expect(greens).toHaveLength(12);
  await L.page.mouse.click(greens[1]!.x, greens[1]!.y); // February, Money in
  await settle(L.page);
  t = await state(L.page);
  expect(t.page).toBe('transactions');
  expect(t.transactions!.filters.month).toBe('2026-02');
  expect(t.transactions!.visibleRows).toBeGreaterThan(0);
});

for (const mode of ['dark', 'light'] as const) {
  test(`theme ${mode}: charts and pages render`, async () => {
    await goto(L.page, 'Settings');
    await L.page.getByRole('radio', { name: mode === 'dark' ? 'Dark' : 'Light' }).check();
    await settle(L.page);
    expect((await state(L.page)).theme.effective).toBe(mode);
    for (const [label, id] of [['Transactions', 'transactions'], ['Reporting', 'reporting']] as const) {
      await goto(L.page, label);
      if (id === 'transactions') await L.page.locator('.grid-row').nth(2).click();
      await L.page.screenshot({ path: path.join(shotDir, `${id}-${mode}.png`) });
    }
    const bg = await L.page.evaluate(() => getComputedStyle(document.querySelector('.fluent-root')!).backgroundColor);
    expect(bg).toBe(mode === 'dark' ? 'rgb(32, 32, 32)' : 'rgb(243, 243, 243)');
  });
}

test('settings dialog: focus lands inside, Tab cycles, Escape closes', async () => {
  await goto(L.page, 'Settings');
  await L.page.getByRole('button', { name: 'Reset settings…' }).click();
  await L.page.getByRole('dialog').waitFor();
  await settle(L.page);
  let s = await state(L.page);
  expect(s.dialog.open).toBe(true);
  expect(s.dialog.focusInside).toBe(true);
  await L.page.screenshot({ path: path.join(shotDir, 'dialog-open.png') });
  // Tab cycles inside the dialog.
  for (let i = 0; i < 6; i++) {
    await L.page.keyboard.press('Tab');
    expect((await state(L.page)).dialog.focusInside).toBe(true);
  }
  await L.page.keyboard.press('Escape');
  await settle(L.page);
  s = await state(L.page);
  expect(s.dialog.open).toBe(false);
  await expect(L.page.getByRole('dialog')).toHaveCount(0);
  // Focus returns to the trigger.
  expect((await state(L.page)).focus.label).toContain('Reset settings');
});

test('network: nothing was blocked or attempted by the renderer', async () => {
  const blocked = await L.app.evaluate(() => (globalThis as unknown as { __folioBlocked: string[] }).__folioBlocked);
  expect(blocked).toEqual([]);
});
