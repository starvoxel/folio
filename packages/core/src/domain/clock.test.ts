// ------------------------------
// clock.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { describe, expect, it } from 'vitest';

import { currentMonth, fixedClock } from './clock.js';
import { localDate } from './local-date.js';

describe('fixedClock', () => {
  describe('aDate', () => {
    it('alwaysReportsThatDate', () => {
      const clock = fixedClock(localDate('2026-11-13'));
      expect(clock.today()).toBe('2026-11-13');
      expect(clock.today()).toBe('2026-11-13');
    });
  });

  describe('noInstantGiven', () => {
    it('reportsTheEpoch', () => {
      expect(fixedClock(localDate('2026-11-13')).nowEpochMs()).toBe(0);
    });
  });

  describe('anInstantGiven', () => {
    it('reportsThatInstant', () => {
      expect(fixedClock(localDate('2026-11-13'), 1_700_000_000_000).nowEpochMs()).toBe(
        1_700_000_000_000,
      );
    });
  });
});

describe('currentMonth', () => {
  describe('aClockInNovember', () => {
    it('returnsNovember', () => {
      expect(currentMonth(fixedClock(localDate('2026-11-30')))).toBe('2026-11');
    });
  });
});
