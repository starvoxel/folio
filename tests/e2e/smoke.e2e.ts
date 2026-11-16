// ------------------------------
// smoke.e2e.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import { findPackagedApp } from './support/app-path.js';
import { launchApp, type LaunchedApp } from './support/launch-app.js';

const PAGES = [
  ['overview', 'Overview'],
  ['transactions', 'Transactions'],
  ['reporting', 'Reporting'],
  ['net-worth', 'Net worth'],
  ['accounts', 'Accounts'],
  ['rules', 'Rules & categories'],
  ['settings', 'Settings'],
] as const;

/**
 * Read the log lines the app wrote to standard error that are warnings or errors. Chromium's own
 * noise (D-Bus messages on Linux, for one) is not JSON and is ignored.
 * @param stderr - Everything the app wrote to standard error.
 * @returns The warning and error lines from the app's logger.
 */
function appWarnings(stderr: string): string[] {
  return stderr
    .split('\n')
    .filter((line) => line.startsWith('{'))
    .filter((line) => /"level":"(warn|error)"/u.test(line));
}

test.describe('packagedApp', () => {
  let userDataDirectory = '';
  let running: LaunchedApp | undefined;

  test.beforeEach(async () => {
    userDataDirectory = await mkdtemp(join(tmpdir(), 'folio-e2e-'));
  });

  test.afterEach(async () => {
    await running?.shutDown();
    running = undefined;
    await rm(userDataDirectory, { recursive: true, force: true });
  });

  test.describe('everyPage', () => {
    test('opensShowsEachPageAndExitsCleanly', async () => {
      const testInfo = test.info();
      running = await launchApp(findPackagedApp(), { userDataDirectory });
      const { page } = running;

      for (const [id, title] of PAGES) {
        await page.getByTestId(`nav-${id}`).click();
        await page.evaluate(() => window.__folio?.settled());
        const state = await page.evaluate(() => window.__folio?.getState());
        expect(state).toMatchObject({ ready: true, page: id, title });
        await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
        await page.screenshot({ path: testInfo.outputPath(`${process.platform}-${id}.png`) });
      }

      expect(running.pageProblems()).toEqual([]);
      expect(await running.shutDown()).toBe(0);
      expect(appWarnings(running.stderr())).toEqual([]);
      running = undefined;
    });
  });

  test.describe('resetDialog', () => {
    test('movesFocusInsideAndClosesOnEscape', async () => {
      running = await launchApp(findPackagedApp(), { userDataDirectory });
      const { page } = running;
      await page.getByTestId('nav-settings').click();
      await page.getByTestId('settings-reset').click();
      await expect(page.getByRole('dialog', { name: 'Reset settings?' })).toBeVisible();
      await page.evaluate(() => window.__folio?.settled());
      const open = await page.evaluate(() => window.__folio?.getState());
      expect(open?.dialog).toEqual({ open: true, title: 'Reset settings?', focusInside: true });

      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
      const closed = await page.evaluate(() => window.__folio?.getState());
      expect(closed?.dialog.open).toBe(false);
    });
  });

  test.describe('themeChosenOnSettings', () => {
    test('survivesARestartThroughTheSettingsFile', async () => {
      running = await launchApp(findPackagedApp(), { userDataDirectory });
      await running.page.getByTestId('nav-settings').click();
      await running.page.getByRole('radio', { name: 'Dark' }).check();
      await running.page.evaluate(() => window.__folio?.settled());
      expect(await running.shutDown()).toBe(0);

      running = await launchApp(findPackagedApp(), { userDataDirectory });
      const state = await running.page.evaluate(() => window.__folio?.getState());
      expect(state?.theme).toEqual({ preference: 'dark', effective: 'dark' });
    });
  });

  test.describe('hardenedRenderer', () => {
    test('hasNoNodeAccessAndRefusesNavigationPopupsAndPermissions', async () => {
      running = await launchApp(findPackagedApp(), { userDataDirectory });
      const { page } = running;

      const globals = await page.evaluate(() => ({
        require: typeof (window as unknown as Record<string, unknown>)['require'],
        process: typeof (window as unknown as Record<string, unknown>)['process'],
        buffer: typeof (window as unknown as Record<string, unknown>)['Buffer'],
      }));
      expect(globals).toEqual({ require: 'undefined', process: 'undefined', buffer: 'undefined' });

      const popup = await page.evaluate(() => window.open('https://example.com/') === null);
      expect(popup).toBe(true);

      await page.evaluate(() => {
        window.location.href = 'https://example.com/';
      });
      await page.waitForTimeout(500);
      expect(page.url()).toMatch(/^folio:\/\/app\//u);

      const permission = await page.evaluate(
        () =>
          new Promise<string>((resolve) => {
            navigator.geolocation.getCurrentPosition(
              () => {
                resolve('granted');
              },
              (error) => {
                resolve(`denied:${String(error.code)}`);
              },
            );
          }),
      );
      expect(permission).toBe('denied:1');
    });
  });

  test.describe('contentSecurityPolicy', () => {
    test('arrivesWithEveryPageLoadWithAFreshNonce', async () => {
      running = await launchApp(findPackagedApp(), { userDataDirectory });
      const { page } = running;
      const first = await page.reload();
      const second = await page.reload();
      const policies = [first, second].map(
        (response) => response?.headers()['content-security-policy'],
      );
      for (const policy of policies) {
        expect(policy).toContain("default-src 'none'");
        expect(policy).toContain("connect-src 'none'");
      }
      expect(policies[0]).not.toBe(policies[1]);
      const blocked = await page.evaluate(() =>
        fetch('https://example.com/').then(
          () => 'allowed',
          () => 'blocked',
        ),
      );
      expect(blocked).toBe('blocked');
    });
  });
});
