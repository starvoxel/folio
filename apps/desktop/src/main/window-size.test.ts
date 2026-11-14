// ------------------------------
// window-size.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { describe, expect, it } from 'vitest';

import { chooseWindowSize } from './window-size.js';

describe('chooseWindowSize', () => {
  describe('aLargeScreen', () => {
    it('returnsTheDesignSize', () => {
      expect(chooseWindowSize({ width: 2560, height: 1400 })).toEqual({ width: 1440, height: 900 });
    });
  });

  describe('aSmallScreen', () => {
    it('shrinksToFit', () => {
      expect(chooseWindowSize({ width: 1280, height: 720 })).toEqual({ width: 1280, height: 720 });
    });
  });

  describe('aTinyScreen', () => {
    it('neverGoesBelowTheMinimum', () => {
      expect(chooseWindowSize({ width: 600, height: 400 })).toEqual({ width: 900, height: 600 });
    });
  });
});
