// ------------------------------
// settings-store.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { readMachineSettings } from '@folio/core';

/** Reads and writes the machine settings (AD-11) as one JSON file in a folder. */
export interface SettingsStore {
  /** Read the stored settings as untrusted JSON; null when there is none or it is unreadable. */
  read(): Promise<unknown>;
  /** Validate the settings, keeping only what is known, and replace the stored file. */
  write(settings: unknown): Promise<void>;
}

/**
 * Create a settings store.
 * @param directory - The folder that holds `settings.json`, normally the app-data folder.
 * @returns The store.
 */
export function createSettingsStore(directory: string): SettingsStore {
  const file = join(directory, 'settings.json');
  return {
    read: async () => {
      try {
        return JSON.parse(await readFile(file, 'utf8')) as unknown;
      } catch {
        // Missing and damaged files both mean "no settings yet"; the renderer applies defaults.
        return null;
      }
    },
    write: async (settings) => {
      // Normalizing drops unknown keys and bad values, so the file only ever holds valid settings.
      const clean = readMachineSettings(settings);
      await mkdir(directory, { recursive: true });
      const temporary = `${file}.tmp`;
      await writeFile(temporary, `${JSON.stringify(clean)}\n`, 'utf8');
      await rename(temporary, file);
    },
  };
}
