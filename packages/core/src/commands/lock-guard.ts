// ------------------------------
// lock-guard.ts
//
// Author: Starvoxel AI Agent - 2026-11-27
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { err, ok, type Result } from '../support/result.js';
import type { YearMonth } from '../domain/local-date.js';
import type { ChangeSet } from './change-set.js';

/** Why the guard refused a change set. */
export interface MonthLockedFailure {
  readonly code: 'monthLocked';
  readonly months: readonly YearMonth[];
}

/**
 * The one check that keeps locked months unchanged (AD-4): refuse a change set that touches any
 * locked month.
 * @param changeSet - The change set about to be applied.
 * @param lockedMonths - The months that are locked.
 * @returns Success, or the locked months the change set touches.
 */
export function checkLocks(
  changeSet: ChangeSet,
  lockedMonths: readonly YearMonth[],
): Result<null, MonthLockedFailure> {
  const hit = changeSet.touchedMonths.filter((month) => lockedMonths.includes(month));
  return hit.length === 0 ? ok(null) : err({ code: 'monthLocked', months: hit });
}
