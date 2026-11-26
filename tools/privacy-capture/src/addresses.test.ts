// ------------------------------
// addresses.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-26
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { describe, expect, it } from 'vitest';

import { isLoopbackAddress, isWildcardAddress } from './addresses.js';

describe('isLoopbackAddress', () => {
  describe('loopbackForms', () => {
    it('returnsTrue', () => {
      for (const address of [
        '127.0.0.1',
        '127.8.9.10',
        '::1',
        '[::1]',
        '::ffff:127.0.0.1',
        'localhost',
      ]) {
        expect(isLoopbackAddress(address)).toBe(true);
      }
    });
  });

  describe('everythingElse', () => {
    it('returnsFalse', () => {
      for (const address of [
        '10.0.0.1',
        '192.168.1.5',
        '8.8.8.8',
        '2001:4860:4860::8888',
        '1127.0.0.1',
      ]) {
        expect(isLoopbackAddress(address)).toBe(false);
      }
    });
  });
});

describe('isWildcardAddress', () => {
  describe('noPeer', () => {
    it('returnsTrue', () => {
      for (const address of ['', '*', '0.0.0.0', '::']) {
        expect(isWildcardAddress(address)).toBe(true);
      }
    });
  });

  describe('aRealAddress', () => {
    it('returnsFalse', () => {
      expect(isWildcardAddress('10.0.0.1')).toBe(false);
    });
  });
});
