// ------------------------------
// account-rules.ts
//
// Author: Starvoxel AI Agent - 2026-11-27
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { firstDayOf, lastDayOf, type YearMonth } from '../domain/local-date.js';
import type { Account } from './account.js';

/**
 * Tell whether an account counts toward a month's coverage, checklist and net worth.
 * An account archived at any point in the month is out for the whole month (S1.14); after it is
 * unarchived it is in again from the first month it is active throughout (S1.15). The analysis
 * flag is a separate setting and is not read here.
 * @param account - The account.
 * @param month - The month.
 * @returns True when the account was never archived during the month.
 */
export function isIncludedInMonth(account: Account, month: YearMonth): boolean {
  const first = firstDayOf(month);
  const last = lastDayOf(month);
  return !account.archivePeriods.some(
    (period) =>
      period.archivedFrom <= last && (period.unarchivedOn === null || period.unarchivedOn > first),
  );
}
