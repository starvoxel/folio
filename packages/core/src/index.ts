// ------------------------------
// index.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

export { FolioError, type FolioErrorOptions } from './support/folio-error.js';
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
export { createStore, type Store } from './state/store.js';
export {
  DEFAULT_MACHINE_SETTINGS,
  THEME_PREFERENCES,
  readMachineSettings,
  type MachineSettings,
  type ThemePreference,
} from './settings/machine-settings.js';
export {
  ACCOUNT_TYPES,
  accountDefaults,
  isArchived,
  type Account,
  type AccountDefaults,
  type AccountType,
  type ArchivePeriod,
  type TransferTreatment,
} from './budget/account.js';
export { isIncludedInMonth } from './budget/account-rules.js';
export { INCOME_CATEGORY_ID, INCOME_CATEGORY_NAME, type Category } from './budget/category.js';
export {
  createBudget,
  type BudgetModel,
  type HouseholdSettings,
  type SetupState,
  type SetupStep,
} from './budget/model.js';
export {
  applyChangeSet,
  invertChangeSet,
  type ChangePart,
  type ChangeSet,
  type EntityChange,
  type Placed,
} from './commands/change-set.js';
export {
  type AccountChanges,
  type Command,
  type CommandContext,
  type CommandFailure,
} from './commands/command.js';
export { applyCommand, type CommandOutcome } from './commands/apply-command.js';
export { checkLocks, type MonthLockedFailure } from './commands/lock-guard.js';
