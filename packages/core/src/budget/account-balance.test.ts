// ------------------------------
// account-balance.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-28
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { describe, expect, it } from 'vitest';

import { fixedClock } from '../domain/clock.js';
import { id } from '../domain/id.js';
import { localDate } from '../domain/local-date.js';
import { money } from '../domain/money.js';
import { applyCommand } from '../commands/apply-command.js';
import { COMMAND_KIND, type Command } from '../commands/command.js';
import type { Account } from './account.js';
import {
  accountDetail,
  coveredThrough,
  currentBalance,
  pickableAccounts,
  snapshotAccountSettings,
  type AccountActivity,
  type KnownBalance,
  type PostedAmount,
} from './account-balance.js';
import { createBudget, type BudgetModel } from './model.js';

const accountId = id<'Account'>('aaaaaaaa-0000-4000-8000-000000000001');
const account: Account = {
  id: accountId,
  name: 'Everyday',
  type: 'chequing',
  provider: 'RBC',
  includeInAnalysis: true,
  transferTreatment: 'notApplicable',
  archivePeriods: [],
  startingBalance: null,
};
const day = localDate;
const posted = (date: string, cents: number): PostedAmount => ({
  date: day(date),
  amount: money(cents),
});
const known = (date: string, cents: number, source: KnownBalance['source']): KnownBalance => ({
  date: day(date),
  amount: money(cents),
  source,
});
const activity = (
  knownBalances: KnownBalance[],
  transactions: PostedAmount[],
): AccountActivity => ({ knownBalances, transactions });

describe('currentBalance', () => {
  describe('nothingKnown', () => {
    it('saysUnknownWithOrWithoutTransactions', () => {
      expect(currentBalance(account, activity([], []))).toEqual({ kind: 'unknown' });
      expect(currentBalance(account, activity([], [posted('2026-03-01', 500)]))).toEqual({
        kind: 'unknown',
      });
    });
  });

  describe('aKnownBalanceAndLaterTransactions', () => {
    it('addsOnlyTheTransactionsAfterItsDate', () => {
      const result = currentBalance(
        account,
        activity(
          [known('2026-03-10', 100_00, 'csv')],
          [
            posted('2026-03-09', 999),
            posted('2026-03-10', 888),
            posted('2026-03-11', -25_00),
            posted('2026-03-15', 5_00),
          ],
        ),
      );
      expect(result).toEqual({
        kind: 'known',
        amount: money(100_00 - 25_00 + 5_00),
        asOf: day('2026-03-15'),
        basedOn: 'csv',
      });
    });
  });

  describe('severalKnownBalances', () => {
    it('usesTheLatestAndPrefersTheConfirmedOneOnTheSameDate', () => {
      const result = currentBalance(
        account,
        activity(
          [
            known('2026-03-01', 1, 'csv'),
            known('2026-03-10', 200_00, 'csv'),
            known('2026-03-10', 300_00, 'confirmed'),
          ],
          [],
        ),
      );
      expect(result).toMatchObject({ amount: money(300_00), basedOn: 'confirmed' });
    });
  });

  describe('aDatedStartingBalance', () => {
    it('countsAsAKnownBalance', () => {
      const withStart: Account = {
        ...account,
        startingBalance: { amount: money(50_00), on: day('2026-02-28') },
      };
      const result = currentBalance(withStart, activity([], [posted('2026-03-02', 10_00)]));
      expect(result).toEqual({
        kind: 'known',
        amount: money(60_00),
        asOf: day('2026-03-02'),
        basedOn: 'starting',
      });
    });
  });

  describe('anUndatedStartingBalance', () => {
    it('isUsedOnlyWhileThereAreNoTransactions', () => {
      const withStart: Account = {
        ...account,
        startingBalance: { amount: money(50_00), on: null },
      };
      expect(currentBalance(withStart, activity([], []))).toEqual({
        kind: 'known',
        amount: money(50_00),
        asOf: null,
        basedOn: 'starting',
      });
      expect(currentBalance(withStart, activity([], [posted('2026-03-02', 1)]))).toEqual({
        kind: 'unknown',
      });
    });
  });
});

