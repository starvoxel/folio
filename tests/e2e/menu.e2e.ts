// ------------------------------
// menu.e2e.ts
//
// Author: Starvoxel AI Agent - 2026-11-26
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { findPackagedApp } from './support/app-path.js';
import { launchApp, type LaunchedApp } from './support/launch-app.js';

/**
 * Start recording the commands the page receives from the host.
 * @param page - The app page.
 */
async function recordMenuCommands(page: Page): Promise<void> {
  await page.evaluate(() => {
    const received: string[] = [];
    (window as unknown as { __menuCommands: string[] }).__menuCommands = received;
    window.folioHost?.onMenuCommand((command) => received.push(command));
  });
}

test.describe('nativeMenu', () => {
  let userDataDirectory = '';
  let running: LaunchedApp | undefined;

  test.beforeEach(async () => {
    test.skip(process.platform !== 'darwin', 'Only macOS has a native menu bar (H1.16)');
    userDataDirectory = await mkdtemp(join(tmpdir(), 'folio-menu-'));
  });

  test.afterEach(async () => {
    await running?.shutDown();
    running = undefined;
    await rm(userDataDirectory, { recursive: true, force: true });
  });

  test.describe('everyFolioCommandInTheMenu', () => {
    test('reachesThePageThroughTheHostWhenClicked', async () => {
      running = await launchApp(findPackagedApp(), { userDataDirectory });
      const { page } = running;
      await recordMenuCommands(page);

      const clicks: [string[], string][] = [
        [['Folio', 'About Folio'], 'about'],
        [['File', 'New'], 'new'],
        [['File', 'Open…'], 'open'],
        [['File', 'Save'], 'save'],
        [['File', 'Save As…'], 'saveAs'],
        [['File', 'Close file'], 'closeFile'],
        [['File', 'Import CSV…'], 'importCsv'],
        [['Edit', 'Undo'], 'undo'],
        [['Edit', 'Redo'], 'redo'],
        [['Folio', 'Settings…'], 'settings'],
      ];
      for (const [path] of clicks) {
        const clicked = await page.evaluate(
          (labels) => window.folioAutomation?.clickMenuItem(labels),
          path,
        );
        expect(clicked, path.join(' > ')).toBe(true);
      }
      await expect
        .poll(() =>
          page.evaluate(() => (window as unknown as { __menuCommands: string[] }).__menuCommands),
        )
        .toEqual(clicks.map(([, command]) => command));

      // Settings is the one command the page acts on so far.
      await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
    });
  });

  test.describe('theMenuBar', () => {
    test('hasTheStandardShortcutsAndQuit', async () => {
      running = await launchApp(findPackagedApp(), { userDataDirectory });
      const tree = (await running.page.evaluate(() => window.folioAutomation?.describeMenu())) as {
        label: string;
        accelerator?: string;
        children?: { label: string; accelerator?: string }[];
      }[];
      const shortcut = (menu: string, item: string): string | undefined =>
        tree.find((entry) => entry.label === menu)?.children?.find((child) => child.label === item)
          ?.accelerator;
      expect(shortcut('File', 'Save')).toBe('Cmd+S');
      expect(shortcut('Edit', 'Undo')).toBe('Cmd+Z');
      expect(shortcut('Edit', 'Redo')).toBe('Shift+Cmd+Z');
      expect(shortcut('Folio', 'Settings…')).toBe('Cmd+,');
      const roleLabels = tree
        .find((entry) => entry.label === 'Edit')
        ?.children?.map((c) => c.label);
      expect(roleLabels).toEqual(expect.arrayContaining(['Cut', 'Copy', 'Paste', 'Select All']));
      const appMenu = tree.find((entry) => entry.label === 'Folio')?.children?.map((c) => c.label);
      expect(appMenu?.some((label) => label.startsWith('Quit'))).toBe(true);
    });
  });
});
