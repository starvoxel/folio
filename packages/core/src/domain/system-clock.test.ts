// ------------------------------
// system-clock.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { systemClock } from './system-clock.js';

describe('systemClock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('lateInTheLocalDay', () => {
    it('reportsTheLocalCalendarDate', () => {
      // Built from local parts, so the expectation holds in every time zone.
      vi.setSystemTime(new Date(2026, 10, 13, 23, 59, 30));
      expect(systemClock().today()).toBe('2026-11-13');
    });
  });

  describe('theFirstSecondOfAYear', () => {
    it('reportsThatYear', () => {
      vi.setSystemTime(new Date(2027, 0, 1, 0, 0, 1));
      expect(systemClock().today()).toBe('2027-01-01');
    });
  });

  describe('anInstant', () => {
    it('reportsTheEpochMilliseconds', () => {
      vi.setSystemTime(1_700_000_000_000);
      expect(systemClock().nowEpochMs()).toBe(1_700_000_000_000);
    });
  });
});
