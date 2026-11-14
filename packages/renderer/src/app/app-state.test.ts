// ------------------------------
// app-state.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { fixedClock, localDate, yearMonth } from '@folio/core';
import { describe, expect, it } from 'vitest';

import {
  applySettings,
  chooseMonth,
  chooseTheme,
  createAppStore,
  initialAppState,
  navigateTo,
} from './app-state.js';

const clock = fixedClock(localDate('2026-11-13'));

describe('initialAppState', () => {
  describe('defaultState', () => {
    it('startsOnOverviewInTheCurrentMonthNotReady', () => {
      expect(initialAppState(clock)).toEqual({
        page: 'overview',
        themePreference: 'system',
        fileName: 'Household 2026.folio',
        hasUnsavedChanges: false,
        month: '2026-11',
        ready: false,
      });
    });
  });
});

describe('navigateTo', () => {
  describe('anotherPage', () => {
    it('changesThePage', () => {
      expect(navigateTo(initialAppState(clock), 'accounts').page).toBe('accounts');
    });
  });

  describe('theSamePage', () => {
    it('returnsTheSameState', () => {
      const state = initialAppState(clock);
      expect(navigateTo(state, 'overview')).toBe(state);
    });
  });
});

describe('chooseTheme', () => {
  describe('aNewTheme', () => {
    it('changesTheChoice', () => {
      expect(chooseTheme(initialAppState(clock), 'dark').themePreference).toBe('dark');
    });
  });

  describe('theSameTheme', () => {
    it('returnsTheSameState', () => {
      const state = initialAppState(clock);
      expect(chooseTheme(state, 'system')).toBe(state);
    });
  });
});

describe('chooseMonth', () => {
  describe('anotherMonth', () => {
    it('changesTheMonth', () => {
      expect(chooseMonth(initialAppState(clock), yearMonth('2026-09')).month).toBe('2026-09');
    });
  });

  describe('theSameMonth', () => {
    it('returnsTheSameState', () => {
      const state = initialAppState(clock);
      expect(chooseMonth(state, yearMonth('2026-11'))).toBe(state);
    });
  });
});

describe('applySettings', () => {
  describe('storedSettings', () => {
    it('appliesTheThemeAndMarksTheStateReady', () => {
      const next = applySettings(initialAppState(clock), { theme: 'dark' });
      expect(next).toMatchObject({ themePreference: 'dark', ready: true });
    });
  });
});

describe('createAppStore', () => {
  describe('defaultState', () => {
    it('holdsTheInitialState', () => {
      expect(createAppStore(clock).getState()).toEqual(initialAppState(clock));
    });
  });
});
