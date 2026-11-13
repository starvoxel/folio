// ------------------------------
// renderer.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { Browser, Page } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { findUnnamedControls } from './support/accessibility.js';
import { launchBrowser } from './support/browser.js';
import { buildMockApp } from './support/build-mock-app.js';
import { serveDirectory, type StaticServer } from './support/static-server.js';
import './support/window-types.js';

const PAGES = [
  ['overview', 'Overview'],
  ['transactions', 'Transactions'],
  ['reporting', 'Reporting'],
  ['net-worth', 'Net worth'],
  ['accounts', 'Accounts'],
  ['rules', 'Rules & categories'],
  ['settings', 'Settings'],
] as const;

const screenshotDirectory = join(import.meta.dirname, '..', '..', 'test-results', 'screenshots');

let workDirectory = '';
let server: StaticServer;
let browser: Browser;

interface OpenedApp {
  readonly page: Page;
  readonly problems: string[];
  close(): Promise<void>;
}

/**
 * Open the built app in a fresh browser context.
 * @param colorScheme - The system colour scheme the context reports.
 * @returns The page, the console problems seen so far, and a way to close it.
 */
async function openApp(colorScheme: 'light' | 'dark'): Promise<OpenedApp> {
  const context = await browser.newContext({ colorScheme, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      problems.push(`${message.type()}: ${message.text()}`);
    }
  });
  await page.goto(server.url);
  await page.waitForFunction(() => window.__folio?.getState().ready === true);
  return { page, problems, close: () => context.close() };
}

/**
 * Wait until React and the browser have settled after an interaction.
 * @param page - The page.
 */
async function settle(page: Page): Promise<void> {
  await page.evaluate(() => window.__folio?.settled());
}

beforeAll(async () => {
  workDirectory = await mkdtemp(join(tmpdir(), 'folio-integration-'));
  const outDirectory = join(workDirectory, 'app');
  await buildMockApp(outDirectory);
  server = await serveDirectory(outDirectory);
  browser = await launchBrowser();
  await mkdir(screenshotDirectory, { recursive: true });
});

afterAll(async () => {
  await browser.close();
  await server.close();
  await rm(workDirectory, { recursive: true, force: true });
});

