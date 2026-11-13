// ------------------------------
// check-install-policy.mjs
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

/**
 * Proves that the hardened npm settings in .npmrc stop a dependency with an unreviewed install
 * script: it installs esbuild (which has a postinstall script) into a temporary project that
 * uses this repository's .npmrc, and fails unless npm refuses with ESTRICTALLOWSCRIPTS.
 */

import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const project = mkdtempSync(join(tmpdir(), 'folio-install-policy-'));

try {
  copyFileSync(join(root, '.npmrc'), join(project, '.npmrc'));
  writeFileSync(
    join(project, 'package.json'),
    JSON.stringify({ name: 'install-policy-probe', version: '0.0.0', private: true }),
  );
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npm, ['install', '--save-dev', 'esbuild'], {
    cwd: project,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  const output = `${result.stdout}${result.stderr}`;
  if (result.status !== 0 && output.includes('ESTRICTALLOWSCRIPTS')) {
    console.log('ok: npm refused a dependency with an unreviewed install script');
  } else {
    console.error(output);
    console.error('FAIL: npm did not refuse an unreviewed install script (check .npmrc)');
    process.exitCode = 1;
  }
} finally {
  rmSync(project, { recursive: true, force: true });
}
