// ------------------------------
// launch-app.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { spawn, type ChildProcess } from 'node:child_process';

import { chromium, type Browser, type Page } from '@playwright/test';
import { WebSocketServer, type WebSocket } from 'ws';

import { platformLaunchArguments, type PackagedApp } from './app-path.js';
import '../../support/window-types.js';

/** A running packaged app and the handles to drive it. */
export interface LaunchedApp {
  readonly page: Page;
  /** Everything the app wrote to its standard error stream so far. */
  stderr(): string;
  /** The page's console errors and uncaught exceptions so far. */
  pageProblems(): readonly string[];
  /** Resolves with the exit code when the process ends. */
  readonly exited: Promise<number | null>;
  /** Close the app: ask it to quit, then make sure the process is gone. */
  shutDown(): Promise<number | null>;
}

/** Options of `launchApp`. */
export interface LaunchOptions {
  /** The app-data folder; every launch of a test uses its own, so runs never share settings. */
  readonly userDataDirectory: string;
}

const WAIT_FOR_PAGE_MS = 30_000;
const WAIT_FOR_EXIT_MS = 20_000;

/**
 * Start the packaged app with Chromium's debugging pipe (AD-16) and attach Playwright to it.
 * The app listens on no port: it writes protocol messages to file descriptor 4 and reads them
 * from 3, and this test process relays them to a loopback socket that only it owns, because
 * Playwright can only connect to an endpoint, not to a pipe.
 * @param app - The packaged app.
 * @param options - The app-data folder.
 * @returns The running app.
 */
export async function launchApp(app: PackagedApp, options: LaunchOptions): Promise<LaunchedApp> {
  const child: ChildProcess = spawn(
    app.executable,
    [
      '--remote-debugging-pipe',
      `--user-data-dir=${options.userDataDirectory}`,
      ...platformLaunchArguments(),
    ],
    {
      stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'],
      env: { ...process.env, FOLIO_AUTOMATION: '1' },
    },
  );
  let stderrText = '';
  child.stderr?.on('data', (chunk: Buffer) => {
    stderrText += chunk.toString('utf8');
  });
  const exited = new Promise<number | null>((resolve) => {
    child.once('exit', (code) => {
      resolve(code);
    });
  });

  const toBrowser = child.stdio[3] as NodeJS.WritableStream;
  const fromBrowser = child.stdio[4] as NodeJS.ReadableStream;
  const relay = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  await new Promise<void>((resolve) => {
    relay.once('listening', () => {
      resolve();
    });
  });
  const address = relay.address();
  if (address === null || typeof address === 'string') {
    throw new Error('The relay has no TCP address');
  }
  let client: WebSocket | null = null;
  let buffered = '';
  fromBrowser.on('data', (chunk: Buffer) => {
    buffered += chunk.toString('utf8');
    for (let end = buffered.indexOf('\0'); end >= 0; end = buffered.indexOf('\0')) {
      client?.send(buffered.slice(0, end));
      buffered = buffered.slice(end + 1);
    }
  });
  relay.on('connection', (socket) => {
    client = socket;
    socket.on('message', (message) => {
      toBrowser.write(`${Buffer.from(message as Buffer).toString('utf8')}\0`);
    });
  });

  const browser: Browser = await chromium.connectOverCDP(`ws://127.0.0.1:${String(address.port)}`, {
    timeout: WAIT_FOR_PAGE_MS,
  });
  const deadline = Date.now() + WAIT_FOR_PAGE_MS;
  let page: Page | undefined;
  while (page === undefined && Date.now() < deadline) {
    page = browser
      .contexts()
      .flatMap((context) => context.pages())
      .find((candidate) => candidate.url().startsWith('folio://'));
    if (page === undefined) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  if (page === undefined) {
    child.kill();
    throw new Error(`No app page appeared over the debugging pipe. stderr: ${stderrText}`);
  }

  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      problems.push(`console error: ${message.text()}`);
    }
  });
  await page.waitForFunction(() => window.__folio?.getState().ready === true);

  return {
    page,
    stderr: () => stderrText,
    pageProblems: () => problems,
    exited,
    shutDown: async () => {
      // Quit through the host, the way the app's own quit command does.
      await Promise.race([
        page.evaluate(() => window.folioHost?.quit()).catch(() => undefined),
        new Promise((resolve) => setTimeout(resolve, 5_000)),
      ]);
      const code = await Promise.race([
        exited,
        new Promise<'timeout'>((resolve) =>
          setTimeout(() => {
            resolve('timeout');
          }, WAIT_FOR_EXIT_MS),
        ),
      ]);
      relay.close();
      if (code === 'timeout') {
        child.kill();
        return exited;
      }
      return code;
    },
  };
}
