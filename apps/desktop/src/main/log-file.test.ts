// ------------------------------
// log-file.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-16
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createRotatingFileWriter, type LogFileOperations } from './log-file.js';

/** An in-memory file system that records its calls and can be told to fail. */
function memoryFiles(): {
  files: LogFileOperations;
  contents: Map<string, string>;
  fail: { next: boolean };
  calls: string[];
} {
  const contents = new Map<string, string>();
  const fail = { next: false };
  const calls: string[] = [];
  const maybeFail = (): void => {
    if (fail.next) {
      fail.next = false;
      throw new Error('disk full');
    }
  };
  const files: LogFileOperations = {
    makeFolder: (path) => {
      calls.push(`makeFolder ${path}`);
      maybeFail();
    },
    fileSize: (path) => Buffer.byteLength(contents.get(path) ?? '', 'utf8'),
    append: (path, text) => {
      maybeFail();
      contents.set(path, (contents.get(path) ?? '') + text);
    },
    rename: (from, to) => {
      const text = contents.get(from);
      if (text !== undefined) {
        contents.set(to, text);
        contents.delete(from);
      }
    },
    remove: (path) => {
      contents.delete(path);
    },
  };
  return { files, contents, fail, calls };
}

const FOLDER = join('data', 'logs');
const CURRENT = join(FOLDER, 'folio.log');

describe('createRotatingFileWriter', () => {
  describe('firstLines', () => {
    it('createsTheFolderOnceAndAppendsEachLineWithANewline', () => {
      const { files, contents, calls } = memoryFiles();
      const write = createRotatingFileWriter({ folder: FOLDER, files });
      write('one');
      write('two');
      expect(contents.get(CURRENT)).toBe('one\ntwo\n');
      expect(calls).toEqual([`makeFolder ${FOLDER}`]);
    });
  });

  describe('aCustomFileName', () => {
    it('writesAndRotatesThatFileAndLeavesFolioLogAlone', () => {
      const { files, contents } = memoryFiles();
      const write = createRotatingFileWriter({
        folder: FOLDER,
        files,
        fileName: 'folio-unredacted.log',
        maxBytes: 10,
        backups: 1,
      });
      write('aaaa');
      write('bbbb');
      write('cccc');
      const custom = join(FOLDER, 'folio-unredacted.log');
      expect(contents.get(custom)).toBe('cccc\n');
      expect(contents.get(`${custom}.1`)).toBe('aaaa\nbbbb\n');
      expect(contents.has(CURRENT)).toBe(false);
    });
  });

  describe('anExistingFile', () => {
    it('countsItsSizeTowardsTheLimit', () => {
      const { files, contents } = memoryFiles();
      contents.set(CURRENT, 'x'.repeat(9));
      const write = createRotatingFileWriter({ folder: FOLDER, files, maxBytes: 12 });
      write('abc');
      expect(contents.get(`${CURRENT}.1`)).toBe('x'.repeat(9));
      expect(contents.get(CURRENT)).toBe('abc\n');
    });
  });

  describe('aLineThatWouldPassTheSizeLimit', () => {
    it('movesTheFileToTheFirstBackupAndStartsANewOne', () => {
      const { files, contents } = memoryFiles();
      const write = createRotatingFileWriter({ folder: FOLDER, files, maxBytes: 10 });
      write('aaaa');
      write('bbbb');
      write('cccc');
      expect(contents.get(`${CURRENT}.1`)).toBe('aaaa\nbbbb\n');
      expect(contents.get(CURRENT)).toBe('cccc\n');
    });
  });

  describe('moreRotationsThanBackups', () => {
    it('keepsOnlyTheNewestBackupsAndDeletesTheOldest', () => {
      const { files, contents } = memoryFiles();
      const write = createRotatingFileWriter({ folder: FOLDER, files, maxBytes: 5, backups: 2 });
      for (const line of ['aaaa', 'bbbb', 'cccc', 'dddd']) {
        write(line);
      }
      expect(contents.get(CURRENT)).toBe('dddd\n');
      expect(contents.get(`${CURRENT}.1`)).toBe('cccc\n');
      expect(contents.get(`${CURRENT}.2`)).toBe('bbbb\n');
      expect(contents.has(`${CURRENT}.3`)).toBe(false);
    });
  });

  describe('noBackups', () => {
    it('startsOverInsteadOfKeepingAnOldFile', () => {
      const { files, contents } = memoryFiles();
      const write = createRotatingFileWriter({ folder: FOLDER, files, maxBytes: 5, backups: 0 });
      write('aaaa');
      write('bbbb');
      expect(contents.get(CURRENT)).toBe('bbbb\n');
      expect([...contents.keys()]).toEqual([CURRENT]);
    });
  });

  describe('aSingleLineLargerThanTheLimit', () => {
    it('isWrittenIntoAFreshFileWithoutLooping', () => {
      const { files, contents } = memoryFiles();
      const write = createRotatingFileWriter({ folder: FOLDER, files, maxBytes: 5 });
      write('a');
      write('long line over the limit');
      write('b');
      expect(contents.get(`${CURRENT}.1`)).toBe('long line over the limit\n');
      expect(contents.get(CURRENT)).toBe('b\n');
    });
  });

  describe('aLineWithMultiByteText', () => {
    it('countsBytesNotCharacters', () => {
      const { files, contents } = memoryFiles();
      const write = createRotatingFileWriter({ folder: FOLDER, files, maxBytes: 8 });
      write('€€'); // 6 bytes plus the newline
      write('€');
      expect(contents.get(`${CURRENT}.1`)).toBe('€€\n');
    });
  });

  describe('aFailedOperation', () => {
    it('throwsAndRecoversOnTheNextLine', () => {
      const { files, contents, fail, calls } = memoryFiles();
      const write = createRotatingFileWriter({ folder: FOLDER, files });
      fail.next = true;
      expect(() => {
        write('lost');
      }).toThrow('disk full');
      write('kept');
      expect(contents.get(CURRENT)).toBe('kept\n');
      expect(calls).toEqual([`makeFolder ${FOLDER}`, `makeFolder ${FOLDER}`]);
    });
  });
});
