// ------------------------------
// web-digest.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-28
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { describe, expect, it } from 'vitest';

import { webDigest } from './web-digest.js';

describe('webDigest', () => {
  describe('theBytesOfAbc', () => {
    it('givesTheKnownSha256', async () => {
      expect(await webDigest(new Uint8Array([0x61, 0x62, 0x63]))).toBe(
        'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
      );
    });
  });

  describe('noBytes', () => {
    it('givesTheShaOfNothing', async () => {
      expect(await webDigest(new Uint8Array())).toBe(
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      );
    });
  });
});
