// ------------------------------
// month-label.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { addMonths, type YearMonth } from '@folio/core';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/**
 * Write a month for people, such as "November 2026".
 * @param value - The month.
 * @returns The month name and year.
 */
export function formatMonthLabel(value: YearMonth): string {
  const name = MONTH_NAMES[Number(value.slice(5, 7)) - 1];
  return `${name ?? value.slice(5, 7)} ${value.slice(0, 4)}`;
}

/**
 * List a run of months ending at a given month, newest first.
 * @param newest - The most recent month.
 * @param count - How many months to list.
 * @returns The months, newest first.
 */
export function recentMonths(newest: YearMonth, count: number): YearMonth[] {
  return Array.from({ length: count }, (_unused, index) => addMonths(newest, -index));
}
