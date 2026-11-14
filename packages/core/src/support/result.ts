// ------------------------------
// result.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

/** A successful outcome carrying a value. */
export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

/** A failed outcome carrying an error value. */
export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

/** The outcome of an operation that can fail on untrusted input, without throwing. */
export type Result<T, E> = Ok<T> | Err<E>;

/**
 * Wrap a value as a successful result.
 * @param value - The value to carry.
 * @returns A successful result.
 */
export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

/**
 * Wrap an error as a failed result.
 * @param error - The error to carry.
 * @returns A failed result.
 */
export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

/**
 * Transform the value of a successful result; a failed result passes through unchanged.
 * @param result - The result to transform.
 * @param transform - Maps the success value.
 * @returns A result with the transformed value, or the original failure.
 */
export function mapResult<T, U, E>(result: Result<T, E>, transform: (value: T) => U): Result<U, E> {
  return result.ok ? ok(transform(result.value)) : result;
}

/**
 * Take the value out of a result, for callers that have already decided a failure is a bug.
 * @param result - The result to open.
 * @returns The success value.
 * @throws {Error} When the result is a failure; the error value is attached as the cause.
 */
export function unwrapResult<T, E>(result: Result<T, E>): T {
  if (result.ok) {
    return result.value;
  }
  throw new Error('Expected a successful result but it was a failure', { cause: result.error });
}

/**
 * Describes why untrusted text was rejected. The message never repeats the input, so a failure
 * can be logged without leaking financial data.
 */
export interface ParseFailure<Code extends string> {
  readonly code: Code;
  readonly message: string;
}
