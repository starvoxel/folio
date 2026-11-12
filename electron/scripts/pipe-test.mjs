import { spawn } from 'node:child_process';
const exe = process.argv[2];
const p = spawn(exe, ['--no-sandbox', '--remote-debugging-pipe', '--data-dir=/home/user/folio/fixtures'], { stdio: ['ignore', 'pipe', 'pipe', 'pipe', 'pipe'], env: { ...process.env, FOLIO_AUTOMATION: '1', FOLIO_USER_DATA: '/tmp/folio-pipe-ud' } });
let buf = ''; const pending = new Map(); let id = 0;
p.stdio[4].on('data', (d) => { buf += d.toString(); let i; while ((i = buf.indexOf('\0')) >= 0) { const m = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1); if (m.id && pending.has(m.id)) pending.get(m.id)(m); else if (m.method) console.log('event', m.method); } });
const send = (method, params = {}, sessionId) => new Promise((res) => { const i = ++id; pending.set(i, res); p.stdio[3].write(JSON.stringify({ id: i, method, params, sessionId }) + '\0'); });
p.stderr.on('data', (d) => { const s = d.toString(); if (/DevTools|pipe/i.test(s)) console.log('stderr:', s.slice(0, 200)); });
await new Promise((r) => setTimeout(r, 4000));
const t = await Promise.race([send('Target.getTargets'), new Promise((r) => setTimeout(() => r({ timeout: true }), 5000))]);
console.log('targets:', JSON.stringify(t).slice(0, 400));
if (t.result) {
  const page = t.result.targetInfos.find((x) => x.type === 'page');
  const a = await send('Target.attachToTarget', { targetId: page.targetId, flatten: true });
  const sid = a.result.sessionId;
  const ev = await send('Runtime.evaluate', { expression: 'JSON.stringify(window.__folio && window.__folio.getState().page)', returnByValue: true }, sid);
  console.log('evaluate:', JSON.stringify(ev.result?.result?.value ?? ev));
  const shot = await send('Page.captureScreenshot', { format: 'png' }, sid);
  console.log('screenshot bytes (b64):', shot.result?.data?.length);
}
p.kill();
