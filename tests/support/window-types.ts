// ------------------------------
// window-types.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import type { HostApi } from '@folio/host-api';
import type { AutomationApi } from '@folio/renderer';

declare global {
  interface Window {
    /** The automation hook, present when the app runs with FOLIO_AUTOMATION=1 or the mock host. */
    __folio?: AutomationApi;
    /** The host bridge the desktop preload script exposes. */
    folioHost?: HostApi;
  }
}
