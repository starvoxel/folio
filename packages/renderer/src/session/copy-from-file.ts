// ------------------------------
// copy-from-file.ts
//
// Author: Starvoxel AI Agent - 2026-11-28
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import {
  categoriesFromFile,
  err,
  ok,
  type Category,
  type CopyOptions,
  type DecodeFailure,
  type Result,
} from '@folio/core';
import { hostErrorCode, type FileRef, type FileStore } from '@folio/host-api';

/** Why the categories of another file could not be copied. Nothing is changed in any case. */
export type CopyFailure =
  | { readonly kind: 'notFound' }
  | { readonly kind: 'unreadable' }
  | { readonly kind: 'invalidFile'; readonly failure: DecodeFailure };

/**
 * Read another budget file and take its categories (S1.6). The file is only read: it is not locked
 * and not backed up, and nothing but its categories is kept.
 * @param store - Where files are read from.
 * @param file - The other file, chosen by the person.
 * @param options - The digest and the source of new ids.
 * @returns The categories with fresh ids, or why they could not be read.
 */
export async function copyCategoriesFromFile(
  store: Pick<FileStore, 'open'>,
  file: FileRef,
  options: CopyOptions,
): Promise<Result<readonly Category[], CopyFailure>> {
  let bytes: Uint8Array;
  try {
    bytes = (await store.open(file)).bytes;
  } catch (error) {
    return err({ kind: hostErrorCode(error) === 'notFound' ? 'notFound' : 'unreadable' });
  }
  const copied = await categoriesFromFile(bytes, options);
  return copied.ok ? ok(copied.value) : err({ kind: 'invalidFile', failure: copied.error });
}

/** What to tell the person when a copy fails. */
export interface CopyFailureMessage {
  readonly title: string;
  readonly message: string;
}

/**
 * Say why categories could not be copied. No message repeats anything from the file.
 * @param failure - The failure.
 * @returns The text.
 */
export function describeCopyFailure(failure: CopyFailure): CopyFailureMessage {
  switch (failure.kind) {
    case 'notFound':
      return { title: 'File not found', message: 'The file is missing or was moved.' };
    case 'unreadable':
      return {
        title: 'The file could not be read',
        message: 'Folio was not allowed to read it, or the drive is not available.',
      };
    case 'invalidFile':
      return failure.failure.code === 'newerFormat'
        ? {
            title: 'This file needs a newer Folio',
            message: 'It was saved by a newer version of the app. Update Folio to copy from it.',
          }
        : {
            title: 'This file is damaged',
            message: 'Folio cannot read it, so no categories were copied and nothing was changed.',
          };
    default:
      return assertNever(failure);
  }
}

/**
 * Stop the build when a failure kind is not handled.
 * @param value - The unhandled value.
 * @throws {Error} Always.
 */
function assertNever(value: never): never {
  throw new Error('Unhandled failure', { cause: value });
}
