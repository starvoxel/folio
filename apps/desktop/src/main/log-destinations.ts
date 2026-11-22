// ------------------------------
// log-destinations.ts
//
// Author: Starvoxel AI Agent - 2026-11-22
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { combineWriters } from './logger.js';

/** What `createLogDestinations` needs. */
export interface LogDestinationOptions {
  /** Whether this is a packaged build. */
  readonly packaged: boolean;
  /** Whether the development-only unredacted output was asked for (`parseUnredacted`). */
  readonly unredacted: boolean;
  /** Writes one line to standard error. */
  readonly stderr: (line: string) => void;
  /** Makes the writer for a log file with the given name; called only when the file is needed. */
  readonly file: (fileName: string) => (line: string) => void;
}

/** Where the logger's lines go. */
export interface LogDestinations {
  /** The normal line: scrubbed and masked, safe to share. */
  readonly write: (line: string) => void;
  /** The unredacted line, present only in an unpackaged run that asked for it. */
  readonly writeUnredacted?: (line: string) => void;
}

/**
 * Decide which destinations get which lines.
 *
 * - Every run: the normal line goes to `folio.log` and to standard error.
 * - An unpackaged run with the unredacted output on: the raw line goes to the terminal and to
 *   `folio-unredacted.log`, and the terminal gets only the raw line, which holds everything the
 *   normal line does, so each message shows once. The normal line still goes to `folio.log`.
 * - A packaged build never gets a raw line, whatever `unredacted` says.
 * @param options - The build kind, the switch and the destinations.
 * @returns The writer for normal lines and, when allowed, the writer for raw lines.
 */
export function createLogDestinations(options: LogDestinationOptions): LogDestinations {
  const normalFile = options.file('folio.log');
  if (options.packaged || !options.unredacted) {
    return { write: combineWriters(options.stderr, normalFile) };
  }
  return {
    write: normalFile,
    writeUnredacted: combineWriters(options.stderr, options.file('folio-unredacted.log')),
  };
}
