// ------------------------------
// money.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import type { Brand } from '../support/brand.js';
import { err, ok, type ParseFailure, type Result } from '../support/result.js';

/**
 * An amount of money as a whole number of cents (AD-7). The range is about plus or minus 90
 * trillion dollars: every value is a safe integer, so arithmetic never silently loses precision.
 * Never do floating-point arithmetic on money; use the helpers in this file.
 */
export type Money = Brand<number, 'Money'>;

/** The largest amount, in cents. */
export const MAX_MONEY_CENTS = Number.MAX_SAFE_INTEGER;

/** The zero amount. */
export const ZERO_MONEY = 0 as Money;

/** Why a decimal string was rejected by `parseMoney`. */
export type MoneyParseCode = 'format' | 'tooManyDecimals' | 'outOfRange';

const DECIMAL_PATTERN = /^([+-]?)(\d+)(?:\.(\d+))?$/u;
const MAX_MONEY_BIG = BigInt(MAX_MONEY_CENTS);

/**
 * Check whether a value is a valid amount: a safe integer count of cents.
 * @param value - The value to test.
 * @returns True when the value is a safe integer.
 */
export function isMoney(value: unknown): value is Money {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

/**
 * Create an amount from a whole number of cents.
 * @param cents - The amount in cents.
 * @returns The branded amount; negative zero becomes zero.
 * @throws {RangeError} When the value is not a safe integer.
 */
export function money(cents: number): Money {
  if (!Number.isSafeInteger(cents)) {
    throw new RangeError('An amount must be a safe integer count of cents');
  }
  // Adding zero turns -0 into 0, so two equal amounts are never told apart by Object.is.
  return (cents + 0) as Money;
}

/**
 * Add two amounts.
 * @param left - The first amount.
 * @param right - The second amount.
 * @returns The sum.
 * @throws {RangeError} When the sum is not a safe integer.
 */
export function addMoney(left: Money, right: Money): Money {
  return money(left + right);
}

/**
 * Subtract one amount from another.
 * @param left - The amount to subtract from.
 * @param right - The amount to subtract.
 * @returns The difference.
 * @throws {RangeError} When the difference is not a safe integer.
 */
export function subtractMoney(left: Money, right: Money): Money {
  return money(left - right);
}

/**
 * Reverse the sign of an amount.
 * @param value - The amount.
 * @returns The amount with the opposite sign.
 */
export function negateMoney(value: Money): Money {
  return money(0 - value);
}

/**
 * Add up a list of amounts; an empty list sums to zero. Every partial sum is checked.
 * @param values - The amounts to add.
 * @returns The total.
 * @throws {RangeError} When any partial sum is not a safe integer.
 */
export function sumMoney(values: readonly Money[]): Money {
  return values.reduce(addMoney, ZERO_MONEY);
}

/**
 * Parse a plain decimal string such as `-12.50` into cents without going through a float. The
 * grammar is strict: an optional sign, digits, and at most two decimals. Currency symbols,
 * thousands separators and brackets are the import pipeline's concern, not this function's.
 * @param text - The decimal text.
 * @returns The amount, or a failure that does not repeat the text.
 */
export function parseMoney(text: string): Result<Money, ParseFailure<MoneyParseCode>> {
  const match = DECIMAL_PATTERN.exec(text);
  if (match === null) {
    return err({ code: 'format', message: 'Not a plain decimal amount' });
  }
  const [, sign = '', whole = '', fraction = ''] = match;
  if (fraction.length > 2) {
    return err({ code: 'tooManyDecimals', message: 'An amount has at most two decimals' });
  }
  // BigInt keeps every digit exact; a Number here could round a long digit string silently.
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (cents > MAX_MONEY_BIG) {
    return err({ code: 'outOfRange', message: 'The amount is too large' });
  }
  return ok(money(sign === '-' ? -Number(cents) : Number(cents)));
}

/**
 * Write an amount as a plain decimal string, from the integer cents, never through a float.
 * @param value - The amount.
 * @returns Text such as `-12.50` or `0.05`.
 */
export function moneyToDecimalString(value: Money): string {
  const absolute = Math.abs(value);
  const remainder = absolute % 100;
  // Subtracting the remainder first makes the division exact: no float rounding near the limit.
  const whole = (absolute - remainder) / 100;
  const fraction = String(remainder).padStart(2, '0');
  return `${value < 0 ? '-' : ''}${String(whole)}.${fraction}`;
}
