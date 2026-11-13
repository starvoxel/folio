// ------------------------------
// result.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { describe, expect, it } from 'vitest';

import { err, mapResult, ok, unwrapResult } from './result.js';

describe('mapResult', () => {
  describe('aSuccess', () => {
    it('transformsTheValue', () => {
      expect(mapResult(ok(2), (value) => value * 3)).toEqual({ ok: true, value: 6 });
    });
  });

  describe('aFailure', () => {
    it('passesTheFailureThrough', () => {
      expect(mapResult(err('bad'), (value: number) => value * 3)).toEqual({
        ok: false,
        error: 'bad',
      });
    });
  });
});

describe('unwrapResult', () => {
  describe('aSuccess', () => {
    it('returnsTheValue', () => {
      expect(unwrapResult(ok('fine'))).toBe('fine');
    });
  });

  describe('aFailure', () => {
    it('throwsAnErrorCarryingTheCause', () => {
      const failure = { code: 'bad' };
      try {
        unwrapResult(err(failure));
        expect.unreachable('unwrapResult should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).cause).toBe(failure);
      }
    });
  });
});
