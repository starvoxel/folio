// ------------------------------
// account.ts
//
// Author: Starvoxel AI Agent - 2026-11-27
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import type { Id } from '../domain/id.js';
import type { LocalDate } from '../domain/local-date.js';

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
