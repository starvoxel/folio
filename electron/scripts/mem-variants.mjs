// Supplementary (not a gate): where does memory go? Overview page only vs Transactions, with and without GPU process.
import { _electron as electron } from '@playwright/test';
import fs from 'node:fs';
const exe = process.argv[2];
async function run(label, args) {
  const app = await electron.launch({ executablePath: exe, args: ['--no-sandbox', ...args], env: { ...process.env, FOLIO_AUTOMATION: '1', FOLIO_DATA_DIR: '../fixtures', FOLIO_USER_DATA: '/tmp/folio-ud-mem-' + label } });
  const win = await app.firstWindow();
  await win.waitForFunction(() => window.__folio?.getState().ready);
  await win.waitForTimeout(3000);
  const m = async () => {
    const ms = await app.evaluate(({ app }) => app.getAppMetrics().map((m) => ({ pid: m.pid, t: m.type, ws: m.memory.workingSetSize })));
    let pss = 0; const parts = [];
    for (const p of ms) { const t = fs.readFileSync(`/proc/${p.pid}/smaps_rollup`, 'utf8'); const k = Number(/^Pss:\s+(\d+)/m.exec(t)[1]); pss += k; parts.push(`${p.t}:${(k/1024).toFixed(0)}`); }
    return `RSSsum=${(ms.reduce((a, b) => a + b.ws, 0) / 1024).toFixed(0)}MB PSSsum=${(pss / 1024).toFixed(0)}MB [${parts.join(' ')}] n=${ms.length}`;
  };
  console.log(label, 'overview   ', await m());
  await win.getByRole('navigation').getByRole('button', { name: 'Transactions', exact: true }).click();
  await win.waitForTimeout(3000);
  console.log(label, 'transactions', await m());
  await app.close();
}
await run('default', []);
await run('disable-gpu', ['--disable-gpu']);
