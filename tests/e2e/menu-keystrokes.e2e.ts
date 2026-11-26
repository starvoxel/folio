// ------------------------------
// menu-keystrokes.e2e.ts
//
// Author: Starvoxel AI Agent - 2026-11-26
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { expect, test } from '@playwright/test';

import { findPackagedApp } from './support/app-path.js';
import { launchApp, type LaunchedApp } from './support/launch-app.js';

const run = promisify(execFile);

/**
 * A one-off experiment, run by the `macos-menu-keystrokes` workflow: does a macOS runner let a
 * script press real keys with `osascript`, so the menu's shortcuts can be checked? Delete this
 * file and that workflow once the result is recorded.
 */
test.describe('menuKeystrokes', () => {
  let userDataDirectory = '';
  let running: LaunchedApp | undefined;

  test.beforeEach(async () => {
    test.skip(
      process.platform !== 'darwin' || process.env['FOLIO_MENU_KEYSTROKES'] !== '1',
      'A one-off macOS experiment, run only by its workflow',
    );
    userDataDirectory = await mkdtemp(join(tmpdir(), 'folio-keys-'));
  });

  test.afterEach(async () => {
    await running?.shutDown();
    running = undefined;
    await rm(userDataDirectory, { recursive: true, force: true });
  });

  test.describe('realKeystrokesSentThroughSystemEvents', () => {
    test('triggerTheMenuShortcuts', async () => {
      running = await launchApp(findPackagedApp(), { userDataDirectory });
      const { page, pid } = running;
      await page.evaluate(() => {
        const received: string[] = [];
        (window as unknown as { __menuCommands: string[] }).__menuCommands = received;
        window.folioHost?.onMenuCommand((command) => received.push(command));
      });
      const script = (lines: string[]): string[] => lines.flatMap((line) => ['-e', line]);
      await run(
        'osascript',
        script([
          'tell application "System Events"',
          `set frontmost of (first process whose unix id is ${String(pid)}) to true`,
          'end tell',
        ]),
      );
      const keys: [string, string, string][] = [
        ['s', 'command down', 'save'],
        ['z', 'command down', 'undo'],
        ['z', '{command down, shift down}', 'redo'],
        [',', 'command down', 'settings'],
      ];
      for (const [key, modifier, command] of keys) {
        await run(
          'osascript',
          script([
            'tell application "System Events"',
            `keystroke "${key}" using ${modifier}`,
            'end tell',
          ]),
        );
        await expect
          .poll(() =>
            page.evaluate(() => (window as unknown as { __menuCommands: string[] }).__menuCommands),
          )
          .toContain(command);
      }
    });
  });
});
