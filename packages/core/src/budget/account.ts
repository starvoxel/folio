// ------------------------------
// account.ts
//
// Author: Starvoxel AI Agent - 2026-11-27
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import type { Id } from '../domain/id.js';
import type { LocalDate } from '../domain/local-date.js';
import { negateMoney, type Money } from '../domain/money.js';

/** The account types of S1.3. */
export const ACCOUNT_TYPES = [
  'chequing',
  'savings',
  'creditCard',
  'rrsp',
  'tfsa',
  'resp',
  'otherInvestment',
  'mortgage',
  'other',
] as const;

/** One of the account types of S1.3. */
export type AccountType = (typeof ACCOUNT_TYPES)[number];

/** How money moved into an account counts. Included accounts have no treatment (area T). */
export type TransferTreatment = 'notApplicable' | 'savings' | 'spending';

/** A stretch of time an account was archived; `unarchivedOn` is null while it still is. */
export interface ArchivePeriod {
  readonly archivedFrom: LocalDate;
  readonly unarchivedOn: LocalDate | null;
}

/**
 * What the account held when its history starts (S1.5). The date is empty until the first import
 * is confirmed, and is then the day before the earliest imported row.
 */
export interface StartingBalance {
  /** Signed: money owed on a credit card or mortgage is negative. */
  readonly amount: Money;
  readonly on: LocalDate | null;
}

/** An account of the household (S1.2). */
export interface Account {
  readonly id: Id<'Account'>;
  readonly name: string;
  readonly type: AccountType;
  readonly provider: string | null;
  readonly includeInAnalysis: boolean;
  readonly transferTreatment: TransferTreatment;
  /** Oldest first; only the last may be open. Needed because S1.14 and S1.15 depend on dates. */
  readonly archivePeriods: readonly ArchivePeriod[];
  /** Null while the person has not entered one; it can be skipped (S1.5). */
  readonly startingBalance: StartingBalance | null;
}

/** The analysis and transfer settings an account of a type starts with (S1.4). */
export interface AccountDefaults {
  readonly includeInAnalysis: boolean;
  readonly transferTreatment: TransferTreatment;
}

/**
 * Find what a new account of a type starts with.
 * @param type - The account type.
 * @returns The defaults, or null for `other`, which is asked at add time (S1.4).
 */
export function accountDefaults(type: AccountType): AccountDefaults | null {
  switch (type) {
    case 'chequing':
    case 'savings':
    case 'creditCard':
      return { includeInAnalysis: true, transferTreatment: 'notApplicable' };
    case 'rrsp':
    case 'tfsa':
    case 'resp':
    case 'otherInvestment':
      return { includeInAnalysis: false, transferTreatment: 'savings' };
    case 'mortgage':
      return { includeInAnalysis: false, transferTreatment: 'spending' };
    case 'other':
      return null;
    default:
      return assertNever(type);
  }
}

/**
 * Tell whether an account holds money owed, which is entered as an amount owed (S1.5).
 * @param type - The account type.
 * @returns True for a credit card or a mortgage.
 */
export function isLiability(type: AccountType): boolean {
  return type === 'creditCard' || type === 'mortgage';
}

/**
 * Turn what the person typed into the signed balance that is stored. A credit card or mortgage is
 * labelled "Amount owed" and typed positive; it is stored negative. Typing a negative amount
 * there means the account is in credit, and is stored positive.
 * @param type - The account type.
 * @param entered - The amount as typed.
 * @returns The signed balance to store.
 */
export function storedBalance(type: AccountType, entered: Money): Money {
  return isLiability(type) ? negateMoney(entered) : entered;
}

/**
 * Turn a stored balance back into what the person sees and types.
 * @param type - The account type.
 * @param stored - The signed balance.
 * @returns The amount to show, owed amounts positive for a credit card or mortgage.
 */
export function enteredBalance(type: AccountType, stored: Money): Money {
  return storedBalance(type, stored);
}

/**
 * Tell whether an account is archived now.
 * @param account - The account.
 * @returns True when its last archive period is still open.
 */
export function isArchived(account: Account): boolean {
  return account.archivePeriods.at(-1)?.unarchivedOn === null;
}

/**
 * Stop the build when a union case is not handled.
 * @param value - The unhandled value.
 * @throws {Error} Always.
 */
function assertNever(value: never): never {
  throw new Error('Unhandled account type', { cause: value });
}
