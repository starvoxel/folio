import { test, expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { goto, launch, memoryMB, root, settle, state } from './app';

// G2 measurements. Thresholds are the gate values from SLICE-SPEC.md; nothing here is tuned.
test.setTimeout(600_000);

interface Pass { worstFrameMs: number; framesOver100ms: number; frames: number; longTasks: number; durationMs: number }

async function scrollWholeGrid(page: import('@playwright/test').Page): Promise<Pass> {
  return page.evaluate(
    () =>
      new Promise<Pass>((resolve) => {
        const el = document.querySelector<HTMLElement>('[data-testid="grid-scroll"]')!;
        el.scrollTop = 0;
        const max = el.scrollHeight - el.clientHeight;
        const step = 600; // px per frame (about 17 rows, about 36,000 px/s at 60 Hz): a fast fling
        let longTasks = 0;
        const po = new PerformanceObserver((l) => { longTasks += l.getEntries().length; });
        try { po.observe({ entryTypes: ['longtask'] }); } catch { /* unsupported */ }
        let last = performance.now();
        const start = last;
        let worst = 0, over = 0, frames = 0;
        const tick = (now: number) => {
          const d = now - last;
          last = now;
          if (frames > 0) { worst = Math.max(worst, d); if (d > 100) over++; }
          frames++;
          if (el.scrollTop >= max) { po.disconnect(); resolve({ worstFrameMs: worst, framesOver100ms: over, frames, longTasks, durationMs: now - start }); return; }
          el.scrollTop = Math.min(max, el.scrollTop + step);
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
  );
}

test('G2: 10,000-row grid: sort every column, scroll twice, memory', async () => {
  const L = await launch();
  const { page, app } = L;
  await goto(page, 'Transactions');
  expect((await state(page)).transactions!.totalRows).toBe(10000);

  await page.waitForTimeout(2000);
  const idle = await memoryMB(app);

  // Sort every column, both directions. Timed in the page: click -> React commit -> two paints.
  const sorts: Record<string, number[]> = {};
  for (const col of ['date', 'description', 'account', 'category', 'amount']) {
    sorts[col] = [];
    for (let i = 0; i < 3; i++) {
      const ms = await page.evaluate(async (c) => {
        const btn = document.querySelector<HTMLButtonElement>(`.head-btn[data-col="${c}"]`)!;
        const t = performance.now();
        btn.click();
        await window.__folio!.settled();
        return performance.now() - t;
      }, col);
      sorts[col]!.push(ms);
    }
  }
  const sortState = (await state(page)).transactions!.sort;

  // Reset sort to date asc for scrolling, then scroll the whole grid twice.
  await page.evaluate(() => document.querySelector<HTMLButtonElement>('.head-btn[data-col="date"]')!.click());
  await settle(page);
  const pass1 = await scrollWholeGrid(page);
  await page.waitForTimeout(3000);
  const mem1 = await memoryMB(app);
  const pass2 = await scrollWholeGrid(page);
  await page.waitForTimeout(3000);
  const mem2 = await memoryMB(app);

  // Selection after a long scroll must not freeze the UI.
  const selMs = await page.evaluate(async () => {
    const row = document.querySelectorAll<HTMLElement>('.grid-row')[5]!;
    const t = performance.now();
    row.click();
    await window.__folio!.settled();
    return performance.now() - t;
  });
  const sel = (await state(page)).transactions!;
  expect(sel.selected).not.toBeNull();
  expect(sel.detailsPanel.text).toContain(sel.selected!.description);

  const worstSort = Object.fromEntries(Object.entries(sorts).map(([k, v]) => [k, Math.max(...v)]));
  const result = {
    platform: process.platform,
    coldStartMs: L.coldStartMs,
    idleMemory: idle,
    afterScroll1: mem1,
    afterScroll2: mem2,
    pass1, pass2,
    sortMsAll: sorts,
    sortMsWorstPerColumn: worstSort,
    lastSortState: sortState,
    selectionMs: selMs,
    renderedRowsAfter: sel.renderedRows,
  };
  fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });
  fs.writeFileSync(path.join(root, 'test-results', `perf-${process.platform}.json`), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));

  await app.close();
  expect(await L.exited).toBe(0);

  // Gate checks (reported honestly; a failure here is a gate failure, not something to tune away).
  expect.soft(Math.max(pass1.worstFrameMs, pass2.worstFrameMs), 'worst frame while scrolling < 100 ms').toBeLessThan(100);
  expect.soft(mem2.workingSetMB, 'total app memory after scrolling < 400 MB (sum of working sets, all processes)').toBeLessThan(400);
  expect.soft(mem2.workingSetMB - mem1.workingSetMB, 'no sustained growth between scroll 1 and scroll 2 (< 20 MB)').toBeLessThan(20);
  for (const [col, ms] of Object.entries(worstSort)) expect.soft(ms, `sort ${col} < 500 ms`).toBeLessThan(500);
});
