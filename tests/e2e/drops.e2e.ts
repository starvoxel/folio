// ------------------------------
// drops.e2e.ts
//
// Author: Starvoxel AI Agent - 2026-11-26
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { findPackagedApp } from './support/app-path.js';
import { launchApp, type LaunchedApp } from './support/launch-app.js';

/**
 * Drop real files on the window through Chromium's drag protocol, which makes trusted events with
 * real file paths, the way the operating system does.
 * @param page - The app page.
 * @param paths - The files to drop.
 */
async function dropFiles(page: Page, paths: string[]): Promise<void> {
  const session = await page.context().newCDPSession(page);
  const data = { items: [], files: paths, dragOperationsMask: 1 };
  for (const type of ['dragEnter', 'dragOver', 'drop'] as const) {
    await session.send('Input.dispatchDragEvent', { type, x: 400, y: 300, data });
  }
}

test.describe('packagedAppDrops', () => {
  let folder = '';
  let userDataDirectory = '';
  let running: LaunchedApp | undefined;

  test.beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), 'folio-drops-'));
    userDataDirectory = await mkdtemp(join(tmpdir(), 'folio-drops-data-'));
  });

  test.afterEach(async () => {
    await running?.shutDown();
    running = undefined;
    await rm(folder, { recursive: true, force: true });
    await rm(userDataDirectory, { recursive: true, force: true });
  });

  test.describe('aCsvAndATextFileDropped', () => {
    test('reachesTheHostWithTheRealPathOfTheCsvOnly', async () => {
      const statement = join(folder, 'Statement March.csv');
      const notes = join(folder, 'notes.txt');
      await writeFile(statement, 'Date,Amount\n');
      await writeFile(notes, 'not a statement');
      running = await launchApp(findPackagedApp(), { userDataDirectory });
      const { page } = running;
      await page.evaluate(() => {
        const received: { path: string; name: string }[][] = [];
        (window as unknown as { __drops: typeof received }).__drops = received;
        window.folioHost?.onFilesDropped((files) => received.push([...files]));
      });

      await dropFiles(page, [statement, notes]);

      await expect
        .poll(() =>
          page.evaluate(() => (window as unknown as { __drops: unknown[] }).__drops.length),
        )
        .toBe(1);
      const drops = await page.evaluate(() => (window as unknown as { __drops: unknown }).__drops);
      expect(drops).toEqual([[{ path: statement, name: 'Statement March.csv' }]]);

      // The dropped path is now one the person chose, so the host will read it.
      const read = await page.evaluate(async (path) => {
        const contents = await window.folioHost?.readFile({ path, name: 'x' });
        return contents === undefined ? null : Array.from(contents.bytes);
      }, statement);
      expect(read).toEqual(Array.from(new TextEncoder().encode('Date,Amount\n')));

      // The page itself did not navigate away from the app.
      expect(page.url().startsWith('folio://')).toBe(true);
    });
  });

  test.describe('aTextFileDroppedAlone', () => {
    test('isIgnoredAndNotGranted', async () => {
      const notes = join(folder, 'notes.txt');
      await writeFile(notes, 'not a statement');
      running = await launchApp(findPackagedApp(), { userDataDirectory });
      const { page } = running;
      await page.evaluate(() => {
        (window as unknown as { __drops: unknown[] }).__drops = [];
        window.folioHost?.onFilesDropped((files) =>
          (window as unknown as { __drops: unknown[] }).__drops.push(files),
        );
      });
      await dropFiles(page, [notes]);
      await page.waitForTimeout(500);
      expect(
        await page.evaluate(() => (window as unknown as { __drops: unknown[] }).__drops.length),
      ).toBe(0);
      const code = await page.evaluate(async (path) => {
        try {
          await window.folioHost?.readFile({ path, name: 'notes.txt' });
          return 'allowed';
        } catch (error) {
          return (error as Error).message.split(' ')[0];
        }
      }, notes);
      expect(code).toBe('[permissionDenied]');
    });
  });
});
