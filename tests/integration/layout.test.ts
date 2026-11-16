// ------------------------------
// layout.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-16
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { FORM_FACTORS, type FormFactor } from '@folio/host-api';
import { devices, type Browser, type BrowserContextOptions, type Page } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { launchBrowser } from './support/browser.js';
import { buildMockApp } from './support/build-mock-app.js';
import { serveDirectory, type StaticServer } from './support/static-server.js';
import '../support/window-types.js';

type WidthClassName = 'compact' | 'medium' | 'regular' | 'wide' | 'ultrawide';

/** What a cell of the matrix must show. */
interface Expectation {
  readonly navigation: 'leftPane' | 'drawer';
  /** The widest the content column gets, or null for the full width. */
  readonly maxWidth: number | null;
  /** Which registry entry the layout comes from. */
  readonly source: string;
}

/**
 * The layout each width class must get. Today only the desktop profile has registry entries and
 * every other profile falls back to it, so one table serves all four. A profile that gets its own
 * entries (AD-21) gets its own table here.
 */
const DESKTOP_EXPECTATIONS: Readonly<Record<WidthClassName, Expectation>> = {
  compact: { navigation: 'drawer', maxWidth: null, source: 'desktop/compact' },
  medium: { navigation: 'drawer', maxWidth: null, source: 'desktop/compact' },
  regular: { navigation: 'leftPane', maxWidth: 1240, source: 'desktop/regular' },
  wide: { navigation: 'leftPane', maxWidth: 1440, source: 'desktop/wide' },
  ultrawide: { navigation: 'leftPane', maxWidth: 1440, source: 'desktop/wide' },
};
const EXPECTATIONS: Readonly<Record<FormFactor, Readonly<Record<WidthClassName, Expectation>>>> = {
  desktop: DESKTOP_EXPECTATIONS,
  web: DESKTOP_EXPECTATIONS,
  tablet: DESKTOP_EXPECTATIONS,
  phone: DESKTOP_EXPECTATIONS,
};

/** A representative window for each width class. */
const SIZES: readonly (readonly [WidthClassName, number, number])[] = [
  ['compact', 420, 800],
  ['medium', 750, 700],
  ['regular', 1440, 900],
  ['wide', 1920, 1080],
  ['ultrawide', 3440, 1440],
];

/** Window shapes that stress the layout beyond the representative sizes (desktop profile). */
const SHAPES: readonly (readonly [string, WidthClassName, number, number])[] = [
  ['minimumWindow', 'regular', 900, 600],
  ['tallAndNarrow', 'regular', 1000, 1600],
  ['superUltrawide32to9', 'ultrawide', 5120, 1440],
];

/** Real device descriptors, which also carry the touch and mobile settings. */
const DEVICES: readonly (readonly [FormFactor, string, WidthClassName])[] = [
  ['tablet', 'Galaxy Tab S4', 'medium'],
  ['tablet', 'Galaxy Tab S4 landscape', 'regular'],
  ['phone', 'Pixel 7', 'compact'],
  ['phone', 'Pixel 7 landscape', 'medium'],
];

const TOUCH_PROFILES: readonly FormFactor[] = ['tablet', 'phone'];
const MINIMUM_TOUCH_TARGET = 44;
const MINIMUM_POINTER_TARGET = 32;

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
 * Open the built app as a profile, with the host reporting touch or pointer input.
 * @param profile - The form-factor profile the mock host reports.
 * @param contextOptions - The viewport or device emulation.
 * @returns The page, the console problems seen so far, and a way to close it.
 */
async function openApp(
  profile: FormFactor,
  contextOptions: BrowserContextOptions,
): Promise<OpenedApp> {
  const context = await browser.newContext({ colorScheme: 'light', ...contextOptions });
  const page = await context.newPage();
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      problems.push(`${message.type()}: ${message.text()}`);
    }
  });
  const touch = TOUCH_PROFILES.includes(profile);
  await page.goto(`${server.url}?profile=${profile}${touch ? '&input=touch' : ''}`);
  await page.waitForFunction(() => window.__folio?.getState().ready === true);
  await page.getByTestId('layout-root').waitFor();
  return { page, problems, close: () => context.close() };
}