describe('builtRenderer', () => {
  describe('lightTheme', () => {
    it('visitsEveryPageAndShowsItsHeading', async () => {
      const app = await openApp('light');
      try {
        for (const [id, title] of PAGES) {
          await app.page.getByTestId(`nav-${id}`).click();
          await settle(app.page);
          const state = await app.page.evaluate(() => window.__folio?.getState());
          expect(state).toMatchObject({ ready: true, page: id, title });
          expect(state?.theme.effective).toBe('light');
          expect(
            await app.page.getByTestId(`nav-${id}`).getAttribute('aria-current'),
            `selected navigation item on ${id}`,
          ).toBe('page');
          await app.page.getByRole('heading', { level: 1, name: title }).waitFor();
          await app.page.getByTestId(`page-${id}`).waitFor();
          await app.page.mouse.move(900, 700);
          await app.page.waitForTimeout(250);
          await app.page.screenshot({ path: join(screenshotDirectory, `light-${id}.png`) });
        }
        expect(app.problems).toEqual([]);
      } finally {
        await app.close();
      }
    });
  });

  describe('darkTheme', () => {
    it('visitsEveryPageWithADarkBackground', async () => {
      const app = await openApp('dark');
      try {
        for (const [id, title] of PAGES) {
          await app.page.getByTestId(`nav-${id}`).click();
          await settle(app.page);
          const state = await app.page.evaluate(() => window.__folio?.getState());
          expect(state).toMatchObject({ page: id, title });
          expect(state?.theme.effective).toBe('dark');
          await app.page.mouse.move(900, 700);
          await app.page.waitForTimeout(250);
          await app.page.screenshot({ path: join(screenshotDirectory, `dark-${id}.png`) });
        }
        const background = await app.page.evaluate(
          () =>
            getComputedStyle(document.querySelector('.fui-FluentProvider') ?? document.body)
              .backgroundColor,
        );
        const [red = 255, green = 255, blue = 255] = (background.match(/\d+/gu) ?? []).map(Number);
        expect((red + green + blue) / 3).toBeLessThan(64);
        expect(app.problems).toEqual([]);
      } finally {
        await app.close();
      }
    });
  });

  describe('lightThemeBackground', () => {
    it('isLight', async () => {
      const app = await openApp('light');
      try {
        const background = await app.page.evaluate(
          () =>
            getComputedStyle(document.querySelector('.fui-FluentProvider') ?? document.body)
              .backgroundColor,
        );
        const [red = 0, green = 0, blue = 0] = (background.match(/\d+/gu) ?? []).map(Number);
        expect((red + green + blue) / 3).toBeGreaterThan(200);
      } finally {
        await app.close();
      }
    });
  });

  describe('everyInteractiveControl', () => {
    it('hasAnAccessibleNameOnEveryPage', async () => {
      const app = await openApp('light');
      try {
        for (const [id] of PAGES) {
          await app.page.getByTestId(`nav-${id}`).click();
          await settle(app.page);
          expect(await findUnnamedControls(app.page), `page ${id}`).toEqual([]);
        }
      } finally {
        await app.close();
      }
    });

    it('hasAnAccessibleNameInTheOpenMenuAndMonthPicker', async () => {
      const app = await openApp('light');
      try {
        await app.page.getByTestId('topbar-menu').click();
        await app.page.getByRole('menuitem', { name: 'Import CSV' }).waitFor();
        expect(await findUnnamedControls(app.page), 'menu').toEqual([]);
        await app.page.keyboard.press('Escape');
        await app.page.getByRole('combobox', { name: 'Month' }).click();
        await app.page.getByRole('option', { name: 'November 2026' }).waitFor();
        expect(await findUnnamedControls(app.page), 'month picker').toEqual([]);
      } finally {
        await app.close();
      }
    });
  });

  describe('themeChoiceOnSettings', () => {
    it('overridesTheSystemThemeAndSurvivesNavigation', async () => {
      const app = await openApp('light');
      try {
        await app.page.getByTestId('nav-settings').click();
        await app.page.getByRole('radio', { name: 'Dark' }).check();
        await settle(app.page);
        let state = await app.page.evaluate(() => window.__folio?.getState());
        expect(state?.theme).toEqual({ preference: 'dark', effective: 'dark' });
        await app.page.getByTestId('nav-overview').click();
        await settle(app.page);
        state = await app.page.evaluate(() => window.__folio?.getState());
        expect(state?.theme.effective).toBe('dark');
      } finally {
        await app.close();
      }
    });
  });

  describe('resetDialog', () => {
    it('movesFocusInsideAndClosesOnEscape', async () => {
      const app = await openApp('light');
      try {
        await app.page.getByTestId('nav-settings').click();
        await app.page.getByTestId('settings-reset').click();
        await app.page.getByRole('dialog', { name: 'Reset settings?' }).waitFor();
        await settle(app.page);
        let state = await app.page.evaluate(() => window.__folio?.getState());
        expect(state?.dialog).toEqual({ open: true, title: 'Reset settings?', focusInside: true });
        await app.page.keyboard.press('Escape');
        await app.page.getByRole('dialog').waitFor({ state: 'detached' });
        state = await app.page.evaluate(() => window.__folio?.getState());
        expect(state?.dialog.open).toBe(false);
      } finally {
        await app.close();
      }
    });
  });

  describe('hostMenuCommand', () => {
    it('isHandledByTheRenderer', async () => {
      const app = await openApp('light');
      try {
        await app.page.getByTestId('topbar-menu').click();
        await app.page.getByTestId('topbar-menu-settings').click();
        await settle(app.page);
        const state = await app.page.evaluate(() => window.__folio?.getState());
        expect(state?.page).toBe('settings');
      } finally {
        await app.close();
      }
    });
  });
});
