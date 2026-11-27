// ------------------------------
// account.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-27
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { describe, expect, it } from 'vitest';

import { ACCOUNT_TYPES, accountDefaults, isArchived, type Account } from './account.js';
import { id } from '../domain/id.js';
import { localDate } from '../domain/local-date.js';

const base: Account = {
  id: id('11111111-1111-4111-8111-111111111111'),
  name: 'Everyday',
  type: 'chequing',
  provider: null,
  includeInAnalysis: true,
  transferTreatment: 'notApplicable',
  archivePeriods: [],
};

describe('accountDefaults', () => {
  describe('everyType', () => {
    it('followsS14', () => {
      expect(
        Object.fromEntries(ACCOUNT_TYPES.map((type) => [type, accountDefaults(type)])),
      ).toEqual({
        chequing: { includeInAnalysis: true, transferTreatment: 'notApplicable' },
        savings: { includeInAnalysis: true, transferTreatment: 'notApplicable' },
        creditCard: { includeInAnalysis: true, transferTreatment: 'notApplicable' },
        rrsp: { includeInAnalysis: false, transferTreatment: 'savings' },
        tfsa: { includeInAnalysis: false, transferTreatment: 'savings' },
        resp: { includeInAnalysis: false, transferTreatment: 'savings' },
        otherInvestment: { includeInAnalysis: false, transferTreatment: 'savings' },
        mortgage: { includeInAnalysis: false, transferTreatment: 'spending' },
        other: null,
      });
    });
  });
});

describe('isArchived', () => {
  describe('noPeriods', () => {
    it('returnsFalse', () => {
      expect(isArchived(base)).toBe(false);
    });
  });

  describe('openPeriod', () => {
    it('returnsTrue', () => {
      const account = {
        ...base,
        archivePeriods: [{ archivedFrom: localDate('2026-03-10'), unarchivedOn: null }],
      };
      expect(isArchived(account)).toBe(true);
    });
  });

  describe('closedPeriod', () => {
    it('returnsFalse', () => {
      const account = {
        ...base,
        archivePeriods: [
          { archivedFrom: localDate('2026-03-10'), unarchivedOn: localDate('2026-05-01') },
        ],
      };
      expect(isArchived(account)).toBe(false);
    });
  });
});
