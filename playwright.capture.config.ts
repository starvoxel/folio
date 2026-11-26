// ------------------------------
// playwright.capture.config.ts
//
// Author: Starvoxel AI Agent - 2026-11-26
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { defineConfig } from '@playwright/test';

/**
 * The privacy capture (AD-18): one scenario that runs the packaged app while something watches
 * its network use. It has its own config because it takes minutes (the idle phase) and needs the
 * capture environment, so the regular end-to-end run skips it. Run it with
 * `npm run test:capture`; on Linux, `tools/privacy-capture/run-linux.sh` sets up the namespace.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/privacy-capture.e2e.ts',
  outputDir: 'test-results/capture',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 20 * 60_000,
  reporter: [['list']],
  use: { trace: 'off' },
});
