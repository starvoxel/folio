// ------------------------------
// atomic-write.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-26
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  readStamped,
  sameStamp,
  stampOf,
  temporaryPathFor,
  writeAtomically,
} from './atomic-write.js';
import { createMemoryFs } from './memory-fs.js';

const folder = resolve('/data');
const target = join(folder, 'Household.folio');
const bytes = (...values: number[]): Uint8Array => new Uint8Array(values);

describe('stampOf', () => {
  describe('aFractionalTime', () => {
    it('cutsItToWholeMilliseconds', () => {
      expect(stampOf({ mtimeMs: 1234.987, size: 5 })).toEqual({ modifiedMs: 1234, sizeBytes: 5 });
    });
  });
});

describe('sameStamp', () => {
  describe('differentTimeOrSize', () => {
    it('returnsFalse', () => {
      const stamp = { modifiedMs: 1, sizeBytes: 1 };
      expect(sameStamp(stamp, { modifiedMs: 2, sizeBytes: 1 })).toBe(false);
      expect(sameStamp(stamp, { modifiedMs: 1, sizeBytes: 2 })).toBe(false);
      expect(sameStamp(stamp, { ...stamp })).toBe(true);
    });
  });
});

describe('temporaryPathFor', () => {
  describe('aTarget', () => {
    it('staysInTheTargetsFolderAndCarriesTheId', () => {
      expect(temporaryPathFor(target, 'abc')).toBe(join(folder, '.Household.folio.abc.tmp'));
    });
  });
});

describe('readStamped', () => {
  describe('missingFile', () => {
    it('rejectsWithNotFound', async () => {
      await expect(readStamped(createMemoryFs(), target)).rejects.toMatchObject({
        code: 'notFound',
      });
    });
  });

  describe('existingFile', () => {
    it('returnsTheBytesAndTheirStamp', async () => {
      const fs = createMemoryFs();
      fs.touch(target, bytes(1, 2, 3));
      const read = await readStamped(fs, target);
      expect(read.bytes).toEqual(bytes(1, 2, 3));
      expect(read.stamp.sizeBytes).toBe(3);
    });
  });
});

describe('writeAtomically', () => {
  describe('newFile', () => {
    it('savesAndLeavesNoTemporaryFile', async () => {
      const fs = createMemoryFs();
      const result = await writeAtomically(fs, target, bytes(9), null, 'a');
      expect(result.kind).toBe('saved');
      expect([...fs.files.keys()]).toEqual([target]);
    });
  });

  describe('unchangedFile', () => {
    it('replacesItAndReturnsTheNewStamp', async () => {
      const fs = createMemoryFs();
      fs.touch(target, bytes(1));
      const { stamp } = await readStamped(fs, target);
      const result = await writeAtomically(fs, target, bytes(2, 2), stamp, 'a');
      expect(result).toMatchObject({ kind: 'saved', stamp: { sizeBytes: 2 } });
      expect(fs.files.get(target)).toEqual(bytes(2, 2));
    });
  });

  describe('fileChangedByAnotherProgram', () => {
    it('refusesAndKeepsTheOtherVersion', async () => {
      const fs = createMemoryFs();
      fs.touch(target, bytes(1));
      const { stamp } = await readStamped(fs, target);
      fs.touch(target, bytes(7, 7, 7));
      const result = await writeAtomically(fs, target, bytes(2), stamp, 'a');
      expect(result.kind).toBe('changedOnDisk');
      expect(fs.files.get(target)).toEqual(bytes(7, 7, 7));
    });
  });

  describe('fileDeletedAfterItWasRead', () => {
    it('rejectsWithNotFoundInsteadOfRecreatingIt', async () => {
      const fs = createMemoryFs();
      await expect(
        writeAtomically(fs, target, bytes(1), { modifiedMs: 1, sizeBytes: 1 }, 'a'),
      ).rejects.toMatchObject({ code: 'notFound' });
      expect(fs.files.size).toBe(0);
    });
  });

  describe('failureWhileWritingTheTemporaryFile', () => {
    it('keepsTheOldFileAndCleansUp', async () => {
      const fs = createMemoryFs();
      fs.touch(target, bytes(1));
      fs.failNext('writeFileSynced');
      await expect(writeAtomically(fs, target, bytes(2), null, 'a')).rejects.toThrow('simulated');
      expect(fs.files.get(target)).toEqual(bytes(1));
      expect([...fs.files.keys()]).toEqual([target]);
    });
  });

  describe('failureWhileRenaming', () => {
    it('keepsTheOldFileAndRemovesTheTemporaryFile', async () => {
      const fs = createMemoryFs();
      fs.touch(target, bytes(1));
      fs.failNext('rename');
      await expect(writeAtomically(fs, target, bytes(2), null, 'a')).rejects.toThrow('simulated');
      expect(fs.files.get(target)).toEqual(bytes(1));
      expect([...fs.files.keys()]).toEqual([target]);
    });
  });
});
