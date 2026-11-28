// ------------------------------
// account.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-27
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { describe, expect, it } from 'vitest';

import {
  ACCOUNT_TYPES,
  accountDefaults,
  enteredBalance,
  isArchived,
  isLiability,
  storedBalance,
  type Account,
} from './account.js';
import { money } from '../domain/money.js';
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
  startingBalance: null,
};

describe('accountDefaults', () => {
  describe('everyTypeWithADefault', () => {
    it('hasNoTreatmentWhenIncludedAndOneWhenExcluded', () => {
      for (const type of ACCOUNT_TYPES) {
        const defaults = accountDefaults(type);
        if (defaults !== null) {
          expect(defaults.transferTreatment === 'notApplicable').toBe(defaults.includeInAnalysis);
        }
      }
    });
  });

  describe('theOtherType', () => {
    it('hasNoDefaultSoItIsAskedAtAddTime', () => {
      expect(ACCOUNT_TYPES.filter((type) => accountDefaults(type) === null)).toEqual(['other']);
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

describe('isLiability', () => {
  describe('everyType', () => {
    it('isTrueOnlyForCreditCardsAndMortgages', () => {
      expect(ACCOUNT_TYPES.filter((type) => isLiability(type))).toEqual(['creditCard', 'mortgage']);
    });
  });
});

describe('storedBalance', () => {
  describe('anAssetType', () => {
    it('keepsTheSign', () => {
      expect(storedBalance('chequing', money(5_00))).toBe(5_00);
      expect(storedBalance('tfsa', money(-5_00))).toBe(-5_00);
    });
  });

  describe('aLiabilityType', () => {
    it('flipsTheSignAndEnteredBalanceFlipsItBack', () => {
      expect(storedBalance('creditCard', money(5_00))).toBe(-5_00);
      expect(enteredBalance('creditCard', money(-5_00))).toBe(5_00);
      expect(storedBalance('mortgage', money(0))).toBe(0);
    });
  });
});
