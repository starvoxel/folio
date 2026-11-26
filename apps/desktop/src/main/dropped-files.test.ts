// ------------------------------
// dropped-files.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-26
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { acceptDroppedPaths, MAX_DROPPED_FILES } from './dropped-files.js';

const csv = join(resolve('/downloads'), 'Statement March.csv');

describe('acceptDroppedPaths', () => {
  describe('absoluteCsvPaths', () => {
    it('areAcceptedWithTheirFileNames', () => {
      const upper = join(resolve('/downloads'), 'JAN.CSV');
      expect(acceptDroppedPaths([csv, upper])).toEqual({
        accepted: [
          { path: csv, name: 'Statement March.csv' },
          { path: upper, name: 'JAN.CSV' },
        ],
        rejected: 0,
      });
    });
  });

  describe('otherItems', () => {
    it('areCountedAndIgnored', () => {
      const result = acceptDroppedPaths([
        csv,
        join(resolve('/downloads'), 'notes.txt'),
        'relative.csv',
        '',
        `${resolve('/x')}\0.csv`,
        join(resolve('/downloads'), 'folder'),
      ]);
      expect(result?.accepted).toHaveLength(1);
      expect(result?.rejected).toBe(5);
    });
  });

  describe('aMalformedPayload', () => {
    it('returnsNull', () => {
      expect(acceptDroppedPaths('x')).toBeNull();
      expect(acceptDroppedPaths([1])).toBeNull();
      expect(acceptDroppedPaths(null)).toBeNull();
      expect(
        acceptDroppedPaths(Array.from({ length: MAX_DROPPED_FILES + 1 }, () => csv)),
      ).toBeNull();
    });
  });

  describe('noFiles', () => {
    it('acceptsNothing', () => {
      expect(acceptDroppedPaths([])).toEqual({ accepted: [], rejected: 0 });
    });
  });
});
