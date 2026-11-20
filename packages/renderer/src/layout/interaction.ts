// ------------------------------
// interaction.ts
//
// Author: Starvoxel AI Agent - 2026-11-16
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import type { InputStyle } from '@folio/host-api';

/** How controls behave for the way the user points, independent of the width class (AD-21). */
export interface Interaction {
  /** Touch targets need to be larger than pointer targets. */
  readonly targetSize: 'standard' | 'large';
  /** Whether a control may appear only on hover, or must always be visible. */
  readonly hoverActions: 'onHover' | 'always';
}

/** The minimum height of an interactive control, in CSS pixels, for each target size. */
export const TARGET_SIZE_PX: Readonly<Record<Interaction['targetSize'], number>> = {
  standard: 32,
  large: 44,
};

/**
 * Turn the host's input style into interaction rules.
 * @param input - What the host reported.
 * @returns The target size and hover behaviour.
 */
export function interactionFor(input: InputStyle): Interaction {
  return {
    targetSize: input.pointer === 'coarse' ? 'large' : 'standard',
    hoverActions: input.hover ? 'onHover' : 'always',
  };
}
