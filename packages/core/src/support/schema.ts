// ------------------------------
// schema.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { z } from 'zod';

import { type Id, parseId } from '../domain/id.js';
import {
  type LocalDate,
  type YearMonth,
  parseLocalDate,
  parseYearMonth,
} from '../domain/local-date.js';
import { type Money, isMoney } from '../domain/money.js';
import { err, ok, type Result } from './result.js';

/** One problem found while validating untrusted input. It names where, never what the value was. */
export interface ValidationIssue {
  readonly path: string;
  readonly message: string;
}

/** The failure of `parseWithSchema`. */
export interface ValidationFailure {
  readonly code: 'invalid';
  readonly issues: readonly ValidationIssue[];
}

/** A schema for an amount in whole cents. */
export const moneySchema = z.custom<Money>(isMoney, {
  message: 'Not a safe integer count of cents',
});

/** A schema for a `YYYY-MM-DD` date that exists. */
export const localDateSchema = z.custom<LocalDate>(
  (value) => typeof value === 'string' && parseLocalDate(value).ok,
  { message: 'Not a date written YYYY-MM-DD' },
);

/** A schema for a `YYYY-MM` month. */
export const yearMonthSchema = z.custom<YearMonth>(
  (value) => typeof value === 'string' && parseYearMonth(value).ok,
  { message: 'Not a month written YYYY-MM' },
);

/**
 * Make a schema for an id of one entity kind.
 * @returns A schema that accepts UUID strings and returns them as branded ids.
 */
export function idSchema<Tag extends string>(): z.ZodType<Id<Tag>> {
  return z.custom<Id<Tag>>((value) => typeof value === 'string' && parseId<Tag>(value).ok, {
    message: 'Not a UUID',
  });
}

/**
 * Validate untrusted input (parsed JSON, a message from the other side of the bridge, an imported
 * file) against a schema. Parsed JSON is never trusted without this (AD-2).
 * @param schema - The schema the input must satisfy.
 * @param input - The untrusted value.
 * @returns The validated value, or the list of problems with their paths.
 */
export function parseWithSchema<S extends z.ZodType>(
  schema: S,
  input: unknown,
): Result<z.output<S>, ValidationFailure> {
  const parsed = schema.safeParse(input);
  if (parsed.success) {
    return ok(parsed.data);
  }
  return err({
    code: 'invalid',
    issues: parsed.error.issues.map((issue) => ({
      path: issue.path.map(String).join('.'),
      message: issue.message,
    })),
  });
}
