// ------------------------------
// theme.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { describe, expect, it } from 'vitest';

import { brandRamp } from './brand-ramp.js';
import { darkTheme, lightTheme } from './theme.js';

describe('brandRamp', () => {
  describe('theAccentShade', () => {
    it('isThePrototypeAccent', () => {
      expect(brandRamp[80]).toBe('#0078D4');
    });
  });

  describe('everyShade', () => {
    it('isAHexColourAndShadesGetLighter', () => {
      const shades = Object.entries(brandRamp)
        .map(([key, value]) => ({ key: Number(key), value }))
        .sort((left, right) => left.key - right.key);
      expect(shades).toHaveLength(16);
      const brightness = shades.map(({ value }) => {
        expect(value).toMatch(/^#[0-9A-F]{6}$/u);
        const [red = 0, green = 0, blue = 0] = [1, 3, 5].map((start) =>
          Number.parseInt(value.slice(start, start + 2), 16),
        );
        return red * 0.299 + green * 0.587 + blue * 0.114;
      });
      expect(brightness).toEqual([...brightness].sort((left, right) => left - right));
    });
  });
});

describe('themes', () => {
  describe('lightTheme', () => {
    it('usesTheAccentForBrandBackgrounds', () => {
      expect(lightTheme.colorBrandBackground).toBe('#0078D4');
    });
  });

  describe('darkTheme', () => {
    it('differsFromTheLightTheme', () => {
      expect(darkTheme.colorNeutralBackground1).not.toBe(lightTheme.colorNeutralBackground1);
    });
  });
});
