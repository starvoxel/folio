// Drive the exact release binary (inspect fuse OFF) without Playwright's Electron mode.
// The app is started with Chromium's own --remote-debugging-pipe (fds 3 and 4), which needs no app code and no network port.
// Playwright cannot speak a pipe to an existing browser, so this test-only bridge relays the pipe to a loopback WebSocket owned by
// the test process (not by the app) and Playwright attaches with connectOverCDP. The app itself never listens on anything.
import { chromium } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { WebSocketServer } from 'ws';
import type { WebSocket } from 'ws';

export interface PipeApp { browser: Browser; page: Page; proc: ChildProcess; exited: Promise<number | null>; close(): Promise<void> }

export async function launchViaPipe(exe: string, args: string[], env: Record<string, string>): Promise<PipeApp> {
  const proc = spawn(exe, ['--remote-debugging-pipe', ...args], { stdio: ['ignore', 'ignore', 'inherit', 'pipe', 'pipe'], env });
  const exited = new Promise<number | null>((res) => proc.once('exit', (code) => res(code)));
  const toBrowser = proc.stdio[3] as NodeJS.WritableStream;
  const fromBrowser = proc.stdio[4] as NodeJS.ReadableStream;
  const wss = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  await new Promise<void>((r) => wss.once('listening', () => r()));
  const port = (wss.address() as { port: number }).port;
  let client: WebSocket | null = null;
  let buf = '';
  fromBrowser.on('data', (d: Buffer) => {
    buf += d.toString('utf8');
    let i: number;
    while ((i = buf.indexOf('\0')) >= 0) { const msg = buf.slice(0, i); buf = buf.slice(i + 1); client?.send(msg); }
  });
  wss.on('connection', (ws) => {
    client = ws;
    ws.on('message', (m) => toBrowser.write(m.toString() + '\0'));
  });
  // Playwright asks /json/version first; answer it from the same server.
  wss.on('headers', () => undefined);
  const browser = await chromium.connectOverCDP(`ws://127.0.0.1:${port}`, { timeout: 30000 });
  const deadline = Date.now() + 30000;
  let page: Page | undefined;
  while (!page && Date.now() < deadline) {
    page = browser.contexts().flatMap((c) => c.pages()).find((p) => p.url().startsWith('folio://'));
    if (!page) await new Promise((r) => setTimeout(r, 200));
  }
  if (!page) throw new Error('no app page found over the pipe');
  return {
    browser, page, proc, exited,
    async close() {
      // Close the window the way a user would; the app quits when its last window closes.
      await Promise.race([page!.evaluate(() => window.close()).catch(() => undefined), new Promise((r) => setTimeout(r, 5000))]);
      await Promise.race([exited, new Promise((r) => setTimeout(r, 15000))]);
      wss.close();
      if (proc.exitCode === null) proc.kill('SIGTERM');
    },
  };
}
