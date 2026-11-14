// ------------------------------
// theme.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { createDarkTheme, createLightTheme, type Theme } from '@fluentui/react-components';

import { brandRamp } from './brand-ramp.js';

/** The light theme: Fluent's light theme with the Folio brand ramp. */
export const lightTheme: Theme = createLightTheme(brandRamp);

/** The dark theme: Fluent's dark theme with the Folio brand ramp. */
export const darkTheme: Theme = createDarkTheme(brandRamp);
