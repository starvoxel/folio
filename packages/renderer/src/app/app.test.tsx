// ------------------------------
// app.test.tsx
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

// @vitest-environment jsdom
import { fixedClock, localDate } from '@folio/core';
import { createMockHost, type MockHost } from '@folio/host-api';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { App } from './app.js';
import { AppServicesProvider } from './app-services.js';
import { createAppStore, type AppStore } from './app-state.js';

interface Rendered {
  readonly host: MockHost;
  readonly store: AppStore;
}

/**
 * Render the whole app against a mock host and wait until the settings have been read.
 * @param settings - The machine settings the mock host starts with.
 * @returns The host and the store, for assertions.
 */
async function renderApp(settings: unknown = null): Promise<Rendered> {
  const host = createMockHost({ settings });
  const store = createAppStore(fixedClock(localDate('2026-11-13')));
  render(
    <AppServicesProvider services={{ host, store, cspNonce: undefined }}>
      <App />
    </AppServicesProvider>,
  );
  await waitFor(() => {
    expect(store.getState().ready).toBe(true);
  });
  return { host, store };
}

beforeEach(() => {
  document.documentElement.removeAttribute('data-theme');
});

afterEach(() => {
  cleanup();
});

describe('App', () => {
  describe('defaultState', () => {
    it('showsTheOverviewPageWithTheShellControls', async () => {
      await renderApp();
      expect(screen.getByRole('heading', { level: 1, name: 'Overview' })).toBeDefined();
      for (const name of ['Menu', 'Undo', 'Redo', 'Import CSV', 'Month']) {
        expect(screen.getByRole(name === 'Month' ? 'combobox' : 'button', { name })).toBeDefined();
      }
      expect(screen.getByTestId('topbar-file-name').textContent).toBe('Household 2026.folio');
      expect(screen.getByTestId('topbar-save-status').textContent).toBe('Saved automatically');
    });
  });

  describe('clickingANavigationItem', () => {
    it('showsThatPage', async () => {
      const { store } = await renderApp();
      fireEvent.click(screen.getByTestId('nav-transactions'));
      expect(store.getState().page).toBe('transactions');
      expect(await screen.findByRole('heading', { level: 1, name: 'Transactions' })).toBeDefined();
    });
  });

  describe('everyNavigationItem', () => {
    it('hasAStableTestIdAndAName', async () => {
      await renderApp();
      for (const [id, name] of [
        ['overview', 'Overview'],
        ['transactions', 'Transactions'],
        ['reporting', 'Reporting'],
        ['net-worth', 'Net worth'],
        ['accounts', 'Accounts'],
        ['rules', 'Rules & categories'],
        ['settings', 'Settings'],
      ] as const) {
        expect(screen.getByTestId(`nav-${id}`).textContent).toBe(name);
      }
    });
  });

  describe('storedDarkTheme', () => {
    it('appliesItToTheRootElement', async () => {
      await renderApp({ theme: 'dark' });
      await waitFor(() => {
        expect(document.documentElement.dataset['theme']).toBe('dark');
      });
    });
  });

  describe('aMenuCommandFromTheHost', () => {
    it('showsTheSettingsPageForSettings', async () => {
      const { host, store } = await renderApp();
      host.controls.emitMenuCommand('settings');
      await waitFor(() => {
        expect(store.getState().page).toBe('settings');
      });
    });
  });
});

describe('SettingsPage', () => {
  describe('choosingTheDarkTheme', () => {
    it('appliesItAndSavesItThroughTheHost', async () => {
      const { host, store } = await renderApp();
      fireEvent.click(screen.getByTestId('nav-settings'));
      fireEvent.click(await screen.findByRole('radio', { name: 'Dark' }));
      await waitFor(() => {
        expect(store.getState().themePreference).toBe('dark');
        expect(host.controls.settings).toEqual({ theme: 'dark' });
      });
    });
  });

  describe('resetWithConfirmation', () => {
    it('opensADialogThatConfirmingResetsTheTheme', async () => {
      const { store } = await renderApp({ theme: 'dark' });
      fireEvent.click(screen.getByTestId('nav-settings'));
      fireEvent.click(await screen.findByTestId('settings-reset'));
      const dialog = await screen.findByRole('dialog', { name: 'Reset settings?' });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Reset' }));
      await waitFor(() => {
        expect(store.getState().themePreference).toBe('system');
        expect(screen.queryByRole('dialog')).toBeNull();
      });
    });
  });

  describe('resetThenCancel', () => {
    it('closesTheDialogAndKeepsTheTheme', async () => {
      const { store } = await renderApp({ theme: 'dark' });
      fireEvent.click(screen.getByTestId('nav-settings'));
      fireEvent.click(await screen.findByTestId('settings-reset'));
      const dialog = await screen.findByRole('dialog');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBeNull();
      });
      expect(store.getState().themePreference).toBe('dark');
    });
  });
});
