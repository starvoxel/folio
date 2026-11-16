// ------------------------------
// interaction.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-16
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { describe, expect, it } from 'vitest';

import { interactionFor, TARGET_SIZE_PX } from './interaction.js';

describe('interactionFor', () => {
  describe('aMouseWithHover', () => {
    it('returnsStandardTargetsAndHoverActions', () => {
      expect(interactionFor({ pointer: 'fine', hover: true })).toEqual({
        targetSize: 'standard',
        hoverActions: 'onHover',
      });
    });
  });

  describe('aFingerWithoutHover', () => {
    it('returnsLargeTargetsAndAlwaysVisibleActions', () => {
      expect(interactionFor({ pointer: 'coarse', hover: false })).toEqual({
        targetSize: 'large',
        hoverActions: 'always',
      });
    });
  });

  describe('aPenOrTrackpadWithoutHover', () => {
    it('keepsStandardTargetsButShowsActionsAlways', () => {
      expect(interactionFor({ pointer: 'fine', hover: false })).toEqual({
        targetSize: 'standard',
        hoverActions: 'always',
      });
    });
  });

  describe('targetSizeTable', () => {
    it('makesTouchTargetsAtLeast44Pixels', () => {
      expect(TARGET_SIZE_PX.large).toBeGreaterThanOrEqual(44);
      expect(TARGET_SIZE_PX.standard).toBeLessThan(TARGET_SIZE_PX.large);
    });
  });
});
