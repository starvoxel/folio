// ------------------------------
// codec-scale.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-27
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { describe, expect, it } from 'vitest';

import type { Account } from '../budget/account.js';
import { createBudget, type BudgetModel } from '../budget/model.js';
import { fixedClock } from '../domain/clock.js';
import { id } from '../domain/id.js';
import { localDate } from '../domain/local-date.js';
import { decodeFolio, encodeFolio } from './codec.js';
import { testDigest as digest } from './test-digest.js';

const ACCOUNTS = 2_000;
const TRANSACTIONS = 30_000;
// Generous: the test timeout only has to catch a codec that is quadratic, which would take minutes.
const TIMEOUT_MS = 20_000;

/**
 * @param count - How many accounts.
 * @returns A model with that many accounts.
 */
function bigModel(count: number): BudgetModel {
  const base = createBudget('Stress', fixedClock(localDate('2026-11-27')));
  const accounts: Account[] = Array.from({ length: count }, (_, index) => ({
    id: id<'Account'>(`aaaaaaaa-0000-4000-8000-${String(index).padStart(12, '0')}`),
    name: `Account ${String(index)}`,
    type: 'chequing',
    provider: null,
    includeInAnalysis: true,
    transferTreatment: 'notApplicable',
    archivePeriods: [],
  }));
  return { ...base, accounts };
}

describe('encodeFolio and decodeFolio', () => {
  describe('aLargeFile', () => {
    it(
      'roundTripsWithinTheTimeout',
      async () => {
        const model = bigModel(ACCOUNTS);
        const transactions = Array.from({ length: TRANSACTIONS }, (_, index) => ({
          n: index,
          account: index % ACCOUNTS,
          cents: index * 7,
          memo: `synthetic row ${String(index)}`,
        }));
        const bytes = await encodeFolio(model, { digest, carried: { transactions } });
        const decoded = await decodeFolio(bytes, { digest });

        expect(decoded.ok && decoded.value.model.accounts).toHaveLength(ACCOUNTS);
        expect(decoded.ok && decoded.value.carried['transactions']).toHaveLength(TRANSACTIONS);
        expect(decoded.ok && decoded.value.damagedLines).toEqual([]);
      },
      TIMEOUT_MS,
    );
  });
});
