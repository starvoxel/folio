// ------------------------------
// machine-settings.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { z } from 'zod';

import { parseWithSchema } from '../support/schema.js';

/** How the app chooses its colours (H1.9): a fixed theme, or follow the system. */
export type ThemePreference = 'light' | 'dark' | 'system';

/** Settings kept on the machine, not in the budget file (AD-11). */
export interface MachineSettings {
  readonly theme: ThemePreference;
}

/** The settings of a machine that has stored none. */
export const DEFAULT_MACHINE_SETTINGS: MachineSettings = { theme: 'system' };

/** The list of theme choices, in the order Settings shows them. */
export const THEME_PREFERENCES: readonly ThemePreference[] = ['light', 'dark', 'system'];

const machineSettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).default('system'),
});

/**
 * Turn stored settings, which are untrusted JSON, into valid settings. Anything unreadable falls
 * back to the defaults: a damaged settings file must never stop the app from starting.
 * @param raw - The stored value, or null when nothing is stored.
 * @returns Valid machine settings.
 */
export function readMachineSettings(raw: unknown): MachineSettings {
  if (raw === null || raw === undefined) {
    return DEFAULT_MACHINE_SETTINGS;
  }
  const parsed = parseWithSchema(machineSettingsSchema, raw);
  return parsed.ok ? { theme: parsed.value.theme } : DEFAULT_MACHINE_SETTINGS;
}
