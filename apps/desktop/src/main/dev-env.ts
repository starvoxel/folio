// ------------------------------
// dev-env.ts
//
// Author: Starvoxel AI Agent - 2026-11-22
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { parseEnv } from 'node:util';

/**
 * The only settings a `.env` file may supply, and only in an unpackaged run. Anything else is
 * ignored, so the file cannot set a variable the hardening depends on (`GOOGLE_API_KEY` and its
 * siblings) or one that steers the runtime (`NODE_OPTIONS`, `ELECTRON_*`). `FOLIO_AUTOMATION` is
 * allowed for driving a development run (AD-16). Adding a key here is a review item.
 */
export const DEV_ENV_KEYS: readonly string[] = [
  'FOLIO_LOG_LEVEL',
  'FOLIO_LOG_UNREDACTED',
  'FOLIO_AUTOMATION',
];

/** The environment after the file was applied, and which keys came from the file. */
export interface DevEnvResult {
  /** A copy of the environment with the file's allowed, unset keys added. */
  readonly env: Readonly<Record<string, string | undefined>>;
  /** The keys that were taken from the file, in the order of `DEV_ENV_KEYS`. */
  readonly loaded: readonly string[];
}

/** What `applyDevEnvFile` needs. */
export interface DevEnvOptions {
  /** Whether this is a packaged build, which never reads the file. */
  readonly packaged: boolean;
  /** The real environment, which always wins over the file. */
  readonly env: Readonly<Record<string, string | undefined>>;
  /** Read the text of the `.env` file; undefined when there is none. */
  readonly readText: () => string | undefined;
}

/**
 * Add the settings from a `.env` file to the environment, for development runs only. A packaged
 * build never reads the file. Only `DEV_ENV_KEYS` are used, and a variable already set in the real
 * environment wins. Returns a copy; the given environment is not changed.
 * @param options - The build kind, the real environment and the file reader.
 * @returns The environment to use and the keys that came from the file.
 */
export function applyDevEnvFile(options: DevEnvOptions): DevEnvResult {
  const text = options.packaged ? undefined : options.readText();
  if (text === undefined) {
    return { env: { ...options.env }, loaded: [] };
  }
  let parsed: Record<string, string | undefined>;
  try {
    parsed = parseEnv(text);
  } catch {
    // A file the parser cannot read is treated as an empty one.
    parsed = {};
  }
  const env: Record<string, string | undefined> = { ...options.env };
  const loaded: string[] = [];
  for (const key of DEV_ENV_KEYS) {
    const value = parsed[key];
    if (value !== undefined && env[key] === undefined) {
      env[key] = value;
      loaded.push(key);
    }
  }
  return { env, loaded };
}
