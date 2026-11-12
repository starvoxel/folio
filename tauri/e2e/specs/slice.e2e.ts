import * as fs from 'node:fs';
import * as path from 'node:path';
import { expect } from '@wdio/globals';
import { byLabel, chooseOption, clickAt, goto, press, resultsDir, settle, shot, state } from './helpers';

const PAGES = ['Overview', 'Transactions', 'Reporting', 'Net worth', 'Accounts', 'Rules & categories', 'Settings'];
const IDS = ['overview', 'transactions', 'reporting', 'networth', 'accounts', 'rules', 'settings'];
const t0 = Date.now();

describe('Folio slice (Tauri, WebdriverIO embedded driver)', () => {
  before(async () => {
    await browser.waitUntil(async () => browser.execute(() => window.__folio?.getState().ready === true), { timeout: 30_000 });
    const coldStartMs = Date.now() - t0;
    const ua = await browser.execute(() => navigator.userAgent);
    fs.writeFileSync(path.join(resultsDir, `webview-${process.platform}.json`), JSON.stringify({ ua, coldStartMsFromSpecStart: coldStartMs }, null, 1));
  });

  it('launch: real window, structured state', async () => {
    const s = await state();
    expect(s.ready).toBe(true);
    expect(s.shell.fileName).toBe('Household 2026.folio');
    expect(s.shell.navItems).toEqual(PAGES);
    expect(await browser.execute(() => document.visibilityState)).toBe('visible');
    expect(await browser.getTitle()).toBe('Folio');
    // browser.getWindowSize() returns 0x0 with the embedded driver; use the page's own view of the window instead.
    expect(await browser.execute(() => window.innerWidth)).toBeGreaterThan(800);
  });

  it('renderer is isolated: no node, no remote globals, no fs/shell plugin commands', async () => {
    const r = await browser.execute(() => ({
      require: typeof (window as any).require,
      process: typeof (window as any).process,
      internals: typeof (window as any).__TAURI_INTERNALS__,
    }));
    expect(r.require).toBe('undefined');
    expect(r.process).toBe('undefined');
    // A plugin command the app never granted must be refused by the capability system.
    const denied = await browser.executeAsync((done: (v: string) => void) => {
      (window as any).__TAURI_INTERNALS__.invoke('plugin:fs|read_text_file', { path: '/etc/hostname' }).then(() => done('allowed'), (e: unknown) => done(String(e)));
    });
    expect(denied).not.toBe('allowed');
    fs.writeFileSync(path.join(resultsDir, `acl-denied-${process.platform}.txt`), String(denied));
  });

  for (const [i, label] of PAGES.entries()) {
    it(`navigate to ${label}: state, screenshot`, async () => {
      await goto(label);
      const s = await state();
      expect(s.page).toBe(IDS[i]);
      expect(s.title).toBe(label);
      expect(await (await $('h1')).getText()).toBe(label);
      await shot(`${IDS[i]}-light.png`);
    });
  }

  it('transactions: all 10,000 rows, search, filters, sort, selection, details', async () => {
    await goto('Transactions');
    let s = (await state()).transactions!;
    expect(s.totalRows).toBe(10000);
    expect(s.visibleRows).toBe(10000);
    expect(s.renderedRows).toBeLessThan(80);
    await (await $$('.grid-row'))[3]!.click();
    s = (await state()).transactions!;
    expect(s.selected).not.toBeNull();
    expect(s.detailsPanel.text).toContain(s.selected!.description);
    expect(s.detailsPanel.text).toContain(s.selected!.account);
    expect(s.detailsPanel.text).toContain(s.selected!.category);

    const search = await byLabel('input', 'Search transactions');
    await search.setValue('sobeys'); await settle();
    s = (await state()).transactions!;
    expect(s.visibleRows).toBeGreaterThan(0);
    expect(s.visibleRows).toBeLessThan(10000);
    await search.clearValue();

    await chooseOption('Account filter', 'acc-visa');
    await chooseOption('Category filter', 'groceries');
    await settle();
    s = (await state()).transactions!;
    expect(s.filters).toMatchObject({ account: 'acc-visa', category: 'groceries' });
    expect(s.visibleRows).toBeGreaterThan(0);
    await chooseOption('Account filter', '');
    await chooseOption('Category filter', '');

    const head = await $('.head-btn[data-col="amount"]');
    await head.click(); await head.click(); await settle();
    s = (await state()).transactions!;
    expect(s.sort).toEqual({ col: 'amount', dir: 'asc' });
    expect(s.firstRows[0]!.amount.startsWith('-$')).toBe(true);

    await search.setValue('全球速卖通'); await settle();
    s = (await state()).transactions!;
    expect(s.visibleRows).toBeGreaterThan(0);
    await search.clearValue();
  });

  it('reporting: donut data, click-through, legend by keyboard', async () => {
    await goto('Reporting');
    const r = (await state()).reporting!;
    expect(r.donut.length).toBeGreaterThan(3);
    expect(r.bars).toHaveLength(12);
    expect(r.legend.length).toBe(r.donut.length);
    expect(r.legend.every((l) => l.tabbable)).toBe(true);
    await shot('reporting-donut-light.png');
    await browser.execute(() => (document.querySelector('select[aria-label="Report month"]') as HTMLElement).focus());
    let found = false;
    for (let i = 0; i < 40 && !found; i++) {
      await press('Tab');
      found = !!(await state()).focus.label?.includes('Show transactions');
    }
    expect(found).toBe(true); // real Tab key events moved focus onto a legend row
    await press('Enter'); await settle();
    const t = await state();
    expect(t.page).toBe('transactions');
    expect(t.transactions!.filters.category).toBe(r.donut[0]!.id);
    expect(t.transactions!.filters.month).toBe(r.month);
  });

  it('reporting: bar and legend click open filtered Transactions', async () => {
    await goto('Reporting');
    const r = (await state()).reporting!;
    await (await $$('[data-testid="legend"] button'))[1]!.click(); await settle();
    let t = await state();
    expect(t.page).toBe('transactions');
    expect(t.transactions!.filters.category).toBe(r.donut[1]!.id);

    await goto('Reporting');
    const donut = await $('[data-testid="donut"]');
    await donut.scrollIntoView();
    const box = await browser.execute(() => { const b = document.querySelector('[data-testid="donut"]')!.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
    await clickAt(box.x + box.w * 0.5 + box.w * 0.37, box.y + box.h * 0.5); await settle();
    t = await state();
    expect(t.page).toBe('transactions');
    expect(t.transactions!.filters.category).not.toBe('');

    await goto('Reporting');
    await (await $('[data-testid="bars"]')).scrollIntoView();
    const greens = await browser.execute(() =>
      [...document.querySelectorAll('[data-testid="bars"] svg path')]
        .filter((p) => (p.getAttribute('fill') ?? '').toLowerCase() === '#0f7b0f')
        .map((p) => p.getBoundingClientRect()).filter((r) => r.height > 20).sort((a, b) => a.x - b.x)
        .map((r) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 })));
    expect(greens).toHaveLength(12);
    await clickAt(greens[1]!.x, greens[1]!.y); await settle();
    t = await state();
    expect(t.page).toBe('transactions');
    expect(t.transactions!.filters.month).toBe('2026-02');
    expect(t.transactions!.visibleRows).toBeGreaterThan(0);
  });

  for (const mode of ['dark', 'light'] as const) {
    it(`theme ${mode}: charts and pages render`, async () => {
      await goto('Settings');
      await (await $(`//input[@type="radio" and @value="${mode}"]`)).click(); await settle();
      expect((await state()).theme.effective).toBe(mode);
      for (const [label, id] of [['Transactions', 'transactions'], ['Reporting', 'reporting']] as const) {
        await goto(label);
        if (id === 'transactions') await (await $$('.grid-row'))[2]!.click();
        await shot(`${id}-${mode}.png`);
      }
      const lum = await browser.execute(() => { const bg = getComputedStyle(document.querySelector('.fluent-root')!).backgroundColor; return bg.match(/\d+/g)!.slice(0, 3).map(Number).reduce((a, b) => a + b, 0) / 3; });
      expect(mode === 'dark' ? lum < 60 : lum > 200).toBe(true);
    });
  }

  it('settings dialog: focus lands inside, Tab cycles, Escape closes', async () => {
    await goto('Settings');
    await (await $('//button[contains(normalize-space(.),"Reset settings")]')).click();
    await $('[role="dialog"]').waitForExist();
    await settle();
    let s = await state();
    expect(s.dialog.open).toBe(true);
    expect(s.dialog.focusInside).toBe(true);
    await browser.executeAsync((done: () => void) => { Promise.all(document.getAnimations().map((a) => a.finished)).then(() => done()); });
    await settle();
    await shot('dialog-open.png');
    for (let i = 0; i < 6; i++) { await press('Tab'); expect((await state()).dialog.focusInside).toBe(true); }
    await press('Escape'); await settle();
    s = await state();
    expect(s.dialog.open).toBe(false);
    await browser.waitUntil(async () => (await $$('[role="dialog"]')).length === 0, { timeout: 3000 }); // exit animation
    expect((await state()).focus.label).toContain('Reset settings');
  });
});
