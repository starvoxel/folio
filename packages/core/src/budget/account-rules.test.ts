// ------------------------------
// account-rules.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-27
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { describe, expect, it } from 'vitest';

import { id } from '../domain/id.js';
import { localDate, yearMonth } from '../domain/local-date.js';
import type { Account, ArchivePeriod } from './account.js';
import { isIncludedInMonth } from './account-rules.js';

/**
 * @param archivePeriods - The archive periods to give the account.
 * @returns An account with them.
 */
function accountWith(...archivePeriods: ArchivePeriod[]): Account {
  return {
    id: id('11111111-1111-4111-8111-111111111111'),
    name: 'Everyday',
    type: 'chequing',
    provider: null,
    includeInAnalysis: true,
    transferTreatment: 'notApplicable',
    archivePeriods,
    startingBalance: null,
  };
}

const open = (from: string): ArchivePeriod => ({
  archivedFrom: localDate(from),
  unarchivedOn: null,
});
const closed = (from: string, until: string): ArchivePeriod => ({
  archivedFrom: localDate(from),
  unarchivedOn: localDate(until),
});

describe('isIncludedInMonth', () => {
  describe('neverArchived', () => {
    it('includesEveryMonth', () => {
      expect(isIncludedInMonth(accountWith(), yearMonth('2026-03'))).toBe(true);
    });
  });

  describe('archivedMidMonth', () => {
    it('excludesThatMonthAndAfter', () => {
      const account = accountWith(open('2026-03-15'));
      expect(isIncludedInMonth(account, yearMonth('2026-02'))).toBe(true);
      expect(isIncludedInMonth(account, yearMonth('2026-03'))).toBe(false);
      expect(isIncludedInMonth(account, yearMonth('2026-04'))).toBe(false);
    });
  });

  describe('archivedOnTheLastDay', () => {
    it('excludesThatMonth', () => {
      const account = accountWith(open('2026-03-31'));
      expect(isIncludedInMonth(account, yearMonth('2026-03'))).toBe(false);
      expect(isIncludedInMonth(account, yearMonth('2026-02'))).toBe(true);
    });
  });

  describe('archivedOnTheFirst', () => {
    it('excludesThatMonth', () => {
      expect(isIncludedInMonth(accountWith(open('2026-03-01')), yearMonth('2026-03'))).toBe(false);
    });
  });

  describe('archivedAcrossAWholeMonth', () => {
    it('excludesEveryMonthTouched', () => {
      const account = accountWith(closed('2026-02-20', '2026-04-10'));
      expect(isIncludedInMonth(account, yearMonth('2026-02'))).toBe(false);
      expect(isIncludedInMonth(account, yearMonth('2026-03'))).toBe(false);
      expect(isIncludedInMonth(account, yearMonth('2026-04'))).toBe(false);
      expect(isIncludedInMonth(account, yearMonth('2026-05'))).toBe(true);
    });
  });

  describe('unarchivedOnTheFirst', () => {
    it('includesThatMonth', () => {
      const account = accountWith(closed('2026-02-20', '2026-04-01'));
      expect(isIncludedInMonth(account, yearMonth('2026-03'))).toBe(false);
      expect(isIncludedInMonth(account, yearMonth('2026-04'))).toBe(true);
    });
  });

  describe('archivedAndRestoredInOneMonth', () => {
    it('excludesThatMonth', () => {
      const account = accountWith(closed('2026-03-10', '2026-03-20'));
      expect(isIncludedInMonth(account, yearMonth('2026-03'))).toBe(false);
      expect(isIncludedInMonth(account, yearMonth('2026-04'))).toBe(true);
    });
  });

  describe('archivedTwice', () => {
    it('excludesBothStretches', () => {
      const account = accountWith(closed('2026-02-10', '2026-03-01'), open('2026-05-05'));
      expect(isIncludedInMonth(account, yearMonth('2026-02'))).toBe(false);
      expect(isIncludedInMonth(account, yearMonth('2026-03'))).toBe(true);
      expect(isIncludedInMonth(account, yearMonth('2026-05'))).toBe(false);
    });
  });
});
