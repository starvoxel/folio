// ------------------------------
// apply-command.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-27
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { INCOME_CATEGORY_ID } from '../budget/category.js';
import { createBudget, type BudgetModel } from '../budget/model.js';
import { fixedClock } from '../domain/clock.js';
import { id } from '../domain/id.js';
import { localDate, yearMonth } from '../domain/local-date.js';
import { applyCommand } from './apply-command.js';
import { applyChangeSet, invertChangeSet } from './change-set.js';
import type { Command, CommandContext, CommandFailure } from './command.js';

const clock = fixedClock(localDate('2026-11-27'));
const accountId = (n: number): ReturnType<typeof id<'Account'>> =>
  id<'Account'>(`aaaaaaaa-0000-4000-8000-${String(n).padStart(12, '0')}`);
const categoryId = (n: number): ReturnType<typeof id<'Category'>> =>
  id<'Category'>(`cccccccc-0000-4000-8000-${String(n).padStart(12, '0')}`);
const noContext: CommandContext = { lockedMonths: [], accountHasTransactions: () => false };

/**
 * @param model - The starting model.
 * @param command - The command to run.
 * @param context - The context, by default one with no locks and no transactions.
 * @returns The new model; the test fails if the command was refused.
 */
function run(model: BudgetModel, command: Command, context = noContext): BudgetModel {
  const result = applyCommand(model, command, context);
  if (!result.ok) {
    throw new Error(`Refused: ${result.error.code}`);
  }
  return result.value.model;
}

/**
 * @param model - The starting model.
 * @param command - The command to run.
 * @param context - The context.
 * @returns The refusal code; the test fails if the command was accepted.
 */
function refusal(model: BudgetModel, command: Command, context = noContext): CommandFailure {
  const result = applyCommand(model, command, context);
  if (result.ok) {
    throw new Error('Expected a refusal');
  }
  return result.error;
}

const empty = createBudget('Household 2027', clock);
const withChequing = run(empty, {
  kind: 'addAccount',
  id: accountId(1),
  name: 'Everyday',
  type: 'chequing',
});