describe('coveredThrough', () => {
  describe('someTransactions', () => {
    it('isTheLatestDate', () => {
      expect(
        coveredThrough(
          activity([], [posted('2026-03-02', 1), posted('2026-04-01', 1), posted('2026-03-30', 1)]),
        ),
      ).toBe('2026-04-01');
    });
  });

  describe('noTransactions', () => {
    it('isNull', () => {
      expect(coveredThrough(activity([known('2026-03-01', 1, 'csv')], []))).toBeNull();
    });
  });
});

describe('accountDetail', () => {
  describe('anAccountWithActivity', () => {
    it('showsBalanceCoveredThroughTypeProviderAndAnalysisSetting', () => {
      const detail = accountDetail(
        account,
        activity([known('2026-03-10', 100_00, 'csv')], [posted('2026-03-12', 1_00)]),
      );
      expect(detail).toEqual({
        type: 'chequing',
        provider: 'RBC',
        includeInAnalysis: true,
        transferTreatment: 'notApplicable',
        archived: false,
        balance: { kind: 'known', amount: money(101_00), asOf: day('2026-03-12'), basedOn: 'csv' },
        coveredThrough: day('2026-03-12'),
      });
    });
  });

  describe('anAccountWithNoBalanceKnown', () => {
    it('saysSoSoTheScreenCanOfferToEnterOne', () => {
      expect(accountDetail(account, activity([], [])).balance).toEqual({ kind: 'unknown' });
    });
  });
});

const empty = createBudget('x', fixedClock(localDate('2026-11-28')));
const context = {
  lockedMonths: [],
  accountHasTransactions: () => false,
  isCategoryUsed: () => false,
};

/**
 * @param model - A model.
 * @param command - A command that must succeed.
 * @returns The new model.
 */
function run(model: BudgetModel, command: Command): BudgetModel {
  const result = applyCommand(model, command, context);
  if (!result.ok) {
    throw new Error(`Refused: ${result.error.code}`);
  }
  return result.value.model;
}

describe('pickableAccounts', () => {
  describe('anArchivedAccount', () => {
    it('isLeftOutUntilItIsUnarchived', () => {
      const two = [1, 2].reduce(
        (model, n) =>
          run(model, {
            kind: COMMAND_KIND.addAccount,
            id: id<'Account'>(`aaaaaaaa-0000-4000-8000-00000000000${String(n)}`),
            name: `A${String(n)}`,
            type: 'chequing',
          }),
        empty,
      );
      const first = two.accounts[0]?.id ?? accountId;
      const archived = run(two, {
        kind: COMMAND_KIND.archiveAccount,
        id: first,
        on: day('2026-03-10'),
      });
      expect(pickableAccounts(archived).map((a) => a.name)).toEqual(['A2']);
      const back = run(archived, {
        kind: COMMAND_KIND.unarchiveAccount,
        id: first,
        on: day('2026-04-01'),
      });
      expect(pickableAccounts(back).map((a) => a.name)).toEqual(['A1', 'A2']);
    });
  });
});

describe('snapshotAccountSettings', () => {
  describe('aSnapshotTakenBeforeAnEdit', () => {
    it('staysAsItWasWhenTheLiveAccountChanges', () => {
      const model = run(empty, {
        kind: COMMAND_KIND.addAccount,
        id: accountId,
        name: 'Everyday',
        type: 'chequing',
      });
      const frozen = snapshotAccountSettings(model);
      const edited = run(model, {
        kind: COMMAND_KIND.updateAccount,
        id: accountId,
        changes: { includeInAnalysis: false, transferTreatment: 'spending' },
      });
      expect(frozen).toEqual([
        { id: accountId, includeInAnalysis: true, transferTreatment: 'notApplicable' },
      ]);
      expect(snapshotAccountSettings(edited)).toEqual([
        { id: accountId, includeInAnalysis: false, transferTreatment: 'spending' },
      ]);
    });
  });
});
