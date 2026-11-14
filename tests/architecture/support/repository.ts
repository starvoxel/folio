// ------------------------------
// repository.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/** The repository root, found from this file's location. */
export const repositoryRoot = join(import.meta.dirname, '..', '..', '..');

const SKIPPED_DIRECTORIES = new Set([
  'node_modules',
  'dist',
  'out',
  'release',
  'coverage',
  'test-results',
  'playwright-report',
  '.git',
  'fixtures',
]);

/**
 * List the TypeScript source files of the workspace, as repository-relative paths with forward
 * slashes. Build output, dependencies and architecture fixtures are skipped.
 * @param roots - The repository-relative directories to search.
 * @returns The sorted file paths.
 */
export function listSourceFiles(roots: readonly string[]): string[] {
  const found: string[] = [];
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRECTORIES.has(entry.name)) {
          walk(join(directory, entry.name));
        }
      } else if (/\.tsx?$/u.test(entry.name)) {
        found.push(relative(repositoryRoot, join(directory, entry.name)).split(sep).join('/'));
      }
    }
  };
  for (const root of roots) {
    walk(join(repositoryRoot, root));
  }
  return found.sort();
}