describe('applyCommand', () => {
  describe('addAccountOfAKnownType', () => {
    it('usesTheTypeDefaults', () => {
      const model = run(empty, {
        kind: 'addAccount',
        id: accountId(1),
        name: '  TFSA  ',
        type: 'tfsa',
        provider: 'Questrade',
      });
      expect(model.accounts).toEqual([
        {
          id: accountId(1),
          name: 'TFSA',
          type: 'tfsa',
          provider: 'Questrade',
          includeInAnalysis: false,
          transferTreatment: 'savings',
          archivePeriods: [],
        },
      ]);
    });
  });

  describe('addAccountOfTypeOther', () => {
    it('requiresAChoice', () => {
      const command: Command = {
        kind: 'addAccount',
        id: accountId(1),
        name: 'Cash',
        type: 'other',
      };
      expect(refusal(empty, command)).toEqual({ code: 'choiceRequired' });
      expect(refusal(empty, { ...command, includeInAnalysis: false })).toEqual({
        code: 'choiceRequired',
      });
    });

    it('acceptsAChoice', () => {
      const model = run(empty, {
        kind: 'addAccount',
        id: accountId(1),
        name: 'Cash',
        type: 'other',
        includeInAnalysis: false,
        transferTreatment: 'spending',
      });
      expect(model.accounts[0]?.transferTreatment).toBe('spending');
    });
  });

  describe('addAccountThatIsIncluded', () => {
    it('hasNoTransferTreatment', () => {
      const model = run(empty, {
        kind: 'addAccount',
        id: accountId(1),
        name: 'Cash',
        type: 'other',
        includeInAnalysis: true,
        transferTreatment: 'spending',
      });
      expect(model.accounts[0]?.transferTreatment).toBe('notApplicable');
    });
  });

  describe('addAccountWithBadInput', () => {
    it('refusesAnEmptyNameAndADuplicateId', () => {
      expect(
        refusal(empty, { kind: 'addAccount', id: accountId(1), name: '   ', type: 'chequing' }),
      ).toEqual({ code: 'nameEmpty' });
      expect(
        refusal(withChequing, { kind: 'addAccount', id: accountId(1), name: 'B', type: 'savings' }),
      ).toEqual({ code: 'duplicateId' });
    });
  });

  describe('updateAccountTypeBeforeImport', () => {
    it('changesTheTypeAndKeepsTheAnalysisSettings', () => {
      const model = run(withChequing, {
        kind: 'updateAccount',
        id: accountId(1),
        changes: { type: 'savings' },
      });
      expect(model.accounts[0]).toMatchObject({
        type: 'savings',
        includeInAnalysis: true,
        transferTreatment: 'notApplicable',
      });
    });
  });

  describe('updateAccountTypeAfterImport', () => {
    it('isRefusedButOtherEditsAreNot', () => {
      const context: CommandContext = { ...noContext, accountHasTransactions: () => true };
      expect(
        refusal(
          withChequing,
          { kind: 'updateAccount', id: accountId(1), changes: { type: 'savings' } },
          context,
        ),
      ).toEqual({ code: 'typeLocked' });
      const renamed = run(
        withChequing,
        { kind: 'updateAccount', id: accountId(1), changes: { name: 'Main' } },
        context,
      );
      expect(renamed.accounts[0]?.name).toBe('Main');
    });
  });

  describe('updateAccountToExcluded', () => {
    it('needsASavingsOrSpendingTreatment', () => {
      const command: Command = {
        kind: 'updateAccount',
        id: accountId(1),
        changes: { includeInAnalysis: false },
      };
      expect(refusal(withChequing, command)).toEqual({ code: 'choiceRequired' });
      const model = run(withChequing, {
        ...command,
        changes: { includeInAnalysis: false, transferTreatment: 'savings' },
      });
      expect(model.accounts[0]).toMatchObject({
        includeInAnalysis: false,
        transferTreatment: 'savings',
      });
    });
  });

  describe('archiveThenUnarchive', () => {
    it('recordsTheDatesAndKeepsTheAccount', () => {
      const archived = run(withChequing, {
        kind: 'archiveAccount',
        id: accountId(1),
        on: localDate('2026-03-15'),
      });
      const restored = run(archived, {
        kind: 'unarchiveAccount',
        id: accountId(1),
        on: localDate('2026-05-01'),
      });
      expect(restored.accounts[0]?.archivePeriods).toEqual([
        { archivedFrom: '2026-03-15', unarchivedOn: '2026-05-01' },
      ]);
    });

    it('allowsASecondArchiveAfterwards', () => {
      let model = withChequing;
      for (const [kind, on] of [
        ['archiveAccount', '2026-03-15'],
        ['unarchiveAccount', '2026-05-01'],
        ['archiveAccount', '2026-07-01'],
      ] as const) {
        model = run(model, { kind, id: accountId(1), on: localDate(on) });
      }
      expect(model.accounts[0]?.archivePeriods).toHaveLength(2);
    });
  });

  describe('archiveWrongWay', () => {
    it('refusesRepeatsAndDatesBeforeTheLastChange', () => {
      const archived = run(withChequing, {
        kind: 'archiveAccount',
        id: accountId(1),
        on: localDate('2026-03-15'),
      });
      const on = localDate('2026-03-20');
      expect(refusal(archived, { kind: 'archiveAccount', id: accountId(1), on })).toEqual({
        code: 'alreadyArchived',
      });
      expect(refusal(withChequing, { kind: 'unarchiveAccount', id: accountId(1), on })).toEqual({
        code: 'notArchived',
      });
      expect(
        refusal(archived, {
          kind: 'unarchiveAccount',
          id: accountId(1),
          on: localDate('2026-03-01'),
        }),
      ).toEqual({ code: 'dateOutOfOrder' });
    });
  });

  describe('editingAnArchivedAccount', () => {
    it('isRefused', () => {
      const archived = run(withChequing, {
        kind: 'archiveAccount',
        id: accountId(1),
        on: localDate('2026-03-15'),
      });
      expect(
        refusal(archived, { kind: 'updateAccount', id: accountId(1), changes: { name: 'X' } }),
      ).toEqual({ code: 'accountArchived' });
    });
  });

  describe('deleteAccount', () => {
    it('removesAnAccountWithNoTransactions', () => {
      expect(run(withChequing, { kind: 'deleteAccount', id: accountId(1) }).accounts).toEqual([]);
    });

    it('refusesAnAccountWithTransactions', () => {
      const context: CommandContext = { ...noContext, accountHasTransactions: () => true };
      expect(refusal(withChequing, { kind: 'deleteAccount', id: accountId(1) }, context)).toEqual({
        code: 'hasTransactions',
      });
    });
  });

  describe('unknownAccount', () => {
    it('isRefusedByEveryAccountCommand', () => {
      const unknown = accountId(9);
      const on = localDate('2026-03-15');
      const commands: Command[] = [
        { kind: 'updateAccount', id: unknown, changes: {} },
        { kind: 'archiveAccount', id: unknown, on },
        { kind: 'unarchiveAccount', id: unknown, on },
        { kind: 'deleteAccount', id: unknown },
      ];
      expect(commands.map((command) => refusal(withChequing, command).code)).toEqual(
        Array.from({ length: 4 }, () => 'unknownAccount'),
      );
    });
  });

  describe('categoryEdits', () => {
    it('addsMainAndSubCategoriesAndRenamesThem', () => {
      let model = run(empty, {
        kind: 'addCategory',
        id: categoryId(1),
        name: 'Food',
        parentId: null,
      });
      model = run(model, {
        kind: 'addCategory',
        id: categoryId(2),
        name: 'Groceries',
        parentId: categoryId(1),
      });
      model = run(model, { kind: 'renameCategory', id: categoryId(2), name: ' Supermarket ' });
      expect(model.categories.map((category) => category.name)).toEqual([
        'Income',
        'Food',
        'Supermarket',
      ]);
    });

    it('refusesAThirdLevelAndAMissingParent', () => {
      let model = run(empty, {
        kind: 'addCategory',
        id: categoryId(1),
        name: 'Food',
        parentId: null,
      });
      model = run(model, {
        kind: 'addCategory',
        id: categoryId(2),
        name: 'Groceries',
        parentId: categoryId(1),
      });
      const third: Command = {
        kind: 'addCategory',
        id: categoryId(3),
        name: 'Deep',
        parentId: categoryId(2),
      };
      expect(refusal(model, third)).toEqual({ code: 'invalidParent' });
      expect(refusal(model, { ...third, parentId: categoryId(9) })).toEqual({
        code: 'invalidParent',
      });
    });

    it('removesAMainCategoryWithItsSubcategories', () => {
      let model = run(empty, {
        kind: 'addCategory',
        id: categoryId(1),
        name: 'Food',
        parentId: null,
      });
      model = run(model, {
        kind: 'addCategory',
        id: categoryId(2),
        name: 'Groceries',
        parentId: categoryId(1),
      });
      model = run(model, { kind: 'removeCategory', id: categoryId(1) });
      expect(model.categories.map((category) => category.name)).toEqual(['Income']);
    });
  });

  describe('theIncomeCategory', () => {
    it('canBeRenamedButNotRemoved', () => {
      const renamed = run(empty, {
        kind: 'renameCategory',
        id: INCOME_CATEGORY_ID,
        name: 'Pay and other',
      });
      expect(renamed.categories[0]?.name).toBe('Pay and other');
      expect(refusal(renamed, { kind: 'removeCategory', id: INCOME_CATEGORY_ID })).toEqual({
        code: 'incomeProtected',
      });
    });
  });

  describe('categoryWithBadInput', () => {
    it('refusesEmptyNamesDuplicatesAndUnknowns', () => {
      expect(
        refusal(empty, { kind: 'addCategory', id: categoryId(1), name: ' ', parentId: null }),
      ).toEqual({ code: 'nameEmpty' });
      expect(
        refusal(empty, { kind: 'addCategory', id: INCOME_CATEGORY_ID, name: 'X', parentId: null }),
      ).toEqual({ code: 'duplicateId' });
      expect(refusal(empty, { kind: 'renameCategory', id: categoryId(9), name: 'X' })).toEqual({
        code: 'unknownCategory',
      });
      expect(refusal(empty, { kind: 'renameCategory', id: INCOME_CATEGORY_ID, name: ' ' })).toEqual(
        { code: 'nameEmpty' },
      );
      expect(refusal(empty, { kind: 'removeCategory', id: categoryId(9) })).toEqual({
        code: 'unknownCategory',
      });
    });
  });

  describe('unarchiveInALockedMonth', () => {
    it('isRefusedAndOneInAnOpenMonthIsNot', () => {
      const archived = run(withChequing, {
        kind: 'archiveAccount',
        id: accountId(1),
        on: localDate('2026-02-10'),
      });
      const context: CommandContext = { ...noContext, lockedMonths: [yearMonth('2026-03')] };
      const command: Command = {
        kind: 'unarchiveAccount',
        id: accountId(1),
        on: localDate('2026-03-05'),
      };
      expect(refusal(archived, command, context)).toEqual({
        code: 'monthLocked',
        months: ['2026-03'],
      });
      const restored = run(archived, { ...command, on: localDate('2026-04-05') }, context);
      expect(restored.accounts[0]?.archivePeriods[0]?.unarchivedOn).toBe('2026-04-05');
    });
  });

  describe('aChangeInALockedMonth', () => {
    it('isRefusedAndLeavesTheModelAlone', () => {
      const context: CommandContext = { ...noContext, lockedMonths: [yearMonth('2026-03')] };
      expect(
        refusal(
          withChequing,
          {
            kind: 'archiveAccount',
            id: accountId(1),
            on: localDate('2026-03-15'),
          },
          context,
        ),
      ).toEqual({ code: 'monthLocked', months: ['2026-03'] });
      const open = run(
        withChequing,
        {
          kind: 'archiveAccount',
          id: accountId(1),
          on: localDate('2026-04-02'),
        },
        context,
      );
      expect(open.accounts[0]?.archivePeriods).toHaveLength(1);
    });
  });

  describe('everyCommand', () => {
    it('leavesTheInputModelUnchanged', () => {
      const before = JSON.stringify(withChequing);
      run(withChequing, { kind: 'deleteAccount', id: accountId(1) });
      expect(JSON.stringify(withChequing)).toBe(before);
    });
  });
});

