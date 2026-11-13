// ------------------------------
// playwright.config.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { defineConfig } from '@playwright/test';

/**
 * End-to-end tests (AD-14, AD-16): they drive the packaged release binary, which `npm run package`
 * builds. Traces are off because recording every test is costly; turn them on for one failing
 * test with `--trace on`.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.e2e.ts',
  outputDir: 'test-results/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  reporter: [['list']],
  use: { trace: 'off' },
});
