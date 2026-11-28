// ------------------------------
// copy-categories.ts
//
// Author: Starvoxel AI Agent - 2026-11-28
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { INCOME_CATEGORY_ID, type Category } from '../budget/category.js';
import { newId, type IdSource } from '../domain/id.js';
import { decodeFolio } from '../file/codec.js';
import type { Digest } from '../file/digest.js';
import type { DecodeFailure } from '../file/failures.js';
import { err, ok, type Result } from '../support/result.js';

/**
 * Whether Copy from an existing file also copies rules. Not yet: rules have no schema until the
 * categorization plan, so setup says that only categories are copied (S1.6).
 */
export const COPY_FROM_FILE_COPIES_RULES = false;

/** What `categoriesFromFile` needs. */
export interface CopyOptions {
  readonly digest: Digest;
  /** Supplies the ids of the copied categories, so they never clash with the old file's. */
  readonly ids: IdSource;
}

/**
 * Read the categories of another budget file, and nothing else of it. The file goes through the
 * same codec as any file, so a damaged or newer one fails the same way, and its accounts,
 * transactions and months are never carried over.
 * @param bytes - The other file's bytes, read without opening or locking it.
 * @param options - The digest and the source of new ids.
 * @returns The categories with fresh ids (Income keeps its fixed one), or why the file cannot be read.
 */
export async function categoriesFromFile(
  bytes: Uint8Array,
  options: CopyOptions,
): Promise<Result<readonly Category[], DecodeFailure>> {
  const decoded = await decodeFolio(bytes, { digest: options.digest });
  if (!decoded.ok) {
    return err(decoded.error);
  }
  const fresh = new Map<string, Category['id']>();
  for (const category of decoded.value.model.categories) {
    fresh.set(
      category.id,
      category.id === INCOME_CATEGORY_ID ? INCOME_CATEGORY_ID : newId<'Category'>(options.ids),
    );
  }
  return ok(
    decoded.value.model.categories.flatMap((category) => {
      const id = fresh.get(category.id);
      const parentId = category.parentId === null ? null : fresh.get(category.parentId);
      return id === undefined || parentId === undefined
        ? []
        : [{ id, name: category.name, parentId }];
    }),
  );
}
