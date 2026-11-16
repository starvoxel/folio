// ------------------------------
// automation.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

// @vitest-environment jsdom
import { fixedClock, localDate } from '@folio/core';
import { afterEach, describe, expect, it } from 'vitest';

import { initialAppState, createAppStore } from './app-state.js';
import { buildSnapshot, installAutomation } from './automation.js';

const clock = fixedClock(localDate('2026-11-13'));

afterEach(() => {
  document.body.innerHTML = '';
  delete document.documentElement.dataset['theme'];
});

describe('buildSnapshot', () => {
  describe('noDialogAndNothingFocused', () => {
    it('describesTheShellAndAClosedDialog', () => {
      const snapshot = buildSnapshot(initialAppState(clock), document);
      expect(snapshot).toMatchObject({
        ready: false,
        page: 'overview',
        title: 'Overview',
        theme: { preference: 'system', effective: 'light' },
        shell: { fileName: 'Household 2026.folio', unsaved: false },
        dialog: { open: false, title: null, focusInside: false },
      });
      expect(snapshot.shell.navItems).toEqual([
        'Overview',
        'Transactions',
        'Reporting',
        'Net worth',
        'Accounts',
        'Rules & categories',
        'Settings',
      ]);
    });
  });

  describe('aDarkRootElement', () => {
    it('reportsTheDarkEffectiveTheme', () => {
      document.documentElement.dataset['theme'] = 'dark';
      expect(buildSnapshot(initialAppState(clock), document).theme.effective).toBe('dark');
    });
  });

  describe('anOpenDialogWithFocusInside', () => {
    it('reportsItsTitleAndTheFocus', () => {
      document.body.innerHTML = `
        <div role="dialog" aria-labelledby="t"><h2 id="t">Reset settings?</h2>
        <button aria-label="Cancel">x</button></div>`;
      document.querySelector('button')?.focus();
      const snapshot = buildSnapshot(initialAppState(clock), document);
      expect(snapshot.dialog).toEqual({ open: true, title: 'Reset settings?', focusInside: true });
      expect(snapshot.focus).toEqual({ tag: 'button', role: null, label: 'Cancel' });
    });
  });

  describe('anOpenDialogWithFocusOutside', () => {
    it('reportsFocusNotInside', () => {
      document.body.innerHTML = `<button id="o">Outside</button><div role="dialog"></div>`;
      document.getElementById('o')?.focus();
      expect(buildSnapshot(initialAppState(clock), document).dialog.focusInside).toBe(false);
    });
  });
});

describe('installAutomation', () => {
  describe('aStore', () => {
    it('putsAWorkingHookOnTheWindow', async () => {
      const store = createAppStore(clock);
      installAutomation(window, store);
      const hook = window.__folio;
      expect(hook).toBeDefined();
      hook?.navigate('accounts');
      expect(hook?.getState().page).toBe('accounts');
      await expect(hook?.settled()).resolves.toBeUndefined();
    });
  });
});
