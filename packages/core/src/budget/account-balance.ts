// ------------------------------
// account-balance.ts
//
// Author: Starvoxel AI Agent - 2026-11-28
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import type { LocalDate } from '../domain/local-date.js';
import { addMoney, sumMoney, type Money } from '../domain/money.js';
import { isArchived, type Account, type AccountType, type TransferTreatment } from './account.js';
import type { BudgetModel } from './model.js';

/** A balance the bank or the person stated, true at the end of its date. */
export interface KnownBalance {
  readonly date: LocalDate;
  readonly amount: Money;
  /** A figure from an imported file, or one the person confirmed. */
  readonly source: 'csv' | 'confirmed';
}

/** What the balance needs to know about one transaction. */
export interface PostedAmount {
  readonly date: LocalDate;
  /** Signed: money in is positive, money out negative. */
  readonly amount: Money;
}

/**
 * What the balance reads of an account's history. The transactions part and the known-balance
 * records belong to the import plan, which fills this narrow shape; until then it is empty.
 */
export interface AccountActivity {
  readonly knownBalances: readonly KnownBalance[];
  readonly transactions: readonly PostedAmount[];
}

/** The balance of an account now, or the fact that none is known (S1.18). */
export type CurrentBalance =
  | {
      readonly kind: 'known';
      readonly amount: Money;
      /** The latest date the figure covers; null while it is only an undated starting balance. */
      readonly asOf: LocalDate | null;
      readonly basedOn: 'csv' | 'confirmed' | 'starting';
    }
  | { readonly kind: 'unknown' };

/** What the account detail view shows (S1.17). */
export interface AccountDetail {
  readonly type: AccountType;
  readonly provider: string | null;
  readonly includeInAnalysis: boolean;
  readonly transferTreatment: TransferTreatment;
  readonly archived: boolean;
  readonly balance: CurrentBalance;
  /** The date of the latest transaction, or null when there are none. */
  readonly coveredThrough: LocalDate | null;
}

/** Which source wins when two balances share a date: the person's word over a file over a guess. */
const SOURCE_RANK = { confirmed: 3, csv: 2, starting: 1 } as const;

/**
 * Work out the current balance: the latest known balance, adjusted by the transactions dated after
 * it (S1.18). A known balance is true at the end of its date, so transactions on that date are
 * already in it. The dated starting balance counts as a known balance; an undated one is used only
 * while the account has no transactions. With nothing known it says so.
 * @param account - The account.
 * @param activity - Its known balances and transactions.
 * @returns The balance, or `unknown`.
 */
export function currentBalance(account: Account, activity: AccountActivity): CurrentBalance {
  const candidates: { date: LocalDate; amount: Money; source: keyof typeof SOURCE_RANK }[] = [
    ...activity.knownBalances,
  ];
  const starting = account.startingBalance;
  if (starting?.on != null) {
    candidates.push({ date: starting.on, amount: starting.amount, source: 'starting' });
  }
  const latest = candidates.reduce<(typeof candidates)[number] | null>(
    (best, candidate) =>
      best === null ||
      candidate.date > best.date ||
      (candidate.date === best.date && SOURCE_RANK[candidate.source] > SOURCE_RANK[best.source])
        ? candidate
        : best,
    null,
  );
  if (latest === null) {
    return starting !== null && activity.transactions.length === 0
      ? { kind: 'known', amount: starting.amount, asOf: null, basedOn: 'starting' }
      : { kind: 'unknown' };
  }
  const later = activity.transactions.filter((posted) => posted.date > latest.date);
  const lastDate = later.reduce(
    (max, posted) => (posted.date > max ? posted.date : max),
    latest.date,
  );
  return {
    kind: 'known',
    amount: addMoney(latest.amount, sumMoney(later.map((posted) => posted.amount))),
    asOf: lastDate,
    basedOn: latest.source,
  };
}

/**
 * Find the date an account's transactions run to.
 * @param activity - The account's activity.
 * @returns The latest transaction date, or null when there are none.
 */
export function coveredThrough(activity: AccountActivity): LocalDate | null {
  return activity.transactions.reduce<LocalDate | null>(
    (max, posted) => (max === null || posted.date > max ? posted.date : max),
    null,
  );
}

/**
 * Collect what the account detail view shows (S1.17).
 * @param account - The account.
 * @param activity - Its known balances and transactions.
 * @returns The detail.
 */
export function accountDetail(account: Account, activity: AccountActivity): AccountDetail {
  return {
    type: account.type,
    provider: account.provider,
    includeInAnalysis: account.includeInAnalysis,
    transferTreatment: account.transferTreatment,
    archived: isArchived(account),
    balance: currentBalance(account, activity),
    coveredThrough: coveredThrough(activity),
  };
}

/**
 * List the accounts a picker offers: the ones that are not archived (S1.14).
 * @param model - The model.
 * @returns The accounts, in model order.
 */
export function pickableAccounts(model: BudgetModel): readonly Account[] {
  return model.accounts.filter((account) => !isArchived(account));
}

/** The analysis settings of every account at one moment, which a month freezes when it closes. */
export type AccountSettingsSnapshot = readonly {
  readonly id: Account['id'];
  readonly includeInAnalysis: boolean;
  readonly transferTreatment: TransferTreatment;
}[];

/**
 * Copy every account's analysis settings, so a closed month keeps what applied when it closed and
 * a later change to the live account cannot reach it.
 * @param model - The model.
 * @returns The snapshot.
 */
export function snapshotAccountSettings(model: BudgetModel): AccountSettingsSnapshot {
  return model.accounts.map((account) => ({
    id: account.id,
    includeInAnalysis: account.includeInAnalysis,
    transferTreatment: account.transferTreatment,
  }));
}
