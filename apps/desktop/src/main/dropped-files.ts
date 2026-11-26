// ------------------------------
// dropped-files.ts
//
// Author: Starvoxel AI Agent - 2026-11-26
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { basename, extname, isAbsolute } from 'node:path';

import type { FileRef } from '@folio/host-api';

/** The most files one drop may carry. A household drops a handful of statements at a time. */
export const MAX_DROPPED_FILES = 50;

const MAX_PATH_LENGTH = 4096;

/** What a drop contained after checking. */
export interface DropOutcome {
  /** The CSV files, as references the page may use. */
  readonly accepted: readonly FileRef[];
  /** How many dropped items were not usable (not a CSV, or not a valid path). */
  readonly rejected: number;
}

/**
 * Check the paths the preload read from a drop. Only absolute paths of CSV files are accepted;
 * anything else is counted and ignored. Other kinds of file reach the app through dialogs only.
 * @param value - Untrusted input: an array of paths.
 * @returns The outcome, or null when the payload is not an array of strings or is too long.
 */
export function acceptDroppedPaths(value: unknown): DropOutcome | null {
  if (
    !Array.isArray(value) ||
    value.length > MAX_DROPPED_FILES ||
    !(value as unknown[]).every((entry) => typeof entry === 'string')
  ) {
    return null;
  }
  const accepted: FileRef[] = [];
  let rejected = 0;
  for (const path of value as string[]) {
    const usable =
      path.length > 0 &&
      path.length <= MAX_PATH_LENGTH &&
      !path.includes('\0') &&
      isAbsolute(path) &&
      extname(path).toLowerCase() === '.csv';
    if (usable) {
      accepted.push({ path, name: basename(path) });
    } else {
      rejected += 1;
    }
  }
  return { accepted, rejected };
}
