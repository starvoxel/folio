// ------------------------------
// build-mock-app.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { join } from 'node:path';

import react from '@vitejs/plugin-react';
import { build } from 'vite';

/**
 * Build the renderer with the mock host entry into a directory, the way the shipped renderer is
 * built (same plugins, same target), so the integration run exercises a production bundle.
 * @param outDir - Where to write the built files.
 */
export async function buildMockApp(outDir: string): Promise<void> {
  await build({
    root: join(import.meta.dirname, 'mock-app'),
    configFile: false,
    logLevel: 'error',
    base: './',
    plugins: [react()],
    build: {
      outDir,
      emptyOutDir: true,
      target: 'es2023',
      sourcemap: false,
      modulePreload: { polyfill: false },
    },
  });
}
