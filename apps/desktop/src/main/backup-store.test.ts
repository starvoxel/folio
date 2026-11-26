// ------------------------------
// backup-store.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-26
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { describe, expect, it } from 'vitest';

import { writeBackup } from './backup-store.js';
import { createMemoryFs } from './memory-fs.js';

const directory = '/backups/abc';

describe('writeBackup', () => {
  describe('firstBackup', () => {
    it('writesTheBytesUnderATimestampedNameAndPrunesNothing', async () => {
      const fs = createMemoryFs();
      const outcome = await writeBackup(
        fs,
        directory,
        'a.folio',
        new Uint8Array([1, 2]),
        Date.UTC(2026, 0, 1),
        'x',
        3,
      );
      expect(outcome.backup.name).toBe('a-20260101T000000000Z.folio');
      expect(fs.files.get(outcome.backup.path)).toEqual(new Uint8Array([1, 2]));
      expect(outcome.pruned).toBe(0);
    });
  });

  describe('moreBackupsThanTheLimit', () => {
    it('deletesTheOldestAndKeepsTheNewest', async () => {
      const fs = createMemoryFs();
      for (let day = 1; day <= 4; day += 1) {
        await writeBackup(
          fs,
          directory,
          'a.folio',
          new Uint8Array([day]),
          Date.UTC(2026, 0, day),
          'x',
          2,
        );
      }
      expect(await fs.listDirectory(directory)).toEqual([
        'a-20260103T000000000Z.folio',
        'a-20260104T000000000Z.folio',
      ]);
    });
  });

  describe('failureWhileWriting', () => {
    it('leavesTheEarlierBackupsAlone', async () => {
      const fs = createMemoryFs();
      await writeBackup(
        fs,
        directory,
        'a.folio',
        new Uint8Array([1]),
        Date.UTC(2026, 0, 1),
        'x',
        2,
      );
      fs.failNext('rename');
      await expect(
        writeBackup(fs, directory, 'a.folio', new Uint8Array([2]), Date.UTC(2026, 0, 2), 'y', 2),
      ).rejects.toThrow('simulated');
      expect(await fs.listDirectory(directory)).toEqual(['a-20260101T000000000Z.folio']);
    });
  });
});
