// ------------------------------
// error-handlers.ts
//
// Author: Starvoxel AI Agent - 2026-11-19
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import type { Logger } from './logger.js';

/** The part of `process` that `installErrorHandlers` uses, so a test can pass a fake. */
export interface ErrorSource {
  on(event: 'uncaughtException', listener: (error: unknown) => void): unknown;
  on(event: 'unhandledRejection', listener: (reason: unknown) => void): unknown;
}

/** What `installErrorHandlers` needs. */
export interface ErrorHandlerServices {
  readonly logger: Logger;
  /** Show a fixed-text error to the person using the app. */
  readonly showError: (title: string, content: string) => void;
  /** Where the events come from; `process` in the app. */
  readonly source: ErrorSource;
}

const TITLE = 'Folio ran into a problem';
// Fixed text: nothing from the error reaches the screen.
const CONTENT =
  'Something unexpected went wrong. Details were written to the log. Folio is still running, ' +
  'but if anything looks wrong, close and reopen it.';

/**
 * Log uncaught exceptions and unhandled promise rejections, and tell the person once. The app
 * keeps running, which replaces Electron's default dialog (decided in plans/logging.md; revisit if
 * continuing after an unknown error proves unsafe). Only the first error shows a box, so a loop
 * of failures cannot bury the window in dialogs; every error is logged.
 * @param services - The logger, the error box and the event source.
 */
export function installErrorHandlers(services: ErrorHandlerServices): void {
  const { logger, showError, source } = services;
  let shown = false;
  const handle = (message: string, error: unknown): void => {
    logger.logError(message, error);
    if (shown) {
      return;
    }
    shown = true;
    try {
      showError(TITLE, CONTENT);
    } catch {
      // The log line is already written; failing to show a box must not raise another error.
    }
  };
  source.on('uncaughtException', (error) => {
    handle('uncaught exception', error);
  });
  source.on('unhandledRejection', (reason) => {
    handle('unhandled rejection', reason);
  });
}
