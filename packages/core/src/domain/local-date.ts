// ------------------------------
// local-date.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import type { Brand } from '../support/brand.js';
import { err, ok, type ParseFailure, type Result } from '../support/result.js';

/** A calendar date with no time or time zone, written `YYYY-MM-DD` (AD-7). */
export type LocalDate = Brand<string, 'LocalDate'>;

/** A calendar month, written `YYYY-MM` (AD-7). */
export type YearMonth = Brand<string, 'YearMonth'>;

/** Why a date or month string was rejected. */
export type DateParseCode = 'format' | 'outOfRange';

/** The numeric parts of a date. */
export interface DateParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/u;
const MONTH_PATTERN = /^(\d{4})-(\d{2})$/u;
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

/**
 * Tell whether a year has a 29th of February.
 * @param year - The year.
 * @returns True for leap years of the Gregorian calendar.
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Count the days in a month.
 * @param year - The year, which decides February.
 * @param month - The month, 1 to 12.
 * @returns The number of days.
 * @throws {RangeError} When the month is not 1 to 12.
 */
export function daysInMonth(year: number, month: number): number {
  const days = DAYS_IN_MONTH[month - 1];
  if (days === undefined || !Number.isInteger(month)) {
    throw new RangeError('A month must be a whole number from 1 to 12');
  }
  return month === 2 && isLeapYear(year) ? 29 : days;
}

/**
 * Parse `YYYY-MM-DD` into a checked date. The year must be 0001 to 9999 and the day must exist.
 * @param text - The date text.
 * @returns The date, or a failure that does not repeat the text.
 */
export function parseLocalDate(text: string): Result<LocalDate, ParseFailure<DateParseCode>> {
  const match = DATE_PATTERN.exec(text);
  if (match === null) {
    return err({ code: 'format', message: 'Not a date written YYYY-MM-DD' });
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    return err({ code: 'outOfRange', message: 'The date does not exist' });
  }
  return ok(text as LocalDate);
}

/**
 * Create a date from text that is expected to be valid.
 * @param text - The date text, `YYYY-MM-DD`.
 * @returns The date.
 * @throws {RangeError} When the text is not a real date.
 */
export function localDate(text: string): LocalDate {
  const result = parseLocalDate(text);
  if (!result.ok) {
    throw new RangeError(result.error.message);
  }
  return result.value;
}

/**
 * Parse `YYYY-MM` into a checked month. The year must be 0001 to 9999.
 * @param text - The month text.
 * @returns The month, or a failure that does not repeat the text.
 */
export function parseYearMonth(text: string): Result<YearMonth, ParseFailure<DateParseCode>> {
  const match = MONTH_PATTERN.exec(text);
  if (match === null) {
    return err({ code: 'format', message: 'Not a month written YYYY-MM' });
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (year < 1 || month < 1 || month > 12) {
    return err({ code: 'outOfRange', message: 'The month does not exist' });
  }
  return ok(text as YearMonth);
}

/**
 * Create a month from text that is expected to be valid.
 * @param text - The month text, `YYYY-MM`.
 * @returns The month.
 * @throws {RangeError} When the text is not a real month.
 */
export function yearMonth(text: string): YearMonth {
  const result = parseYearMonth(text);
  if (!result.ok) {
    throw new RangeError(result.error.message);
  }
  return result.value;
}

/**
 * Split a date into numbers.
 * @param date - The date.
 * @returns Its year, month and day.
 */
export function localDateParts(date: LocalDate): DateParts {
  return {
    year: Number(date.slice(0, 4)),
    month: Number(date.slice(5, 7)),
    day: Number(date.slice(8, 10)),
  };
}

/**
 * Find the month a date falls in.
 * @param date - The date.
 * @returns The month of the date.
 */
export function yearMonthOf(date: LocalDate): YearMonth {
  return date.slice(0, 7) as YearMonth;
}

/**
 * Build a month from numbers.
 * @param year - The year, 1 to 9999.
 * @param month - The month, 1 to 12.
 * @returns The month.
 * @throws {RangeError} When the year or month is out of range.
 */
export function yearMonthFromParts(year: number, month: number): YearMonth {
  if (!Number.isInteger(year) || year < 1 || year > 9999) {
    throw new RangeError('A year must be a whole number from 1 to 9999');
  }
  return yearMonth(`${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`);
}

/**
 * Move a month forward or back by a number of whole months.
 * @param value - The starting month.
 * @param count - How many months to move; negative moves back.
 * @returns The month that many months away.
 * @throws {RangeError} When the result is outside years 1 to 9999.
 */
export function addMonths(value: YearMonth, count: number): YearMonth {
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const index = year * 12 + (month - 1) + count;
  return yearMonthFromParts(Math.floor(index / 12), (index % 12) + 1);
}

/**
 * Find the first day of a month.
 * @param value - The month.
 * @returns The date of its first day.
 */
export function firstDayOf(value: YearMonth): LocalDate {
  return `${value}-01` as LocalDate;
}

/**
 * Find the last day of a month.
 * @param value - The month.
 * @returns The date of its last day.
 */
export function lastDayOf(value: YearMonth): LocalDate {
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  return `${value}-${String(daysInMonth(year, month)).padStart(2, '0')}` as LocalDate;
}
