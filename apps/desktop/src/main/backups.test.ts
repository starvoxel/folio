// ------------------------------
// backups.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-26
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { describe, expect, it } from 'vitest';

import { backupFileName, backupsToDelete, backupStamp } from './backups.js';

describe('backupStamp', () => {
  describe('aMoment', () => {
    it('writesUtcDigitsThatSortInTimeOrder', () => {
      expect(backupStamp(Date.UTC(2026, 10, 26, 2, 45, 0, 123))).toBe('20261126T024500123Z');
    });
  });
});

describe('backupFileName', () => {
  describe('aFileWithAnExtension', () => {
    it('putsTheStampBeforeTheExtension', () => {
      expect(backupFileName('Household 2026.folio', Date.UTC(2026, 0, 2, 3, 4, 5, 6))).toBe(
        'Household 2026-20260102T030405006Z.folio',
      );
    });
  });
});

describe('backupsToDelete', () => {
  const name = (day: number): string => backupFileName('a.folio', Date.UTC(2026, 0, day));

  describe('moreThanTheLimit', () => {
    it('returnsTheOldestOnes', () => {
      const names = [name(3), name(1), name(2), name(4)];
      expect(backupsToDelete(names, 'a.folio', 2)).toEqual([name(1), name(2)]);
    });
  });

  describe('withinTheLimit', () => {
    it('returnsNothing', () => {
      expect(backupsToDelete([name(1), name(2)], 'a.folio', 2)).toEqual([]);
    });
  });

  describe('otherFilesInTheFolder', () => {
    it('areNeverDeleted', () => {
      const names = ['notes.txt', 'a.folio', 'a-2026.folio', backupFileName('b.folio', 0), name(1)];
      expect(backupsToDelete(names, 'a.folio', 0)).toEqual([name(1)]);
    });
  });

  describe('aNameWithRegexCharacters', () => {
    it('isMatchedLiterally', () => {
      const special = backupFileName('a(1)+b.folio', 0);
      expect(backupsToDelete([special, backupFileName('aXb.folio', 0)], 'a(1)+b.folio', 0)).toEqual(
        [special],
      );
    });
  });
});
