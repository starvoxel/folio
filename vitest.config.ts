// ------------------------------
// vitest.config.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { defineConfig } from 'vitest/config';

/**
 * One Vitest project per kind of test (AD-14), each runnable on its own with
 * `vitest run --project <name>`. End-to-end tests run under Playwright, not here.
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'architecture',
          include: ['tests/architecture/**/*.test.ts'],
          exclude: ['tests/architecture/fixtures/**'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'unit',
          include: ['packages/*/src/**/*.test.ts', 'apps/*/src/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          environment: 'node',
        },
      },
    ],
  },
});
