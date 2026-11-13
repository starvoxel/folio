// ------------------------------
// clock.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { yearMonthOf, type LocalDate, type YearMonth } from './local-date.js';

/** The only source of time in the domain (AD-7), injected so "today" is testable. */
export interface Clock {
  /** The current calendar date where the household is. */
  today(): LocalDate;
  /** The current instant, in milliseconds since the Unix epoch, for audit timestamps. */
  nowEpochMs(): number;
}

/**
 * Find the month the clock is in.
 * @param clock - The clock.
 * @returns The current month.
 */
export function currentMonth(clock: Clock): YearMonth {
  return yearMonthOf(clock.today());
}

/**
 * Make a clock that never moves, for tests and tools.
 * @param date - The date it reports.
 * @param epochMs - The instant it reports; the Unix epoch unless given.
 * @returns The fixed clock.
 */
export function fixedClock(date: LocalDate, epochMs = 0): Clock {
  return { today: () => date, nowEpochMs: () => epochMs };
}
