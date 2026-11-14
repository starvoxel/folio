// ------------------------------
// id.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import type { Brand } from '../support/brand.js';
import { err, ok, type ParseFailure, type Result } from '../support/result.js';

/**
 * A UUID that identifies one kind of entity (AD-7). The tag keeps ids of different entities apart
 * at compile time, for example `Id<'Account'>` and `Id<'Category'>`.
 */
export type Id<Tag extends string> = Brand<string, `Id:${Tag}`>;

/** Supplies fresh UUIDs; the host passes `() => crypto.randomUUID()`, tests pass a counter. */
export type IdSource = () => string;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

/**
 * Parse text into an id. Upper-case hexadecimal is accepted and written back in lower case.
 * @param text - The UUID text.
 * @returns The id, or a failure that does not repeat the text.
 */
export function parseId<Tag extends string>(text: string): Result<Id<Tag>, ParseFailure<'format'>> {
  const normalized = text.toLowerCase();
  if (!UUID_PATTERN.test(normalized)) {
    return err({ code: 'format', message: 'Not a UUID' });
  }
  return ok(normalized as Id<Tag>);
}

/**
 * Create an id from text that is expected to be a UUID.
 * @param text - The UUID text.
 * @returns The id.
 * @throws {RangeError} When the text is not a UUID.
 */
export function id<Tag extends string>(text: string): Id<Tag> {
  const result = parseId<Tag>(text);
  if (!result.ok) {
    throw new RangeError(result.error.message);
  }
  return result.value;
}

/**
 * Make a new id from the supplied source of UUIDs.
 * @param source - Where the UUID comes from.
 * @returns A new id.
 * @throws {RangeError} When the source returns something that is not a UUID.
 */
export function newId<Tag extends string>(source: IdSource): Id<Tag> {
  return id<Tag>(source());
}
