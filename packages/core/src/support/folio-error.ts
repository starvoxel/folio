// ------------------------------
// folio-error.ts
//
// Author: Starvoxel AI Agent - 2026-11-21
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

/** What a `FolioError` can carry besides its message. */
export interface FolioErrorOptions {
  /** The error that caused this one, kept as the original; its message is not logged. */
  readonly cause?: unknown;
}

/**
 * An error the app raises itself, whose message is safe to log (AD-10). The logger writes it as it
 * is, so it holds fixed text, ids, counts, dates, positions and hashes, never a value from a file,
 * field or setting: `row 12, column 3 is not an amount`, not `"1,2oo.00" is not an amount`. Wrap a
 * third-party error as the `cause`; its message is never logged.
 */
export class FolioError extends Error {
  /**
   * @param message - Fixed text with ids, counts, dates and positions only.
   * @param options - The cause, when this error wraps another.
   */
  public constructor(message: string, options?: FolioErrorOptions) {
    super(message, options);
    this.name = 'FolioError';
  }
}
