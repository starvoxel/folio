// ------------------------------
// index.ts
//
// Author: Starvoxel AI Agent - 2026-11-16
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

export { interactionFor, TARGET_SIZE_PX, type Interaction } from './interaction.js';
export type {
  ContentRules,
  LayoutDefinition,
  NavigationForm,
  PaddingStep,
  TopBarRules,
} from './layout-definition.js';
export { LAYOUT_REGISTRY, type LayoutRegistry, type ProfileLayouts } from './layout-registry.js';
export {
  layoutFor,
  resolveLayout,
  type LayoutSource,
  type ResolvedLayout,
} from './resolve-layout.js';
export {
  WIDTH_CLASS_THRESHOLDS,
  WIDTH_CLASSES,
  widthClassOf,
  type WidthClass,
} from './width-class.js';