/**
 * Wait until React and the browser have settled after an interaction.
 * @param page - The page.
 */
async function settle(page: Page): Promise<void> {
  await page.evaluate(() => window.__folio?.settled());
}

/**
 * Read an attribute of an element by test id.
 * @param page - The page.
 * @param testId - The element's test id.
 * @param name - The attribute.
 * @returns The value, or null when the element or attribute is missing.
 */
async function attribute(page: Page, testId: string, name: string): Promise<string | null> {
  return page.getByTestId(testId).getAttribute(name);
}

/**
 * The shortest visible control height among the given selectors.
 * @param page - The page.
 * @param selector - A CSS selector for the controls.
 * @returns The smallest height in CSS pixels, or null when no control is visible.
 */
async function shortestControl(page: Page, selector: string): Promise<number | null> {
  return page.evaluate((query) => {
    // A drop-down's touch area is its bordered root, which wraps the combobox button.
    const heights = [...document.querySelectorAll(query)]
      .map((element) =>
        element.getAttribute('role') === 'combobox' && element.parentElement !== null
          ? element.parentElement.getBoundingClientRect()
          : element.getBoundingClientRect(),
      )
      .filter((box) => box.width > 0 && box.height > 0)
      .map((box) => box.height);
    return heights.length === 0 ? null : Math.min(...heights);
  }, selector);
}

/**
 * Check one cell: the layout the page chose, that nothing scrolls sideways, that the navigation
 * has the right form and works, that the content column follows its rule, and that controls meet
 * the input style's target size.
 * @param app - The opened app.
 * @param profile - The profile the host reported.
 * @param widthClass - The class the width must fall in.
 * @param label - The file name stem for the screenshots.
 */
