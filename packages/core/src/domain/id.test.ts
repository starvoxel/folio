// ------------------------------
// id.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { describe, expect, it } from 'vitest';

import { id, newId, parseId, type Id } from './id.js';

const sample = '3f2b8c1e-5a4d-4e6f-9a7b-0c1d2e3f4a5b';

describe('parseId', () => {
  describe('aUuid', () => {
    it('returnsTheId', () => {
      expect(parseId(sample)).toEqual({ ok: true, value: sample });
    });
  });

  describe('upperCaseUuid', () => {
    it('returnsTheLowerCaseId', () => {
      expect(parseId(sample.toUpperCase())).toEqual({ ok: true, value: sample });
    });
  });

  describe('emptyInput', () => {
    it('returnsAFormatFailure', () => {
      expect(parseId('')).toMatchObject({ ok: false, error: { code: 'format' } });
    });
  });

  describe('notAUuid', () => {
    it('returnsAFormatFailure', () => {
      expect(parseId('not-a-uuid')).toMatchObject({ ok: false, error: { code: 'format' } });
      expect(parseId(`${sample}0`)).toMatchObject({ ok: false, error: { code: 'format' } });
    });
  });
});

describe('id', () => {
  describe('aUuid', () => {
    it('returnsTheId', () => {
      const account: Id<'Account'> = id<'Account'>(sample);
      expect(account).toBe(sample);
    });
  });

  describe('notAUuid', () => {
    it('throwsRangeError', () => {
      expect(() => id('nope')).toThrow(RangeError);
    });
  });
});

describe('newId', () => {
  describe('aSourceOfUuids', () => {
    it('returnsWhatTheSourceMade', () => {
      expect(newId<'Account'>(() => sample)).toBe(sample);
    });
  });

  describe('aBrokenSource', () => {
    it('throwsRangeError', () => {
      expect(() => newId<'Account'>(() => 'broken')).toThrow(RangeError);
    });
  });
});
