// ------------------------------
// ipc-requests.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-26
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { describe, expect, it } from 'vitest';

import {
  parseBackUpRequest,
  parseDialogOptions,
  parseFileEvent,
  parseFileRef,
  parseLockRequest,
  parseMenuPath,
  parseStamp,
  parseWriteRequest,
} from './ipc-requests.js';

const file = { path: '/data/a.folio', name: 'a.folio' };
const stamp = { modifiedMs: 5, sizeBytes: 3 };

describe('parseFileRef', () => {
  describe('aWellFormedReference', () => {
    it('isReturned', () => {
      expect(parseFileRef(file)).toEqual(file);
    });
  });

  describe('malformedReferences', () => {
    it('areRejected', () => {
      const long = 'x'.repeat(5000);
      for (const bad of [
        null,
        'a',
        [],
        {},
        { path: '', name: 'a' },
        { path: 'a\0b', name: 'a' },
        { path: long, name: 'a' },
        { path: 'a', name: 7 },
      ]) {
        expect(parseFileRef(bad)).toBeNull();
      }
    });
  });
});

describe('parseStamp', () => {
  describe('badNumbers', () => {
    it('areRejected', () => {
      for (const bad of [
        null,
        {},
        { modifiedMs: 'x', sizeBytes: 1 },
        { modifiedMs: 1, sizeBytes: -1 },
        { modifiedMs: 1, sizeBytes: 1.5 },
        { modifiedMs: Number.NaN, sizeBytes: 1 },
      ]) {
        expect(parseStamp(bad)).toBeNull();
      }
      expect(parseStamp(stamp)).toEqual(stamp);
    });
  });
});

describe('parseWriteRequest', () => {
  describe('aNewFileAndAKnownStamp', () => {
    it('acceptsBoth', () => {
      const bytes = new Uint8Array([1]);
      expect(parseWriteRequest({ file, bytes, expected: null })).toEqual({
        file,
        bytes,
        expected: null,
      });
      expect(parseWriteRequest({ file, bytes, expected: stamp })?.expected).toEqual(stamp);
    });
  });

  describe('badParts', () => {
    it('areRejected', () => {
      const bytes = new Uint8Array([1]);
      expect(parseWriteRequest({ file, bytes: [1], expected: null })).toBeNull();
      expect(parseWriteRequest({ file, bytes, expected: 'x' })).toBeNull();
      expect(parseWriteRequest({ file, bytes })).toBeNull();
      expect(parseWriteRequest({ file: 3, bytes, expected: null })).toBeNull();
      expect(parseWriteRequest(null)).toBeNull();
    });
  });
});

describe('parseLockRequest', () => {
  describe('optionsGivenOrNot', () => {
    it('defaultsToNoTakeOver', () => {
      expect(parseLockRequest({ file })).toEqual({ file, options: {} });
      expect(parseLockRequest({ file, options: { takeOverStale: true } })).toEqual({
        file,
        options: { takeOverStale: true },
      });
    });
  });

  describe('badOptions', () => {
    it('areRejected', () => {
      expect(parseLockRequest({ file, options: { takeOverStale: 'yes' } })).toBeNull();
      expect(parseLockRequest({ file, options: 5 })).toBeNull();
      expect(parseLockRequest({ options: {} })).toBeNull();
    });
  });
});

describe('parseBackUpRequest', () => {
  describe('referenceAndBytes', () => {
    it('isAccepted', () => {
      const bytes = new Uint8Array([2]);
      expect(parseBackUpRequest({ file, bytes })).toEqual({ file, bytes });
      expect(parseBackUpRequest({ file, bytes: 'x' })).toBeNull();
    });
  });
});

describe('parseDialogOptions', () => {
  describe('noOptions', () => {
    it('meansEmptyOptions', () => {
      expect(parseDialogOptions(undefined, false)).toEqual({});
    });
  });

  describe('titleFiltersAndASuggestedName', () => {
    it('keepsThemAndDropsTheFolderFromTheName', () => {
      expect(
        parseDialogOptions(
          {
            title: 'Save',
            suggestedName: '../../etc/x.folio',
            filters: [{ name: 'Budget', extensions: ['folio'] }],
          },
          true,
        ),
      ).toEqual({
        title: 'Save',
        suggestedName: 'x.folio',
        filters: [{ name: 'Budget', extensions: ['folio'] }],
      });
    });
  });

  describe('aSuggestedNameOnTheOpenDialog', () => {
    it('isRejected', () => {
      expect(parseDialogOptions({ suggestedName: 'a' }, false)).toBeNull();
    });
  });

  describe('badFilters', () => {
    it('areRejected', () => {
      for (const filters of [
        'x',
        [{ name: 1, extensions: [] }],
        [{ name: 'a', extensions: ['*.folio'] }],
        [{ name: 'a', extensions: 'folio' }],
      ]) {
        expect(parseDialogOptions({ filters }, false)).toBeNull();
      }
    });
  });
});

describe('parseMenuPath', () => {
  describe('oneToFourLabels', () => {
    it('isAccepted', () => {
      expect(parseMenuPath(['File', 'Save'])).toEqual(['File', 'Save']);
    });
  });

  describe('badInput', () => {
    it('isRejected', () => {
      for (const bad of [
        [],
        ['a', 'b', 'c', 'd', 'e'],
        [1],
        'File',
        null,
        ['x'.repeat(101)],
        [''],
        ['File', ''],
      ]) {
        expect(parseMenuPath(bad)).toBeNull();
      }
    });
  });
});

describe('parseFileEvent', () => {
  describe('theKnownEvents', () => {
    it('areAccepted', () => {
      expect(parseFileEvent({ kind: 'created' })).toEqual({ kind: 'created' });
      expect(parseFileEvent({ kind: 'opened', damagedLines: 0, fromBackup: false })).toEqual({
        kind: 'opened',
        damagedLines: 0,
        fromBackup: false,
      });
      expect(parseFileEvent({ kind: 'openFailed', reason: 'locked' })).toEqual({
        kind: 'openFailed',
        reason: 'locked',
      });
    });
  });

  describe('anythingElse', () => {
    it('isRefusedAndExtraFieldsAreDropped', () => {
      expect(parseFileEvent(null)).toBeNull();
      expect(parseFileEvent({ kind: 'other' })).toBeNull();
      expect(parseFileEvent({ kind: 'openFailed', reason: 'my secret note' })).toBeNull();
      expect(parseFileEvent({ kind: 'opened', damagedLines: -1, fromBackup: false })).toBeNull();
      expect(parseFileEvent({ kind: 'opened', damagedLines: 1.5, fromBackup: false })).toBeNull();
      expect(parseFileEvent({ kind: 'opened', damagedLines: 1, fromBackup: 'yes' })).toBeNull();
      expect(parseFileEvent({ kind: 'created', note: 'Acme Corp' })).toEqual({ kind: 'created' });
    });
  });
});
