// ------------------------------
// apply-command.ts
//
// Author: Starvoxel AI Agent - 2026-11-27
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import {
  accountDefaults,
  isArchived,
  type Account,
  type AccountType,
  type TransferTreatment,
} from '../budget/account.js';
import { INCOME_CATEGORY_ID, type Category } from '../budget/category.js';
import type { BudgetModel } from '../budget/model.js';
import { yearMonthOf, type YearMonth } from '../domain/local-date.js';
import { err, ok, type Result } from '../support/result.js';
import { applyChangeSet, type ChangePart, type ChangeSet } from './change-set.js';
import type { Command, CommandContext, CommandFailure } from './command.js';
import { checkLocks } from './lock-guard.js';

/** What a successful command gives back: the new model and the change set that made it. */
export interface CommandOutcome {
  readonly model: BudgetModel;
  readonly changeSet: ChangeSet;
}

type Planned = Result<ChangeSet, CommandFailure>;

const NO_MONTHS: readonly YearMonth[] = [];

/**
 * Run a command: plan it, check the lock guard, then apply it. The model is never changed in place.
 * @param model - The model to change.
 * @param command - The command.
 * @param context - Locked months and the transaction check.
 * @returns The new model and its change set, or why the command was refused.
 */
export function applyCommand(
  model: BudgetModel,
  command: Command,
  context: CommandContext,
): Result<CommandOutcome, CommandFailure> {
  const planned = plan(model, command, context);
  if (!planned.ok) {
    return planned;
  }
  const locked = checkLocks(planned.value, context.lockedMonths);
  if (!locked.ok) {
    return locked;
  }
  return ok({ model: applyChangeSet(model, planned.value), changeSet: planned.value });
}

/**
 * Turn a command into a change set, or refuse it.
 * @param model - The model.
 * @param command - The command.
 * @param context - Locked months and the transaction check.
 * @returns The change set or the refusal.
 */
function plan(model: BudgetModel, command: Command, context: CommandContext): Planned {
  switch (command.kind) {
    case 'addAccount':
      return planAddAccount(model, command);
    case 'updateAccount':
      return planUpdateAccount(model, command, context);
    case 'archiveAccount':
    case 'unarchiveAccount':
      return planArchive(model, command);
    case 'deleteAccount':
      return planDeleteAccount(model, command, context);
    case 'addCategory':
      return planAddCategory(model, command);
    case 'renameCategory':
      return planRenameCategory(model, command);
    case 'removeCategory':
      return planRemoveCategory(model, command);
    default:
      return assertNever(command);
  }
}

/**
 * Wrap parts as a change set.
 * @param parts - The parts.
 * @param touchedMonths - The months the change touches.
 * @returns A successful plan.
 */
function changeSet(parts: readonly ChangePart[], touchedMonths = NO_MONTHS): Planned {
  return ok({ parts, touchedMonths });
}

/**
 * Settle the analysis flag and transfer treatment for a type, from what was asked and the defaults.
 * @param type - The account type.
 * @param asked - What the command carried, if anything.
 * @param asked.includeInAnalysis - The analysis flag.
 * @param asked.transferTreatment - The transfer treatment.
 * @returns The settings, or a refusal when an `other` account's choice is missing or contradicts.
 */
function settleTreatment(
  type: AccountType,
  asked: { includeInAnalysis?: boolean; transferTreatment?: TransferTreatment },
): Result<{ includeInAnalysis: boolean; transferTreatment: TransferTreatment }, CommandFailure> {
  const defaults = accountDefaults(type);
  const includeInAnalysis = asked.includeInAnalysis ?? defaults?.includeInAnalysis;
  if (includeInAnalysis === undefined) {
    return err({ code: 'choiceRequired' });
  }
  if (includeInAnalysis) {
    return ok({ includeInAnalysis, transferTreatment: 'notApplicable' });
  }
  const treatment = asked.transferTreatment ?? defaults?.transferTreatment;
  if (treatment === undefined || treatment === 'notApplicable') {
    return err({ code: 'choiceRequired' });
  }
  return ok({ includeInAnalysis, transferTreatment: treatment });
}

/**
 * @param model - The model.
 * @param command - The add command.
 * @returns The plan.
 */
function planAddAccount(
  model: BudgetModel,
  command: Extract<Command, { kind: 'addAccount' }>,
): Planned {
  const name = command.name.trim();
  if (name === '') {
    return err({ code: 'nameEmpty' });
  }
  if (model.accounts.some((account) => account.id === command.id)) {
    return err({ code: 'duplicateId' });
  }
  const settled = settleTreatment(command.type, command);
  if (!settled.ok) {
    return settled;
  }
  const account: Account = {
    id: command.id,
    name,
    type: command.type,
    provider: command.provider ?? null,
    ...settled.value,
    archivePeriods: [],
  };
  return changeSet([
    {
      kind: 'account',
      scope: 'global',
      before: null,
      after: { index: model.accounts.length, value: account },
    },
  ]);
}

/**
 * @param model - The model.
 * @param command - The update command.
 * @param context - The transaction check.
 * @returns The plan.
 */
