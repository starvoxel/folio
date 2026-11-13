// ------------------------------
// app.tsx
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { useEffect, type ReactElement } from 'react';

import { applySettings, chooseMonth, navigateTo } from './app-state.js';
import { useAppServices } from './app-services.js';
import { handleMenuCommand, MENU_ENTRIES } from './menu-commands.js';
import { formatMonthLabel, recentMonths } from './month-label.js';
import { FOOTER_PAGES, isPageId, NAVIGATION_PAGES, type PageDefinition } from './pages.js';
import { testIds } from './test-ids.js';
import { useAppState } from './use-app-state.js';
import { readMachineSettings, parseYearMonth } from '@folio/core';
import { PageRouter } from '../screens/page-router.js';
import {
  AppNavigation,
  AppRoot,
  AppShell,
  TopBar,
  type AppNavigationItem,
} from '../ui/fluent/index.js';

const MONTHS_SHOWN = 12;

/**
 * The whole app: loads the machine settings, listens for menu commands from the host, and draws
 * the shell with the current page.
 * @returns The app element.
 */
export function App(): ReactElement {
  const { host, store, cspNonce } = useAppServices();
  const state = useAppState(store);

  useEffect(() => {
    let active = true;
    const load = async (): Promise<void> => {
      let raw: unknown = null;
      try {
        raw = await host.readSettings();
      } catch {
        // Unreadable settings are the same as none: start with the defaults.
      }
      if (active) {
        store.setState((current) => applySettings(current, readMachineSettings(raw)));
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [host, store]);

  useEffect(
    () =>
      host.onMenuCommand((command) => {
        handleMenuCommand(store, command);
      }),
    [host, store],
  );

  const months = recentMonths(state.month, MONTHS_SHOWN).map((month) => ({
    value: month,
    label: formatMonthLabel(month),
  }));
  const toItem = (page: PageDefinition): AppNavigationItem => ({
    value: page.id,
    label: page.title,
    icon: page.icon,
    testId: testIds.nav(page.id),
  });

  return (
    <AppRoot themePreference={state.themePreference} cspNonce={cspNonce}>
      <AppShell
        navigation={
          <AppNavigation
            title="Folio"
            label="Main navigation"
            items={NAVIGATION_PAGES.map(toItem)}
            footerItems={FOOTER_PAGES.map(toItem)}
            selected={state.page}
            onSelect={(value) => {
              if (isPageId(value)) {
                store.setState((current) => navigateTo(current, value));
              }
            }}
          />
        }
        topBar={
          <TopBar
            fileName={state.fileName}
            statusText={state.hasUnsavedChanges ? 'Unsaved changes' : 'Saved automatically'}
            fileNameTestId={testIds.topBar.fileName}
            statusTestId={testIds.topBar.saveStatus}
            menuLabel="Menu"
            menuTestId={testIds.topBar.menu}
            menuItems={MENU_ENTRIES.map((entry) => ({
              id: entry.command,
              label: entry.label,
              testId: testIds.topBar.menuItem(entry.command),
              onSelect: () => {
                handleMenuCommand(store, entry.command);
              },
            }))}
            commands={[
              // Placeholders: they do nothing until the features behind them are built.
              {
                id: 'undo',
                label: 'Undo',
                icon: 'undo',
                testId: testIds.topBar.undo,
                onClick: noop,
              },
              {
                id: 'redo',
                label: 'Redo',
                icon: 'redo',
                testId: testIds.topBar.redo,
                onClick: noop,
              },
              {
                id: 'import',
                label: 'Import CSV',
                icon: 'import',
                testId: testIds.topBar.importCsv,
                onClick: noop,
              },
            ]}
            monthLabel="Month"
            monthTestId={testIds.topBar.month}
            months={months}
            selectedMonth={state.month}
            onMonthChange={(value) => {
              const parsed = parseYearMonth(value);
              if (parsed.ok) {
                store.setState((current) => chooseMonth(current, parsed.value));
              }
            }}
          />
        }
      >
        <PageRouter page={state.page} />
      </AppShell>
    </AppRoot>
  );
}

/** Does nothing; stands in for commands whose features are not built. */
function noop(): void {
  // Intentionally empty.
}
