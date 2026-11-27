// ------------------------------
// zip-bytes.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-27
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { describe, expect, it } from 'vitest';

import {
  entryText,
  MAX_ENTRIES,
  MAX_ENTRY_BYTES,
  MAX_TOTAL_BYTES,
  unzipEntries,
  zipEntries,
} from './zip-bytes.js';

describe('zipEntries', () => {
  describe('theSameEntriesTwice', () => {
    it('givesIdenticalBytes', () => {
      const entries = [
        { name: 'a.json', text: '{"a":1}\n' },
        { name: 'b.jsonl', text: '{"b":2}\n' },
      ];
      expect(zipEntries(entries)).toEqual(zipEntries(entries));
    });
  });

  describe('everyEntry', () => {
    it('carriesTheFixedTimestampOf1980', () => {
      const zip = zipEntries([{ name: 'a.json', text: '[]' }]);
      const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
      // Local header: time at 10, date at 12 (little endian); 33 is 1980-01-01.
      expect([view.getUint16(10, true), view.getUint16(12, true)]).toEqual([0, 33]);
    });
  });

  describe('entriesInAGivenOrder', () => {
    it('keepsThatOrder', () => {
      const zip = zipEntries([
        { name: 'z.json', text: '1' },
        { name: 'a.json', text: '2' },
      ]);
      const names = unzipEntries(zip);
      expect(names.ok && [...names.value.keys()]).toEqual(['z.json', 'a.json']);
    });
  });
});

describe('unzipEntries', () => {
  describe('roundTrip', () => {
    it('returnsTheText', () => {
      const result = unzipEntries(zipEntries([{ name: 'a.json', text: 'héllo' }]));
      expect(result.ok && entryText(result.value.get('a.json') ?? new Uint8Array())).toBe('héllo');
    });
  });

  describe('bytesThatAreNotAZip', () => {
    it('returnsNotAZipWithoutThrowing', () => {
      expect(unzipEntries(new Uint8Array([1, 2, 3, 4]))).toEqual({ ok: false, error: 'notAZip' });
      expect(unzipEntries(new Uint8Array())).toEqual({ ok: false, error: 'notAZip' });
    });
  });

  describe('aTruncatedZip', () => {
    it('returnsNotAZip', () => {
      const zip = zipEntries([{ name: 'a.json', text: 'x'.repeat(500) }]);
      expect(unzipEntries(zip.slice(0, zip.length - 30))).toEqual({ ok: false, error: 'notAZip' });
    });
  });

  describe('manyEntriesEachClaimingAFairShare', () => {
    it('returnsNotAZipWhenTheClaimsAddUpTooHigh', () => {
      const count = Math.floor(MAX_TOTAL_BYTES / MAX_ENTRY_BYTES) + 1;
      const zip = zipEntries(
        Array.from({ length: count }, (_, n) => ({ name: `${String(n)}.json`, text: 'x' })),
      );
      const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
      let offset = view.getUint32(zip.length - 22 + 16, true);
      for (let entry = 0; entry < count; entry += 1) {
        view.setUint32(offset + 24, MAX_ENTRY_BYTES, true);
        offset +=
          46 +
          view.getUint16(offset + 28, true) +
          view.getUint16(offset + 30, true) +
          view.getUint16(offset + 32, true);
      }
      expect(unzipEntries(zip)).toEqual({ ok: false, error: 'notAZip' });
    });
  });

  describe('moreEntriesThanAFileCanHold', () => {
    it('returnsNotAZip', () => {
      const entries = Array.from({ length: MAX_ENTRIES + 1 }, (_, n) => ({
        name: `${String(n)}.json`,
        text: '1',
      }));
      expect(unzipEntries(zipEntries(entries))).toEqual({ ok: false, error: 'notAZip' });
    });
  });

  describe('anEntryClaimingToBeHuge', () => {
    it('returnsNotAZipBeforeInflating', () => {
      const zip = zipEntries([{ name: 'a.json', text: 'x'.repeat(100) }]);
      const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
      const end = zip.length - 22;
      const central = view.getUint32(end + 16, true);
      view.setUint32(central + 24, MAX_ENTRY_BYTES + 1, true);
      expect(unzipEntries(zip)).toEqual({ ok: false, error: 'notAZip' });
    });
  });
});