function planUpdateAccount(
  model: BudgetModel,
  command: Extract<Command, { kind: 'updateAccount' }>,
  context: CommandContext,
): Planned {
  const index = model.accounts.findIndex((account) => account.id === command.id);
  const before = model.accounts[index];
  if (before === undefined) {
    return err({ code: 'unknownAccount' });
  }
  if (isArchived(before)) {
    return err({ code: 'accountArchived' });
  }
  const { changes } = command;
  const name = changes.name === undefined ? before.name : changes.name.trim();
  if (name === '') {
    return err({ code: 'nameEmpty' });
  }
  const type = changes.type ?? before.type;
  if (type !== before.type && context.accountHasTransactions(before.id)) {
    return err({ code: 'typeLocked' });
  }
  const settled = settleTreatment(type, {
    includeInAnalysis: changes.includeInAnalysis ?? before.includeInAnalysis,
    transferTreatment: changes.transferTreatment ?? before.transferTreatment,
  });
  if (!settled.ok) {
    return settled;
  }
  const after: Account = {
    ...before,
    name,
    type,
    provider: changes.provider === undefined ? before.provider : changes.provider,
    ...settled.value,
  };
  return changeSet([
    {
      kind: 'account',
      scope: 'global',
      before: { index, value: before },
      after: { index, value: after },
    },
  ]);
}

/**
 * @param model - The model.
 * @param command - The archive or unarchive command.
 * @returns The plan.
 */
function planArchive(
  model: BudgetModel,
  command: Extract<Command, { kind: 'archiveAccount' | 'unarchiveAccount' }>,
): Planned {
  const index = model.accounts.findIndex((account) => account.id === command.id);
  const before = model.accounts[index];
  if (before === undefined) {
    return err({ code: 'unknownAccount' });
  }
  const archived = isArchived(before);
  const lastPeriod = before.archivePeriods.at(-1);
  if (command.kind === 'archiveAccount') {
    if (archived) {
      return err({ code: 'alreadyArchived' });
    }
    if (lastPeriod?.unarchivedOn != null && command.on < lastPeriod.unarchivedOn) {
      return err({ code: 'dateOutOfOrder' });
    }
  } else if (!archived) {
    return err({ code: 'notArchived' });
  } else if (lastPeriod !== undefined && command.on < lastPeriod.archivedFrom) {
    return err({ code: 'dateOutOfOrder' });
  }
  const completed = before.archivePeriods.slice(0, archived ? -1 : undefined);
  const archivePeriods =
    command.kind === 'archiveAccount'
      ? [...before.archivePeriods, { archivedFrom: command.on, unarchivedOn: null }]
      : [
          ...completed,
          { archivedFrom: lastPeriod?.archivedFrom ?? command.on, unarchivedOn: command.on },
        ];
  return changeSet(
    [
      {
        kind: 'account',
        scope: 'global',
        before: { index, value: before },
        after: { index, value: { ...before, archivePeriods } },
      },
    ],
    [yearMonthOf(command.on)],
  );
}

/**
 * @param model - The model.
 * @param command - The delete command.
 * @param context - The transaction check.
 * @returns The plan.
 */
function planDeleteAccount(
  model: BudgetModel,
  command: Extract<Command, { kind: 'deleteAccount' }>,
  context: CommandContext,
): Planned {
  const index = model.accounts.findIndex((account) => account.id === command.id);
  const before = model.accounts[index];
  if (before === undefined) {
    return err({ code: 'unknownAccount' });
  }
  if (context.accountHasTransactions(before.id)) {
    return err({ code: 'hasTransactions' });
  }
  return changeSet([
    { kind: 'account', scope: 'global', before: { index, value: before }, after: null },
  ]);
}

/**
 * @param model - The model.
 * @param command - The add command.
 * @returns The plan.
 */
function planAddCategory(
  model: BudgetModel,
  command: Extract<Command, { kind: 'addCategory' }>,
): Planned {
  const name = command.name.trim();
  if (name === '') {
    return err({ code: 'nameEmpty' });
  }
  if (model.categories.some((category) => category.id === command.id)) {
    return err({ code: 'duplicateId' });
  }
  if (command.parentId !== null) {
    const parent = model.categories.find((category) => category.id === command.parentId);
    if (parent?.parentId !== null) {
      return err({ code: 'invalidParent' });
    }
  }
  const category: Category = { id: command.id, name, parentId: command.parentId };
  return changeSet([
    {
      kind: 'category',
      scope: 'global',
      before: null,
      after: { index: model.categories.length, value: category },
    },
  ]);
}

/**
 * @param model - The model.
 * @param command - The rename command.
 * @returns The plan.
 */
function planRenameCategory(
  model: BudgetModel,
  command: Extract<Command, { kind: 'renameCategory' }>,
): Planned {
  const index = model.categories.findIndex((category) => category.id === command.id);
  const before = model.categories[index];
  if (before === undefined) {
    return err({ code: 'unknownCategory' });
  }
  const name = command.name.trim();
  if (name === '') {
    return err({ code: 'nameEmpty' });
  }
  return changeSet([
    {
      kind: 'category',
      scope: 'global',
      before: { index, value: before },
      after: { index, value: { ...before, name } },
    },
  ]);
}

/**
 * Remove a category and, for a main one, its subcategories.
 * @param model - The model.
 * @param command - The remove command.
 * @returns The plan.
 */
function planRemoveCategory(
  model: BudgetModel,
  command: Extract<Command, { kind: 'removeCategory' }>,
): Planned {
  if (command.id === INCOME_CATEGORY_ID) {
    return err({ code: 'incomeProtected' });
  }
  if (!model.categories.some((category) => category.id === command.id)) {
    return err({ code: 'unknownCategory' });
  }
  const parts: ChangePart[] = [];
  model.categories.forEach((category, index) => {
    if (category.id === command.id || category.parentId === command.id) {
      parts.push({
        kind: 'category',
        scope: 'global',
        before: { index, value: category },
        after: null,
      });
    }
  });
  // Highest index first, so each recorded index is still right when its part is applied.
  return changeSet(parts.reverse());
}

/**
 * Stop the build when a command kind is not handled.
 * @param value - The unhandled value.
 * @throws {Error} Always.
 */
function assertNever(value: never): never {
  throw new Error('Unhandled command', { cause: value });
}
