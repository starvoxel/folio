// ------------------------------
// test-ids.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import type { ThemePreference } from '@folio/core';

import type { PageId } from './pages.js';

/**
 * The `data-testid` convention: lower-case kebab-case, area first, then the thing, for example
 * `nav-overview`, `topbar-undo`, `settings-theme-dark`, `dialog-reset-settings-confirm`. Ids are
 * stable names for test tooling (AD-15); they never change because a label does. A control that
 * tests need gets one id in this file and nowhere else.
 */
export const testIds = {
  nav: (page: PageId): string => `nav-${page}`,
  page: (page: PageId): string => `page-${page}`,
  topBar: {
    menu: 'topbar-menu',
    menuItem: (command: string): string => `topbar-menu-${command}`,
    fileName: 'topbar-file-name',
    saveStatus: 'topbar-save-status',
    undo: 'topbar-undo',
    redo: 'topbar-redo',
    importCsv: 'topbar-import-csv',
    month: 'topbar-month',
  },
  settings: {
    theme: 'settings-theme',
    themeOption: (theme: ThemePreference): string => `settings-theme-${theme}`,
    reset: 'settings-reset',
  },
  dialog: {
    resetSettings: 'dialog-reset-settings',
  },
} as const;
