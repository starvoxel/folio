// ------------------------------
// vite.preload.config.js
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { defineConfig } from 'vite';

/**
 * The bundle of the preload script. A sandboxed preload can require only `electron`, so it is one
 * CommonJS file with the rest inlined.
 */
export default defineConfig({
  build: {
    ssr: 'src/preload/preload.ts',
    outDir: 'dist/preload',
    emptyOutDir: true,
    target: 'node24',
    minify: false,
    sourcemap: false,
    rollupOptions: {
      external: ['electron'],
      output: { format: 'cjs', entryFileNames: 'preload.cjs' },
    },
  },
  ssr: { noExternal: true, target: 'node' },
});