const accountTypes = fc.constantFrom('chequing', 'savings', 'creditCard', 'tfsa', 'mortgage');
const dayOfYear = fc
  .record({ month: fc.integer({ min: 1, max: 12 }), day: fc.integer({ min: 1, max: 28 }) })
  .map(({ month, day }) =>
    localDate(`2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`),
  );

/** Commands that mostly apply, built from small id pools so that they interact. */
const anyCommand: fc.Arbitrary<Command> = fc.oneof(
  fc.record({
    kind: fc.constant('addAccount' as const),
    id: fc.integer({ min: 1, max: 4 }).map(accountId),
    name: fc.constantFrom('A', 'B', ' '),
    type: accountTypes,
  }),
  fc.record({
    kind: fc.constant('updateAccount' as const),
    id: fc.integer({ min: 1, max: 4 }).map(accountId),
    changes: fc.record({ name: fc.constantFrom('X', 'Y') }),
  }),
  fc.record({
    kind: fc.constantFrom('archiveAccount' as const, 'unarchiveAccount' as const),
    id: fc.integer({ min: 1, max: 4 }).map(accountId),
    on: dayOfYear,
  }),
  fc.record({
    kind: fc.constant('deleteAccount' as const),
    id: fc.integer({ min: 1, max: 4 }).map(accountId),
  }),
  fc.record({
    kind: fc.constant('addCategory' as const),
    id: fc.integer({ min: 1, max: 6 }).map(categoryId),
    name: fc.constantFrom('Food', 'Fun'),
    parentId: fc.oneof(fc.constant(null), fc.integer({ min: 1, max: 6 }).map(categoryId)),
  }),
  fc.record({
    kind: fc.constant('removeCategory' as const),
    id: fc.integer({ min: 1, max: 6 }).map(categoryId),
  }),
);

