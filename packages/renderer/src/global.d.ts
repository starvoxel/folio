// ------------------------------
// global.d.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import type { HostApi } from '@folio/host-api';

import type { AutomationApi } from './app/automation.js';

declare global {
  interface Window {
    /** The host bridge the desktop preload script exposes (AD-19). */
    folioHost?: HostApi;
    /** The automation hook; present only when the app runs with FOLIO_AUTOMATION=1 (AD-16). */
    __folio?: AutomationApi;
  }
}
