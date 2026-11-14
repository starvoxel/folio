// ------------------------------
// menu-commands.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import type { MenuCommand } from '@folio/host-api';

import { navigateTo, type AppStore } from './app-state.js';

/** The entries of the hamburger menu, in order (H1.14). */
export const MENU_ENTRIES: readonly { readonly command: MenuCommand; readonly label: string }[] = [
  { command: 'new', label: 'New' },
  { command: 'open', label: 'Open' },
  { command: 'save', label: 'Save' },
  { command: 'closeFile', label: 'Close file' },
  { command: 'undo', label: 'Undo' },
  { command: 'redo', label: 'Redo' },
  { command: 'importCsv', label: 'Import CSV' },
  { command: 'settings', label: 'Settings' },
  { command: 'about', label: 'About' },
];

/**
 * Carry out a menu command, from the hamburger menu or the host's native menu. Only Settings does
 * anything yet; the rest arrive with their features and are ignored until then.
 * @param store - The app state.
 * @param command - The command to carry out.
 */
export function handleMenuCommand(store: AppStore, command: MenuCommand): void {
  if (command === 'settings') {
    store.setState((state) => navigateTo(state, 'settings'));
  }
}
