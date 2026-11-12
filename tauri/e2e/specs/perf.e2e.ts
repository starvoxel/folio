// G2 (frames, sorts, memory after two scrolls) and F1 (memory at P0..P5). Same scenario as the Electron slice's perf.spec.ts and mem-points.mjs.
// Memory is measured by scripts/memtree.mjs on the whole app including the OS web view processes (app-only and all reported separately).
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { goto, resultsDir, settle, state } from './helpers';

const memtree = path.resolve(process.cwd(), '..', 'scripts', 'memtree.mjs');
const exeName = process.platform === 'win32' ? 'folio.exe' : 'folio';
const SOAK = Number(process.env.MEM_SOAK ?? 20);
const IDLE_MS = Number(process.env.MEM_IDLE_S ?? 60) * 1000;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function rootPid(): number {
  return Number(execFileSync('node', [memtree, 'find', exeName], { encoding: 'utf8' }).trim());
}
function mem(pid: number) {
  const args = [memtree, 'measure', String(pid)];
  if (process.env.FOLIO_WEBKIT_BASELINE) args.push(process.env.FOLIO_WEBKIT_BASELINE);
  return JSON.parse(execFileSync('node', args, { encoding: 'utf8', maxBuffer: 1 << 26 }));
}

interface Pass { worstFrameMs: number; framesOver100ms: number; frames: number; longTasks: number; durationMs: number }
const scrollWholeGrid = (): Promise<Pass> =>
  browser.executeAsync((done: (p: Pass) => void) => {
    const el = document.querySelector<HTMLElement>('[data-testid="grid-scroll"]')!;
    el.scrollTop = 0;
    const max = el.scrollHeight - el.clientHeight;
    let longTasks = 0;
    const po = new PerformanceObserver((l) => { longTasks += l.getEntries().length; });
    try { po.observe({ entryTypes: ['longtask'] }); } catch { /* unsupported (WebKit) */ }
    let last = performance.now();
    const start = last;
    let worst = 0, over = 0, frames = 0;
    const tick = (now: number) => {
      const d = now - last;
      last = now;
      if (frames > 0) { worst = Math.max(worst, d); if (d > 100) over++; }
      frames++;
      if (el.scrollTop >= max) { po.disconnect(); done({ worstFrameMs: worst, framesOver100ms: over, frames, longTasks, durationMs: now - start }); return; }
      el.scrollTop = Math.min(max, el.scrollTop + 600);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }) as Promise<Pass>;

describe('perf and memory', () => {
  it('G2 + F1', async function () {
    this.timeout(900_000);
    await browser.waitUntil(async () => browser.execute(() => window.__folio?.getState().ready === true), { timeout: 60_000 });
    const pid = rootPid();
    const out: Record<string, unknown> = { platform: process.platform, pid, ua: await browser.execute(() => navigator.userAgent) };
    const points: Record<string, unknown> = {};
    const snap = (p: string) => { points[p] = mem(pid); console.log('MEM', p, JSON.stringify(points[p])); };

    await wait(5000); snap('P0');
    await goto('Transactions'); await wait(5000); snap('P1');

    // Sort every column (G2). Timed in the page: click -> React commit -> two paints.
    const sorts: Record<string, number[]> = {};
    for (const col of ['date', 'description', 'account', 'category', 'amount']) {
      sorts[col] = [];
      for (let i = 0; i < 3; i++) {
        sorts[col]!.push(await browser.executeAsync((c: string, done: (ms: number) => void) => {
          const btn = document.querySelector<HTMLButtonElement>(`.head-btn[data-col="${c}"]`)!;
          const t = performance.now();
          btn.click();
          window.__folio!.settled().then(() => done(performance.now() - t));
        }, col) as number);
      }
    }
    await browser.execute(() => document.querySelector<HTMLButtonElement>('.head-btn[data-col="date"]')!.click());
    await settle();
    out.sortMsWorstPerColumn = Object.fromEntries(Object.entries(sorts).map(([k, v]) => [k, Math.max(...v)]));

    const pass1 = await scrollWholeGrid(); await wait(3000); snap('P2');
    const pass2 = await scrollWholeGrid(); await wait(3000); snap('P3');
    const pass3 = await scrollWholeGrid(); await wait(IDLE_MS); snap('P4');
    out.passes = [pass1, pass2, pass3];

    // Selection after a long scroll must not freeze the UI.
    out.selectionMs = await browser.executeAsync((done: (ms: number) => void) => {
      const row = document.querySelectorAll<HTMLElement>('.grid-row')[5]!;
      const t = performance.now(); row.click();
      window.__folio!.settled().then(() => done(performance.now() - t));
    });

    const cols = ['amount', 'description', 'date', 'category', 'account'];
    const cats = ['groceries', 'dining', 'housing', 'transport', 'shopping'];
    const setCat = (v: string) => browser.execute((val: string) => {
      const el = document.querySelector('select[aria-label="Category filter"]') as HTMLSelectElement;
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(el, val);
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, v);
    const soakFrames: number[] = [];
    for (let i = 0; i < SOAK; i++) {
      await browser.execute((c: string) => document.querySelector<HTMLButtonElement>(`.head-btn[data-col="${c}"]`)!.click(), cols[i % cols.length]!);
      await setCat(cats[i % cats.length]!); await wait(150);
      await setCat(''); await wait(150);
      soakFrames.push((await scrollWholeGrid()).worstFrameMs);
    }
    await wait(IDLE_MS); snap('P5');
    out.soakWorstFrameMs = Math.max(...soakFrames);
    out.points = points;
    out.rowsAfterSoak = (await state()).transactions!.visibleRows;
    fs.writeFileSync(path.join(resultsDir, `perf-${process.platform}${process.env.FOLIO_PERF_SUFFIX ?? ''}.json`), JSON.stringify(out, null, 2));
  });
});
