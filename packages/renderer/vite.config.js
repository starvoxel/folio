// ------------------------------
// vite.config.js
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * The production build of the renderer. The desktop app serves `dist/` over its own protocol
 * (AD-18), so every asset path is relative and nothing is loaded from the network.
 */
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2023',
    sourcemap: false,
    modulePreload: { polyfill: false },
    // The bundle loads from disk inside the app, so its size costs memory, not download time.
    chunkSizeWarningLimit: 1500,
  },
});
