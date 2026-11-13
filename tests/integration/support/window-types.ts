// ------------------------------
// window-types.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import type { AutomationApi } from '@folio/renderer';

declare global {
  interface Window {
    /** The automation hook the mock-host build turns on. */
    __folio?: AutomationApi;
  }
}
