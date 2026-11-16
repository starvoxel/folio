// ------------------------------
// width-class.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-16
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { describe, expect, it } from 'vitest';

import { WIDTH_CLASS_THRESHOLDS, WIDTH_CLASSES, widthClassOf } from './width-class.js';

describe('widthClassOf', () => {
  describe('eachThresholdExactly', () => {
    for (const widthClass of WIDTH_CLASSES) {
      it(`returns${widthClass}For${String(WIDTH_CLASS_THRESHOLDS[widthClass])}Pixels`, () => {
        expect(widthClassOf(WIDTH_CLASS_THRESHOLDS[widthClass])).toBe(widthClass);
      });
    }
  });

  describe('onePixelBelowAThreshold', () => {
    it('returnsTheNarrowerClass', () => {
      expect(widthClassOf(599)).toBe('compact');
      expect(widthClassOf(899)).toBe('medium');
      expect(widthClassOf(1599)).toBe('regular');
      expect(widthClassOf(2559)).toBe('wide');
    });
  });

  describe('theAppWindowSizes', () => {
    it('classifiesTheMinimumPreferredAndUltrawideWidths', () => {
      expect(widthClassOf(900)).toBe('regular');
      expect(widthClassOf(1440)).toBe('regular');
      expect(widthClassOf(1920)).toBe('wide');
      expect(widthClassOf(3440)).toBe('ultrawide');
      expect(widthClassOf(5120)).toBe('ultrawide');
    });
  });

  describe('aWidthThatIsNotLaidOut', () => {
    it('returnsCompactForZeroNegativeAndNotANumber', () => {
      expect(widthClassOf(0)).toBe('compact');
      expect(widthClassOf(-20)).toBe('compact');
      expect(widthClassOf(Number.NaN)).toBe('compact');
    });
  });

  describe('thresholdTable', () => {
    it('risesWithEveryClass', () => {
      const values = WIDTH_CLASSES.map((widthClass) => WIDTH_CLASS_THRESHOLDS[widthClass]);
      expect(values).toEqual([...values].sort((left, right) => left - right));
      expect(new Set(values).size).toBe(values.length);
    });
  });
});