async function checkCell(
  app: OpenedApp,
  profile: FormFactor,
  widthClass: WidthClassName,
  label: string,
): Promise<void> {
  const { page } = app;
  const expected = EXPECTATIONS[profile][widthClass];
  const touch = TOUCH_PROFILES.includes(profile);

  expect(await attribute(page, 'layout-root', 'data-form-factor')).toBe(profile);
  expect(await attribute(page, 'layout-root', 'data-width-class'), 'width class').toBe(widthClass);
  expect(await attribute(page, 'layout-root', 'data-layout-source'), 'layout source').toBe(
    expected.source,
  );
  expect(await attribute(page, 'layout-root', 'data-target-size')).toBe(
    touch ? 'large' : 'standard',
  );
  expect(await attribute(page, 'layout-root', 'data-hover-actions')).toBe(
    touch ? 'always' : 'onHover',
  );
  expect(await attribute(page, 'app-shell', 'data-navigation'), 'navigation form').toBe(
    expected.navigation,
  );

  const overflow = await page.evaluate(() => {
    const widthOverflow = (element: Element | null): number =>
      element === null ? 0 : element.scrollWidth - element.clientWidth;
    return {
      document: widthOverflow(document.documentElement),
      main: widthOverflow(document.querySelector('main')),
      topBar: widthOverflow(document.querySelector('header')),
    };
  });
  expect(overflow, 'sideways overflow in pixels').toEqual({ document: 0, main: 0, topBar: 0 });

  // The content column keeps its rule and sits in the middle of the space.
  const main = await page.locator('main').boundingBox();
  const column = await page.locator('main > div').boundingBox();
  expect(main).not.toBeNull();
  expect(column).not.toBeNull();
  if (main !== null && column !== null) {
    if (expected.maxWidth !== null) {
      expect(column.width).toBeLessThanOrEqual(expected.maxWidth + 1);
      if (main.width > expected.maxWidth + 2 * 40 + 20) {
        expect(column.width, 'a column with room reaches its maximum width').toBeGreaterThanOrEqual(
          expected.maxWidth - 1,
        );
      }
    }
    const left = column.x - main.x;
    const right = main.x + main.width - (column.x + column.width);
    expect(Math.abs(left - right), 'difference between the side gaps').toBeLessThanOrEqual(20);
  }

  // The top bar shows what the layout says and moves the rest to the overflow menu.
  const viewportWidth = await page.evaluate(() => document.documentElement.clientWidth);
  const menu = await page.getByTestId('topbar-menu').boundingBox();
  const fileName = await page.getByTestId('topbar-file-name').boundingBox();
  const month = await page.getByTestId('topbar-month').boundingBox();
  expect(menu).not.toBeNull();
  if (menu !== null && fileName !== null && month !== null) {
    if (expected.navigation === 'drawer') {
      expect(await page.getByTestId('topbar-undo').count(), 'inline commands').toBe(0);
      expect(menu.x + menu.width, 'overflow menu stays inside the window').toBeLessThanOrEqual(
        viewportWidth,
      );
      expect(menu.x, 'overflow menu comes after the file name or wraps below it').toBeGreaterThan(
        Math.min(fileName.x, 1),
      );
    } else {
      expect(await page.getByTestId('topbar-undo').isVisible(), 'inline commands').toBe(true);
      expect(menu.x, 'hamburger menu comes before the file name').toBeLessThan(fileName.x);
    }
  }

  // Touch targets belong to the input style, whatever the width.
  const minimum = touch ? MINIMUM_TOUCH_TARGET : MINIMUM_POINTER_TARGET;
  expect(
    await shortestControl(page, 'header button, header [role="combobox"]'),
    'shortest top bar control',
  ).toBeGreaterThanOrEqual(minimum);

  await page.waitForTimeout(500); // Let the navigation's slide-in animation finish.
  await page.screenshot({ path: join(screenshotDirectory, `layout-${label}.png`) });

  // The navigation has the right form and works.
  const overview = page.getByTestId('nav-overview');
  if (expected.navigation === 'leftPane') {
    await overview.waitFor();
    const box = await overview.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.x ?? 999, 'left pane item sits at the left edge').toBeLessThan(40);
    expect(await page.getByTestId('topbar-navigation').count(), 'drawer toggle').toBe(0);
    expect(
      await shortestControl(page, '[data-testid^="nav-"]'),
      'navigation items',
    ).toBeGreaterThanOrEqual(minimum);
  } else {
    expect(await overview.count(), 'a closed drawer leaves no navigation on the page').toBe(0);
    const toggle = page.getByTestId('topbar-navigation');
    expect(await toggle.getAttribute('aria-expanded')).toBe('false');
    await toggle.click();
    await overview.waitFor();
    await settle(page);
    expect(await toggle.getAttribute('aria-expanded')).toBe('true');
    expect(
      await shortestControl(page, '[data-testid^="nav-"]'),
      'drawer navigation items',
    ).toBeGreaterThanOrEqual(minimum);
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(screenshotDirectory, `layout-${label}-drawer-open.png`) });
    await page.keyboard.press('Escape');
    await overview.waitFor({ state: 'detached' });
    await settle(page);
    expect(
      await page.evaluate(() => document.activeElement?.getAttribute('data-testid')),
      'focus returns to the drawer button after Escape',
    ).toBe('topbar-navigation');
    await toggle.click();
    await page.getByTestId('nav-accounts').click();
    await overview.waitFor({ state: 'detached' });
    await settle(page);
    expect((await page.evaluate(() => window.__folio?.getState()))?.page).toBe('accounts');
  }
  expect(app.problems).toEqual([]);
}

