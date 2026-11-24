// ------------------------------
// install-hooks.mjs
//
// Author: Starvoxel AI Agent - 2026-11-24
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

/**
 * Points git at the tracked hooks in `.githooks`, so every clone runs them after `npm install`.
 * It never fails the install: outside a git checkout (an exported tarball) it does nothing.
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');

if (existsSync(join(root, '.git'))) {
  const current = spawnSync('git', ['config', 'core.hooksPath'], { cwd: root, encoding: 'utf8' });
  const existing = current.stdout.trim();
  if (existing !== '' && existing !== '.githooks') {
    console.warn(`warning: core.hooksPath is already "${existing}"; left unchanged`);
  } else if (
    spawnSync('git', ['config', 'core.hooksPath', '.githooks'], { cwd: root }).status !== 0
  ) {
    console.warn('warning: could not set core.hooksPath to .githooks');
  }
}
