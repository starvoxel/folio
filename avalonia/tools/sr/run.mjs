// Real screen reader against the Avalonia slice. Same scenario as the Electron slice's scripts/sr/run.mjs:
// focus the grid, ArrowDown x3, End, then open the Settings dialog, Tab, Escape. Output is the raw spoken-phrase log.
// usage: node run.mjs <app exe> <cli exe> <data dir> <out.txt> [app args...]
import { spawn, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const [exe, cli, data, out, ...appArgs] = process.argv.slice(2);
const lines = [];
const log = (s) => { lines.push(s); console.log(s); };
const g = await import('@guidepup/guidepup');
const sr = process.platform === 'win32' ? g.nvda : g.voiceOver;
const name = process.platform === 'win32' ? 'NVDA' : 'VoiceOver';
const disc = path.resolve(path.dirname(out), 'discovery.json');
try { fs.unlinkSync(disc); } catch {}
const env = { ...process.env, FOLIO_DISCOVERY: disc };
const C = (...a) => spawnSync(cli, a, { env, encoding: 'utf8' }).stdout;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const app = spawn(exe, ['--data', data, '--automation', '--discovery', disc, '--size', '1440x900', ...appArgs], { env, stdio: 'ignore' });
try {
  C('wait-ready');
  await sleep(3000);
  await sr.start();
  log(`${name} started (app args: ${appArgs.join(' ')})`);
  const say = async (label, action) => { const before = (await sr.spokenPhraseLog()).length; await action(); await sleep(1500); const all = await sr.spokenPhraseLog(); log(`--- ${label}\n${all.slice(before).map((p) => '  > ' + p).join('\n') || '  (nothing announced)'}`); };
  await say('go to Transactions (through the automation endpoint)', async () => C('navigate', 'Transactions'));
  await say('focus the table (window activated, table focused)', async () => C('invoke', '{"action":"focusTable"}'));
  try { await say('report current focus (NVDA+Tab style command)', () => sr.perform(sr.keyboardCommands.reportCurrentFocus)); } catch (e) { log('report-focus command unavailable: ' + String(e).slice(0, 200)); }
  for (let i = 1; i <= 4; i++) await say(`ArrowDown ${i} (real key through the screen reader)`, () => sr.press('ArrowDown'));
  await say('End key', () => sr.press('End'));
  await say('go to Settings and open the dialog', async () => { C('navigate', 'Settings'); await sleep(800); C('invoke', '{"action":"openDialog"}'); });
  await say('Tab inside the dialog', () => sr.press('Tab'));
  await say('Escape', () => sr.press('Escape'));
} catch (e) { log('ERROR: ' + String(e).slice(0, 600)); }
finally {
  try { await sr.stop(); } catch { /* ignore */ }
  C('quit'); await sleep(1000); try { app.kill(); } catch {}
  fs.writeFileSync(out, lines.join('\n') + '\n');
}
