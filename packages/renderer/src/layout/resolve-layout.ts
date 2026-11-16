// ------------------------------
// resolve-layout.ts
//
// Author: Starvoxel AI Agent - 2026-11-16
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import type { FormFactor } from '@folio/host-api';

import type { LayoutDefinition } from './layout-definition.js';
import { LAYOUT_REGISTRY, type LayoutRegistry } from './layout-registry.js';
import { WIDTH_CLASSES, type WidthClass } from './width-class.js';

/** Where a resolved layout came from, so a test or a log can tell a fallback from a match. */
export interface LayoutSource {
  /** The profile whose entry was used; differs from the asked one after a fallback to desktop. */
  readonly profile: FormFactor;
  /** The class of the entry used, or `default` when the profile's default was used. */
  readonly entry: WidthClass | 'default';
}

/** The outcome of a lookup. */
export interface ResolvedLayout {
  readonly formFactor: FormFactor;
  readonly widthClass: WidthClass;
  readonly definition: LayoutDefinition;
  readonly source: LayoutSource;
}

/**
 * Look up the layout for a profile and a width class. The order is: the class itself, the nearest
 * narrower class the profile defines, the profile's default, then the same steps for desktop. A
 * profile that is not in the registry goes straight to desktop.
 * @param registry - The layouts to search.
 * @param formFactor - The profile the host reported.
 * @param widthClass - The class of the area the app has.
 * @returns The layout and where it came from.
 */
export function resolveLayout(
  registry: LayoutRegistry,
  formFactor: FormFactor,
  widthClass: WidthClass,
): ResolvedLayout {
  const profile = registry[formFactor];
  const layouts = profile ?? registry.desktop;
  const source: LayoutSource = {
    profile: profile === undefined ? 'desktop' : formFactor,
    entry: 'default',
  };
  for (let index = WIDTH_CLASSES.indexOf(widthClass); index >= 0; index -= 1) {
    const candidate = WIDTH_CLASSES[index];
    const definition = candidate === undefined ? undefined : layouts.byWidth[candidate];
    if (candidate !== undefined && definition !== undefined) {
      return {
        formFactor,
        widthClass,
        definition,
        source: { ...source, entry: candidate },
      };
    }
  }
  return { formFactor, widthClass, definition: layouts.default, source };
}

/**
 * Look up a layout in the app's own registry.
 * @param formFactor - The profile the host reported.
 * @param widthClass - The class of the area the app has.
 * @returns The layout and where it came from.
 */
export function layoutFor(formFactor: FormFactor, widthClass: WidthClass): ResolvedLayout {
  return resolveLayout(LAYOUT_REGISTRY, formFactor, widthClass);
}
