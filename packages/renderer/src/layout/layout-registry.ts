// ------------------------------
// layout-registry.ts
//
// Author: Starvoxel AI Agent - 2026-11-16
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import type { FormFactor } from '@folio/host-api';

import type { LayoutDefinition } from './layout-definition.js';
import type { WidthClass } from './width-class.js';

/** The layouts of one profile: the entries it needs and the one for everything below them. */
export interface ProfileLayouts {
  /** Used for a width below the narrowest class in `byWidth`. */
  readonly default: LayoutDefinition;
  /** Only the classes the profile needs; the others inherit from the nearest narrower one. */
  readonly byWidth: Readonly<Partial<Record<WidthClass, LayoutDefinition>>>;
}

/**
 * The profiles that have layouts. Desktop is required because every other profile falls back to
 * it; a profile that is not listed uses desktop's layouts as they are.
 */
export type LayoutRegistry = { readonly desktop: ProfileLayouts } & Readonly<
  Partial<Record<FormFactor, ProfileLayouts>>
>;

const DESKTOP_REGULAR: LayoutDefinition = {
  navigation: 'leftPane',
  topBar: { commands: 'inline', status: 'beside' },
  content: { maxWidth: 1240, padding: 'standard' },
};

const DESKTOP_COMPACT: LayoutDefinition = {
  navigation: 'drawer',
  topBar: { commands: 'overflow', status: 'below' },
  content: { maxWidth: null, padding: 'compact' },
};

const DESKTOP_WIDE: LayoutDefinition = {
  ...DESKTOP_REGULAR,
  content: { maxWidth: 1440, padding: 'roomy' },
};

/**
 * The layouts of the app. Adding a tablet or phone layout is a new entry here plus the shell
 * variants it names; no screen changes (AD-21). Medium inherits compact and ultrawide inherits
 * wide, so the desktop lists three classes.
 */
export const LAYOUT_REGISTRY: LayoutRegistry = {
  desktop: {
    default: DESKTOP_REGULAR,
    byWidth: { compact: DESKTOP_COMPACT, regular: DESKTOP_REGULAR, wide: DESKTOP_WIDE },
  },
};
