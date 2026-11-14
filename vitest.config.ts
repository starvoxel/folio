// ------------------------------
// vitest.config.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * One Vitest project per kind of test (AD-14), each runnable on its own with
 * `vitest run --project <name>`. End-to-end tests run under Playwright, not here.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'architecture',
          include: ['tests/architecture/**/*.test.ts'],
          exclude: ['tests/architecture/fixtures/**'],
          environment: 'node',
        },
      },
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['packages/*/src/**/*.test.{ts,tsx}', 'apps/*/src/**/*.test.{ts,tsx}'],
          environment: 'node',
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          environment: 'node',
          testTimeout: 60_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
