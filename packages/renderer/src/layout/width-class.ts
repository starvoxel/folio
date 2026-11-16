// ------------------------------
// width-class.ts
//
// Author: Starvoxel AI Agent - 2026-11-16
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

/** The size steps of the area the app has, from narrowest to widest. */
export const WIDTH_CLASSES = ['compact', 'medium', 'regular', 'wide', 'ultrawide'] as const;

/** One step of the width scale. */
export type WidthClass = (typeof WIDTH_CLASSES)[number];

/**
 * The smallest width, in CSS pixels, at which each class starts. This table is the only place the
 * thresholds are written down (AD-21). Regular starts at the app's minimum window width, so the
 * narrower classes are reached only by zooming or by an embedding that is smaller than a window.
 */
export const WIDTH_CLASS_THRESHOLDS: Readonly<Record<WidthClass, number>> = {
  compact: 0,
  medium: 600,
  regular: 900,
  wide: 1600,
  ultrawide: 2560,
};

/**
 * Classify a width.
 * @param widthPx - The width of the area the app has, in CSS pixels. A width that is not a
 * positive number (an area that is not laid out yet) counts as compact.
 * @returns The widest class whose threshold the width reaches.
 */
export function widthClassOf(widthPx: number): WidthClass {
  for (const widthClass of [...WIDTH_CLASSES].reverse()) {
    if (widthPx >= WIDTH_CLASS_THRESHOLDS[widthClass]) {
      return widthClass;
    }
  }
  return 'compact';
}
