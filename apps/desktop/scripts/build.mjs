// ------------------------------
// build.mjs
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

/**
 * Builds everything the desktop app is made of into apps/desktop/dist: the renderer (from the
 * renderer package), the main process and the preload script.
 */

import { cp, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { build } from 'vite';

const desktop = join(import.meta.dirname, '..');
const renderer = join(desktop, '..', '..', 'packages', 'renderer');

await rm(join(desktop, 'dist'), { recursive: true, force: true });

await build({ root: renderer, configFile: join(renderer, 'vite.config.js'), logLevel: 'warn' });
await build({
  root: desktop,
  configFile: join(desktop, 'vite.main.config.js'),
  logLevel: 'warn',
});
await build({
  root: desktop,
  configFile: join(desktop, 'vite.preload.config.js'),
  logLevel: 'warn',
});
await cp(join(renderer, 'dist'), join(desktop, 'dist', 'renderer'), { recursive: true });

console.log('built: apps/desktop/dist (main, preload, renderer)');
