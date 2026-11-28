// ------------------------------
// file-event-log.ts
//
// Author: Starvoxel AI Agent - 2026-11-28
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import type { FileEvent } from '@folio/host-api';

import type { Logger } from './logger.js';

/**
 * Write the log line for a file event the page reported. The text is fixed here and the fields come
 * from a closed list, so the line carries no name, path or amount whatever the page sent (AD-10).
 * @param logger - The logger.
 * @param event - A validated event.
 */
export function logFileEvent(logger: Logger, event: FileEvent): void {
  switch (event.kind) {
    case 'created':
      logger.info('created a budget file');
      return;
    case 'opened':
      logger.info('opened a budget file', {
        damagedLines: event.damagedLines,
        fromBackup: event.fromBackup,
      });
      return;
    case 'openFailed':
      logger.warn('could not open a budget file', { reason: event.reason });
      return;
    default:
      assertNever(event);
  }
}

/**
 * Stop the build when an event kind is not handled.
 * @param value - The unhandled value.
 * @throws {Error} Always.
 */
function assertNever(value: never): never {
  throw new Error('Unhandled file event', { cause: value });
}
