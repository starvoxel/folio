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
 * An error the app raises itself, whose message is safe to write to a diagnostic log (AD-10).
 *
 * The message is the message standard in one place: fixed text, plus ids, counts, dates, positions
 * (row, column, offset) and hashes, and never a value taken from a file, a field or a setting.
 * Write `row 12, column 3 is not an amount`, not `"1,2oo.00" is not an amount`. The logger writes
 * this message as it is, so nothing the caller puts in it is hidden or checked.
 *
 * Code that catches a third-party error wraps it, keeping the original as the cause: the cause's
 * message is never logged, because a library's message can quote data.
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
