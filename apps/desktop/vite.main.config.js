// ------------------------------
// vite.main.config.js
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { defineConfig } from 'vite';

/**
 * The bundle of the Electron main process: one CommonJS file with every dependency inlined, so
 * the packaged app needs no node_modules. Only Electron itself and Node's built-in modules stay
 * outside the bundle.
 */
export default defineConfig({
  build: {
    ssr: 'src/main/main.ts',
    outDir: 'dist/main',
    emptyOutDir: true,
    target: 'node24',
    minify: false,
    sourcemap: false,
    rollupOptions: {
      external: ['electron'],
      output: { format: 'cjs', entryFileNames: 'main.cjs' },
    },
  },
  ssr: { noExternal: true, target: 'node' },
});
