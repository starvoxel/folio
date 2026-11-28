// ------------------------------
// file-event-log.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-28
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { describe, expect, it } from 'vitest';

import type { FileEvent } from '@folio/host-api';

import { logFileEvent } from './file-event-log.js';
import type { Logger } from './logger.js';

/**
 * @param event - The event to log.
 * @returns The lines the logger received.
 */
function linesFor(event: FileEvent): string[] {
  const lines: string[] = [];
  const note = (level: string) => (message: string, fields?: Record<string, unknown>) => {
    lines.push(`${level} ${message} ${JSON.stringify(fields ?? {})}`);
  };
  const logger: Logger = {
    debug: note('debug'),
    info: note('info'),
    warn: note('warn'),
    error: note('error'),
    logError: note('error'),
  };
  logFileEvent(logger, event);
  return lines;
}

describe('logFileEvent', () => {
  describe('aCreatedFile', () => {
    it('logsFixedTextAtInfo', () => {
      expect(linesFor({ kind: 'created' })).toEqual(['info created a budget file {}']);
    });
  });

  describe('anOpenedFile', () => {
    it('logsOnlyCountsAndFlags', () => {
      expect(linesFor({ kind: 'opened', damagedLines: 2, fromBackup: true })).toEqual([
        'info opened a budget file {"damagedLines":2,"fromBackup":true}',
      ]);
    });
  });

  describe('aFailedOpen', () => {
    it('logsTheReasonCodeAtWarn', () => {
      expect(linesFor({ kind: 'openFailed', reason: 'checksumMismatch' })).toEqual([
        'warn could not open a budget file {"reason":"checksumMismatch"}',
      ]);
    });
  });
});
