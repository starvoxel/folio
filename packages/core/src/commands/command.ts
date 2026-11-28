// ------------------------------
// command.ts
//
// Author: Starvoxel AI Agent - 2026-11-27
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import type { Id } from '../domain/id.js';
import type { LocalDate, YearMonth } from '../domain/local-date.js';
import type { AccountType, TransferTreatment } from '../budget/account.js';
import type { Category } from '../budget/category.js';

/** The kind of every command, named once so a typo cannot compile. */
export const COMMAND_KIND = {
  addAccount: 'addAccount',
  updateAccount: 'updateAccount',
  archiveAccount: 'archiveAccount',
  unarchiveAccount: 'unarchiveAccount',
  deleteAccount: 'deleteAccount',
  addCategory: 'addCategory',
  renameCategory: 'renameCategory',
  removeCategory: 'removeCategory',
  applyTemplate: 'applyTemplate',
} as const;

/** One of the command kinds. */
export type CommandKind = (typeof COMMAND_KIND)[keyof typeof COMMAND_KIND];

/** Why a command can be refused, named once so a typo cannot compile. */
export const FAILURE = {
  monthLocked: 'monthLocked',
  nameEmpty: 'nameEmpty',
  choiceRequired: 'choiceRequired',
  duplicateId: 'duplicateId',
  unknownAccount: 'unknownAccount',
  unknownCategory: 'unknownCategory',
  typeLocked: 'typeLocked',
  hasTransactions: 'hasTransactions',
  accountArchived: 'accountArchived',
  alreadyArchived: 'alreadyArchived',
  notArchived: 'notArchived',
  dateOutOfOrder: 'dateOutOfOrder',
  incomeProtected: 'incomeProtected',
  invalidParent: 'invalidParent',
  categoryInUse: 'categoryInUse',
} as const;

/** The edits to an account that `updateAccount` may make; omitted fields stay as they are. */
export interface AccountChanges {
  readonly name?: string;
  readonly type?: AccountType;
  readonly provider?: string | null;
  readonly includeInAnalysis?: boolean;
  readonly transferTreatment?: TransferTreatment;
}

/**
 * Every change to the budget is one of these (AD-4). The caller supplies ids and dates, so the
 * same command on the same model always gives the same result.
 */
export type Command =
  | {
      readonly kind: typeof COMMAND_KIND.addAccount;
      readonly id: Id<'Account'>;
      readonly name: string;
      readonly type: AccountType;
      readonly provider?: string | null;
      /** Required for `other`, which has no default (S1.4). */
      readonly includeInAnalysis?: boolean;
      readonly transferTreatment?: TransferTreatment;
    }
  | {
      readonly kind: typeof COMMAND_KIND.updateAccount;
      readonly id: Id<'Account'>;
      readonly changes: AccountChanges;
    }
  | {
      readonly kind: typeof COMMAND_KIND.archiveAccount;
      readonly id: Id<'Account'>;
      readonly on: LocalDate;
    }
  | {
      readonly kind: typeof COMMAND_KIND.unarchiveAccount;
      readonly id: Id<'Account'>;
      readonly on: LocalDate;
    }
  | { readonly kind: typeof COMMAND_KIND.deleteAccount; readonly id: Id<'Account'> }
  | {
      readonly kind: typeof COMMAND_KIND.addCategory;
      readonly id: Id<'Category'>;
      readonly name: string;
      readonly parentId: Id<'Category'> | null;
    }
  | {
      readonly kind: typeof COMMAND_KIND.renameCategory;
      readonly id: Id<'Category'>;
      readonly name: string;
    }
  | { readonly kind: typeof COMMAND_KIND.removeCategory; readonly id: Id<'Category'> }
  | {
      readonly kind: typeof COMMAND_KIND.applyTemplate;
      /** The whole category set, Income first or anywhere in it; it replaces the current one. */
      readonly categories: readonly Category[];
    };

/** What a command needs to know that the model does not hold. */
export interface CommandContext {
  readonly lockedMonths: readonly YearMonth[];
  /** Whether an account has any transactions; the transactions part belongs to a later plan. */
  readonly accountHasTransactions: (accountId: Id<'Account'>) => boolean;
  /** Whether a category is used by anything; the plans that use categories supply it. */
  readonly isCategoryUsed?: (categoryId: Id<'Category'>) => boolean;
}

/** Why a command was refused. None of them carries a name or an amount. */
export type CommandFailure =
  | {
      readonly code: typeof FAILURE.monthLocked;
      readonly months: readonly YearMonth[];
    }
  | { readonly code: Exclude<(typeof FAILURE)[keyof typeof FAILURE], typeof FAILURE.monthLocked> };
