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
      readonly kind: 'addAccount';
      readonly id: Id<'Account'>;
      readonly name: string;
      readonly type: AccountType;
      readonly provider?: string | null;
      /** Required for `other`, which has no default (S1.4). */
      readonly includeInAnalysis?: boolean;
      readonly transferTreatment?: TransferTreatment;
    }
  | { readonly kind: 'updateAccount'; readonly id: Id<'Account'>; readonly changes: AccountChanges }
  | { readonly kind: 'archiveAccount'; readonly id: Id<'Account'>; readonly on: LocalDate }
  | { readonly kind: 'unarchiveAccount'; readonly id: Id<'Account'>; readonly on: LocalDate }
  | { readonly kind: 'deleteAccount'; readonly id: Id<'Account'> }
  | {
      readonly kind: 'addCategory';
      readonly id: Id<'Category'>;
      readonly name: string;
      readonly parentId: Id<'Category'> | null;
    }
  | { readonly kind: 'renameCategory'; readonly id: Id<'Category'>; readonly name: string }
  | { readonly kind: 'removeCategory'; readonly id: Id<'Category'> };

/** What a command needs to know that the model does not hold. */
export interface CommandContext {
  readonly lockedMonths: readonly YearMonth[];
  /** Whether an account has any transactions; the transactions part belongs to a later plan. */
  readonly accountHasTransactions: (accountId: Id<'Account'>) => boolean;
}

/** Why a command was refused. None of them carries a name or an amount. */
export type CommandFailure =
  | { readonly code: 'monthLocked'; readonly months: readonly YearMonth[] }
  | {
      readonly code:
        | 'nameEmpty'
        | 'choiceRequired'
        | 'duplicateId'
        | 'unknownAccount'
        | 'unknownCategory'
        | 'typeLocked'
        | 'hasTransactions'
        | 'accountArchived'
        | 'alreadyArchived'
        | 'notArchived'
        | 'dateOutOfOrder'
        | 'incomeProtected'
        | 'invalidParent';
    };
