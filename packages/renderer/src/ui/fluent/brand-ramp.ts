// ------------------------------
// brand-ramp.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import type { BrandVariants } from '@fluentui/react-components';

/**
 * The brand ramp around the prototype's accent #0078D4 (AD-15). Fluent reads shade 80 as the
 * primary brand colour in the light theme. The other shades step evenly in lightness at one hue,
 * which is close to the prototype's hover and pressed colours; a design review settles the rest.
 */
export const brandRamp: BrandVariants = {
  10: '#001729',
  20: '#002541',
  30: '#00335A',
  40: '#004172',
  50: '#004F8B',
  60: '#005CA3',
  70: '#006ABC',
  80: '#0078D4',
  90: '#058BF2',
  100: '#239BF6',
  110: '#48AAF4',
  120: '#6CB8F3',
  130: '#8EC8F3',
  140: '#AFD7F5',
  150: '#CFE6F8',
  160: '#EEF6FC',
};
