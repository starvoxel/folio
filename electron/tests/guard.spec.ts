import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { exePath, fixtures } from './app';

// The shipped binary must not accept remote-debugging switches unless FOLIO_AUTOMATION=1.
test('release binary refuses --remote-debugging-pipe without FOLIO_AUTOMATION', async () => {
  const env = { ...process.env, FOLIO_DATA_DIR: fixtures } as Record<string, string>;
  delete env.FOLIO_AUTOMATION;
  const args = ['--remote-debugging-pipe', ...(process.platform === 'linux' ? ['--no-sandbox'] : [])];
  const p = spawn(exePath(), args, { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'], env });
  let err = '';
  p.stderr!.on('data', (d: Buffer) => { err += d.toString(); });
  const code = await new Promise<number | null>((res) => { const t = setTimeout(() => { p.kill(); res(-1); }, 20000); p.once('exit', (c) => { clearTimeout(t); res(c); }); });
  expect(code, err).toBe(2);
  expect(err).toContain('FOLIO_AUTOMATION');
});
