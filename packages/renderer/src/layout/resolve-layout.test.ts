// ------------------------------
// resolve-layout.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-16
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { describe, expect, it } from 'vitest';

import type { LayoutDefinition } from './layout-definition.js';
import { LAYOUT_REGISTRY, type LayoutRegistry } from './layout-registry.js';
import { layoutFor, resolveLayout } from './resolve-layout.js';
import { WIDTH_CLASSES } from './width-class.js';

/**
 * Make a layout that tests can tell apart by its content width.
 * @param maxWidth - The width that identifies the layout.
 * @returns The layout.
 */
function layout(maxWidth: number): LayoutDefinition {
  return {
    navigation: 'leftPane',
    topBar: { commands: 'inline', status: 'beside' },
    content: { maxWidth, padding: 'standard' },
  };
}

const registry: LayoutRegistry = {
  desktop: { default: layout(1), byWidth: { compact: layout(2), wide: layout(3) } },
  phone: { default: layout(10), byWidth: { regular: layout(11) } },
};

describe('resolveLayout', () => {
  describe('aClassTheProfileDefines', () => {
    it('returnsThatEntry', () => {
      const resolved = resolveLayout(registry, 'desktop', 'wide');
      expect(resolved.definition.content.maxWidth).toBe(3);
      expect(resolved.source).toEqual({ profile: 'desktop', entry: 'wide' });
    });
  });

  describe('aClassBetweenTwoDefinedOnes', () => {
    it('returnsTheNearestNarrowerEntry', () => {
      expect(resolveLayout(registry, 'desktop', 'medium').source.entry).toBe('compact');
      expect(resolveLayout(registry, 'desktop', 'regular').source.entry).toBe('compact');
      expect(resolveLayout(registry, 'desktop', 'ultrawide').source.entry).toBe('wide');
    });
  });

  describe('aClassBelowEveryDefinedOne', () => {
    it('returnsTheProfileDefault', () => {
      const resolved = resolveLayout(registry, 'phone', 'compact');
      expect(resolved.definition.content.maxWidth).toBe(10);
      expect(resolved.source).toEqual({ profile: 'phone', entry: 'default' });
    });
  });

  describe('aProfileThatIsNotRegistered', () => {
    it('usesTheDesktopLayoutsAndSaysSo', () => {
      const resolved = resolveLayout(registry, 'tablet', 'wide');
      expect(resolved.definition.content.maxWidth).toBe(3);
      expect(resolved.source).toEqual({ profile: 'desktop', entry: 'wide' });
      expect(resolved.formFactor).toBe('tablet');
    });
  });

  describe('everyProfileAndClassOfTheRegistry', () => {
    it('resolvesToADefinition', () => {
      for (const formFactor of ['desktop', 'web', 'tablet', 'phone'] as const) {
        for (const widthClass of WIDTH_CLASSES) {
          const resolved = layoutFor(formFactor, widthClass);
          expect(resolved.definition.navigation).toMatch(/^(leftPane|drawer)$/u);
        }
      }
    });
  });
});

describe('layoutFor', () => {
  describe('theDesktopProfile', () => {
    it('usesTheDrawerOnlyBelowRegular', () => {
      expect(layoutFor('desktop', 'compact').definition.navigation).toBe('drawer');
      expect(layoutFor('desktop', 'medium').definition.navigation).toBe('drawer');
      expect(layoutFor('desktop', 'regular').definition.navigation).toBe('leftPane');
      expect(layoutFor('desktop', 'wide').definition.navigation).toBe('leftPane');
      expect(layoutFor('desktop', 'ultrawide').definition.navigation).toBe('leftPane');
    });

    it('widensTheContentColumnOnWideAndUltrawide', () => {
      expect(layoutFor('desktop', 'regular').definition.content.maxWidth).toBe(1240);
      expect(layoutFor('desktop', 'wide').definition.content.maxWidth).toBe(1440);
      expect(layoutFor('desktop', 'ultrawide').definition.content.maxWidth).toBe(1440);
      expect(layoutFor('desktop', 'compact').definition.content.maxWidth).toBeNull();
    });

    it('movesTheTopBarCommandsToTheOverflowMenuOnlyWhenCompact', () => {
      expect(layoutFor('desktop', 'compact').definition.topBar.commands).toBe('overflow');
      expect(layoutFor('desktop', 'regular').definition.topBar.commands).toBe('inline');
    });
  });

  describe('theProfilesWithoutEntries', () => {
    it('matchTheDesktopLayoutsUntilTheyGetTheirOwn', () => {
      for (const formFactor of ['web', 'tablet', 'phone'] as const) {
        if (LAYOUT_REGISTRY[formFactor] !== undefined) {
          continue;
        }
        for (const widthClass of WIDTH_CLASSES) {
          expect(layoutFor(formFactor, widthClass).definition).toBe(
            layoutFor('desktop', widthClass).definition,
          );
        }
      }
    });
  });
});
