// ------------------------------
// browser.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { chromium, type Browser } from '@playwright/test';

/**
 * Start Chromium. Playwright finds its own browser; a machine that has Chromium somewhere else
 * (a container, say) can point FOLIO_CHROMIUM_PATH at it.
 * @returns The running browser.
 */
export async function launchBrowser(): Promise<Browser> {
  const executablePath = process.env['FOLIO_CHROMIUM_PATH'];
  return chromium.launch(executablePath === undefined ? {} : { executablePath });
}
