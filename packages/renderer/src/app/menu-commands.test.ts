// ------------------------------
// menu-commands.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { fixedClock, localDate } from '@folio/core';
import { describe, expect, it } from 'vitest';

import { createAppStore } from './app-state.js';
import { handleMenuCommand, MENU_ENTRIES } from './menu-commands.js';

const clock = fixedClock(localDate('2026-11-13'));

describe('handleMenuCommand', () => {
  describe('settings', () => {
    it('showsTheSettingsPage', () => {
      const store = createAppStore(clock);
      handleMenuCommand(store, 'settings');
      expect(store.getState().page).toBe('settings');
    });
  });

  describe('aCommandWithoutAFeatureYet', () => {
    it('leavesTheStateAlone', () => {
      const store = createAppStore(clock);
      const before = store.getState();
      handleMenuCommand(store, 'importCsv');
      expect(store.getState()).toBe(before);
    });
  });
});

describe('MENU_ENTRIES', () => {
  describe('defaultState', () => {
    it('followsTheHamburgerMenuOfTheRequirements', () => {
      expect(MENU_ENTRIES.map((entry) => entry.label)).toEqual([
        'New',
        'Open',
        'Save',
        'Close file',
        'Undo',
        'Redo',
        'Import CSV',
        'Settings',
        'About',
      ]);
    });
  });
});
