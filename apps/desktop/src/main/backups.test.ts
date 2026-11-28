// ------------------------------
// backups.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-26
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { describe, expect, it } from 'vitest';

import { backupFileName, backupsToDelete, backupStamp, newestBackup } from './backups.js';

describe('backupStamp', () => {
  describe('aMoment', () => {
    it('writesUtcDigitsToTheWholeSecond', () => {
      expect(backupStamp(Date.UTC(2026, 10, 26, 2, 45, 0, 999))).toBe('20261126-024500');
    });
  });
});

describe('backupFileName', () => {
  describe('aFileWithAnExtension', () => {
    it('putsUnderscoreAndTheStampBeforeTheExtension', () => {
      expect(backupFileName('Household 2026.folio', Date.UTC(2026, 0, 2, 3, 4, 5, 6))).toBe(
        'Household 2026_20260102-030405.folio',
      );
    });
  });

  describe('aNameThatIsAlreadyTaken', () => {
    it('getsTheNextFreeCounter', () => {
      const at = Date.UTC(2026, 0, 2, 3, 4, 5);
      const first = backupFileName('a.folio', at);
      const second = backupFileName('a.folio', at, [first]);
      const third = backupFileName('a.folio', at, [first, second]);
      expect([second, third]).toEqual(['a_20260102-030405_2.folio', 'a_20260102-030405_3.folio']);
    });
  });

  describe('theOldestBackupOfTheSecondWasPruned', () => {
    it('stillNumbersAboveTheHighestCounterSoTheNewestSortsLast', () => {
      const at = Date.UTC(2026, 0, 2, 3, 4, 5);
      const taken = ['a_20260102-030405_2.folio', 'a_20260102-030405_3.folio'];
      const next = backupFileName('a.folio', at, taken);
      expect(next).toBe('a_20260102-030405_4.folio');
      expect(backupsToDelete([...taken, next], 'a.folio', 2)).toEqual([taken[0]]);
    });
  });

  describe('theNextSecond', () => {
    it('startsAgainWithoutACounter', () => {
      const taken = [backupFileName('a.folio', Date.UTC(2026, 0, 2, 3, 4, 5))];
      expect(backupFileName('a.folio', Date.UTC(2026, 0, 2, 3, 4, 6), taken)).toBe(
        'a_20260102-030406.folio',
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

  describe('manyBackupsInOneSecond', () => {
    it('orderCountersAsNumbersSoTenFollowsNine', () => {
      const at = Date.UTC(2026, 0, 1);
      const names: string[] = [];
      for (let index = 0; index < 11; index += 1) {
        names.push(backupFileName('a.folio', at, names));
      }
      expect(backupsToDelete([...names].reverse(), 'a.folio', 10)).toEqual([names[0]]);
      expect(backupsToDelete(names, 'a.folio', 1)).toHaveLength(10);
      expect(backupsToDelete(names, 'a.folio', 1)).not.toContain(names[10]);
    });
  });

  describe('aProtectedName', () => {
    it('isNeverDeletedEvenWhenItSortsAsTheOldest', () => {
      const names = [name(5), name(6), name(1)];
      expect(backupsToDelete(names, 'a.folio', 2, name(1))).toEqual([name(5)]);
      expect(backupsToDelete(names, 'a.folio', 2)).toEqual([name(1)]);
    });
  });

  describe('aFileWithoutAnExtension', () => {
    it('isNamedAndMatchedLikeAnyOther', () => {
      const made = backupFileName('Budget', Date.UTC(2026, 0, 1));
      expect(made).toBe('Budget_20260101-000000');
      expect(backupsToDelete([made], 'Budget', 0)).toEqual([made]);
    });
  });

  describe('otherFilesInTheFolder', () => {
    it('areNeverDeleted', () => {
      const names = ['notes.txt', 'a.folio', 'a_2026.folio', backupFileName('b.folio', 0), name(1)];
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

describe('newestBackup', () => {
  describe('backupsAcrossSecondsAndCounters', () => {
    it('picksTheLatestByTimeThenByNumber', () => {
      const names = [
        'Household_20260101-000000.folio',
        'Household_20260101-000001_2.folio',
        'Household_20260101-000001_10.folio',
        'Household_20260101-000001.folio',
        'notes.txt',
      ];
      expect(newestBackup(names, 'Household.folio')).toBe('Household_20260101-000001_10.folio');
    });
  });

  describe('noBackupsOfThisFile', () => {
    it('returnsNull', () => {
      expect(newestBackup(['Other_20260101-000000.folio'], 'Household.folio')).toBeNull();
      expect(newestBackup([], 'Household.folio')).toBeNull();
    });
  });
});