describe('invertChangeSet', () => {
  describe('anySequenceOfCommands', () => {
    it('restoresTheModelWhenEveryChangeSetIsUndoneNewestFirst', () => {
      fc.assert(
        fc.property(fc.array(anyCommand, { maxLength: 25 }), (commands) => {
          let model = empty;
          const applied = [];
          for (const command of commands) {
            const result = applyCommand(model, command, noContext);
            if (result.ok) {
              model = result.value.model;
              applied.push(result.value.changeSet);
            }
          }
          for (const changeSet of applied.reverse()) {
            model = applyChangeSet(model, invertChangeSet(changeSet));
          }
          expect(model).toEqual(empty);
        }),
      );
    });

    it('restoresTheModelAfterEachSingleCommand', () => {
      fc.assert(
        fc.property(fc.array(anyCommand, { maxLength: 25 }), anyCommand, (setup, command) => {
          let model = empty;
          for (const earlier of setup) {
            const result = applyCommand(model, earlier, noContext);
            model = result.ok ? result.value.model : model;
          }
          const result = applyCommand(model, command, noContext);
          if (result.ok) {
            expect(
              applyChangeSet(result.value.model, invertChangeSet(result.value.changeSet)),
            ).toEqual(model);
          }
        }),
      );
    });
  });
});
