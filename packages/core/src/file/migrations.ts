// ------------------------------
// migrations.ts
//
// Author: Starvoxel AI Agent - 2026-11-27
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { err, ok, type Result } from '../support/result.js';
import { FORMAT_VERSION } from './manifest.js';

/** The parsed content of every part by name; a JSONL part is a list of its parsed lines. */
export type RawParts = Readonly<Record<string, unknown>>;

/** Turns the parts of one format version into those of the next. */
export interface MigrationStep {
  readonly from: number;
  readonly migrate: (parts: RawParts) => Result<RawParts, 'failed'>;
}

/**
 * The chain of upgrades from older files. It is empty while version 1 is still a draft: until the
 * core views have shipped, fixtures are regenerated, not migrated (plans/setup-and-accounts.md).
 */
export const MIGRATIONS: readonly MigrationStep[] = [];

/**
 * Bring parts up to the current version, one step per version.
 * @param parts - The parts as read.
 * @param fromVersion - The version they were written in.
 * @param chain - The steps; the real chain unless a test passes its own.
 * @returns The parts at the current version, or the version a missing or failing step stopped at.
 */
export function runMigrations(
  parts: RawParts,
  fromVersion: number,
  chain: readonly MigrationStep[] = MIGRATIONS,
): Result<RawParts, { readonly fromVersion: number }> {
  let current = parts;
  for (let version = fromVersion; version < FORMAT_VERSION; version += 1) {
    const step = chain.find((candidate) => candidate.from === version);
    const migrated = step?.migrate(current);
    if (migrated?.ok !== true) {
      return err({ fromVersion: version });
    }
    current = migrated.value;
  }
  return ok(current);
}
