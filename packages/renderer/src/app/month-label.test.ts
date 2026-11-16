// ------------------------------
// month-label.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { yearMonth } from '@folio/core';
import { describe, expect, it } from 'vitest';

import { formatMonthLabel, recentMonths } from './month-label.js';

describe('formatMonthLabel', () => {
  describe('aMonth', () => {
    it('returnsTheNameAndYear', () => {
      expect(formatMonthLabel(yearMonth('2026-11'))).toBe('November 2026');
      expect(formatMonthLabel(yearMonth('2027-01'))).toBe('January 2027');
    });
  });
});

describe('recentMonths', () => {
  describe('threeMonthsAcrossAYearEnd', () => {
    it('listsThemNewestFirst', () => {
      expect(recentMonths(yearMonth('2027-01'), 3)).toEqual(['2027-01', '2026-12', '2026-11']);
    });
  });

  describe('zeroMonths', () => {
    it('returnsAnEmptyList', () => {
      expect(recentMonths(yearMonth('2027-01'), 0)).toEqual([]);
    });
  });
});
