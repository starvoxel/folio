// ------------------------------
// index.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

export { type Brand } from './support/brand.js';
export {
  err,
  mapResult,
  ok,
  unwrapResult,
  type Err,
  type Ok,
  type ParseFailure,
  type Result,
} from './support/result.js';
export {
  idSchema,
  localDateSchema,
  moneySchema,
  parseWithSchema,
  yearMonthSchema,
  type ValidationFailure,
  type ValidationIssue,
} from './support/schema.js';
export { currentMonth, fixedClock, type Clock } from './domain/clock.js';
export { systemClock } from './domain/system-clock.js';
export { id, newId, parseId, type Id, type IdSource } from './domain/id.js';
export {
  addMonths,
  daysInMonth,
  firstDayOf,
  isLeapYear,
  lastDayOf,
  localDate,
  localDateParts,
  parseLocalDate,
  parseYearMonth,
  yearMonth,
  yearMonthFromParts,
  yearMonthOf,
  type DateParseCode,
  type DateParts,
  type LocalDate,
  type YearMonth,
} from './domain/local-date.js';
export {
  MAX_MONEY_CENTS,
  ZERO_MONEY,
  addMoney,
  isMoney,
  money,
  moneyToDecimalString,
  negateMoney,
  parseMoney,
  subtractMoney,
  sumMoney,
  type Money,
  type MoneyParseCode,
} from './domain/money.js';
