// ------------------------------
// copy-from-file.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-28
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { describe, expect, it } from 'vitest';

import { createBudget, encodeFolio, fixedClock, localDate } from '@folio/core';
import { createHostFileStore, createMockHost, type FileRef } from '@folio/host-api';

import { copyCategoriesFromFile, describeCopyFailure } from './copy-from-file.js';
import { webDigest } from './web-digest.js';

const source: FileRef = { path: '/data/Source.folio', name: 'Source.folio' };

/**
 * @returns A source of distinct UUIDs.
 */
function counter(): () => string {
  let n = 0;
  return () => `dddddddd-0000-4000-8000-${String((n += 1)).padStart(12, '0')}`;
}

describe('copyCategoriesFromFile', () => {
  describe('aValidFile', () => {
    it('givesItsCategoriesAndLocksNothing', async () => {
      const bytes = await encodeFolio(createBudget('Source', fixedClock(localDate('2026-01-01'))), {
        digest: webDigest,
      });
      const host = createMockHost({ files: { [source.path]: bytes } });
      const copied = await copyCategoriesFromFile(createHostFileStore(host), source, {
        digest: webDigest,
        ids: counter(),
      });
      expect(copied.ok && copied.value.map((category) => category.name)).toEqual(['Income']);
      expect(host.controls.heldLocks).toEqual([]);
      expect(host.controls.backups).toEqual([]);
    });
  });

  describe('aMissingFile', () => {
    it('failsWithNotFound', async () => {
      const copied = await copyCategoriesFromFile(createHostFileStore(createMockHost()), source, {
        digest: webDigest,
        ids: counter(),
      });
      expect(copied).toEqual({ ok: false, error: { kind: 'notFound' } });
    });
  });

  describe('aDamagedFile', () => {
    it('failsWithInvalidFile', async () => {
      const host = createMockHost({ files: { [source.path]: new Uint8Array([1, 2, 3]) } });
      const copied = await copyCategoriesFromFile(createHostFileStore(host), source, {
        digest: webDigest,
        ids: counter(),
      });
      expect(copied).toEqual({
        ok: false,
        error: { kind: 'invalidFile', failure: { code: 'notAZip' } },
      });
    });
  });
});

describe('describeCopyFailure', () => {
  describe('everyKind', () => {
    it('hasATitleAndRepeatsNothingFromTheFile', () => {
      const failures = [
        { kind: 'notFound' },
        { kind: 'unreadable' },
        { kind: 'invalidFile', failure: { code: 'notAZip' } },
        { kind: 'invalidFile', failure: { code: 'newerFormat', formatVersion: 3 } },
      ] as const;
      for (const failure of failures) {
        expect(describeCopyFailure(failure).title).not.toBe('');
      }
      expect(describeCopyFailure(failures[3]).title).toBe('This file needs a newer Folio');
    });
  });
});