beforeAll(async () => {
  workDirectory = await mkdtemp(join(tmpdir(), 'folio-layout-'));
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

describe('builtLayout', () => {
  for (const profile of FORM_FACTORS) {
    for (const [widthClass, width, height] of SIZES) {
      describe(`${profile}Profile${widthClass}Width${String(width)}x${String(height)}`, () => {
        it('showsTheRightNavigationWithoutScrollingSideways', async () => {
          const touch = TOUCH_PROFILES.includes(profile);
          const app = await openApp(profile, {
            viewport: { width, height },
            hasTouch: touch,
          });
          try {
            await checkCell(
              app,
              profile,
              widthClass,
              `${profile}-${widthClass}-${String(width)}x${String(height)}`,
            );
          } finally {
            await app.close();
          }
        });
      });
    }
  }

  for (const [name, widthClass, width, height] of SHAPES) {
    describe(`desktopProfile${name}Window`, () => {
      it('showsTheRightNavigationWithoutScrollingSideways', async () => {
        const app = await openApp('desktop', { viewport: { width, height } });
        try {
          await checkCell(app, 'desktop', widthClass, `desktop-shape-${name}`);
        } finally {
          await app.close();
        }
      });
    });
  }

  for (const [profile, deviceName, widthClass] of DEVICES) {
    describe(`${profile}ProfileOn${deviceName.replaceAll(' ', '')}`, () => {
      it('showsTheRightNavigationWithoutScrollingSideways', async () => {
        const device = devices[deviceName];
        expect(device, `Playwright device ${deviceName}`).toBeDefined();
        const { defaultBrowserType: _browserType, ...options } = device ?? {};
        const app = await openApp(profile, options);
        try {
          await checkCell(
            app,
            profile,
            widthClass,
            `${profile}-device-${deviceName.replaceAll(' ', '-')}`,
          );
        } finally {
          await app.close();
        }
      });
    });
  }

  describe('desktopProfileResizedAcrossEveryThreshold', () => {
    it('changesTheWidthClassAndTheNavigationFormWithoutReloading', async () => {
      const app = await openApp('desktop', { viewport: { width: 1440, height: 900 } });
      try {
        const steps: readonly (readonly [number, WidthClassName])[] = [
          [599, 'compact'],
          [600, 'medium'],
          [899, 'medium'],
          [900, 'regular'],
          [1599, 'regular'],
          [1600, 'wide'],
          [2559, 'wide'],
          [2560, 'ultrawide'],
          [1000, 'regular'],
          [450, 'compact'],
          [3440, 'ultrawide'],
        ];
        for (const [width, widthClass] of steps) {
          await app.page.setViewportSize({ width, height: 900 });
          await app.page.waitForFunction(
            (expected) =>
              document
                .querySelector('[data-testid="layout-root"]')
                ?.getAttribute('data-width-class') === expected,
            widthClass,
          );
          await settle(app.page);
          expect(
            await attribute(app.page, 'app-shell', 'data-navigation'),
            `at ${String(width)}px`,
          ).toBe(DESKTOP_EXPECTATIONS[widthClass].navigation);
          const overflow = await app.page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
          );
          expect(overflow, `sideways overflow at ${String(width)}px`).toBeLessThanOrEqual(0);
        }
        expect(app.problems).toEqual([]);
      } finally {
        await app.close();
      }
    });

    it('keepsTheSelectedPageAndClosesAnOpenDrawerWhenTheNavigationBecomesAPane', async () => {
      const app = await openApp('desktop', { viewport: { width: 500, height: 800 } });
      try {
        await app.page.getByTestId('topbar-navigation').click();
        await app.page.getByTestId('nav-transactions').click();
        await settle(app.page);
        await app.page.getByTestId('topbar-navigation').click();
        await app.page.getByTestId('nav-overview').waitFor();
        await app.page.setViewportSize({ width: 1440, height: 900 });
        await app.page.getByTestId('nav-transactions').waitFor();
        await settle(app.page);
        expect(await attribute(app.page, 'nav-transactions', 'aria-current')).toBe('page');
        expect(await app.page.getByRole('dialog').count(), 'an open drawer overlay').toBe(0);
        expect(app.problems).toEqual([]);
      } finally {
        await app.close();
      }
    });
  });
});
